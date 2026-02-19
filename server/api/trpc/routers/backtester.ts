/**
 * Router tRPC del Backtester (OPTIMIZADO)
 *
 * Mejoras:
 * - Cache de ticks en memoria (carga una vez al iniciar)
 * - Cache de resultados por configuración
 * - Sistema de jobs en background para backtests pesados
 * - Endpoints síncronos y asíncronos
 */

import { z } from "zod";
import { procedure, router } from "../init";
import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  Side,
} from "@/lib/backtest-engine";
import {
  loadSignalsFromFile,
  generateSyntheticTicks,
  TradingSignal,
} from "@/lib/parsers/signals-csv";
import {
  getTicksForSignal,
  hasTicksData,
  getTicksInfo,
} from "@/lib/parsers/ticks-loader";
import {
  initializeTicksCache,
  getCacheStatus,
  getTicksFromCache,
  getMarketPriceFromCache,
  isCacheReady,
  waitForCache,
  preloadDaysForSignals,
} from "@/lib/ticks-cache";
import {
  getCachedResult,
  cacheResult,
  hashConfig,
} from "@/lib/backtest-cache";
import {
  createJob,
  getJob,
  getActiveJobs,
  getQueuedJobs,
  getCompletedJobs,
  cancelJob,
  getJobsStats,
  type BacktestJob,
} from "@/lib/backtest-jobs";
import path from "path";

// ==================== SCHEMAS ====================

const BacktestConfigSchema = z.object({
  strategyName: z.string().default("Toni (G4)"),
  lotajeBase: z.number().min(0.01).max(10).default(0.1),
  numOrders: z.number().min(1).max(5).default(1),
  pipsDistance: z.number().min(1).max(100).default(10),
  maxLevels: z.number().min(1).max(40).default(4),
  takeProfitPips: z.number().min(5).max(100).default(20),
  stopLossPips: z.number().min(0).max(500).optional(),
  useStopLoss: z.boolean().default(false),
  restrictionType: z.enum(["RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"]).optional(),
  // Fuente de señales
  signalsSource: z.string().optional().default("signals_simple.csv"),
  useRealPrices: z.boolean().optional().default(true),
});

// ==================== HELPERS ====================

/**
 * Genera ticks sintéticos para una señal (fallback)
 */
function generateSyntheticTicksForSignal(
  signal: TradingSignal,
  config: { takeProfitPips: number; pipsDistance: number }
): { timestamp: Date; bid: number; ask: number; spread: number }[] {
  const durationMs = signal.closeTimestamp
    ? signal.closeTimestamp.getTime() - signal.timestamp.getTime()
    : 30 * 60 * 1000;

  const exitPrice =
    signal.side === "BUY"
      ? signal.entryPrice + config.takeProfitPips * 0.1
      : signal.entryPrice - config.takeProfitPips * 0.1;

  return generateSyntheticTicks(
    signal.entryPrice,
    exitPrice,
    durationMs,
    config.pipsDistance * 2
  );
}

// ==================== ROUTER ====================

