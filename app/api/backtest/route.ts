/**
 * POST /api/backtest
 *
 * API Route para ejecutar backtests leyendo datos de Supabase (PostgreSQL via Prisma)
 * en lugar de archivos CSV locales.
 *
 * Requiere autenticación y filtra datos por tenantId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  PriceTick,
  Side,
} from "@/lib/backtest-engine";
import { generateSyntheticTicks } from "@/lib/parsers/signals-csv";
import {
  filterSignals,
  getSegmentationStats,
} from "@/lib/backtest-filters";

// ==================== TIPOS ====================

interface BacktestRequest {
  // Parámetros de estrategia
  strategyName?: string;
  lotajeBase?: number;
  numOrders?: number;
  pipsDistance?: number;
  maxLevels?: number;
  takeProfitPips?: number;
  stopLossPips?: number;
  useStopLoss?: boolean;
  useTrailingSL?: boolean;
  trailingSLPercent?: number;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
  initialCapital?: number;

  // Filtros de fecha (obligatorios para limitar datos)
  dateFrom: string;  // ISO string
  dateTo: string;    // ISO string

  // Filtros opcionales
  filters?: {
    daysOfWeek?: number[];
    hourFrom?: number;
    hourTo?: number;
    session?: "ASIAN" | "EUROPEAN" | "US" | "ALL";
    side?: "BUY" | "SELL";
  };

  // Opciones
  useRealPrices?: boolean;  // Si true, intenta usar ticks reales de TickData
  signalLimit?: number;     // Limitar cantidad de señales
}

// Sesiones de trading por hora (UTC)
const TRADING_SESSIONS = {
  ASIAN: { start: 0, end: 8 },
  EUROPEAN: { start: 8, end: 16 },
  US: { start: 13, end: 21 },
  ALL: { start: 0, end: 24 },
};

// ==================== HELPERS ====================

/**
 * Convierte una señal de Prisma al formato esperado por el backtest engine
 */
function prismaSignalToTradingSignal(signal: {
  id: string;
  side: string;
  price: number | null;
  symbol: string;
  receivedAt: Date;
  isCloseSignal: boolean;
}) {
  return {
    id: signal.id,
    side: signal.side as Side,
    entryPrice: signal.price || 0,
    timestamp: signal.receivedAt,
    closeTimestamp: undefined, // No tenemos esta info en Signal
    symbol: signal.symbol,
  };
}

/**
 * Filtra señales por día de la semana y hora
 */
function applyFilters(
  signals: ReturnType<typeof prismaSignalToTradingSignal>[],
  filters: BacktestRequest["filters"]
) {
  if (!filters) return signals;

  return signals.filter((signal) => {
    // Filtro por día de la semana (0=domingo, 6=sábado)
    if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
      const dayOfWeek = signal.timestamp.getUTCDay();
      if (!filters.daysOfWeek.includes(dayOfWeek)) return false;
    }

    // Filtro por hora
    const hour = signal.timestamp.getUTCHours();
    if (filters.hourFrom !== undefined && hour < filters.hourFrom) return false;
    if (filters.hourTo !== undefined && hour >= filters.hourTo) return false;

    // Filtro por sesión
    if (filters.session && filters.session !== "ALL") {
      const session = TRADING_SESSIONS[filters.session];
      if (hour < session.start || hour >= session.end) return false;
    }

    // Filtro por lado
    if (filters.side && signal.side !== filters.side) return false;

    return true;
  });
}

/**
 * Genera ticks sintéticos cuando no hay datos reales
 */
function generateSyntheticTicksForSignal(
  signal: { entryPrice: number; timestamp: Date; side: Side },
  config: { takeProfitPips: number; pipsDistance: number }
): PriceTick[] {
  const durationMs = 30 * 60 * 1000; // 30 minutos por defecto
  const exitPrice =
    signal.side === "BUY"
      ? signal.entryPrice + config.takeProfitPips * 0.1
      : signal.entryPrice - config.takeProfitPips * 0.1;

  return generateSyntheticTicks(
    signal.entryPrice,
    exitPrice,
    durationMs,
    config.pipsDistance * 2,
    signal.timestamp
  );
}

