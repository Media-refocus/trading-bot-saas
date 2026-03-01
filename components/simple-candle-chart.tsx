"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getThemeColors } from "@/lib/chart-themes";

// ==================== TYPES ====================

interface TradeLevel {
  level: number;
  openPrice: number;
  closePrice: number;
  openTime: Date;
  closeTime: Date;
}

interface TradeDetail {
  signalTimestamp: Date;
  signalSide: "BUY" | "SELL";
  signalPrice: number;
  entryPrice: number;
  entryTime: Date;
  exitPrice: number;
  exitTime: Date;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL";
  totalProfit: number;
  levels: TradeLevel[];
}

interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread?: number;
}

interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type Timeframe = "1" | "5" | "15";

interface SimpleCandleChartProps {
  ticks: Tick[];
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
  themeId?: string;
}

// ==================== CONSTANTS ====================

const PIP_VALUE = 0.1;
const HISTORY_CANDLES = 50;
const DEFAULT_SPEED = 10;
const SPEED_OPTIONS = [1, 2, 5, 10, 20, 50, 100];

// ==================== UTILITY FUNCTIONS ====================

function getTimeframeMs(tf: Timeframe): number {
  return parseInt(tf) * 60 * 1000;
}

function getCandleTime(timestamp: Date, tf: Timeframe): number {
  const intervalMs = getTimeframeMs(tf);
  const time = timestamp.getTime();
  return Math.floor(time / intervalMs) * intervalMs;
}

function getMidPrice(tick: Tick): number {
  return (tick.bid + tick.ask) / 2;
}

