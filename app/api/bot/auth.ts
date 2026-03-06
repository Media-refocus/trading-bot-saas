/**
 * Middleware de autenticación para endpoints del bot
 * Valida API key y proporciona contexto del bot
 * Incluye rate limiting para proteger contra abuso
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractApiKeyFromHeader, validateApiKey } from "@/lib/api-key";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  createRateLimitHeaders,
} from "@/lib/rate-limit";
import { checkAndUpdateExpiredTrial } from "@/lib/plan-gates";
import { decryptCredential } from "@/lib/encryption";

// Cache de bot configs para evitar consultas repetidas
// TTL: 60 segundos
const botConfigCache = new Map<
  string,
  { botConfig: BotConfigContext; cachedAt: number }
>();
const CACHE_TTL_MS = 60 * 1000;

export interface BotConfigContext {
  id: string;
  tenantId: string;
  status: string;
}

export interface BotAuthResult {
  success: true;
  botConfig: BotConfigContext;
}

export interface BotAuthError {
  success: false;
  error: NextResponse;
}

/**
 * Verifica rate limiting antes de procesar la autenticacion
 * Se aplica por IP para proteger contra ataques de fuerza bruta
 */
export function checkBotRateLimit(
  request: NextRequest
): { allowed: true } | { allowed: false; error: NextResponse } {
  const clientIp = getClientIp(request);
  const rateLimitKey = `bot:${clientIp}`;
  const result = checkRateLimit(rateLimitKey, RATE_LIMITS.bot);

  if (!result.allowed) {
    const headers = createRateLimitHeaders(result);
    return {
      allowed: false,
      error: NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Demasiadas solicitudes. Intenta de nuevo en ${result.retryAfter} segundos.`,
          retryAfter: result.retryAfter,
        },
        { status: 429, headers }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Autentica una request del bot usando la API key
 *
 * @param request - NextRequest con header Authorization
 * @returns BotAuthResult si es válido, BotAuthError si no
 *
 * @example
 * const auth = await authenticateBot(request);
 * if (!auth.success) {
 *   return auth.error;
 * }
 * const { botConfig } = auth;
 */
export async function authenticateBot(
  request: NextRequest
): Promise<BotAuthResult | BotAuthError> {
  // Verificar rate limiting primero
  const rateLimitCheck = checkBotRateLimit(request);
  if (!rateLimitCheck.allowed) {
    return { success: false, error: rateLimitCheck.error };
  }

  const authHeader = request.headers.get("authorization");
  const apiKey = extractApiKeyFromHeader(authHeader);

  if (!apiKey) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  // Buscar en cache primero
  const cached = botConfigCache.get(apiKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { success: true, botConfig: cached.botConfig };
  }

  // Buscar todos los bot configs activos
  // Nota: En producción con PostgreSQL, usaríamos un índice específico
  const botConfigs = await prisma.botConfig.findMany({
    select: {
      id: true,
      tenantId: true,
      apiKeyHash: true,
      status: true,
    },
  });

  // Validar API key contra cada hash
  for (const config of botConfigs) {
    const isValid = await validateApiKey(apiKey, config.apiKeyHash);

    if (isValid) {
      const botConfigContext: BotConfigContext = {
        id: config.id,
        tenantId: config.tenantId,
        status: config.status,
      };

      // Check subscription status - auto-pause expired trials
      const subscriptionInfo = await checkAndUpdateExpiredTrial(config.tenantId);

      // If subscription is paused, deny access
      if (subscriptionInfo.status === "PAUSED" || subscriptionInfo.status === "CANCELED") {
        return {
          success: false,
          error: NextResponse.json(
            {
              error: "Subscription paused or expired",
              code: "SUBSCRIPTION_PAUSED",
              message: "Tu suscripción está pausada. Actívala desde el dashboard.",
            },
            { status: 403 }
          ),
        };
      }

      // Validar account number MT4/MT5 (opcional — solo si viene header)
      const mtValidation = await validateMtAccount(request, config.tenantId);
      if (!mtValidation.valid) {
        return { success: false, error: mtValidation.error };
      }

      // Guardar en cache
      botConfigCache.set(apiKey, {
        botConfig: botConfigContext,
        cachedAt: Date.now(),
      });

      return { success: true, botConfig: botConfigContext };
    }
  }

  return {
    success: false,
    error: NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    ),
  };
}

/**
 * Obtiene el config completo del bot desde DB
 */
export async function getFullBotConfig(botConfigId: string) {
  return prisma.botConfig.findUnique({
    where: { id: botConfigId },
    include: {
      BotAccount: {
        where: { isActive: true },
      },
    },
  });
}

/**
 * Valida que el número de cuenta MT4/MT5 del request coincida
 * con algún BotAccount registrado para el tenant.
 *
 * La validación es OPCIONAL: si el header X-MT-Account no está presente
 * (bots MT5 existentes), se permite sin restricción.
 *
 * Si está presente y NO coincide → 403 MT_ACCOUNT_MISMATCH
 *
 * @param request  - NextRequest con posible header X-MT-Account
 * @param tenantId - ID del tenant ya autenticado vía API key
 */
export async function validateMtAccount(
  request: NextRequest,
  tenantId: string
): Promise<{ valid: true } | { valid: false; error: NextResponse }> {
  const mtAccount = request.headers.get("X-MT-Account");

  // Sin header → compatibilidad total con MT5 existente
  if (!mtAccount) {
    return { valid: true };
  }

  // Obtener todas las cuentas activas del tenant
  const botAccounts = await prisma.botAccount.findMany({
    where: {
      BotConfig: { tenantId },
      isActive: true,
    },
    select: { id: true, loginEnc: true },
  });

  // Comparar mt_account con cada loginEnc descifrado
  for (const account of botAccounts) {
    try {
      const decryptedLogin = decryptCredential(account.loginEnc);
      if (decryptedLogin === mtAccount) {
        return { valid: true };
      }
    } catch {
      // Si falla el descifrado de una cuenta, continuamos con las demás
      continue;
    }
  }

  // No coincide ninguna cuenta registrada
  return {
    valid: false,
    error: NextResponse.json(
      {
        error: "Account not authorized",
        code: "MT_ACCOUNT_MISMATCH",
        message:
          "El número de cuenta MT4 no está registrado en tu suscripción TBS. " +
          "Añádelo desde el dashboard antes de usar el EA.",
      },
      { status: 403 }
    ),
  };
}

/**
 * Invalida el cache de autenticación (útil al cambiar API keys)
 */
export function invalidateAuthCache(apiKey?: string) {
  if (apiKey) {
    botConfigCache.delete(apiKey);
  } else {
    botConfigCache.clear();
  }
}

/**
 * Helper para respuestas de error estandarizadas
 */
export function botErrorResponse(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Helper para respuestas exitosas estandarizadas
 */
export function botSuccessResponse<T>(data: T): NextResponse {
  return NextResponse.json({
    success: true,
    ...data,
    timestamp: new Date().toISOString(),
  });
}