export const backtesterRouter = router({
  /**
   * Ejecuta un backtest síncrono (rápido, para pocas señales)
   * Usa cache de ticks y cache de resultados
   */
  execute: procedure
    .input(
      z.object({
        config: BacktestConfigSchema,
        signalLimit: z.number().min(1).max(10000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const jobId = `backtest_${Date.now()}`;
      const startTime = Date.now();

      try {
        // Verificar cache de resultados primero
        const signalsSource = input.config.signalsSource || "signals_simple.csv";
        const cachedResult = getCachedResult(input.config as BacktestConfig, signalsSource);

        if (cachedResult) {
          console.log(`[Backtester] Resultado desde cache: ${hashConfig(input.config as BacktestConfig, signalsSource)}`);
          return {
            jobId,
            status: "completed",
            results: cachedResult,
            fromCache: true,
            elapsedMs: Date.now() - startTime,
          };
        }

        // Solo inicializar cache si se van a usar precios reales y el usuario lo solicita explícitamente
        // Si el cache no está listo, se usarán ticks sintéticos automáticamente
        const wantsRealPrices = input.config.useRealPrices === true;
        const cacheReady = isCacheReady();

        if (wantsRealPrices && !cacheReady) {
          console.log(`[Backtester] Cache no listo, inicializando en background...`);
          // Inicializar en background, no bloquear
          initializeTicksCache().catch(err => {
            console.error(`[Backtester] Error inicializando cache:`, err);
          });
        }

        // Cargar señales
        const signalsPath = path.join(process.cwd(), signalsSource);
        let signals = await loadSignalsFromFile(signalsPath);

        if (input.signalLimit) {
          signals = signals.slice(0, input.signalLimit);
        }

        // Enriquecer con precios del cache solo si está disponible y el usuario lo quiere
        const cacheStatus = getCacheStatus();
        if (wantsRealPrices && cacheStatus.isLoaded) {
          const enrichedSignals: TradingSignal[] = [];

          for (const signal of signals) {
            const marketPrice = await getMarketPriceFromCache(signal.timestamp);

            if (marketPrice) {
              const entryPrice = (marketPrice.bid + marketPrice.ask) / 2;
              enrichedSignals.push({
                ...signal,
                entryPrice,
              });
            } else if (signal.entryPrice > 0) {
              enrichedSignals.push(signal);
            }
          }

          if (enrichedSignals.length > 0) {
            signals = enrichedSignals;
            console.log(`[Backtester] Enriquecidas ${enrichedSignals.length}/${signals.length} señales con precios reales`);
          }
        }

        // Crear motor
        const engine = new BacktestEngine(input.config as BacktestConfig);

        // Procesar cada señal
        for (let i = 0; i < signals.length; i++) {
          const signal = signals[i];

          engine.startSignal(signal.side, signal.entryPrice);
          engine.openInitialOrders(signal.entryPrice);

          // Obtener ticks del cache o generar sintéticos
          let ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];

          // Solo usar ticks reales si useRealPrices es true y el cache está cargado
          if (input.config.useRealPrices !== false && cacheStatus.isLoaded) {
            const endTime = signal.closeTimestamp
              ? new Date(Math.min(signal.closeTimestamp.getTime(), signal.timestamp.getTime() + 24 * 60 * 60 * 1000))
              : new Date(signal.timestamp.getTime() + 24 * 60 * 60 * 1000);

            ticks = await getTicksFromCache(signal.timestamp, endTime);
          }

          // Si no hay ticks reales o useRealPrices es false, usar sintéticos
          if (ticks.length === 0 || input.config.useRealPrices === false) {
            ticks = generateSyntheticTicksForSignal(signal, input.config);
          }

          for (const tick of ticks) {
            engine.processTick(tick);
          }
        }

        const results = engine.getResults();

        // Guardar en cache
        cacheResult(input.config as BacktestConfig, signalsSource, results);

        const elapsedMs = Date.now() - startTime;
        console.log(`[Backtester] Backtest completado en ${elapsedMs}ms`);

        return {
          jobId,
          status: "completed",
          results,
          fromCache: false,
          elapsedMs,
        };
      } catch (error) {
        console.error(`[Backtester] Error:`, error);
        throw error;
      }
    }),

  /**
   * Crea un job de backtest asíncrono (para muchas señales)
   */
  executeAsync: procedure
    .input(
      z.object({
        config: BacktestConfigSchema,
        signalLimit: z.number().min(1).max(10000).optional(),
        priority: z.number().min(0).max(10).default(0),
      })
    )
    .mutation(async ({ input }) => {
      const signalsSource = input.config.signalsSource || "signals_simple.csv";

      // Verificar cache primero
      const cachedResult = getCachedResult(input.config as BacktestConfig, signalsSource);

      if (cachedResult) {
        return {
          jobId: `cached_${Date.now()}`,
          status: "completed" as const,
          results: cachedResult,
          fromCache: true,
        };
      }

      // Crear job
      const job = createJob(
        input.config as BacktestConfig,
        signalsSource,
        input.signalLimit,
        input.priority
      );

      return {
        jobId: job.id,
        status: job.status,
        message: "Job creado y en cola",
      };
    }),

  /**
   * Obtiene el estado de un job
   */
  getJobStatus: procedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = getJob(input.jobId);

      if (!job) {
        throw new Error("Job not found");
      }

      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        currentSignal: job.currentSignal,
        totalSignals: job.totalSignals,
        error: job.error,
        results: job.status === "completed" ? job.results : undefined,
      };
    }),

  /**
   * Cancela un job
   */
  cancelJob: procedure
    .input(z.object({ jobId: z.string() }))
    .mutation(({ input }) => {
      const success = cancelJob(input.jobId);

      if (!success) {
        throw new Error("Job not found or cannot be cancelled");
      }

      return { success: true };
    }),

  /**
   * Obtiene todos los jobs (activos, en cola, completados)
   */
  getAllJobs: procedure.query(() => {
    return {
      active: getActiveJobs(),
      queued: getQueuedJobs(),
      completed: getCompletedJobs().slice(0, 10), // Últimos 10
      stats: getJobsStats(),
    };
  }),

  /**
   * Obtiene el estado del cache de ticks
   */
  getCacheStatus: procedure.query(() => {
    return getCacheStatus();
  }),

  /**
   * Inicializa el cache de ticks manualmente
   */
  initCache: procedure.mutation(async () => {
    await initializeTicksCache();
    return getCacheStatus();
  }),

  /**
   * Precarga los días de ticks para una fuente de señales
   * Esto hace que el primer backtest sea rápido
   */
  preloadTicks: procedure
    .input(z.object({
      signalsSource: z.string().optional().default("signals_intradia.csv"),
    }))
    .mutation(async ({ input }) => {
      // Cargar señales
      const signalsPath = path.join(process.cwd(), input.signalsSource);
      const signals = await loadSignalsFromFile(signalsPath);

      console.log(`[Backtester] Precargando ticks para ${signals.length} señales de ${input.signalsSource}`);

      // Inicializar índice si no está listo
      if (!isCacheReady()) {
        await initializeTicksCache();
      }

      // Precargar días
      await preloadDaysForSignals(signals);

      return {
        success: true,
        signalsCount: signals.length,
        cacheStatus: getCacheStatus(),
      };
    }),

  /**
   * Obtiene información de las señales disponibles
   */
  getSignalsInfo: procedure
    .input(z.object({
      source: z.string().optional().default("signals_simple.csv"),
    }))
    .query(async ({ input }) => {
      const signalsPath = path.join(process.cwd(), input.source);
      const signals = await loadSignalsFromFile(signalsPath);

      return {
        total: signals.length,
        source: input.source,
        dateRange: {
          start: signals[0]?.timestamp,
          end: signals[signals.length - 1]?.timestamp,
        },
        bySide: {
          buy: signals.filter((s) => s.side === "BUY").length,
          sell: signals.filter((s) => s.side === "SELL").length,
        },
      };
    }),

  /**
   * Obtiene información sobre los datos de ticks disponibles
   */
  getTicksInfo: procedure.query(() => {
    const hasRealTicks = hasTicksData();
    const info = getTicksInfo();
    const cacheStatus = getCacheStatus();

    return {
      hasRealTicks,
      files: info.files,
      totalSizeMB: info.totalSizeMB,
      cache: cacheStatus,
    };
  }),

  /**
   * Lista las fuentes de señales disponibles
   */
  listSignalSources: procedure.query(async () => {
    const fs = await import("fs");
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);

    const signalFiles = files.filter(f =>
      f.startsWith("signals") && f.endsWith(".csv")
    );

    const sources = [];

    for (const file of signalFiles) {
      try {
        const signalsPath = path.join(cwd, file);
        const signals = await loadSignalsFromFile(signalsPath);

        sources.push({
          file,
          total: signals.length,
          dateRange: {
            start: signals[0]?.timestamp,
            end: signals[signals.length - 1]?.timestamp,
          },
        });
      } catch (error) {
        console.warn(`Error leyendo ${file}:`, error);
      }
    }

    return sources;
  }),
});