function generateHistoryCandles(
  entryPrice: number,
  entryTime: Date,
  count: number,
  tf: Timeframe
): OHLC[] {
  const candles: OHLC[] = [];
  const intervalMs = getTimeframeMs(tf);
  let currentPrice = entryPrice;
  let currentTime = getCandleTime(entryTime, tf) - intervalMs;

  for (let i = 0; i < count; i++) {
    const volatility = 0.5 + Math.random() * 1.5;
    const trend = (Math.random() - 0.5) * 0.3;
    const open = currentPrice;
    const close = open + trend + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.unshift({
      time: Math.floor(currentTime / 1000),
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
    currentTime -= intervalMs;
  }

  return candles;
}

function aggregateTicksToCandles(ticks: Tick[], tf: Timeframe): OHLC[] {
  if (ticks.length === 0) return [];

  const candleMap = new Map<number, OHLC>();

  for (const tick of ticks) {
    const price = getMidPrice(tick);
    const candleTime = getCandleTime(new Date(tick.timestamp), tf);
    const timeKey = Math.floor(candleTime / 1000);

    const existing = candleMap.get(timeKey);
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    } else {
      candleMap.set(timeKey, {
        time: timeKey,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    }
  }

  return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
}

function generateSyntheticTicks(
  entryPrice: number,
  exitPrice: number,
  entryTime: Date,
  exitTime: Date
): Tick[] {
  const entryMs = entryTime.getTime();
  const exitMs = exitTime.getTime();
  const durationMs = exitMs - entryMs;

  if (durationMs <= 0) return [];

  const avgInterval = 300;
  const numTicks = Math.max(100, Math.ceil(durationMs / avgInterval));
  const ticks: Tick[] = [];
  const priceDiff = exitPrice - entryPrice;
  const baseSpread = 0.02;

  let currentPrice = entryPrice;
  let lastTime = entryMs;

  for (let i = 0; i < numTicks; i++) {
    const progress = numTicks > 1 ? i / (numTicks - 1) : 0;
    const targetPrice = entryPrice + priceDiff * progress;
    const trend = (targetPrice - currentPrice) * 0.1;
    const noise = (Math.random() - 0.5) * 0.05;
    currentPrice += trend + noise;

    const spread = baseSpread + (Math.random() - 0.5) * 0.01;
    lastTime += avgInterval + (Math.random() - 0.5) * 200;

    ticks.push({
      timestamp: new Date(lastTime),
      bid: currentPrice,
      ask: currentPrice + spread,
      spread,
    });
  }

  return ticks;
}

// ==================== LEVELS STATUS COMPONENT ====================

function LevelsStatus({
  levels,
  currentTick,
  isBuy,
  levelColors,
}: {
  levels: TradeLevel[];
  currentTick: Tick | null;
  isBuy: boolean;
  levelColors: string[];
}) {
  const currentTimeMs = currentTick
    ? new Date(currentTick.timestamp).getTime()
    : Date.now();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {levels.map((level) => {
        const entryTimeMs = levels[0]?.openTime
          ? new Date(levels[0].openTime).getTime()
          : 0;
        const openTimeMs = level.openTime
          ? new Date(level.openTime).getTime()
          : level.level === 0
            ? entryTimeMs
            : Infinity;
        const closeTimeMs = level.closeTime
          ? new Date(level.closeTime).getTime()
          : Infinity;

        const isOpened = currentTimeMs >= openTimeMs && !isNaN(openTimeMs);
        const isClosed =
          (currentTimeMs >= closeTimeMs && closeTimeMs !== Infinity) ||
          (level.closePrice != null && level.closePrice !== 0);
        const isPending = !isOpened && !isClosed;

        const levelColor =
          level.level === 0
            ? isBuy
              ? "#00c853"
              : "#ff1744"
            : levelColors[(level.level - 1) % levelColors.length];

        let pipsGained = 0;
        if (isClosed && level.closePrice) {
          pipsGained = isBuy
            ? (level.closePrice - level.openPrice) / PIP_VALUE
            : (level.openPrice - level.closePrice) / PIP_VALUE;
        }

        return (
          <div
            key={level.level}
            className={`p-2 rounded text-[11px] sm:text-xs border ${
              isPending
                ? "border-gray-700 bg-gray-800/50 opacity-50"
                : isClosed
                  ? "border-gray-600 bg-gray-800"
                  : "border-current"
            }`}
            style={{
              borderColor: isClosed || isPending ? undefined : levelColor,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold" style={{ color: levelColor }}>
                {level.level === 0 ? "ENTRY" : `L${level.level}`}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] ${
                  isPending
                    ? "bg-gray-700 text-gray-400"
                    : isClosed
                      ? "bg-green-900/50 text-green-400"
                      : "bg-blue-900/50 text-blue-400 animate-pulse"
                }`}
              >
                {isPending ? "PEND" : isClosed ? "OK" : "ACT"}
              </span>
            </div>
            <div className="font-mono text-gray-300">
              {level.openPrice.toFixed(2)}
            </div>
            {isClosed && (
              <div className="text-green-400 font-mono mt-1 text-[10px] sm:text-xs">
                +{pipsGained.toFixed(1)} pips
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function SimpleCandleChart({
  ticks,
  trade,
  config,
  hasRealTicks = true,
  themeId = "mt5",
}: SimpleCandleChartProps) {
  const colors = getThemeColors(themeId);

  // Refs for chart
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  // State
  const [timeframe, setTimeframe] = useState<Timeframe>("1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [progress, setProgress] = useState(0);
  const [currentTickIndex, setCurrentTickIndex] = useState(0);
  const [allTicks, setAllTicks] = useState<Tick[]>([]);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [displayedCandles, setDisplayedCandles] = useState<OHLC[]>([]);
  const [historyCandles, setHistoryCandles] = useState<OHLC[]>([]);
  const [isChartReady, setIsChartReady] = useState(false);

  // ==================== CHART INITIALIZATION ====================

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let chart: any = null;
    let series: any = null;

    (async () => {
      try {
        const lc = await import("lightweight-charts");

        if (!mounted || !containerRef.current) return;

        chart = lc.createChart(containerRef.current, {
          layout: {
            background: { type: lc.ColorType.Solid, color: colors.background },
            textColor: colors.text,
          },
          grid: {
            vertLines: { color: colors.grid, style: 1 },
            horzLines: { color: colors.grid, style: 1 },
          },
          crosshair: {
            mode: lc.CrosshairMode.Normal,
            vertLine: {
              color: colors.text + "50",
              width: 1,
              style: 2,
            },
            horzLine: {
              color: colors.text + "50",
              width: 1,
              style: 2,
            },
          },
          rightPriceScale: {
            borderColor: colors.grid,
            scaleMargins: { top: 0.1, bottom: 0.1 },
          },
          timeScale: {
            borderColor: colors.grid,
            timeVisible: true,
            secondsVisible: false,
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: true,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
        });

        series = chart.addCandlestickSeries({
          upColor: colors.candleUp,
          downColor: colors.candleDown,
          borderUpColor: colors.candleUp,
          borderDownColor: colors.candleDown,
          wickUpColor: colors.wickUp,
          wickDownColor: colors.wickDown,
        });

        if (!mounted) {
          chart.remove();
          return;
        }

        chartRef.current = chart;
        seriesRef.current = series;
        setIsChartReady(true);

        // Handle resize
        const handleResize = () => {
          if (containerRef.current && chart) {
            chart.applyOptions({
              width: containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        // Cleanup on unmount
        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (error) {
        console.error("Error initializing chart:", error);
      }
    })();

    return () => {
      mounted = false;
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        chartRef.current = null;
        seriesRef.current = null;
        priceLinesRef.current = [];
        setIsChartReady(false);
      }
    };
  }, [colors]);

  // ==================== LOAD TICKS ====================

  useEffect(() => {
    if (!trade) {
      setAllTicks([]);
      setDisplayedCandles([]);
      setHistoryCandles([]);
      setCurrentTickIndex(0);
      setProgress(0);
      setIsPlaying(false);
      setCurrentTick(null);
      return;
    }

    let loadedTicks: Tick[] = [];
    if (ticks && ticks.length > 0) {
      loadedTicks = ticks;
    } else if (trade.entryPrice != null && trade.exitPrice != null) {
      loadedTicks = generateSyntheticTicks(
        trade.entryPrice,
        trade.exitPrice,
        new Date(trade.entryTime),
        new Date(trade.exitTime)
      );
    }

    setAllTicks(loadedTicks);

    const history = generateHistoryCandles(
      trade.entryPrice,
      new Date(trade.entryTime),
      HISTORY_CANDLES,
      timeframe
    );
    setHistoryCandles(history);
    setDisplayedCandles(history);
    setCurrentTickIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setCurrentTick(null);
  }, [trade, ticks, timeframe]);

  // ==================== UPDATE CHART DATA ====================

  useEffect(() => {
    if (!seriesRef.current || displayedCandles.length === 0 || !isChartReady)
      return;

    seriesRef.current.setData(displayedCandles);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [displayedCandles, isChartReady]);

  // ==================== PRICE LINES ====================

  useEffect(() => {
    if (!seriesRef.current || !trade || !isChartReady) return;

    // Remove existing price lines
    for (const line of priceLinesRef.current) {
      try {
        seriesRef.current.removePriceLine(line);
      } catch (e) {
        // Ignore errors
      }
    }
    priceLinesRef.current = [];

    const isBuy = trade.signalSide === "BUY";
    const newLines: any[] = [];

    // Entry line
    const entryLine = seriesRef.current.createPriceLine({
      price: trade.entryPrice,
      color: colors.entryLine,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Entry",
    });
    newLines.push(entryLine);

    // Take Profit line
    const tpPrice = isBuy
      ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
      : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
    const tpLine = seriesRef.current.createPriceLine({
      price: tpPrice,
      color: colors.tpLine,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "TP",
    });
    newLines.push(tpLine);

    // Stop Loss line (50 pips default)
    const slPrice = isBuy
      ? trade.entryPrice - 50 * PIP_VALUE
      : trade.entryPrice + 50 * PIP_VALUE;
    const slLine = seriesRef.current.createPriceLine({
      price: slPrice,
      color: colors.slLine,
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "SL",
    });
    newLines.push(slLine);

    // Level lines
    if (trade.levels) {
      for (const level of trade.levels) {
        if (level.level > 0) {
          const levelColor =
            colors.levelColors[(level.level - 1) % colors.levelColors.length];
          const levelLine = seriesRef.current.createPriceLine({
            price: level.openPrice,
            color: levelColor,
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: false,
            title: `L${level.level}`,
          });
          newLines.push(levelLine);
        }
      }
    }

    priceLinesRef.current = newLines;
  }, [trade, config, colors, isChartReady]);

  // ==================== REPLAY ANIMATION ====================

  useEffect(() => {
    if (!isPlaying || allTicks.length === 0) return;

    const intervalMs = Math.max(5, 100 / speed);
    let idx = currentTickIndex;
    let currentCandles = [...historyCandles];
    let cancelled = false;

    const interval = setInterval(() => {
      if (cancelled || idx >= allTicks.length) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      const tick = allTicks[idx];
      const price = getMidPrice(tick);
      const candleTime = getCandleTime(new Date(tick.timestamp), timeframe);
      const timeKey = Math.floor(candleTime / 1000);

      const lastCandle = currentCandles[currentCandles.length - 1];
      if (lastCandle && lastCandle.time === timeKey) {
        lastCandle.high = Math.max(lastCandle.high, price);
        lastCandle.low = Math.min(lastCandle.low, price);
        lastCandle.close = price;
      } else {
        currentCandles.push({
          time: timeKey,
          open: price,
          high: price,
          low: price,
          close: price,
        });
      }

      setDisplayedCandles([...currentCandles]);
      setCurrentTick(tick);
      setProgress(((idx + 1) / allTicks.length) * 100);
      setCurrentTickIndex(idx);
      idx++;
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPlaying, speed, allTicks, currentTickIndex, timeframe, historyCandles]);

  // ==================== HANDLERS ====================

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTickIndex(0);
    setProgress(0);
    setCurrentTick(null);
    setDisplayedCandles(historyCandles);
  }, [historyCandles]);

  const handleTimeframeChange = useCallback(
    (tf: Timeframe) => {
      setTimeframe(tf);
      if (trade && allTicks.length > 0) {
        const history = generateHistoryCandles(
          trade.entryPrice,
          new Date(trade.entryTime),
          HISTORY_CANDLES,
          tf
        );
        setHistoryCandles(history);
        setDisplayedCandles(history);
        setCurrentTickIndex(0);
        setProgress(0);
        setIsPlaying(false);
        setCurrentTick(null);
      }
    },
    [trade, allTicks]
  );

  // ==================== VALIDATION ====================

  if (!trade) {
    return (
      <div className="text-center py-12 text-gray-400">
        Selecciona un trade para ver el gráfico
      </div>
    );
  }

  if (
    trade.entryPrice == null ||
    isNaN(trade.entryPrice) ||
    trade.exitPrice == null ||
    isNaN(trade.exitPrice)
  ) {
    return (
      <div className="text-center py-12 text-gray-400">
        Datos del trade incompletos
      </div>
    );
  }

  const isBuy = trade.signalSide === "BUY";
  const tpPrice = isBuy
    ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
    : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
  const slPrice = isBuy
    ? trade.entryPrice - 50 * PIP_VALUE
    : trade.entryPrice + 50 * PIP_VALUE;

  // ==================== RENDER ====================

  return (
    <div className="space-y-4">
      {/* Trade header */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 p-3 bg-slate-800 rounded-lg">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span
            className={`px-3 py-1.5 sm:py-1 rounded font-bold text-[13px] sm:text-sm ${
              isBuy ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {trade.signalSide}
          </span>
          <div className="text-[13px] sm:text-sm">
            <span className="text-gray-400">Entry: </span>
            <span className="font-mono text-white">
              {trade.entryPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-[13px] sm:text-sm">
            <span className="text-gray-400">Exit: </span>
            <span className="font-mono text-white">
              {trade.exitPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-[13px] sm:text-sm">
            <span className="text-gray-400">P/L: </span>
            <span
              className={`font-bold ${
                trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {trade.totalProfit >= 0 ? "+" : ""}
              {trade.totalProfit.toFixed(2)}€
            </span>
          </div>
        </div>
        <div
          className={`text-[11px] sm:text-xs px-2 py-1 rounded ${
            trade.exitReason === "TAKE_PROFIT"
              ? "bg-green-900/50 text-green-400"
              : trade.exitReason === "TRAILING_SL"
                ? "bg-yellow-900/50 text-yellow-400"
                : "bg-red-900/50 text-red-400"
          }`}
        >
          {trade.exitReason === "TAKE_PROFIT"
            ? "TP Hit"
            : trade.exitReason === "TRAILING_SL"
              ? "Trailing SL"
              : "Stop Loss"}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-slate-800 rounded-lg">
        {/* Timeframe buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">TF:</span>
          {(["1", "5", "15"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-3 py-2.5 sm:py-1.5 rounded text-[13px] sm:text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
                timeframe === tf
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              M{tf}
            </button>
          ))}
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-3 py-2.5 sm:py-1.5 bg-slate-700 rounded text-[13px] sm:text-sm border-0 text-white min-h-[44px] sm:min-h-0"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-4 py-2.5 sm:py-1.5 rounded font-medium text-white flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? (
            <>
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">Pausar</span>
              <span className="sm:hidden">||</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              Play
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-2.5 sm:py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Current price */}
        {currentTick && (
          <div className="w-full sm:w-auto sm:ml-auto text-[13px] sm:text-sm text-center sm:text-left">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-yellow-400">
              {getMidPrice(currentTick).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] sm:text-xs text-gray-500">
          <span>{allTicks.length.toLocaleString()} ticks</span>
          <span>{currentTickIndex.toLocaleString()} procesados</span>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden min-h-[300px] sm:min-h-[450px]"
        style={{ backgroundColor: colors.background }}
      />

      {/* Price levels legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 bg-slate-800 rounded-lg text-[13px] sm:text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-0.5"
            style={{ backgroundColor: colors.entryLine }}
          />
          <span className="text-gray-400">Entry:</span>
          <span className="font-mono text-white">
            {trade.entryPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: colors.tpLine }} />
          <span className="text-gray-400">TP:</span>
          <span className="font-mono text-green-400">{tpPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: colors.slLine }} />
          <span className="text-gray-400">SL:</span>
          <span className="font-mono text-red-400">{slPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Pips:</span>
          <span
            className={`font-mono font-bold ${
              trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {isBuy
              ? ((trade.exitPrice - trade.entryPrice) / PIP_VALUE).toFixed(1)
              : ((trade.entryPrice - trade.exitPrice) / PIP_VALUE).toFixed(1)}
          </span>
        </div>
      </div>

      {/* Grid levels status */}
      {trade.levels && trade.levels.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
            Niveles de Grid
          </div>
          <LevelsStatus
            levels={trade.levels}
            currentTick={currentTick}
            isBuy={isBuy}
            levelColors={colors.levelColors}
          />
        </div>
      )}

      {/* Synthetic ticks warning */}
      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          Sin ticks reales - simulando con ticks sintéticos
        </p>
      )}
    </div>
  );
}
