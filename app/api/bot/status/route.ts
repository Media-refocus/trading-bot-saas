import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/bot/status
 * Obtiene el estado completo del bot para el dashboard
 * (autenticación por sesión de usuario)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenant: {
          include: {
            botConfigs: true,
            botHeartbeats: {
              orderBy: { receivedAt: "desc" },
              take: 100, // Últimos 100 heartbeats
            },
            positions: {
              where: { status: "OPEN" },
              orderBy: { openedAt: "desc" },
            },
          },
        },
      },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];

    if (!botConfig) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: "Bot no configurado",
      });
    }

    // Último heartbeat
    const lastHeartbeat = user.tenant.botHeartbeats[0];

    // Determinar si está online (heartbeat en los últimos 2 minutos)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const isOnline = lastHeartbeat && new Date(lastHeartbeat.receivedAt) > twoMinutesAgo;

    // Posiciones abiertas
    const openPositions = user.tenant.positions;

    // Métricas del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayHeartbeats = user.tenant.botHeartbeats.filter(
      (h) => new Date(h.receivedAt) >= today
    );

    // Calcular métricas
    let todayTrades = 0;
    let todayProfit = 0;
    if (todayHeartbeats.length > 0) {
      const first = todayHeartbeats[todayHeartbeats.length - 1];
      const last = todayHeartbeats[0];
      todayTrades = last.totalTrades - first.totalTrades;
      todayProfit = last.totalProfit - first.totalProfit;
    }

    // Historial de heartbeats para gráfico (últimas 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const heartbeatHistory = user.tenant.botHeartbeats
      .filter((h) => new Date(h.receivedAt) >= oneDayAgo)
      .map((h) => ({
        time: h.receivedAt.toISOString(),
        profit: h.totalProfit,
        trades: h.totalTrades,
        status: h.status,
      }))
      .reverse(); // Orden cronológico

    return NextResponse.json({
      success: true,
      configured: true,

      // Estado de conexión
      connection: {
        isOnline,
        lastSeen: lastHeartbeat?.receivedAt.toISOString() || null,
        status: lastHeartbeat?.status || "UNKNOWN",
        mt5Connected: lastHeartbeat?.mt5Connected ?? false,
        error: lastHeartbeat?.error || null,
        platform: lastHeartbeat?.platform || null,
        version: lastHeartbeat?.version || null,
      },

      // Posiciones abiertas
      positions: openPositions.map((p) => ({
        id: p.id,
        side: p.side,
        symbol: p.symbol,
        lotSize: p.lotSize,
        openPrice: p.openPrice,
        currentPrice: null, // Se actualiza en tiempo real en el cliente
        level: p.level,
        openedAt: p.openedAt.toISOString(),
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
      })),

      // Métricas
      metrics: {
        todayTrades,
        todayProfit,
        totalTrades: lastHeartbeat?.totalTrades || 0,
        totalProfit: lastHeartbeat?.totalProfit || 0,
        openPositions: openPositions.length,
        currentLevel: lastHeartbeat?.currentLevel || 0,
        currentSide: lastHeartbeat?.currentSide || null,
      },

      // Historial para gráficos
      history: heartbeatHistory,

      // Configuración actual
      config: {
        lotSize: botConfig.lotSize,
        maxLevels: botConfig.maxLevels,
        gridDistance: botConfig.gridDistance,
        takeProfit: botConfig.takeProfit,
        isActive: botConfig.isActive,
      },
    });
  } catch (error) {
    console.error("Error obteniendo status:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
