/**
 * Helper para crear alertas desde otros modulos
 * ==============================================
 *
 * Uso:
 *   import { createAlert, ALERT_TYPES } from "@/lib/alerts";
 *   await createAlert(tenantId, ALERT_TYPES.BOT_OFFLINE, "El bot esta offline");
 */
import { prisma } from "@/lib/prisma";

export const ALERT_TYPES = {
  BOT_OFFLINE: "BOT_OFFLINE",
  BOT_ERROR: "BOT_ERROR",
  HIGH_DRAWDOWN: "HIGH_DRAWDOWN",
  SUBSCRIPTION_EXPIRING: "SUBSCRIPTION_EXPIRING",
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];

interface AlertMetadata {
  botVersion?: string;
  platform?: string;
  errorMessage?: string;
  drawdownPercent?: number;
  daysUntilExpiry?: number;
  [key: string]: unknown;
}

/**
 * Crea una alerta para un tenant
 *
 * @param tenantId - ID del tenant
 * @param type - Tipo de alerta
 * @param message - Mensaje descriptivo
 * @param metadata - Datos adicionales (opcional)
 * @returns La alerta creada o null si hay error
 */
export async function createAlert(
  tenantId: string,
  type: AlertType,
  message: string,
  metadata?: AlertMetadata
) {
  try {
    // Verificar que el tenant existe
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      console.error(`[Alerts] Tenant no encontrado: ${tenantId}`);
      return null;
    }

    // Verificar si ya existe una alerta similar no leida en las ultimas 24 horas
    // para evitar spam de alertas
    const existingAlert = await prisma.alert.findFirst({
      where: {
        tenantId,
        type,
        read: false,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 horas
        },
      },
    });

    if (existingAlert) {
      console.log(`[Alerts] Alerta duplicada ignorada para tenant ${tenantId}: ${type}`);
      return existingAlert;
    }

    const alert = await prisma.alert.create({
      data: {
        tenantId,
        type,
        message,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });

    console.log(`[Alerts] Alerta creada para tenant ${tenantId}: ${type} - ${message}`);
    return alert;
  } catch (error) {
    console.error("[Alerts] Error creando alerta:", error);
    return null;
  }
}

/**
 * Mensajes predefinidos para cada tipo de alerta
 */
export const ALERT_MESSAGES = {
  BOT_OFFLINE: "Tu bot de trading esta offline. No se ha recibido heartbeat en mas de 5 minutos.",
  BOT_ERROR: "Tu bot de trading ha reportado un error.",
  HIGH_DRAWDOWN: (percent: number) => `Advertencia: Drawdown alto detectado (${percent.toFixed(1)}%).`,
  SUBSCRIPTION_EXPIRING: (days: number) => `Tu suscripcion vence en ${days} dias. Renuevala para continuar operando.`,
};