// ==================== HANDLER ====================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verificar autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // 2. Obtener tenantId del usuario
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: "Usuario sin tenant asociado" },
        { status: 400 }
      );
    }

    // 3. Parsear y validar input
    const body: BacktestRequest = await request.json();

    if (!body.dateFrom || !body.dateTo) {
      return NextResponse.json(
        { error: "dateFrom y dateTo son obligatorios" },
        { status: 400 }
      );
    }

    const dateFrom = new Date(body.dateFrom);
    const dateTo = new Date(body.dateTo);

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return NextResponse.json(
        { error: "Fechas inválidas" },
        { status: 400 }
      );
    }

    // 4. Construir configuración del backtest
    const config: BacktestConfig = {
      strategyName: body.strategyName || "Toni (G4)",
      lotajeBase: body.lotajeBase ?? 0.1,
      numOrders: body.numOrders ?? 1,
      pipsDistance: body.pipsDistance ?? 10,
      maxLevels: body.maxLevels ?? 4,
      takeProfitPips: body.takeProfitPips ?? 20,
      stopLossPips: body.stopLossPips,
      useStopLoss: body.useStopLoss ?? false,
      useTrailingSL: body.useTrailingSL ?? true,
      trailingSLPercent: body.trailingSLPercent ?? 50,
      restrictionType: body.restrictionType,
      initialCapital: body.initialCapital ?? 10000,
    };

    // 5. Leer señales de Supabase
    const signalsFromDb = await prisma.signal.findMany({
      where: {
        tenantId: user.tenantId,
        receivedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        // Solo señales con precio válido
        price: { gt: 0 },
      },
      orderBy: { receivedAt: "asc" },
      take: body.signalLimit || 1000,
    });

    console.log(`[API /backtest] Encontradas ${signalsFromDb.length} señales en Supabase`);

    if (signalsFromDb.length === 0) {
      return NextResponse.json({
        error: "No se encontraron señales en el rango de fechas especificado",
        hint: "Verifica que existan señales en la tabla Signal para tu tenant",
        dateRange: { from: dateFrom, to: dateTo },
      }, { status: 404 });
    }

    // 6. Convertir a formato del engine y aplicar filtros
    let signals = signalsFromDb.map(prismaSignalToTradingSignal);
    signals = applyFilters(signals, body.filters);

    console.log(`[API /backtest] Después de filtros: ${signals.length} señales`);

    // 7. Leer ticks de Supabase si se requieren precios reales
    const useRealPrices = body.useRealPrices !== false;
    let ticksCache: Map<string, PriceTick[]> = new Map();

    if (useRealPrices) {
      const ticksFromDb = await prisma.tickData.findMany({
        where: {
          timestamp: {
            gte: dateFrom,
            lte: dateTo,
          },
          symbol: "XAUUSD",
        },
        orderBy: { timestamp: "asc" },
      });

      console.log(`[API /backtest] Encontrados ${ticksFromDb.length} ticks en Supabase`);

      // Agrupar ticks por día para acceso rápido
      for (const tick of ticksFromDb) {
        const dayKey = tick.timestamp.toISOString().slice(0, 10);
        if (!ticksCache.has(dayKey)) {
          ticksCache.set(dayKey, []);
        }
        ticksCache.get(dayKey)!.push({
          timestamp: tick.timestamp,
          bid: tick.bid,
          ask: tick.ask,
          spread: tick.spread,
        });
      }
    }

    // 8. Crear motor de backtest
    const engine = new BacktestEngine(config);
    let totalTicksProcessed = 0;
    let signalsProcessed = 0;

    // 9. Procesar cada señal
    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];

      // Validar precio de entrada
      if (signal.entryPrice <= 0) {
        console.warn(`[API /backtest] Señal ${i} sin precio válido, saltando`);
        continue;
      }

      engine.startSignal(signal.side, signal.entryPrice, i, signal.timestamp);

      // Buscar ticks para esta señal
      let ticks: PriceTick[] = [];
      const dayKey = signal.timestamp.toISOString().slice(0, 10);

      if (useRealPrices && ticksCache.has(dayKey)) {
        // Filtrar ticks posteriores a la señal
        const dayTicks = ticksCache.get(dayKey)!;
        ticks = dayTicks.filter(t => t.timestamp >= signal.timestamp);
      }

      // Si no hay ticks reales, generar sintéticos
      if (ticks.length === 0) {
        ticks = generateSyntheticTicksForSignal(signal, {
          takeProfitPips: config.takeProfitPips,
          pipsDistance: config.pipsDistance,
        });
      }

      // Obtener timestamp de entrada
      const entryTimestamp = ticks.length > 0 ? ticks[0].timestamp : signal.timestamp;
      engine.openInitialOrders(signal.entryPrice, entryTimestamp);

      signalsProcessed++;
      totalTicksProcessed += ticks.length;

      // Procesar cada tick
      for (const tick of ticks) {
        engine.processTick(tick);
      }

      // Cerrar posiciones pendientes al final de la señal
      if (engine.hasOpenPositions() && ticks.length > 0) {
        const lastTick = ticks[ticks.length - 1];
        const closePrice = signal.side === "BUY" ? lastTick.bid : lastTick.ask;
        engine.closeRemainingPositions(closePrice, lastTick.timestamp);
      }
    }

    console.log(`[API /backtest] Procesadas ${signalsProcessed} señales, ${totalTicksProcessed} ticks`);

    // 10. Obtener resultados
    const results = engine.getResults();

    // 11. Calcular segmentación
    const profits = results.tradeDetails.map(d => d.totalProfit);
    const segmentation = getSegmentationStats(
      signals.filter((_, i) => i < results.tradeDetails.length),
      profits
    );

    const elapsedMs = Date.now() - startTime;
    console.log(`[API /backtest] Backtest completado en ${elapsedMs}ms`);

    // 12. Devolver respuesta
    return NextResponse.json({
      status: "completed",
      elapsedMs,
      results: {
        ...results,
        segmentation,
      },
      meta: {
        signalsLoaded: signals.length,
        signalsProcessed,
        totalTicksProcessed,
        usedRealPrices: useRealPrices && ticksCache.size > 0,
        dateRange: { from: dateFrom, to: dateTo },
      },
    });

  } catch (error) {
    console.error("[API /backtest] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error interno del servidor",
        stack: process.env.NODE_ENV === "development" ? (error as Error).stack : undefined,
      },
      { status: 500 }
    );
  }
}

// ==================== GET para info ====================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Usuario sin tenant" }, { status: 400 });
    }

    // Obtener info de señales disponibles
    const signalsStats = await prisma.signal.aggregate({
      where: { tenantId: user.tenantId },
      _count: true,
      _min: { receivedAt: true },
      _max: { receivedAt: true },
    });

    // Obtener info de ticks disponibles
    const ticksStats = await prisma.tickData.aggregate({
      _count: true,
      _min: { timestamp: true },
      _max: { timestamp: true },
    });

    return NextResponse.json({
      signals: {
        total: signalsStats._count,
        dateRange: {
          start: signalsStats._min.receivedAt,
          end: signalsStats._max.receivedAt,
        },
      },
      ticks: {
        total: ticksStats._count,
        dateRange: {
          start: ticksStats._min.timestamp,
          end: ticksStats._max.timestamp,
        },
      },
    });
  } catch (error) {
    console.error("[API /backtest GET] Error:", error);
    return NextResponse.json(
      { error: "Error obteniendo información" },
      { status: 500 }
    );
  }
}
