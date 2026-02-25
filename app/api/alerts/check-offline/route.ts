/**
 * Endpoint para verificar bots offline y crear alertas
 * =====================================================
 *
 * POST /api/alerts/check-offline
 * Verifica todos los bots y crea alertas para los que no han enviado heartbeat en 5 min
 *
 * Este endpoint debe ser llamado por un cron job cada minuto.
 * En produccion, proteger con un secret header.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAlert, ALERT_TYPES } from "@/lib/alerts";

// Tiempo en ms para considerar un bot offline (5 minutos)
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * POST /api/alerts/check-offline
 * Verifica bots offline y crea alertas
 *
 * Headers opcionales:
 * - X-Cron-Secret: Secret para autorizar el request (recomendado en produccion)
 */
export async function POST(request: NextRequest) {
  try {
    // En produccion, verificar secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const providedSecret = request.headers.get("x-cron-secret");
      if (providedSecret !== cronSecret) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const offlineThreshold = new Date(now.getTime() - OFFLINE_THRESHOLD_MS);

    // Buscar todos los bots activos con lastHeartbeat antiguo o sin heartbeat
    const offlineBots = await prisma.botConfig.findMany({
      where: {
        isActive: true,
        OR: [
          { lastHeartbeat: { lt: offlineThreshold } },
          { lastHeartbeat: null },
        ],
      },
      include: {
        tenant: true,
      },
    });

    let alertsCreated = 0;

    for (const bot of offlineBots) {
      // Verificar si ya existe una alerta BOT_OFFLINE no leida
      const existingAlert = await prisma.alert.findFirst({
        where: {
          tenantId: bot.tenantId,
          type: ALERT_TYPES.BOT_OFFLINE,
          read: false,
        },
      });

      if (!existingAlert) {
        const lastSeen = bot.lastHeartbeat
          ? bot.lastHeartbeat.toLocaleString("es-ES")
          : "nunca";

        await createAlert(
          bot.tenantId,
          ALERT_TYPES.BOT_OFFLINE,
          `Tu bot de trading esta offline. Ultima conexion: ${lastSeen}`,
          {
            lastHeartbeat: bot.lastHeartbeat?.toISOString(),
            botConfigId: bot.id,
          }
        );
        alertsCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: offlineBots.length,
      alertsCreated,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Error verificando bots offline:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
