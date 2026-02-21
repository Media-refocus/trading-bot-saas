/**
 * Conversor de Ticks a Velas OHLC
 *
 * Convierte ticks individuales en velas (candlesticks)
 * para diferentes timeframes.
 */

export type Timeframe = "1" | "5" | "15" | "60"; // minutos

export interface Candle {
  time: number;      // Unix timestamp en segundos
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

/**
 * Convierte array de ticks a velas OHLC
 * @param ticks - Array de ticks ordenados por timestamp
 * @param timeframeMinutes - Intervalo en minutos (1, 5, 15, 60)
 */
export function ticksToCandles(
  ticks: Tick[],
  timeframeMinutes: Timeframe
): Candle[] {
  if (ticks.length === 0) return [];

  const intervalMs = parseInt(timeframeMinutes) * 60 * 1000;
  const candles: Candle[] = [];
  let currentCandle: Partial<Candle> | null = null;

  for (const tick of ticks) {
    const timestamp = new Date(tick.timestamp).getTime();
    const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
    const price = (tick.bid + tick.ask) / 2; // Mid price

    if (!currentCandle || currentCandle.time !== Math.floor(candleTime / 1000)) {
      // Guardar vela anterior si existe
      if (currentCandle && currentCandle.time !== undefined) {
        candles.push(currentCandle as Candle);
      }
      // Iniciar nueva vela
      currentCandle = {
        time: Math.floor(candleTime / 1000), // Unix seconds para Lightweight Charts
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
      };
    } else {
      // Actualizar vela actual
      currentCandle.high = Math.max(currentCandle.high!, price);
      currentCandle.low = Math.min(currentCandle.low!, price);
      currentCandle.close = price;
      currentCandle.volume = (currentCandle.volume || 0) + 1;
    }
  }

  // Añadir última vela
  if (currentCandle && currentCandle.time !== undefined) {
    candles.push(currentCandle as Candle);
  }

  return candles;
}

/**
 * Genera velas progressivamente para animación
 * Usado para reproducir el backtest tick a tick
 */
export function* candlesIterator(
  ticks: Tick[],
  timeframeMinutes: Timeframe
): Generator<{ candle: Candle; tickIndex: number; totalTicks: number }> {
  if (ticks.length === 0) return;

  const intervalMs = parseInt(timeframeMinutes) * 60 * 1000;
  let currentCandle: Partial<Candle> | null = null;
  let currentCandleTime: number | null = null;

  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    const timestamp = new Date(tick.timestamp).getTime();
    const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
    const price = (tick.bid + tick.ask) / 2;

    // Si cambió el período de la vela, iniciar nueva
    if (currentCandleTime !== Math.floor(candleTime / 1000)) {
      currentCandleTime = Math.floor(candleTime / 1000);
      currentCandle = {
        time: currentCandleTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      // Actualizar vela existente
      currentCandle!.high = Math.max(currentCandle!.high!, price);
      currentCandle!.low = Math.min(currentCandle!.low!, price);
      currentCandle!.close = price;
    }

    yield {
      candle: currentCandle as Candle,
      tickIndex: i,
      totalTicks: ticks.length,
    };
  }
}

/**
 * Genera velas sintéticas para una señal cuando no hay ticks reales
 */
export function generateSyntheticCandles(
  entryPrice: number,
  exitPrice: number,
  entryTime: Date,
  exitTime: Date,
  timeframeMinutes: Timeframe
): Candle[] {
  const candles: Candle[] = [];
  const intervalMs = parseInt(timeframeMinutes) * 60 * 1000;
  const durationMs = exitTime.getTime() - entryTime.getTime();
  const numCandles = Math.max(1, Math.ceil(durationMs / intervalMs));

  for (let i = 0; i < numCandles; i++) {
    const progress = i / Math.max(1, numCandles - 1);
    const noise = (Math.random() - 0.5) * 0.5; // Ruido pequeño

    // Interpolar precio con algo de variación
    const basePrice = entryPrice + (exitPrice - entryPrice) * progress;
    const variation = Math.abs(exitPrice - entryPrice) * 0.1;

    const open = basePrice + (Math.random() - 0.5) * variation;
    const close = basePrice + noise * variation;
    const high = Math.max(open, close) + Math.random() * variation * 0.5;
    const low = Math.min(open, close) - Math.random() * variation * 0.5;

    candles.push({
      time: Math.floor((entryTime.getTime() + i * intervalMs) / 1000),
      open,
      high,
      low,
      close,
    });
  }

  return candles;
}
