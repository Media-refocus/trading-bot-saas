"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { OHLC } from "@/lib/candle-compression";

// ==================== TYPES ====================

export interface MAConfig {
  type: "SMA" | "EMA";
  period: number;
  color: string;
  visible: boolean;
}

export interface MALine {
  type: "SMA" | "EMA";
  period: number;
  color: string;
  values: Array<{ time: number; value: number | null }>;
}

export interface MAOverlayProps {
  lines: MAConfig[];
  onToggle: (period: number, type: "SMA" | "EMA") => void;
  className?: string;
}

// ==================== DEFAULT CONFIG ====================

export const DEFAULT_MA_LINES: MAConfig[] = [
  { type: "SMA", period: 20, color: "#FFB800", visible: true },
  { type: "SMA", period: 50, color: "#00BCD4", visible: true },
  { type: "EMA", period: 12, color: "#9C27B0", visible: false },
  { type: "EMA", period: 26, color: "#E91E63", visible: false },
];

// ==================== CALCULATION FUNCTIONS ====================

/**
 * Calcula Simple Moving Average (SMA)
 */
export function calculateSMA(candles: OHLC[], period: number): Array<{ time: number; value: number | null }> {
  const result: Array<{ time: number; value: number | null }> = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push({ time: candles[i].time, value: null });
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    result.push({ time: candles[i].time, value: sum / period });
  }

  return result;
}

/**
 * Calcula Exponential Moving Average (EMA)
 * EMA = Precio_actual * k + EMA_anterior * (1 - k)
 * k = 2 / (period + 1)
 */
export function calculateEMA(candles: OHLC[], period: number): Array<{ time: number; value: number | null }> {
  const result: Array<{ time: number; value: number | null }> = [];
  const k = 2 / (period + 1);

  // Primero calcular SMA para los primeros 'period' valores como base
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sum += candles[i].close;
      result.push({ time: candles[i].time, value: null });
      continue;
    }

    if (i === period - 1) {
      sum += candles[i].close;
      result.push({ time: candles[i].time, value: sum / period });
      continue;
    }

    // EMA = Precio * k + EMA_anterior * (1 - k)
    const prevEMA = result[i - 1].value!;
    const ema = candles[i].close * k + prevEMA * (1 - k);
    result.push({ time: candles[i].time, value: ema });
  }

  return result;
}

/**
 * Calcula todas las líneas de MA configuradas
 */
export function calculateMALines(candles: OHLC[], configs: MAConfig[]): MALine[] {
  return configs
    .filter(c => c.visible)
    .map(config => {
      const values = config.type === "SMA"
        ? calculateSMA(candles, config.period)
        : calculateEMA(candles, config.period);

      return {
        type: config.type,
        period: config.period,
        color: config.color,
        values,
      };
    });
}

// ==================== COMPONENT ====================

export function MAOverlay({ lines, onToggle, className }: MAOverlayProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-4 py-2 bg-[#252526] border-b border-[#3C3C3C]", className)}>
      <span className="text-xs text-[#888888] font-medium mr-2">Media Móvil:</span>
      {lines.map((line) => (
        <button
          key={`${line.type}-${line.period}`}
          onClick={() => onToggle(line.period, line.type)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all",
            line.visible
              ? "bg-[#333333] text-white"
              : "bg-transparent text-[#666666] hover:text-[#888888]"
          )}
        >
          {/* Color indicator */}
          <span
            className={cn(
              "w-3 h-0.5 rounded-full",
              line.visible ? "" : "opacity-30"
            )}
            style={{ backgroundColor: line.color }}
          />
          <span className="font-mono">
            {line.type}{line.period}
          </span>
        </button>
      ))}
    </div>
  );
}

// ==================== LEGEND COMPONENT ====================

interface MALegendProps {
  lines: MAConfig[];
  maValues: Map<string, number | null>;
  className?: string;
}

export function MALegend({ lines, maValues, className }: MALegendProps) {
  const visibleLines = lines.filter(l => l.visible);

  if (visibleLines.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 p-2 bg-[#1E1E1E]/90 rounded text-[10px] font-mono", className)}>
      {visibleLines.map(line => {
        const value = maValues.get(`${line.type}-${line.period}`);
        return (
          <div key={`${line.type}-${line.period}`} className="flex items-center gap-2">
            <span
              className="w-4 h-0.5 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            <span className="text-[#888888]">{line.type}{line.period}</span>
            <span className="text-white">
              {value !== null && value !== undefined ? value.toFixed(2) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ==================== HOOK ====================

/**
 * Hook para calcular MA lines con memoización
 */
export function useMALines(candles: OHLC[], configs: MAConfig[]): MALine[] {
  return useMemo(() => {
    if (candles.length === 0 || configs.every(c => !c.visible)) {
      return [];
    }
    return calculateMALines(candles, configs);
  }, [candles, configs]);
}
