/**
 * Sistema de Seguridad - API Key Management
 * ===========================================
 *
 * Funciones para gestionar API keys de forma segura:
 * - Generación con hash SHA-256
 * - Validación de estado y suscripción
 * - Rate limiting
 * - Auditoría
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ───────────────────────── CONSTANTES ─────────────────────────

export const API_KEY_PREFIX = "tb";
export const API_KEY_LIVE_PREFIX = "tb_live";
export const API_KEY_TEST_PREFIX = "tb_test";
export const API_KEY_LENGTH = 32;

// Estados de API key
export type ApiKeyStatus = "ACTIVE" | "PAUSED" | "REVOKED" | "EXPIRED" | "GRACE_PERIOD";

// Eventos de auditoría
export type AuditEvent =
  | "API_KEY_GENERATED"
  | "API_KEY_REVOKED"
  | "API_KEY_ROTATED"
  | "API_KEY_ACCESSED"
  | "API_KEY_REJECTED"
  | "RATE_LIMIT_EXCEEDED"
  | "SUSPICIOUS_ACTIVITY"
  | "IP_BLOCKED";

// Rate limits por endpoint
export const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/bot/signals": { limit: 30, windowMs: 60 * 1000 },
  "/api/bot/heartbeat": { limit: 120, windowMs: 60 * 60 * 1000 },
  "/api/bot/config": { limit: 60, windowMs: 60 * 60 * 1000 },
  "/api/bot/auth": { limit: 10, windowMs: 60 * 1000 },
  "default": { limit: 1000, windowMs: 60 * 60 * 1000 },
};

// ───────────────────────── GENERACIÓN ─────────────────────────

/**
 * Genera una nueva API key segura
 * Formato: tb_live_<32 chars hex> o tb_test_<32 chars hex>
 */
export function generateApiKey(isTest: boolean = false): string {
  const prefix = isTest ? API_KEY_TEST_PREFIX : API_KEY_LIVE_PREFIX;
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const key = randomBytes.toString("hex");
  return `${prefix}_${key}`;
}

/**
 * Hashea una API key con SHA-256 para almacenar en BD
 * NUNCA almacenar API keys en texto plano
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Verifica si una API key tiene el formato correcto
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  const pattern = /^tb_(live|test)_[a-f0-9]{64}$/;
  return pattern.test(apiKey);
}

// ───────────────────────── VALIDACIÓN ─────────────────────────

export interface ValidationResult {
  valid: boolean;
  reason?:
    | "INVALID_FORMAT"
    | "API_KEY_NOT_FOUND"
    | "API_KEY_REVOKED"
    | "API_KEY_EXPIRED"
    | "SUBSCRIPTION_INACTIVE"
    | "SUBSCRIPTION_EXPIRED"
    | "GRACE_PERIOD_EXPIRED"
    | "RATE_LIMIT_EXCEEDED";
  tenantId?: string;
  botConfigId?: string;
  planId?: string;
  planName?: string;
  maxLevels?: number;
  maxPositions?: number;
  hasTrailingSL?: boolean;
}

/**
 * Valida una API key y su suscripción asociada
 *
 * Flujo:
 * 1. Verificar formato
 * 2. Buscar en BD por hash
 * 3. Verificar estado de la key
 * 4. Verificar suscripción activa
 * 5. Verificar periodo de gracia si aplica
 * 6. Verificar rate limit
 */
