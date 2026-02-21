/**
 * OPTIMIZADOR DE PARÁMETROS - Trading Bot SaaS
 *
 * Encuentra la mejor configuración automáticamente probando
 * múltiples combinaciones de parámetros.
 */

import { BacktestEngine, BacktestConfig, BacktestResult, Side } from "./backtest-engine";
import { TradingSignal, loadSignalsFromFile } from "./parsers/signals-csv";
import { getTicksFromDB, isTicksDBReady, getMarketPrice } from "./ticks-db";
import path from "path";

// ==================== TIPOS ====================

export interface OptimizationParams {
  // Rangos de parámetros a optimizar
  pipsDistanceRange?: number[];      // ej: [5, 10, 15, 20]
  maxLevelsRange?: number[];         // ej: [1, 2, 3, 4, 5]
  takeProfitRange?: number[];        // ej: [10, 15, 20, 25, 30]
  trailingSLPercentRange?: number[]; // ej: [30, 40, 50, 60]

  // Parámetros fijos
  lotajeBase?: number;
  numOrders?: number;
  useStopLoss?: boolean;
  stopLossPips?: number;
  useTrailingSL?: boolean;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
  initialCapital?: number;
}

export interface OptimizationResult {
  config: BacktestConfig;
  result: BacktestResult;
  score: number; // Puntuación compuesta
  rank: number;  // Posición en el ranking
}

export interface OptimizationProgress {
  current: number;
  total: number;
  currentConfig: BacktestConfig;
  bestSoFar: OptimizationResult | null;
  elapsedMs: number;
}

export type OptimizationCallback = (progress: OptimizationProgress) => void;

export type OptimizationMetric =
  | "totalProfit"
  | "winRate"
  | "profitFactor"
  | "sharpeRatio"
  | "calmarRatio"
  | "expectancy"
  | "minDrawdown"; // Maximizar profit con drawdown limitado

export interface OptimizationOptions {
  signalsSource: string;
  signalLimit?: number;
  metric?: OptimizationMetric;
  maxDrawdownPercent?: number; // Máximo drawdown permitido
  onProgress?: OptimizationCallback;
}

// ==================== CONSTANTES ====================

const DEFAULT_PIPS_DISTANCE = [5, 10, 15, 20];
const DEFAULT_MAX_LEVELS = [1, 2, 3, 4, 5, 6];
const DEFAULT_TAKE_PROFIT = [10, 15, 20, 25, 30];
const DEFAULT_TRAILING_SL = [30, 40, 50, 60, 70];

// ==================== FUNCIONES ====================

/**
 * Genera todas las combinaciones de parámetros
 */
export function generateCombinations(params: OptimizationParams): BacktestConfig[] {
  const pipsDistances = params.pipsDistanceRange || DEFAULT_PIPS_DISTANCE;
  const maxLevels = params.maxLevelsRange || DEFAULT_MAX_LEVELS;
  const takeProfits = params.takeProfitRange || DEFAULT_TAKE_PROFIT;
  const trailingSLs = params.trailingSLPercentRange || DEFAULT_TRAILING_SL;

  const combinations: BacktestConfig[] = [];

  for (const pipsDistance of pipsDistances) {
    for (const maxLevel of maxLevels) {
      for (const takeProfit of takeProfits) {
        for (const trailingSL of trailingSLs) {
          combinations.push({
            strategyName: `Optimized_${pipsDistance}p_${maxLevel}L_${takeProfit}TP`,
            lotajeBase: params.lotajeBase || 0.1,
            numOrders: params.numOrders || 1,
            pipsDistance,
            maxLevels: maxLevel,
            takeProfitPips: takeProfit,
            useStopLoss: params.useStopLoss || false,
            stopLossPips: params.stopLossPips,
            useTrailingSL: params.useTrailingSL !== false,
            trailingSLPercent: trailingSL,
            restrictionType: params.restrictionType,
            initialCapital: params.initialCapital || 10000,
          });
        }
      }
    }
  }

  return combinations;
}

/**
 * Calcula el score de una configuración según la métrica elegida
 */
export function calculateScore(
  result: BacktestResult,
  metric: OptimizationMetric,
  maxDrawdownPercent?: number
): number {
  // Filtrar por drawdown máximo si está especificado
  if (maxDrawdownPercent && result.maxDrawdownPercent > maxDrawdownPercent) {
    return -Infinity;
  }

  switch (metric) {
    case "totalProfit":
      return result.totalProfit;

    case "winRate":
      return result.winRate;

    case "profitFactor":
      return result.profitFactor;

    case "sharpeRatio":
      return result.sharpeRatio;

    case "calmarRatio":
      return result.calmarRatio;

    case "expectancy":
      return result.expectancy;

    case "minDrawdown":
      // Maximizar profit minimizando drawdown
      return result.totalProfit / (result.maxDrawdownPercent + 1);

    default:
      // Score compuesto: profit * winRate * profitFactor / drawdown
      return result.totalProfit * (result.winRate / 100) * result.profitFactor / (result.maxDrawdownPercent + 1);
  }
}

