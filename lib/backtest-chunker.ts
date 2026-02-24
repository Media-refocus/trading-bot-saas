/**
 * Backtest Chunker - Procesa backtests en lotes para evitar OOM
 *
 * PROBLEMA: Con 1516 senales distribuidas en 400+ dias, cargar todos
 * los ticks de una vez causa OOM (5-8GB de memoria).
 *
 * SOLUCION: Procesar en chunks de 50 senales, cargando solo los dias
 * necesarios para cada chunk. El LRU cache mantiene los dias frecuentes.
 *
 * Beneficios:
 * - Memoria controlada (<200MB)
 * - Progreso reportable para UI
 * - Cancelable
 * - Escalable para multiples usuarios
 */

import type { TradingSignal } from "./parsers/signals-csv";
import { getDaysNeededForSignals, loadTicksByDayGrouped } from "./ticks-batch-loader";
import { ticksLRUCache } from "./ticks-lru-cache";

// Tipo Tick
export interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

export interface ChunkProgress {
  currentChunk: number;
  totalChunks: number;
  signalsProcessed: number;
  totalSignals: number;
  currentPhase: "loading" | "processing" | "completed";
  message: string;
  memoryMB: number;
}

export type ProgressCallback = (progress: ChunkProgress) => void;

/**
 * Divide un array en chunks
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Configuracion del chunker
 */
export const CHUNKER_CONFIG = {
  chunkSize: 50,           // Senales por chunk
  maxMemoryMB: 150,        // Alertar si excede
  progressIntervalMs: 500, // Reportar progreso cada X ms
};

/**
 * Procesa senales en chunks, cargando ticks bajo demanda
 *
 * @param signals - Senales a procesar
 * @param processChunk - Funcion que procesa un chunk de senales
 * @param onProgress - Callback para reportar progreso
 */
export async function processInChunks(
  signals: TradingSignal[],
  processChunk: (
    chunkSignals: TradingSignal[],
    ticksByDay: Map<string, Tick[]>,
    chunkIndex: number
  ) => Promise<void>,
  onProgress?: ProgressCallback
): Promise<void> {

  const chunkSize = CHUNKER_CONFIG.chunkSize;
  const chunks = chunkArray(signals, chunkSize);
  const totalChunks = chunks.length;

  let lastProgressTime = Date.now();

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunkSignals = chunks[chunkIndex];

    // Reportar progreso (throttled)
    const now = Date.now();
    if (onProgress && now - lastProgressTime > CHUNKER_CONFIG.progressIntervalMs) {
      const stats = ticksLRUCache.getStats();
      onProgress({
        currentChunk: chunkIndex + 1,
        totalChunks,
        signalsProcessed: chunkIndex * chunkSize,
        totalSignals: signals.length,
        currentPhase: "loading",
        message: `Cargando ticks para chunk ${chunkIndex + 1}/${totalChunks}`,
        memoryMB: stats.currentSizeMB,
      });
      lastProgressTime = now;
    }

    // Cargar solo los dias necesarios para este chunk
    const daysNeeded = getDaysNeededForSignals(chunkSignals);
    const ticksByDay = await loadTicksByDayGrouped(daysNeeded);

    // Reportar fase de procesamiento
    if (onProgress) {
      const stats = ticksLRUCache.getStats();
      onProgress({
        currentChunk: chunkIndex + 1,
        totalChunks,
        signalsProcessed: chunkIndex * chunkSize,
        totalSignals: signals.length,
        currentPhase: "processing",
        message: `Procesando chunk ${chunkIndex + 1}/${totalChunks}`,
        memoryMB: stats.currentSizeMB,
      });
    }

    // Procesar el chunk
    await processChunk(chunkSignals, ticksByDay, chunkIndex);

    // Forzar garbage collection entre chunks (si esta disponible)
    if (global.gc) {
      global.gc();
    }

    // Verificar memoria
    const stats = ticksLRUCache.getStats();
    if (stats.currentSizeMB > CHUNKER_CONFIG.maxMemoryMB) {
      console.warn(`[Chunker] Memoria alta: ${stats.currentSizeMB}MB`);
    }
  }

  // Reportar completado
  if (onProgress) {
    const stats = ticksLRUCache.getStats();
    onProgress({
      currentChunk: totalChunks,
      totalChunks,
      signalsProcessed: signals.length,
      totalSignals: signals.length,
      currentPhase: "completed",
      message: "Procesamiento completado",
      memoryMB: stats.currentSizeMB,
    });
  }
}

/**
 * Obtiene estadisticas del chunker
 */
export function getChunkerStats() {
  const cacheStats = ticksLRUCache.getStats();
  return {
    cache: cacheStats,
    config: CHUNKER_CONFIG,
  };
}
