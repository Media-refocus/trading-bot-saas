/**
 * Middleware de autenticación para endpoints del bot
 * Valida API key y proporciona contexto del bot
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractApiKeyFromHeader, validateApiKey } from "@/lib/api-key";

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

  // Obtener versión del bot del header (opcional)
  const botVersion = request.headers.get("x-bot-version") || "unknown";

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
      botAccounts: {
        where: { isActive: true },
      },
    },
  });
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
