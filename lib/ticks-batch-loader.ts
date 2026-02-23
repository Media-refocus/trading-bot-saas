/**
 * Ticks Batch Loader - Optimizacion para reducir consultas en backtester
 *
 * PROBLEMA: El backtester hacia 3 consultas por senal:
 *   1. getMarketPrice() para entryPrice
 *   2. getMarketPrice() para entryTimestamp (redundante!)
 *   3. getTicksFromDB() para ticks de simulacion
 *
 * SOLUCION: Agrupar senales por dia y cargar ticks en batch
 *   - 1 consulta por dia en lugar de 3 por senal
 *   - Con 3032 senales en ~600 dias: de 9096 consultas a ~600
 *   - Tiempo esperado: de 45 min a ~5-8 min
 */

import { PrismaClient } from "@prisma/client";
import type { TradingSignal } from "./parsers/signals-csv";

const prisma = new PrismaClient();

export interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// Cache global de ticks por dia (compartido entre llamadas)
const globalTicksByDay = new Map<string, Tick[]>();
let lastCacheClear = Date.now();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Agrupa senales por dia
 * Retorna un Map<fecha, indices de senales>
 */
export function groupSignalsByDay(signals: TradingSignal[]): Map<string, number[]> {
  const byDay = new Map<string, number[]>();

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const dayKey = signal.timestamp.toISOString().slice(0, 10);

    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, []);
    }
    byDay.get(dayKey)!.push(i);
  }

  return byDay;
}

/**
 * Obtiene los dias necesarios para un conjunto de senales
 * Incluye el dia de entrada + dias adicionales hasta el cierre (max 24h)
 */
export function getDaysNeededForSignals(signals: TradingSignal[]): Set<string> {
  const daysNeeded = new Set<string>();

  for (const signal of signals) {
    // Dia de entrada
    const startKey = signal.timestamp.toISOString().slice(0, 10);
    daysNeeded.add(startKey);

    // Dia de cierre (o maximo 24h despues)
    const closeTime = signal.closeTimestamp
      ? new Date(Math.min(
          signal.closeTimestamp.getTime(),
          signal.timestamp.getTime() + 24 * 60 * 60 * 1000
        ))
      : new Date(signal.timestamp.getTime() + 24 * 60 * 60 * 1000);

    const endKey = closeTime.toISOString().slice(0, 10);
    daysNeeded.add(endKey);

    // Si cruza medianoche, anadir dias intermedios
    const startDate = new Date(startKey);
    const endDate = new Date(endKey);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      daysNeeded.add(d.toISOString().slice(0, 10));
    }
  }

  return daysNeeded;
}

/**
 * Carga ticks para multiples dias en una sola consulta
 * Retorna un Map<dia, Tick[]>
 *
 * OPTIMIZACION: Usa una unica consulta SQL con rango amplio
 * en lugar de N consultas individuales
 */
