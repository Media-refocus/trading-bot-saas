/**
 * Middleware de Autenticación para API del Bot
 * =============================================
 *
 * Valida API key + suscripción activa en cada request
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  ValidationResult,
  logAuditEvent,
} from "./api-key";

// ───────────────────────── HEADERS ─────────────────────────

export const AUTH_HEADERS = {
  RATE_LIMIT_LIMIT: "X-RateLimit-Limit",
  RATE_LIMIT_REMAINING: "X-RateLimit-Remaining",
  RATE_LIMIT_RESET: "X-RateLimit-Reset",
  REQUEST_ID: "X-Request-ID",
} as const;

// ───────────────────────── TIPOS ─────────────────────────

export interface AuthenticatedRequest extends NextRequest {
  auth: ValidationResult & { valid: true };
}

// ───────────────────────── FUNCIONES HELPER ─────────────────────────

/**
 * Extrae la API key del header Authorization
 * Formato: "Bearer tb_live_xxxx" o "tb_live_xxxx"
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  // Formato: "Bearer tb_live_xxx"
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // Formato directo: "tb_live_xxx"
  if (authHeader.startsWith("tb_")) {
    return authHeader.trim();
  }

  return null;
}

/**
 * Obtiene información del request para logging
 */
function getRequestContext(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown",
    userAgent: request.headers.get("user-agent") || undefined,
    endpoint: request.nextUrl.pathname,
  };
}

/**
 * Genera headers de rate limit para la respuesta
 */
function getRateLimitHeaders(validation: ValidationResult): Record<string, string> {
  // TODO: Implementar tracking real de rate limit
  return {
    [AUTH_HEADERS.RATE_LIMIT_LIMIT]: "1000",
    [AUTH_HEADERS.RATE_LIMIT_REMAINING]: "999",
    [AUTH_HEADERS.RATE_LIMIT_RESET]: String(Math.floor(Date.now() / 1000) + 3600),
  };
}

// ───────────────────────── MIDDLEWARE ─────────────────────────

/**
 * Middleware de autenticación para endpoints del bot
 *
 * Uso:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const auth = await authenticateBotRequest(request);
 *   if (!auth.valid) {
 *     return auth.response; // 401/403 response
 *   }
 *   // auth.tenantId, auth.botConfigId disponibles
 * }
 * ```
 */
export async function authenticateBotRequest(
  request: NextRequest
): Promise<
  | { valid: true; tenantId: string; botConfigId: string; response?: never; planLimits: ValidationResult }
  | { valid: false; response: NextResponse; tenantId?: never; botConfigId?: never; planLimits?: never }
> {
  const context = getRequestContext(request);

  // 1. Extraer API key
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    await logAuditEvent({
      event: "API_KEY_REJECTED",
      metadata: { reason: "MISSING_API_KEY" },
      ...context,
    });

    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Authorization header requerido",
          code: "MISSING_AUTH",
        },
        { status: 401 }
      ),
    };
  }

  // 2. Validar API key + suscripción
  const validation = await validateApiKey(
    apiKey,
    context.endpoint,
    context.ipAddress
  );

  if (!validation.valid) {
    const statusCode =
      validation.reason === "RATE_LIMIT_EXCEEDED" ? 429 : 401;

    // Mapear reason a codigo de error
    const errorCode: Record<string, string> = {
      INVALID_FORMAT: "INVALID_KEY_FORMAT",
      API_KEY_NOT_FOUND: "INVALID_API_KEY",
      API_KEY_REVOKED: "KEY_REVOKED",
      API_KEY_EXPIRED: "KEY_EXPIRED",
      SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_REQUIRED",
      SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
      GRACE_PERIOD_EXPIRED: "GRACE_PERIOD_EXPIRED",
      RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    };

    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: getErrorMessage(validation.reason),
          code: errorCode[validation.reason || "INVALID_API_KEY"],
          tenantId: validation.tenantId,
        },
        {
          status: statusCode,
          headers: statusCode === 429 ? getRateLimitHeaders(validation) : undefined,
        }
      ),
    };
  }

  // 3. Retornar datos de autenticación
  return {
    valid: true,
    tenantId: validation.tenantId!,
    botConfigId: validation.botConfigId!,
    planLimits: validation,
  };
}

/**
 * Mensajes de error user-friendly
 */
function getErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    INVALID_FORMAT: "Formato de API key invalido",
    API_KEY_NOT_FOUND: "API key no encontrada",
    API_KEY_REVOKED: "API key revocada. Genera una nueva desde el dashboard.",
    API_KEY_EXPIRED: "API key expirada. Renueva tu suscripcion.",
    SUBSCRIPTION_INACTIVE: "Suscripcion inactiva. Activa tu plan para continuar.",
    SUBSCRIPTION_EXPIRED: "Suscripcion vencida. Renueva para continuar operando.",
    GRACE_PERIOD_EXPIRED: "Periodo de gracia finalizado. Renueva tu suscripcion.",
    RATE_LIMIT_EXCEEDED: "Limite de requests excedido. Espera un momento.",
  };

  return messages[reason || "API_KEY_NOT_FOUND"] || "Error de autenticacion";
}

// ───────────────────────── DECORATOR PARA ROUTES ─────────────────────────

/**
 * Decorator para proteger endpoints del bot
 *
 * Uso:
 * ```ts
 * export const GET = withBotAuth(async (request, auth) => {
 *   // auth.tenantId, auth.botConfigId disponibles
 *   return NextResponse.json({ data: "protected" });
 * });
 * ```
 */
export function withBotAuth(
  handler: (
    request: NextRequest,
    auth: { valid: true; tenantId: string; botConfigId: string; planLimits: ValidationResult }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const auth = await authenticateBotRequest(request);

    if (!auth.valid) {
      return auth.response;
    }

    return handler(request, {
      valid: true,
      tenantId: auth.tenantId,
      botConfigId: auth.botConfigId,
      planLimits: auth.planLimits,
    });
  };
}

// ───────────────────────── VALIDACIÓN DE LÍMITES ─────────────────────────

/**
 * Valida que una acción esté dentro de los límites del plan
 */
export function validatePlanLimit(
  auth: { valid: true; planLimits: ValidationResult },
  limitType: "maxLevels" | "maxPositions",
  requestedValue: number
): { allowed: boolean; reason?: string } {
  const { planLimits } = auth;

  if (limitType === "maxLevels") {
    const maxLevels = planLimits.maxLevels ?? 3;
    if (requestedValue > maxLevels) {
      return {
        allowed: false,
        reason: `Plan limitado a ${maxLevels} niveles. Solicitaste: ${requestedValue}`,
      };
    }
  }

  if (limitType === "maxPositions") {
    const maxPositions = planLimits.maxPositions ?? 1;
    if (requestedValue > maxPositions) {
      return {
        allowed: false,
        reason: `Plan limitado a ${maxPositions} posicion(es). Solicitaste: ${requestedValue}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Valida acceso a feature según plan
 */
export function validatePlanFeature(
  auth: { valid: true; planLimits: ValidationResult },
  feature: "trailingSL" | "advancedGrid" | "multiSymbol" | "priority"
): { allowed: boolean; reason?: string } {
  const { planLimits } = auth;

  if (feature === "trailingSL" && !planLimits.hasTrailingSL) {
    return {
      allowed: false,
      reason: "Trailing SL no disponible en tu plan. Actualiza a Pro.",
    };
  }

  // TODO: Añadir más features según plan

  return { allowed: true };
}