export async function validateApiKey(
  apiKey: string,
  endpoint: string,
  ipAddress?: string
): Promise<ValidationResult> {
  // 1. Verificar formato
  if (!isValidApiKeyFormat(apiKey)) {
    await logAuditEvent({
      event: "API_KEY_REJECTED",
      metadata: { reason: "INVALID_FORMAT" },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  // 2. Buscar en BD por hash
  const hashedKey = hashApiKey(apiKey);
  const botConfig = await prisma.botConfig.findUnique({
    where: { apiKey: hashedKey },
    include: {
      tenant: {
        include: {
          plan: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!botConfig) {
    await logAuditEvent({
      event: "API_KEY_REJECTED",
      metadata: { reason: "API_KEY_NOT_FOUND" },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "API_KEY_NOT_FOUND" };
  }

  // 3. Verificar estado de la key
  if (botConfig.apiKeyStatus === "REVOKED") {
    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_REJECTED",
      metadata: { reason: "API_KEY_REVOKED" },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "API_KEY_REVOKED" };
  }

  if (botConfig.apiKeyStatus === "EXPIRED") {
    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_REJECTED",
      metadata: { reason: "API_KEY_EXPIRED" },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "API_KEY_EXPIRED" };
  }

  // 4. Verificar suscripción activa
  const activeSubscription = botConfig.tenant.subscriptions[0];
  const plan = botConfig.tenant.plan;

  if (!activeSubscription) {
    // Verificar periodo de gracia (3 dias despues de vencer)
    const gracePeriodEnd = botConfig.apiKeyExpiresAt;
    if (gracePeriodEnd && new Date() < gracePeriodEnd) {
      // En periodo de gracia, permitir pero loguear
      await logAuditEvent({
        botConfigId: botConfig.id,
        event: "API_KEY_ACCESSED",
        metadata: { gracePeriod: true },
        ipAddress,
        endpoint,
      });

      return {
        valid: true,
        tenantId: botConfig.tenantId,
        botConfigId: botConfig.id,
        planId: plan?.id,
        planName: plan?.name || "Sin plan",
        maxLevels: plan?.maxLevels ?? 3,
        maxPositions: plan?.maxPositions ?? 1,
        hasTrailingSL: plan?.hasTrailingSL ?? true,
      };
    }

    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_REJECTED",
      metadata: { reason: "SUBSCRIPTION_INACTIVE" },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "SUBSCRIPTION_INACTIVE" };
  }

  // Verificar si la suscripcion ha expirado
  if (activeSubscription.currentPeriodEnd && new Date() > activeSubscription.currentPeriodEnd) {
    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_REJECTED",
      metadata: {
        reason: "SUBSCRIPTION_EXPIRED",
        expiredAt: activeSubscription.currentPeriodEnd,
      },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "SUBSCRIPTION_EXPIRED" };
  }

  // 5. Verificar rate limit
  const rateLimitResult = await checkRateLimit(botConfig, endpoint);
  if (!rateLimitResult.allowed) {
    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "RATE_LIMIT_EXCEEDED",
      metadata: {
        endpoint,
        count: rateLimitResult.count,
        limit: rateLimitResult.limit,
      },
      ipAddress,
      endpoint,
    });
    return { valid: false, reason: "RATE_LIMIT_EXCEEDED" };
  }

  // Incrementar contador de requests
  await incrementRequestCount(botConfig);

  // Log acceso exitoso (solo cada 100 requests para no saturar)
  if (botConfig.requestCount % 100 === 0) {
    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_ACCESSED",
      metadata: { requestCount: botConfig.requestCount },
      ipAddress,
      endpoint,
    });
  }

  return {
    valid: true,
    tenantId: botConfig.tenantId,
    botConfigId: botConfig.id,
    planId: plan?.id,
    planName: plan?.name || "Sin plan",
    maxLevels: plan?.maxLevels ?? 3,
    maxPositions: plan?.maxPositions ?? 1,
    hasTrailingSL: plan?.hasTrailingSL ?? true,
  };
}

// ───────────────────────── RATE LIMITING ─────────────────────────

interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetIn?: number;
}

/**
 * Verifica si el tenant ha excedido el rate limit
 */
async function checkRateLimit(
  botConfig: { id: string; requestCount: number; rateLimitResetAt: Date | null },
  endpoint: string
): Promise<RateLimitResult> {
  const now = new Date();
  const limits = RATE_LIMITS[endpoint] || RATE_LIMITS["default"];

  // Resetear contador si ha pasado la ventana de tiempo
  if (botConfig.rateLimitResetAt && now > botConfig.rateLimitResetAt) {
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        requestCount: 0,
        rateLimitResetAt: new Date(now.getTime() + limits.windowMs),
      },
    });
    return { allowed: true, count: 0, limit: limits.limit };
  }

  // Inicializar rate limit reset si no existe
  if (!botConfig.rateLimitResetAt) {
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        rateLimitResetAt: new Date(now.getTime() + limits.windowMs),
      },
    });
  }

  // Verificar si ha excedido el limite
  if (botConfig.requestCount >= limits.limit) {
    const resetIn = botConfig.rateLimitResetAt
      ? botConfig.rateLimitResetAt.getTime() - now.getTime()
      : limits.windowMs;

    return {
      allowed: false,
      count: botConfig.requestCount,
      limit: limits.limit,
      resetIn: Math.max(0, resetIn),
    };
  }

  return {
    allowed: true,
    count: botConfig.requestCount,
    limit: limits.limit,
  };
}

/**
 * Incrementa el contador de requests
 */
async function incrementRequestCount(
  botConfig: { id: string; requestCount: number }
): Promise<void> {
  await prisma.botConfig.update({
    where: { id: botConfig.id },
    data: {
      requestCount: botConfig.requestCount + 1,
      lastHeartbeat: new Date(),
    },
  });
}

// ───────────────────────── AUDITORÍA ─────────────────────────

interface AuditLogParams {
  botConfigId?: string;
  event: AuditEvent;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
}