export async function loadTicksByDayGrouped(
  daysNeeded: Set<string>,
  symbol: string = "XAUUSD"
): Promise<Map<string, Tick[]>> {
  const startTime = Date.now();

  // Verificar TTL del cache global
  if (Date.now() - lastCacheClear > CACHE_TTL_MS) {
    globalTicksByDay.clear();
    lastCacheClear = Date.now();
    console.log("[BatchLoader] Cache global limpiado por TTL");
  }

  // Filtrar dias ya cargados
  const daysToLoad = Array.from(daysNeeded).filter(d => !globalTicksByDay.has(d));

  if (daysToLoad.length === 0) {
    console.log(`[BatchLoader] Todos los ${daysNeeded.size} dias ya en cache`);
    return new Map(globalTicksByDay);
  }

  console.log(`[BatchLoader] Cargando ${daysToLoad.length} dias (${daysNeeded.size - daysToLoad.length} en cache)`);

  // Calcular rango de fechas
  const sortedDays = daysToLoad.sort();
  const minDate = new Date(sortedDays[0] + "T00:00:00.000Z");
  const maxDate = new Date(sortedDays[sortedDays.length - 1] + "T23:59:59.999Z");

  // UNICA consulta SQL para todos los dias
  const ticks = await prisma.tickData.findMany({
    where: {
      symbol,
      timestamp: {
        gte: minDate,
        lte: maxDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      timestamp: true,
      bid: true,
      ask: true,
      spread: true,
    },
  });

  console.log(`[BatchLoader] Consulta SQL: ${ticks.length} ticks en ${Date.now() - startTime}ms`);

  // Agrupar por dia
  let groupedCount = 0;
  for (const tick of ticks) {
    const dayKey = tick.timestamp.toISOString().slice(0, 10);

    if (!globalTicksByDay.has(dayKey)) {
      globalTicksByDay.set(dayKey, []);
    }
    globalTicksByDay.get(dayKey)!.push({
      timestamp: tick.timestamp,
      bid: tick.bid,
      ask: tick.ask,
      spread: tick.spread,
    });
    groupedCount++;
  }

  // Asegurar que todos los dias solicitados existan en el mapa (aunque sea vacio)
  for (const day of daysNeeded) {
    if (!globalTicksByDay.has(day)) {
      globalTicksByDay.set(day, []);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[BatchLoader] Cargados ${daysToLoad.length} dias, ${groupedCount} ticks en ${elapsed}ms`);

  return new Map(globalTicksByDay);
}

/**
 * Obtiene el precio de mercado mas cercano a un timestamp
 * Usando ticks previamente cargados (sin consulta adicional)
 */
export function getMarketPriceFromCache(
  ticksByDay: Map<string, Tick[]>,
  timestamp: Date,
  toleranceMs: number = 5 * 60 * 1000
): { bid: number; ask: number; spread: number; timestamp: Date } | null {
  const dayKey = timestamp.toISOString().slice(0, 10);
  const dayTicks = ticksByDay.get(dayKey);

  if (!dayTicks || dayTicks.length === 0) {
    // Intentar dia anterior o siguiente
    const prevDay = new Date(timestamp);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevKey = prevDay.toISOString().slice(0, 10);
    const prevTicks = ticksByDay.get(prevKey);

    if (prevTicks && prevTicks.length > 0) {
      return findClosestTick(prevTicks, timestamp, toleranceMs);
    }

    return null;
  }

  return findClosestTick(dayTicks, timestamp, toleranceMs);
}

/**
 * Encuentra el tick mas cercano a un timestamp
 */
function findClosestTick(
  ticks: Tick[],
  timestamp: Date,
  toleranceMs: number
): { bid: number; ask: number; spread: number; timestamp: Date } | null {
  let bestTick: Tick | null = null;
  let bestDiff = Infinity;

  for (const tick of ticks) {
    const diff = Math.abs(tick.timestamp.getTime() - timestamp.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestTick = tick;
    }
  }

  if (!bestTick || bestDiff > toleranceMs) {
    return null;
  }

  return {
    bid: bestTick.bid,
    ask: bestTick.ask,
    spread: bestTick.spread,
    timestamp: bestTick.timestamp,
  };
}

/**
 * Obtiene ticks para una senal especifica
 * Usando el cache de ticks por dia (sin consulta adicional)
 */
export function getTicksForSignal(
  ticksByDay: Map<string, Tick[]>,
  signal: TradingSignal
): Tick[] {
  const allTicks: Tick[] = [];

  // Rango de tiempo: desde entrada hasta cierre (max 24h)
  const startTime = signal.timestamp;
  const endTime = signal.closeTimestamp
    ? new Date(Math.min(
        signal.closeTimestamp.getTime(),
        signal.timestamp.getTime() + 24 * 60 * 60 * 1000
      ))
    : new Date(signal.timestamp.getTime() + 24 * 60 * 60 * 1000);

  // Obtener dias en el rango
  const startDay = new Date(startTime.toISOString().slice(0, 10));
  const endDay = new Date(endTime.toISOString().slice(0, 10));

  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    const dayKey = d.toISOString().slice(0, 10);
    const dayTicks = ticksByDay.get(dayKey);

    if (dayTicks) {
      // Filtrar por rango de tiempo exacto
      for (const tick of dayTicks) {
        if (tick.timestamp >= startTime && tick.timestamp <= endTime) {
          allTicks.push(tick);
        }
      }
    }
  }

  // Ordenar por timestamp
  allTicks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return allTicks;
}

/**
 * Precarga ticks para un conjunto de senales
 * Llamar antes de procesar para tener todo listo
 */
export async function preloadTicksForSignals(
  signals: TradingSignal[],
  symbol: string = "XAUUSD"
): Promise<Map<string, Tick[]>> {
  const daysNeeded = getDaysNeededForSignals(signals);
  console.log(`[BatchLoader] Precargando ${daysNeeded.size} dias para ${signals.length} senales...`);

  const startTime = Date.now();
  const ticksByDay = await loadTicksByDayGrouped(daysNeeded, symbol);
  const elapsed = Date.now() - startTime;

  // Contar total de ticks
  let totalTicks = 0;
  for (const ticks of ticksByDay.values()) {
    totalTicks += ticks.length;
  }

  console.log(`[BatchLoader] Precarga completada: ${totalTicks} ticks en ${elapsed}ms`);

  return ticksByDay;
}

/**
 * Limpia el cache global
 */
export function clearBatchCache(): void {
  globalTicksByDay.clear();
  lastCacheClear = Date.now();
  console.log("[BatchLoader] Cache global limpiado");
}

/**
 * Obtiene estadisticas del cache
 */
export function getBatchCacheStats(): {
  cachedDays: number;
  totalTicks: number;
  estimatedMemoryMB: number;
} {
  let totalTicks = 0;
  for (const ticks of globalTicksByDay.values()) {
    totalTicks += ticks.length;
  }

  // Estimacion: cada tick ~100 bytes
  const estimatedMemoryMB = Math.round(totalTicks * 100 / 1024 / 1024 * 100) / 100;

  return {
    cachedDays: globalTicksByDay.size,
    totalTicks,
    estimatedMemoryMB,
  };
}
