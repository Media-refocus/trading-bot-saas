/**
 * Parser de señales desde CSV
 *
 * Formato esperado (signals_simple.csv):
 * ts_utc;kind;side;price_hint;range_id;message_id;confidence
 */

import { Side } from "../backtest-engine";

export interface RawSignal {
  timestamp: Date;
  kind: "range_open" | "range_close";
  side: Side | null;
  priceHint: number | null;
  rangeId: string;
  messageId: number;
  confidence: number | null;
}

export interface TradingSignal {
  id: string;
  timestamp: Date;
  side: Side;
  entryPrice: number;
  closeTimestamp?: Date;
  closePrice?: number;
  rangeId: string;
  confidence: number;
}

/**
 * Parsea una línea CSV a RawSignal
 */
function parseCsvLine(line: string): RawSignal | null {
  const parts = line.split(";");
  if (parts.length < 7) return null;

  const [tsUtc, kind, side, priceHint, rangeId, messageId, confidence] = parts;

  return {
    timestamp: new Date(tsUtc),
    kind: kind as "range_open" | "range_close",
    side: side === "BUY" || side === "SELL" ? (side as Side) : null,
    priceHint: priceHint ? parseFloat(priceHint) : null,
    rangeId: rangeId || "",
    messageId: messageId ? parseInt(messageId, 10) : 0,
    confidence: confidence ? parseFloat(confidence) : null,
  };
}

/**
 * Parsea contenido CSV completo a array de RawSignals
 */
export function parseSignalsCsv(content: string): RawSignal[] {
  const lines = content.trim().split("\n");
  const signals: RawSignal[] = [];

  // Saltar header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const signal = parseCsvLine(line);
    if (signal) {
      signals.push(signal);
    }
  }

  return signals;
}

/**
 * Convierte RawSignals a TradingSignals (pares open/close)
 */
export function groupSignalsByRange(rawSignals: RawSignal[]): TradingSignal[] {
  const rangeMap = new Map<string, { open: RawSignal; close?: RawSignal }>();

  for (const signal of rawSignals) {
    if (signal.kind === "range_open") {
      rangeMap.set(signal.rangeId, { open: signal });
    } else if (signal.kind === "range_close") {
      const existing = rangeMap.get(signal.rangeId);
      if (existing) {
        existing.close = signal;
      }
    }
  }

  const tradingSignals: TradingSignal[] = [];

  for (const [rangeId, { open, close }] of rangeMap) {
    // Solo requerimos side, el precio puede ser enriquecido después con ticks reales
    if (!open.side) continue;

    tradingSignals.push({
      id: rangeId,
      timestamp: open.timestamp,
      side: open.side,
      entryPrice: open.priceHint || 0, // 0 indica que necesita ser enriquecido
      closeTimestamp: close?.timestamp,
      closePrice: close ? (open.priceHint || 0) : undefined,
      rangeId,
      confidence: open.confidence || 0.95,
    });
  }

  // Ordenar por timestamp
  return tradingSignals.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

/**
 * Carga señales desde un archivo CSV en el servidor
 */
export async function loadSignalsFromFile(
  filePath: string
): Promise<TradingSignal[]> {
  const fs = await import("fs");
  const content = fs.readFileSync(filePath, "utf-8");
  const rawSignals = parseSignalsCsv(content);
  return groupSignalsByRange(rawSignals);
}

/**
 * Genera ticks sintéticos para simular movimiento de precio realista
 * (Se usa cuando no hay datos reales de ticks)
 *
 * Características del XAUUSD real (basado en ticks de MT5):
 * - Spread típico: 15-22 pips (0.15-0.22 en precio)
 * - Movimiento por tick: 0.1-0.3 pips normalmente, con saltos de 1-2 pips
 * - Rango típico en 1 hora: 50-200 pips según volatilidad
 */
export function generateSyntheticTicks(
  entryPrice: number,
  exitPrice: number,
  durationMs: number,
  volatilityPips: number = 100,
  startTimestamp?: Date
): { timestamp: Date; bid: number; ask: number; spread: number }[] {
  const ticks: { timestamp: Date; bid: number; ask: number; spread: number }[] =
    [];

  const PIP_VALUE = 0.1;

  // Spread realista para XAUUSD: 15-22 pips
  const baseSpread = 0.18; // 18 pips promedio

  // Más ticks para mejor visualización: ~1 tick por segundo de simulación
  // Mínimo 200 ticks, máximo 2000 para no saturar
  const targetTicks = Math.min(2000, Math.max(200, Math.floor(durationMs / 1000)));
  const numTicks = targetTicks;

  // Timestamp de inicio
  const startTs = startTimestamp ? startTimestamp.getTime() : Date.now() - durationMs;

  // Diferencia de precio objetivo
  const priceDiff = exitPrice - entryPrice;

  // Volatilidad en precio (100 pips = 10.0 en precio)
  const volatility = volatilityPips * PIP_VALUE;

  // Random walk acumulativo para movimiento natural
  let currentPrice = entryPrice;
  let accumulatedNoise = 0;

  // Parámetros de movimiento realista
  const tickNoise = volatility / 50; // ~0.2 pips por tick (realista)
  const jumpChance = 0.02; // 2% de probabilidad de salto brusco
  const jumpSize = volatility / 5; // Saltos de ~20 pips

  for (let i = 0; i <= numTicks; i++) {
    const progress = i / numTicks;

    // Tendencia base hacia el precio objetivo
    const trendPrice = entryPrice + priceDiff * progress;

    // Random walk: acumular ruido gradualmente
    const noiseStep = (Math.random() - 0.5) * 2 * tickNoise;
    accumulatedNoise += noiseStep;

    // Salto brusco ocasional (noticias, liquidez)
    if (Math.random() < jumpChance) {
      const jump = (Math.random() - 0.5) * 2 * jumpSize;
      accumulatedNoise += jump;
    }

    // Mean reversion suave: el ruido no debe alejarse demasiado
    accumulatedNoise *= 0.995;

    // Combinar tendencia + ruido acumulado
    // Aumentar peso del ruido hacia la mitad, reducir hacia los extremos
    const noiseWeight = Math.sin(progress * Math.PI);
    let finalPrice = trendPrice + accumulatedNoise * (0.5 + noiseWeight * 0.5);

    // Spread variable (15-22 pips, más ancho en movimientos bruscos)
    const spreadVariation = (Math.random() - 0.5) * 0.04;
    const spread = baseSpread + spreadVariation + (Math.abs(noiseStep) > tickNoise ? 0.03 : 0);

    ticks.push({
      timestamp: new Date(startTs + (durationMs * i) / numTicks),
      bid: finalPrice,
      ask: finalPrice + spread,
      spread,
    });
  }

  return ticks;
}
