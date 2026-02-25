/**
 * API de Heartbeat para el Bot
 * ============================
 *
 * POST: Recibe telemetry del bot
 * GET: Obtiene el ultimo estado del bot
 */
import { NextRequest, NextResponse } from "next/server";
import { withBotAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { createAlert, ALERT_TYPES } from "@/lib/alerts";

interface HeartbeatData {
  status: string;
  mt5Connected: boolean;
  openPositions: number;
  currentLevel: number;
  currentSide: string | null;
  totalTrades: number;
  totalProfit: number;
  version?: string;
  platform?: string;
  error?: string;
  drawdownPercent?: number;
}

/**
 * POST /api/bot/heartbeat
 * Recibe telemetry del bot
 *
 * Headers: Authorization: Bearer <apiKey>
 * Body: HeartbeatData
 */
export const POST = withBotAuth(async (request, auth) => {
  try {
    const data: HeartbeatData = await request.json();

    // Validar datos requeridos
    if (!data.status) {
      return NextResponse.json(
        { success: false, error: "status es requerido" },
        { status: 400 }
      );
    }

    // Crear registro de heartbeat
    await prisma.botHeartbeat.create({
      data: {
        tenantId: auth.tenantId,
        status: data.status,
        mt5Connected: data.mt5Connected ?? false,
        openPositions: data.openPositions ?? 0,
        currentLevel: data.currentLevel ?? 0,
        currentSide: data.currentSide,
        totalTrades: data.totalTrades ?? 0,
        totalProfit: data.totalProfit ?? 0,
        version: data.version,
        platform: data.platform,
        error: data.error,
      },
    });

    // Actualizar ultimo heartbeat en BotConfig
    await prisma.botConfig.update({
      where: { id: auth.botConfigId },
      data: { lastHeartbeat: new Date() },
    });

    // Crear alertas segun el estado del bot
    // 1. Alerta de error si el status es ERROR
    if (data.status === "ERROR" && data.error) {
      await createAlert(
        auth.tenantId,
        ALERT_TYPES.BOT_ERROR,
        `Tu bot de trading ha reportado un error: ${data.error}`,
        {
          errorMessage: data.error,
          botVersion: data.version,
          platform: data.platform,
        }
      );
    }

    // 2. Alerta de drawdown alto si supera el 20%
    if (data.drawdownPercent && data.drawdownPercent > 20) {
      await createAlert(
        auth.tenantId,
        ALERT_TYPES.HIGH_DRAWDOWN,
        `Advertencia: Drawdown alto detectado (${data.drawdownPercent.toFixed(1)}%). Considera reducir el riesgo.`,
        {
          drawdownPercent: data.drawdownPercent,
        }
      );
    }

    // Verificar si hay comandos pendientes para el bot
    // (por ejemplo: STOP, RESTART, UPDATE_CONFIG)
    // Por ahora devolvemos siempre OK
    return NextResponse.json({
      success: true,
      command: null, // Futuro: "STOP", "RESTART", "UPDATE_CONFIG"
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error procesando heartbeat:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/bot/heartbeat
 * Obtiene el último estado del bot (para dashboard)
 *
 * Headers: Authorization: Bearer <apiKey>
 */
export const GET = withBotAuth(async (request, auth) => {
  try {
    // Obtener último heartbeat
    const lastHeartbeat = await prisma.botHeartbeat.findFirst({
      where: { tenantId: auth.tenantId },
      orderBy: { receivedAt: "desc" },
    });

    // Obtener config para lastHeartbeat
    const botConfig = await prisma.botConfig.findUnique({
      where: { id: auth.botConfigId },
      select: { lastHeartbeat: true },
    });

    return NextResponse.json({
      success: true,
      lastHeartbeat: lastHeartbeat
        ? {
            status: lastHeartbeat.status,
            mt5Connected: lastHeartbeat.mt5Connected,
            openPositions: lastHeartbeat.openPositions,
            currentLevel: lastHeartbeat.currentLevel,
            currentSide: lastHeartbeat.currentSide,
            totalTrades: lastHeartbeat.totalTrades,
            totalProfit: lastHeartbeat.totalProfit,
            version: lastHeartbeat.version,
            platform: lastHeartbeat.platform,
            error: lastHeartbeat.error,
            receivedAt: lastHeartbeat.receivedAt.toISOString(),
          }
        : null,
      configLastHeartbeat: botConfig?.lastHeartbeat?.toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo heartbeat:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
});
