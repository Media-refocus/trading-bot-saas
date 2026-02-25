import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/bot/status
 * Obtiene el estado completo del bot para el dashboard
 * (autenticacion por sesion de usuario)
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
              take: 1000, // Ultimos 1000 heartbeats para historico
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

    // Ultimo heartbeat
    const lastHeartbeat = user.tenant.botHeartbeats[0];

    // Determinar si esta online (heartbeat en los ultimos 2 minutos)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const isOnline = lastHeartbeat && new Date(lastHeartbeat.receivedAt) > twoMinutesAgo;

    // Posiciones abiertas
    const openPositions = user.tenant.positions;

    // Metricas del dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayHeartbeats = user.tenant.botHeartbeats.filter(
      (h) => new Date(h.receivedAt) >= today
    );

    // Calcular metricas de hoy
    let todayTrades = 0;
    let todayProfit = 0;
    if (todayHeartbeats.length > 0) {
      const first = todayHeartbeats[todayHeartbeats.length - 1];
      const last = todayHeartbeats[0];
      todayTrades = last.totalTrades - first.totalTrades;
      todayProfit = last.totalProfit - first.totalProfit;
    }

    // Historial de heartbeats para grafico (ultimas 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const heartbeatHistory = user.tenant.botHeartbeats
      .filter((h) => new Date(h.receivedAt) >= oneDayAgo)
      .map((h) => ({
        time: h.receivedAt.toISOString(),
        profit: h.totalProfit,
        trades: h.totalTrades,
        status: h.status,
      }))
      .reverse(); // Orden cronologico

    // ============================================
    // DATOS HISTORICOS PARA GRAFICOS (ULTIMOS 7 DIAS)
    // ============================================

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Agrupar heartbeats por dia
    const heartbeatsByDay: Record<string, typeof user.tenant.botHeartbeats> = {};

    for (const h of user.tenant.botHeartbeats) {
      const date = new Date(h.receivedAt);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split("T")[0];

      if (new Date(dateKey) >= sevenDaysAgo) {
        if (!heartbeatsByDay[dateKey]) {
          heartbeatsByDay[dateKey] = [];
        }
        heartbeatsByDay[dateKey].push(h);
      }
    }

    // Generar array de ultimos 7 dias con datos
    const profitChartData: Array<{ date: string; profit: number; cumulative: number }> = [];
    const tradesChartData: Array<{ date: string; trades: number; wins: number; losses: number }> = [];

    let cumulativeProfit = 0;

    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split("T")[0];
      const dayName = date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

      const dayHeartbeats = heartbeatsByDay[dateKey] || [];

      // Calcular profit del dia
      let dayProfit = 0;
      let dayStartTrades = 0;
      let dayEndTrades = 0;

      if (dayHeartbeats.length > 0) {
        const first = dayHeartbeats[dayHeartbeats.length - 1];
        const last = dayHeartbeats[0];
        dayProfit = last.totalProfit - first.totalProfit;
        dayStartTrades = first.totalTrades;
        dayEndTrades = last.totalTrades;
        cumulativeProfit = last.totalProfit;
      }

      const dayTrades = dayEndTrades - dayStartTrades;

      profitChartData.push({
        date: dayName,
        profit: dayProfit,
        cumulative: cumulativeProfit,
      });

      tradesChartData.push({
        date: dayName,
        trades: dayTrades,
        // Aproximacion de wins/losses basada en profit del dia
        wins: dayProfit >= 0 ? dayTrades : Math.max(0, Math.floor(dayTrades * 0.4)),
        losses: dayProfit < 0 ? dayTrades : Math.max(0, Math.floor(dayTrades * 0.4)),
      });
    }

    // ============================================
    // ESTADISTICAS DE WIN RATE
    // ============================================

    // Obtener posiciones cerradas para calcular win rate real
    const closedPositions = await prisma.position.findMany({
      where: {
        tenantId: user.tenant.id,
        status: "CLOSED",
        closedAt: { gte: sevenDaysAgo },
      },
      select: {
        profitMoney: true,
      },
    });

    const winningTrades = closedPositions.filter((p) => (p.profitMoney ?? 0) > 0).length;
    const losingTrades = closedPositions.filter((p) => (p.profitMoney ?? 0) < 0).length;
    const totalClosedTrades = closedPositions.length;

    // Calcular promedios
    const totalWinProfit = closedPositions
      .filter((p) => (p.profitMoney ?? 0) > 0)
      .reduce((sum, p) => sum + (p.profitMoney ?? 0), 0);
    const totalLossProfit = closedPositions
      .filter((p) => (p.profitMoney ?? 0) < 0)
      .reduce((sum, p) => sum + (p.profitMoney ?? 0), 0);

    const avgProfit = winningTrades > 0 ? totalWinProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLossProfit / losingTrades : 0;

    const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;

    return NextResponse.json({
      success: true,
      configured: true,

      // Estado de conexion
      connection: {
        isOnline,
        lastSeen: lastHeartbeat?.receivedAt.toISOString() || null,
        status: lastHeartbeat?.status || "UNKNOWN",
        mt5Connected: lastHeartbeat?.mt5Connected ?? false,
        error: lastHeartbeat?.error || null,
        platform: lastHeartbeat?.platform || null,
        version: lastHeartbeat?.version || null,
      },

      // Estado de seguridad
      security: {
        apiKeyStatus: botConfig.apiKeyStatus,
        apiKeyCreatedAt: botConfig.apiKeyCreatedAt?.toISOString() || null,
        lastRotation: botConfig.apiKeyRotatedAt?.toISOString() || null,
        requestCount: botConfig.requestCount,
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

      // Metricas
      metrics: {
        todayTrades,
        todayProfit,
        totalTrades: lastHeartbeat?.totalTrades || 0,
        totalProfit: lastHeartbeat?.totalProfit || 0,
        openPositions: openPositions.length,
        currentLevel: lastHeartbeat?.currentLevel || 0,
        currentSide: lastHeartbeat?.currentSide || null,
      },

      // Historial para graficos (24h)
      history: heartbeatHistory,

      // Datos para graficos historicos (7 dias)
      charts: {
        profit: profitChartData,
        trades: tradesChartData,
        winRate: {
          winRate,
          totalTrades: totalClosedTrades,
          winningTrades,
          losingTrades,
          avgProfit,
          avgLoss,
        },
      },

      // Configuracion actual
      config: {
        lotSize: botConfig.lotSize,
        maxLevels: botConfig.maxLevels,
        gridDistance: botConfig.gridDistance,
        takeProfit: botConfig.takeProfit,
        isActive: botConfig.isActive,
        paperTradingMode: botConfig.paperTradingMode,
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