/**
 * Ejecuta un backtest para una configuración específica
 */
export async function runSingleBacktest(
  config: BacktestConfig,
  signals: TradingSignal[],
  useRealPrices: boolean = true
): Promise<BacktestResult> {
  const dbReady = useRealPrices && await isTicksDBReady();
  const engine = new BacktestEngine(config);

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];

    // Enriquecer con precio real si está disponible
    let entryPrice = signal.entryPrice;
    if (dbReady) {
      const marketPrice = await getMarketPrice(signal.timestamp);
      if (marketPrice) {
        entryPrice = (marketPrice.bid + marketPrice.ask) / 2;
      }
    }

    engine.startSignal(signal.side, entryPrice, i, signal.timestamp);
    engine.openInitialOrders(entryPrice, signal.timestamp);

    // Obtener ticks
    const endTime = signal.closeTimestamp
      ? new Date(Math.min(signal.closeTimestamp.getTime(), signal.timestamp.getTime() + 24 * 60 * 60 * 1000))
      : new Date(signal.timestamp.getTime() + 24 * 60 * 60 * 1000);

    let ticks = dbReady
      ? await getTicksFromDB(signal.timestamp, endTime)
      : [];

    // Si no hay ticks reales, generar sintéticos
    if (ticks.length === 0) {
      ticks = generateSyntheticTicks(signal, config);
    }

    for (const tick of ticks) {
      engine.processTick(tick);
    }
  }

  return engine.getResults();
}

/**
 * Genera ticks sintéticos simples para una señal
 */
function generateSyntheticTicks(
  signal: TradingSignal,
  config: BacktestConfig
): { timestamp: Date; bid: number; ask: number; spread: number }[] {
  const ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] = [];
  const durationMs = signal.closeTimestamp
    ? signal.closeTimestamp.getTime() - signal.timestamp.getTime()
    : 30 * 60 * 1000;

  const numTicks = Math.min(100, Math.floor(durationMs / 60000));
  const step = durationMs / numTicks;

  const isBuy = signal.side === "BUY";
  const exitPrice = isBuy
    ? signal.entryPrice + config.takeProfitPips * 0.1
    : signal.entryPrice - config.takeProfitPips * 0.1;

  for (let i = 0; i <= numTicks; i++) {
    const progress = i / numTicks;
    // Simular movimiento con algo de ruido
    const noise = (Math.random() - 0.5) * 2;
    const price = signal.entryPrice + (exitPrice - signal.entryPrice) * progress + noise;

    ticks.push({
      timestamp: new Date(signal.timestamp.getTime() + i * step),
      bid: price,
      ask: price + 0.02,
      spread: 0.02,
    });
  }

  return ticks;
}

/**
 * Ejecuta la optimización completa
 */
export async function runOptimization(
  params: OptimizationParams,
  options: OptimizationOptions
): Promise<OptimizationResult[]> {
  const startTime = Date.now();
  const combinations = generateCombinations(params);
  const results: OptimizationResult[] = [];

  // Cargar señales
  const signalsPath = path.join(process.cwd(), options.signalsSource);
  let signals = await loadSignalsFromFile(signalsPath);
  if (options.signalLimit) {
    signals = signals.slice(0, options.signalLimit);
  }

  const metric = options.metric || "totalProfit";
  let bestSoFar: OptimizationResult | null = null;

  for (let i = 0; i < combinations.length; i++) {
    const config = combinations[i];

    try {
      const result = await runSingleBacktest(config, signals, true);
      const score = calculateScore(result, metric, options.maxDrawdownPercent);

      const optResult: OptimizationResult = {
        config,
        result,
        score,
        rank: 0, // Se asignará después
      };

      results.push(optResult);

      if (score > (bestSoFar?.score || -Infinity)) {
        bestSoFar = optResult;
      }

      // Callback de progreso
      if (options.onProgress) {
        options.onProgress({
          current: i + 1,
          total: combinations.length,
          currentConfig: config,
          bestSoFar,
          elapsedMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      console.error(`Error en configuración ${config.strategyName}:`, error);
    }
  }

  // Ordenar por score y asignar ranks
  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  return results;
}

/**
 * Obtiene las combinaciones recomendadas (quick optimization)
 */
export function getQuickOptimizationPresets(): OptimizationParams[] {
  return [
    {
      // Conservador: poco drawdown
      pipsDistanceRange: [15, 20],
      maxLevelsRange: [1, 2],
      takeProfitRange: [15, 20],
      trailingSLPercentRange: [40, 50],
    },
    {
      // Balanceado
      pipsDistanceRange: [10, 15],
      maxLevelsRange: [2, 3, 4],
      takeProfitRange: [15, 20, 25],
      trailingSLPercentRange: [40, 50, 60],
    },
    {
      // Agresivo: maximizar profit
      pipsDistanceRange: [5, 10],
      maxLevelsRange: [3, 4, 5, 6],
      takeProfitRange: [20, 25, 30],
      trailingSLPercentRange: [50, 60, 70],
    },
  ];
}
