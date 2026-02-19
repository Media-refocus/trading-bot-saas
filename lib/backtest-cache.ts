/**
 * Cache de resultados de backtest
 *
 * - Almacena resultados por hash de configuración
 * - Evita recalcular backtests idénticos
 * - Incluye TTL para resultados antiguos
 */

import type { BacktestResult } from "./backtest-engine";

interface CachedResult {
  hash: string;
  config: BacktestConfig;
  results: BacktestResult;
  timestamp: Date;
  signalsSource: string;
  signalCount: number;
}

interface BacktestConfig {
  strategyName: string;
  lotajeBase: number;
  numOrders: number;
  pipsDistance: number;
  maxLevels: number;
  takeProfitPips: number;
  stopLossPips?: number;
  useStopLoss: boolean;
  signalsSource?: string;
  useRealPrices?: boolean;
}

// Cache en memoria
const resultsCache = new Map<string, CachedResult>();

// Configuración
const MAX_CACHE_SIZE = 100; // Máximo 100 resultados en cache
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Genera un hash único para una configuración de backtest
 */
export function hashConfig(config: BacktestConfig, signalsSource: string): string {
  const parts = [
    config.strategyName,
    config.lotajeBase.toString(),
    config.numOrders.toString(),
    config.pipsDistance.toString(),
    config.maxLevels.toString(),
    config.takeProfitPips.toString(),
    (config.stopLossPips || 0).toString(),
    config.useStopLoss.toString(),
    (config.useRealPrices ?? false).toString(), // Importante: distinguir sintéticos vs reales
    signalsSource,
  ];

  // Hash simple pero efectivo
  const str = parts.join("|");
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32bit integer
  }

  return hash.toString(16);
}

/**
 * Guarda un resultado en cache
 */
export function cacheResult(
  config: BacktestConfig,
  signalsSource: string,
  results: BacktestResult
): void {
  const hash = hashConfig(config, signalsSource);

  // Limpiar cache si está lleno
  if (resultsCache.size >= MAX_CACHE_SIZE) {
    evictOldest();
  }

  const cached: CachedResult = {
    hash,
    config,
    results,
    timestamp: new Date(),
    signalsSource,
    signalCount: results.totalTrades,
  };

  resultsCache.set(hash, cached);
  console.log(`[BacktestCache] Resultado cacheado: ${hash} (${signalsSource})`);
}

/**
 * Obtiene un resultado del cache
 */
export function getCachedResult(
  config: BacktestConfig,
  signalsSource: string
): BacktestResult | null {
  const hash = hashConfig(config, signalsSource);
  const cached = resultsCache.get(hash);

  if (!cached) {
    return null;
  }

  // Verificar TTL
  const age = Date.now() - cached.timestamp.getTime();
  if (age > CACHE_TTL_MS) {
    resultsCache.delete(hash);
    console.log(`[BacktestCache] Resultado expirado: ${hash}`);
    return null;
  }

  console.log(`[BacktestCache] Resultado desde cache: ${hash}`);
  return cached.results;
}

/**
 * Elimina los resultados más antiguos
 */
function evictOldest(): void {
  // Ordenar por timestamp
  const entries = Array.from(resultsCache.entries())
    .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

  // Eliminar el 20% más antiguo
  const toRemove = Math.ceil(entries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    resultsCache.delete(entries[i][0]);
  }

  console.log(`[BacktestCache] Eliminados ${toRemove} resultados antiguos`);
}

/**
 * Obtiene estadísticas del cache
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
} {
  return {
    size: resultsCache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: 0, // TODO: Implementar contador de hits/misses
  };
}

/**
 * Limpia todo el cache
 */
export function clearBacktestCache(): void {
  resultsCache.clear();
  console.log("[BacktestCache] Cache limpiado");
}

/**
 * Invalida cache para una fuente de señales específica
 */
export function invalidateForSource(signalsSource: string): void {
  let removed = 0;

  for (const [hash, cached] of resultsCache.entries()) {
    if (cached.signalsSource === signalsSource) {
      resultsCache.delete(hash);
      removed++;
    }
  }

  console.log(`[BacktestCache] Invalidados ${removed} resultados para ${signalsSource}`);
}
