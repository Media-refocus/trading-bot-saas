"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  onClose?: () => void;
}

// ==================== CONSTANTS ====================

const PIP_VALUE = 0.1; // XAUUSD: 1 pip = 0.10 en precio
const HISTORY_CANDLES = 50;
const SPEED_INTERVALS: Record<number, number> = {
  1: 500,
  2: 250,
  5: 100,
  10: 50,
};
const DEFAULT_SPEED = 1;
const CANDLE_BODY_RATIO = 0.65;
const MIN_CANDLES_VISIBLE = 20;
const MAX_CANDLES_VISIBLE = 200;

// Touch target minimum
const MIN_TOUCH_TARGET = 44;

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

/**
 * Generate history candles with REALISTIC XAUUSD volatility
 * XAUUSD typical M1 volatility: 0.3-1.5 price points per candle
 * This equals 3-15 pips per minute
 */
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
    // XAUUSD realistic volatility: 0.3-1.5 price points per M1 candle
    // For M5/M15, scale accordingly
    const tfMultiplier = parseInt(tf);
    const baseVolatility = 0.3 + Math.random() * 1.2; // 0.3 to 1.5
    const volatility = baseVolatility * Math.sqrt(tfMultiplier); // Scale by timeframe

    // Random trend component (small)
    const trend = (Math.random() - 0.5) * 0.2;

    const open = currentPrice;
    const close = open + trend + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * 0.3;

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
  onClose,
}: SimpleCandleChartProps) {
  const colors = getThemeColors(themeId);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Chart state
  const [timeframe, setTimeframe] = useState<Timeframe>("1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [progress, setProgress] = useState(0);
  const [currentTickIndex, setCurrentTickIndex] = useState(0);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);

  // View state
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartVisibleStart, setDragStartVisibleStart] = useState(0);

  // Touch zoom state
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);

  // Crosshair state (touch-hold)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isTouchHolding, setIsTouchHolding] = useState(false);
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dimensions - BIGGER CHART
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [isMobile, setIsMobile] = useState(false);

  // Derived data
  const [allTicks, setAllTicks] = useState<Tick[]>([]);
  const [historyCandles, setHistoryCandles] = useState<OHLC[]>([]);
  const [tradeCandles, setTradeCandles] = useState<OHLC[]>([]);
  const [displayedCandles, setDisplayedCandles] = useState<OHLC[]>([]);

  // Calculate all relevant prices for auto-fit
  const allPrices = useMemo(() => {
    if (!trade) return { min: 0, max: 1 };

    const prices: number[] = [trade.entryPrice, trade.exitPrice];

    // Add TP
    const isBuy = trade.signalSide === "BUY";
    const tpPrice = isBuy
      ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
      : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
    prices.push(tpPrice);

    // Add SL (assume 50 pips if not hit)
    const slPrice = isBuy
      ? trade.entryPrice - 50 * PIP_VALUE
      : trade.entryPrice + 50 * PIP_VALUE;
    prices.push(slPrice);

    // Add all level prices
    if (trade.levels) {
      for (const level of trade.levels) {
        prices.push(level.openPrice);
      }
    }

    // Add visible candle prices
    for (const c of displayedCandles) {
      prices.push(c.high, c.low);
    }

    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [trade, config, displayedCandles]);

  // Price range for visible candles - AUTO-FIT to show ALL markers
  const priceRange = useMemo(() => {
    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (visible.length === 0) return { min: allPrices.min, max: allPrices.max };

    let min = Infinity;
    let max = -Infinity;
    for (const c of visible) {
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
    }

    // ALWAYS include trade markers in range
    if (trade) {
      const isBuy = trade.signalSide === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      min = Math.min(min, trade.entryPrice, trade.exitPrice, tpPrice, slPrice);
      max = Math.max(max, trade.entryPrice, trade.exitPrice, tpPrice, slPrice);

      if (trade.levels) {
        for (const level of trade.levels) {
          min = Math.min(min, level.openPrice);
          max = Math.max(max, level.openPrice);
        }
      }
    }

    const padding = (max - min) * 0.15; // 15% padding
    return { min: min - padding, max: max + padding };
  }, [displayedCandles, visibleStart, visibleCount, trade, config, allPrices]);

  // ==================== RESPONSIVE HANDLING ====================

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mobile = rect.width < 768;
        setIsMobile(mobile);

        // BIGGER CHART SIZES
        const height = mobile
          ? Math.max(350, window.innerHeight * 0.5) // Mobile: 50% viewport, min 350px
          : 450; // Desktop: 450px

        setDimensions({
          width: rect.width,
          height,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // ==================== LOAD TICKS & AUTO-SHOW ALL CANDLES ====================

  useEffect(() => {
    if (!trade) {
      setAllTicks([]);
      setHistoryCandles([]);
      setTradeCandles([]);
      setDisplayedCandles([]);
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

    // Generate history candles
    const history = generateHistoryCandles(
      trade.entryPrice,
      new Date(trade.entryTime),
      HISTORY_CANDLES,
      timeframe
    );
    setHistoryCandles(history);

    // Aggregate trade candles
    const tradeCndl = aggregateTicksToCandles(loadedTicks, timeframe);
    setTradeCandles(tradeCndl);

    // AUTO-SHOW ALL CANDLES IMMEDIATELY (history + trade candles)
    const allCandles = [...history, ...tradeCndl];
    setDisplayedCandles(allCandles);

    // Set progress to 100% since we're showing everything
    setProgress(100);
    setCurrentTickIndex(loadedTicks.length);
    if (loadedTicks.length > 0) {
      setCurrentTick(loadedTicks[loadedTicks.length - 1]);
    }

    // Auto-fit to show all candles
    if (allCandles.length > 60) {
      setVisibleStart(Math.max(0, allCandles.length - 60));
    } else {
      setVisibleStart(0);
    }
    setVisibleCount(Math.min(60, allCandles.length));

    // Don't auto-play
    setIsPlaying(false);
  }, [trade, ticks, timeframe]);

  // ==================== REPLAY ANIMATION ====================

  useEffect(() => {
    if (!isPlaying || allTicks.length === 0) {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
      return;
    }

    const intervalMs = SPEED_INTERVALS[speed] || 500;
    let idx = 0;
    let currentCandles = [...historyCandles];

    // Reset to history candles when starting replay
    setDisplayedCandles([...historyCandles]);
    setCurrentTickIndex(0);
    setProgress(0);

    replayIntervalRef.current = setInterval(() => {
      if (idx >= allTicks.length) {
        setIsPlaying(false);
        if (replayIntervalRef.current) {
          clearInterval(replayIntervalRef.current);
          replayIntervalRef.current = null;
        }
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
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
        replayIntervalRef.current = null;
      }
    };
  }, [isPlaying, speed, allTicks, timeframe, historyCandles]);

  // ==================== CANVAS RENDERING ====================

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;

    // Set canvas size with DPR
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Chart area with room for labels
    const padding = { top: 20, right: 75, bottom: 35, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear with theme background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Get visible candles
    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (visible.length === 0) {
      ctx.fillStyle = colors.text;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos", width / 2, height / 2);
      return;
    }

    const { min: minPrice, max: maxPrice } = priceRange;
    const priceRangeValue = maxPrice - minPrice || 1;

    // Helper functions
    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / priceRangeValue) * chartHeight;

    const indexToX = (index: number) => {
      const candleWidth = chartWidth / visibleCount;
      return padding.left + index * candleWidth + candleWidth / 2;
    };

    // Draw grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    // Horizontal grid (price) - with labels
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRangeValue * i) / priceSteps;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price labels on Y-axis (right side)
      ctx.fillStyle = colors.text;
      ctx.font = `${isMobile ? 10 : 11}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Vertical grid (time) - with labels
    const timeSteps = Math.min(6, visible.length);
    for (let i = 0; i < timeSteps; i++) {
      const idx = Math.floor((i / Math.max(1, timeSteps - 1)) * (visible.length - 1));
      const x = indexToX(idx);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Time labels on X-axis (bottom)
      if (visible[idx]) {
        const date = new Date(visible[idx].time * 1000);
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = colors.text;
        ctx.font = `${isMobile ? 9 : 10}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(timeStr, x, height - padding.bottom + 15);
      }
    }

    // Calculate candle dimensions
    const candleSlotWidth = chartWidth / visibleCount;
    const candleBodyWidth = candleSlotWidth * CANDLE_BODY_RATIO;
    const candleWickWidth = 1;

    // Draw candles
    for (let i = 0; i < visible.length; i++) {
      const candle = visible[i];
      const x = indexToX(i);
      const isBullish = candle.close >= candle.open;

      const color = isBullish ? colors.candleUp : colors.candleDown;
      const wickColor = isBullish ? colors.wickUp : colors.wickDown;

      const openY = priceToY(candle.open);
      const closeY = priceToY(candle.close);
      const highY = priceToY(candle.high);
      const lowY = priceToY(candle.low);

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = candleWickWidth;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;

      ctx.fillStyle = color;
      ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight);
    }

    // Draw trade markers
    if (trade) {
      const isBuy = trade.signalSide === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      // Grid levels FIRST (so they're behind other markers)
      if (trade.levels) {
        for (const level of trade.levels) {
          if (level.level > 0) {
            const levelColor = "#00bcd4"; // Cyan for grid levels
            const levelY = priceToY(level.openPrice);

            ctx.strokeStyle = levelColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, levelY);
            ctx.lineTo(width - padding.right, levelY);
            ctx.stroke();

            ctx.fillStyle = levelColor;
            ctx.font = "10px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`L${level.level} ${level.openPrice.toFixed(2)}`, width - padding.right + 5, levelY + 3);
          }
        }
        ctx.setLineDash([]);
      }

      // Entry line - SOLID BLUE, full width
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = "#2196f3"; // Blue
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();

      ctx.fillStyle = "#2196f3";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Entry ${trade.entryPrice.toFixed(2)}`, width - padding.right + 5, entryY + 4);

      // TP line - GREEN DASHED
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = "#4caf50"; // Green
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();

      ctx.fillStyle = "#4caf50";
      ctx.fillText(`TP ${tpPrice.toFixed(2)}`, width - padding.right + 5, tpY + 4);

      // SL line - RED DASHED
      const slY = priceToY(slPrice);
      ctx.strokeStyle = "#f44336"; // Red
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, slY);
      ctx.lineTo(width - padding.right, slY);
      ctx.stroke();

      ctx.fillStyle = "#f44336";
      ctx.fillText(`SL ${slPrice.toFixed(2)}`, width - padding.right + 5, slY + 4);

      ctx.setLineDash([]);

      // Exit marker - ORANGE/YELLOW at exit candle
      if (trade.exitPrice && displayedCandles.length > 0) {
        // Find the exit candle (last trade candle)
        const exitCandleTime = getCandleTime(new Date(trade.exitTime), timeframe);
        const exitIdx = displayedCandles.findIndex(c => c.time === Math.floor(exitCandleTime / 1000));

        if (exitIdx >= visibleStart && exitIdx < visibleStart + visibleCount) {
          const relativeIdx = exitIdx - visibleStart;
          const exitX = indexToX(relativeIdx);
          const exitY = priceToY(trade.exitPrice);

          // Diamond marker for exit
          ctx.fillStyle = "#ff9800"; // Orange
          ctx.beginPath();
          ctx.moveTo(exitX, exitY - 8);
          ctx.lineTo(exitX + 6, exitY);
          ctx.lineTo(exitX, exitY + 8);
          ctx.lineTo(exitX - 6, exitY);
          ctx.closePath();
          ctx.fill();

          // Exit label
          ctx.fillStyle = "#ff9800";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`Exit ${trade.exitPrice.toFixed(2)}`, exitX + 10, exitY + 4);
        }
      }
    }

    // Draw crosshair (on mouse or touch-hold)
    if (mousePos && mousePos.x > padding.left && mousePos.x < width - padding.right) {
      ctx.strokeStyle = colors.text + "60";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePos.x, padding.top);
      ctx.lineTo(mousePos.x, height - padding.bottom);
      ctx.stroke();

      // Horizontal line
      if (mousePos.y > padding.top && mousePos.y < height - padding.bottom) {
        ctx.beginPath();
        ctx.moveTo(padding.left, mousePos.y);
        ctx.lineTo(width - padding.right, mousePos.y);
        ctx.stroke();

        // Price label at crosshair
        const price = minPrice + ((height - padding.bottom - mousePos.y) / chartHeight) * priceRangeValue;

        // Background for price label
        ctx.fillStyle = colors.background;
        ctx.fillRect(width - padding.right + 2, mousePos.y - 8, 70, 16);

        ctx.fillStyle = colors.text;
        ctx.font = "11px monospace";
        ctx.textAlign = "left";
        ctx.fillText(price.toFixed(2), width - padding.right + 5, mousePos.y + 4);
      }

      ctx.setLineDash([]);
    }
  }, [dimensions, displayedCandles, visibleStart, visibleCount, priceRange, colors, trade, config, mousePos, isMobile]);

  // Render on state changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // ==================== MOUSE/TOUCH HANDLERS ====================

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartVisibleStart(visibleStart);
  }, [visibleStart]);

  const handleMouseMoveDrag = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = e.clientX - dragStartX;
    const candleWidth = (rect.width - 80) / visibleCount;
    const candleDelta = Math.round(deltaX / candleWidth);

    const newStart = Math.max(0, Math.min(displayedCandles.length - visibleCount, dragStartVisibleStart - candleDelta));
    setVisibleStart(newStart);
  }, [isDragging, dragStartX, dragStartVisibleStart, visibleCount, displayedCandles.length]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 5 : -5;
    const newCount = Math.max(MIN_CANDLES_VISIBLE, Math.min(MAX_CANDLES_VISIBLE, visibleCount + delta));

    // Adjust visibleStart to keep center candle in center
    const centerOffset = visibleCount / 2;
    const newCenterOffset = newCount / 2;
    const newStart = Math.max(0, Math.min(displayedCandles.length - newCount, Math.round(visibleStart + centerOffset - newCenterOffset)));

    setVisibleCount(newCount);
    setVisibleStart(newStart);
  }, [visibleCount, visibleStart, displayedCandles.length]);

  // Touch handlers with touch-hold for crosshair
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const touch = e.touches[0];

      // Start drag immediately
      setIsDragging(true);
      setDragStartX(touch.clientX);
      setDragStartVisibleStart(visibleStart);

      // Start touch-hold timer for crosshair (300ms)
      touchHoldTimerRef.current = setTimeout(() => {
        setIsTouchHolding(true);
        setMousePos({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      }, 300);
    } else if (e.touches.length === 2) {
      // Pinch start - cancel touch-hold
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
      }
      setIsTouchHolding(false);
      setMousePos(null);

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setLastPinchDistance(Math.sqrt(dx * dx + dy * dy));
    }
  }, [visibleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      // Cancel touch-hold if moving
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
      }

      if (isTouchHolding) {
        // Update crosshair position
        const touch = e.touches[0];
        setMousePos({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      } else if (isDragging) {
        // Pan
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartX;
        const candleWidth = (rect.width - 80) / visibleCount;
        const candleDelta = Math.round(deltaX / candleWidth);

        const newStart = Math.max(0, Math.min(displayedCandles.length - visibleCount, dragStartVisibleStart - candleDelta));
        setVisibleStart(newStart);
      }
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const delta = (lastPinchDistance - distance) / 10;
      const newCount = Math.max(MIN_CANDLES_VISIBLE, Math.min(MAX_CANDLES_VISIBLE, visibleCount + Math.round(delta)));

      setVisibleCount(newCount);
      setLastPinchDistance(distance);
    }
  }, [isDragging, dragStartX, dragStartVisibleStart, visibleCount, displayedCandles.length, lastPinchDistance, isTouchHolding]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setLastPinchDistance(null);
    setIsTouchHolding(false);
    setMousePos(null);

    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  }, []);

  // ==================== HANDLERS ====================

  const handleReset = useCallback(() => {
    // Reset to show all candles (history + trade)
    const allCandles = [...historyCandles, ...tradeCandles];
    setDisplayedCandles(allCandles);
    setCurrentTickIndex(allTicks.length);
    setProgress(100);
    setCurrentTick(allTicks.length > 0 ? allTicks[allTicks.length - 1] : null);
    setIsPlaying(false);

    // Auto-fit
    if (allCandles.length > 60) {
      setVisibleStart(Math.max(0, allCandles.length - 60));
    } else {
      setVisibleStart(0);
    }
    setVisibleCount(Math.min(60, allCandles.length));
  }, [historyCandles, tradeCandles, allTicks]);

  const handleTimeframeChange = useCallback(
    (tf: Timeframe) => {
      setTimeframe(tf);
      if (trade) {
        const history = generateHistoryCandles(
          trade.entryPrice,
          new Date(trade.entryTime),
          HISTORY_CANDLES,
          tf
        );
        setHistoryCandles(history);

        const tradeCndl = aggregateTicksToCandles(allTicks, tf);
        setTradeCandles(tradeCndl);

        // Show all candles
        const allCandles = [...history, ...tradeCndl];
        setDisplayedCandles(allCandles);
        setCurrentTickIndex(allTicks.length);
        setProgress(100);
        setIsPlaying(false);
        setCurrentTick(allTicks.length > 0 ? allTicks[allTicks.length - 1] : null);

        // Auto-fit
        if (allCandles.length > 60) {
          setVisibleStart(Math.max(0, allCandles.length - 60));
        } else {
          setVisibleStart(0);
        }
        setVisibleCount(Math.min(60, allCandles.length));
      }
    },
    [trade, allTicks]
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // Start replay from beginning
      setDisplayedCandles([...historyCandles]);
      setCurrentTickIndex(0);
      setProgress(0);
      setCurrentTick(null);
      setIsPlaying(true);
    }
  }, [isPlaying, historyCandles]);

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
    <div className="space-y-3">
      {/* Trade header - COMPACT ON MOBILE */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-800 rounded-lg">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Side badge + basic info - single line when possible */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded font-bold text-[13px] sm:text-sm ${
                isBuy ? "bg-green-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {isBuy ? "LONG" : "SHORT"}
            </span>
            <span
              className={`font-bold text-[13px] sm:text-sm ${
                trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {trade.totalProfit >= 0 ? "+" : ""}
              {trade.totalProfit.toFixed(2)}€
            </span>
          </div>

          {/* Entry/Exit info - compact */}
          <div className="text-[13px] sm:text-sm flex gap-3">
            <div>
              <span className="text-gray-400">E: </span>
              <span className="font-mono text-white">{trade.entryPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">X: </span>
              <span className="font-mono text-white">{trade.exitPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          {/* Close button - 44x44 touch target */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-11 h-11 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-400 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Controls - LARGER TOUCH TARGETS */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800 rounded-lg">
        {/* Timeframe buttons - flex-wrap for mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {(["1", "5", "15"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-4 py-2.5 rounded text-sm font-medium transition-colors min-h-[44px] min-w-[44px] ${
                timeframe === tf
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              M{tf}
            </button>
          ))}
        </div>

        {/* Speed selector - flex-wrap for mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {([1, 2, 5, 10] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-4 py-2.5 rounded text-sm font-medium transition-colors min-h-[44px] min-w-[44px] ${
                speed === s
                  ? "bg-purple-600 text-white"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Play/Pause - PROMINENT */}
        <button
          onClick={handlePlayPause}
          className={`px-6 py-2.5 rounded font-medium text-white flex items-center justify-center gap-2 min-h-[48px] ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Pausar</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Replay</span>
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-2.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white flex items-center justify-center gap-2 min-h-[44px]"
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
          <div className="w-full sm:w-auto sm:ml-auto text-sm text-center sm:text-left">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-yellow-400">
              {getMidPrice(currentTick).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Chart container - BIGGER */}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ backgroundColor: colors.background, height: dimensions.height }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseMove={(e) => {
            handleMouseMove(e);
            handleMouseMoveDrag(e);
          }}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="cursor-crosshair touch-none"
        />
      </div>

      {/* Progress bar - BELOW chart */}
      <div className="space-y-1 px-3">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{allTicks.length.toLocaleString()} ticks</span>
          <span>{currentTickIndex.toLocaleString()} procesados</span>
        </div>
      </div>

      {/* Price levels legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 bg-slate-800 rounded-lg text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-0.5"
            style={{ backgroundColor: "#2196f3" }}
          />
          <span className="text-gray-400">Entry:</span>
          <span className="font-mono text-white">
            {trade.entryPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: "#4caf50" }} />
          <span className="text-gray-400">TP:</span>
          <span className="font-mono text-green-400">{tpPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ backgroundColor: "#f44336" }} />
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