/**
 * Registra un evento de auditoría
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await prisma.apiKeyAudit.create({
      data: {
        botConfigId: params.botConfigId || "SYSTEM",
        event: params.event,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        endpoint: params.endpoint,
      },
    });
  } catch (error) {
    // No fallar el request si falla el log
    console.error("Error logging audit event:", error);
  }
}

// ───────────────────────── GESTIÓN DE API KEYS ─────────────────────────

interface CreateApiKeyResult {
  success: boolean;
  apiKey?: string;
  error?: string;
}

/**
 * Crea una nueva API key para un tenant
 * IMPORTANTE: La API key en texto plano solo se devuelve UNA vez
 */
export async function createApiKeyForTenant(tenantId: string): Promise<CreateApiKeyResult> {
  try {
    // Generar nueva key
    const apiKeyPlain = generateApiKey(false);
    const apiKeyHash = hashApiKey(apiKeyPlain);

    // Verificar si ya existe config
    const existing = await prisma.botConfig.findUnique({
      where: { tenantId },
    });

    if (existing) {
      // Actualizar existente
      await prisma.botConfig.update({
        where: { id: existing.id },
        data: {
          apiKey: apiKeyHash,
          apiKeyPlain: apiKeyPlain, // Solo temporal para mostrar
          apiKeyStatus: "ACTIVE",
          apiKeyCreatedAt: new Date(),
          apiKeyRotatedAt: existing.apiKey ? new Date() : null,
          requestCount: 0,
          rateLimitResetAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Log auditoría
      await logAuditEvent({
        botConfigId: existing.id,
        event: existing.apiKey ? "API_KEY_ROTATED" : "API_KEY_GENERATED",
        metadata: { tenantId },
      });
    } else {
      // Crear nuevo config
      const newConfig = await prisma.botConfig.create({
        data: {
          tenantId,
          apiKey: apiKeyHash,
          apiKeyPlain, // Solo temporal para mostrar
          apiKeyStatus: "ACTIVE",
          apiKeyCreatedAt: new Date(),
          requestCount: 0,
          rateLimitResetAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Log auditoría
      await logAuditEvent({
        botConfigId: newConfig.id,
        event: "API_KEY_GENERATED",
        metadata: { tenantId },
      });
    }

    return {
      success: true,
      apiKey: apiKeyPlain, // Cliente debe guardar esto!
    };
  } catch (error) {
    console.error("Error creating API key:", error);
    return {
      success: false,
      error: "Error interno al generar API key",
    };
  }
}

/**
 * Revoca una API key
 */
export async function revokeApiKey(
  tenantId: string,
  reason: string = "USER_REQUEST"
): Promise<boolean> {
  try {
    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
    });

    if (!botConfig) {
      return false;
    }

    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        apiKeyStatus: "REVOKED",
        apiKeyPlain: null, // Limpiar key en plano
        isActive: false,
      },
    });

    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_REVOKED",
      metadata: { reason },
    });

    return true;
  } catch (error) {
    console.error("Error revoking API key:", error);
    return false;
  }
}

/**
 * Pausa una API key (ej: pago pendiente)
 */
export async function pauseApiKey(
  tenantId: string,
  reason: string = "PAYMENT_PENDING"
): Promise<boolean> {
  try {
    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
    });

    if (!botConfig) {
      return false;
    }

    // Calcular fecha de expiración del periodo de gracia (3 dias)
    const gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        apiKeyStatus: "PAUSED",
        apiKeyExpiresAt: gracePeriodEnd,
        isActive: false,
      },
    });

    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_REVOKED",
      metadata: { reason, gracePeriodEnd },
    });

    return true;
  } catch (error) {
    console.error("Error pausing API key:", error);
    return false;
  }
}

/**
 * Reactiva una API key después de pago exitoso
 */
export async function reactivateApiKey(tenantId: string): Promise<boolean> {
  try {
    const botConfig = await prisma.botConfig.findUnique({
      where: { tenantId },
    });

    if (!botConfig) {
      return false;
    }

    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: {
        apiKeyStatus: "ACTIVE",
        apiKeyExpiresAt: null,
        isActive: true,
      },
    });

    await logAuditEvent({
      botConfigId: botConfig.id,
      event: "API_KEY_ACCESSED",
      metadata: { reason: "PAYMENT_RECEIVED" },
    });

    return true;
  } catch (error) {
    console.error("Error reactivating API key:", error);
    return false;
  }
}

/**
 * Limpia la API key en texto plano después de mostrarla al usuario
 * LLAMAR ESTO DESPUÉS DE MOSTRAR LA KEY UNA VEZ
 */
export async function clearPlainApiKey(tenantId: string): Promise<void> {
  await prisma.botConfig.updateMany({
    where: { tenantId },
    data: { apiKeyPlain: null },
  });
}
