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

type Timeframe = "1" | "5" | "15" | "60" | "240" | "1440";

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

const PIP_VALUE = 0.1;
const HISTORY_CANDLES = 50;
const SPEED_INTERVALS: Record<number, number> = {
  1: 500,
  2: 250,
  5: 100,
  10: 50,
};
const DEFAULT_SPEED = 1;
const CANDLE_BODY_RATIO = 0.7;
const MIN_CANDLES_VISIBLE = 20;
const MAX_CANDLES_VISIBLE = 200;
const MIN_TOUCH_TARGET = 44;

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1": "M1",
  "5": "M5",
  "15": "M15",
  "60": "H1",
  "240": "H4",
  "1440": "D1",
};

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
    const tfMultiplier = parseInt(tf);
    const baseVolatility = 0.3 + Math.random() * 1.2;
    const volatility = baseVolatility * Math.sqrt(tfMultiplier / 60);
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
              ? "#26a69a"
              : "#ef5350"
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
            className={`p-2 rounded text-[11px] sm:text-xs border transition-all ${
              isPending
                ? "border-[#2a2e39] bg-[#1e222d]/50 opacity-50"
                : isClosed
                  ? "border-[#2a2e39] bg-[#1e222d]"
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
                    ? "bg-[#2a2e39] text-[#787b86]"
                    : isClosed
                      ? "bg-[#26a69a]/20 text-[#26a69a]"
                      : "bg-[#2962ff]/20 text-[#2962ff] animate-pulse"
                }`}
              >
                {isPending ? "PEND" : isClosed ? "OK" : "ACT"}
              </span>
            </div>
            <div className="font-mono text-[#d1d4dc]">
              {level.openPrice.toFixed(2)}
            </div>
            {isClosed && (
              <div className="text-[#26a69a] font-mono mt-1 text-[10px] sm:text-xs">
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
  themeId = "tv-pro",
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

  // Crosshair state
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isTouchHolding, setIsTouchHolding] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<OHLC | null>(null);
  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dimensions
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

    const isBuy = trade.signalSide === "BUY";
    const tpPrice = isBuy
      ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
      : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
    prices.push(tpPrice);

    const slPrice = isBuy
      ? trade.entryPrice - 50 * PIP_VALUE
      : trade.entryPrice + 50 * PIP_VALUE;
    prices.push(slPrice);

    if (trade.levels) {
      for (const level of trade.levels) {
        prices.push(level.openPrice);
      }
    }

    for (const c of displayedCandles) {
      prices.push(c.high, c.low);
    }

    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [trade, config, displayedCandles]);

  // Price range for visible candles
  const priceRange = useMemo(() => {
    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (visible.length === 0) return { min: allPrices.min, max: allPrices.max };

    let min = Infinity;
    let max = -Infinity;
    for (const c of visible) {
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
    }

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

    const padding = (max - min) * 0.15;
    return { min: min - padding, max: max + padding };
  }, [displayedCandles, visibleStart, visibleCount, trade, config, allPrices]);

  // ==================== RESPONSIVE HANDLING ====================

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mobile = rect.width < 768;
        setIsMobile(mobile);

        const height = mobile
          ? Math.max(350, window.innerHeight * 0.5)
          : 450;

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

    const history = generateHistoryCandles(
      trade.entryPrice,
      new Date(trade.entryTime),
      HISTORY_CANDLES,
      timeframe
    );
    setHistoryCandles(history);

    const tradeCndl = aggregateTicksToCandles(loadedTicks, timeframe);
    setTradeCandles(tradeCndl);

    const allCandles = [...history, ...tradeCndl];
    setDisplayedCandles(allCandles);

    setProgress(100);
    setCurrentTickIndex(loadedTicks.length);
    if (loadedTicks.length > 0) {
      setCurrentTick(loadedTicks[loadedTicks.length - 1]);
    }

    if (allCandles.length > 60) {
      setVisibleStart(Math.max(0, allCandles.length - 60));
    } else {
      setVisibleStart(0);
    }
    setVisibleCount(Math.min(60, allCandles.length));

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

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Chart area with room for price scale
    const padding = { top: 15, right: 70, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear with TradingView background
    ctx.fillStyle = "#131722";
    ctx.fillRect(0, 0, width, height);

    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (visible.length === 0) {
      ctx.fillStyle = "#787b86";
      ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos", width / 2, height / 2);
      return;
    }

    const { min: minPrice, max: maxPrice } = priceRange;
    const priceRangeValue = maxPrice - minPrice || 1;

    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / priceRangeValue) * chartHeight;

    const indexToX = (index: number) => {
      const candleWidth = chartWidth / visibleCount;
      return padding.left + index * candleWidth + candleWidth / 2;
    };

    // Draw subtle grid
    ctx.strokeStyle = "#1e222d";
    ctx.lineWidth = 1;

    // Horizontal grid (price)
    const priceSteps = 6;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRangeValue * i) / priceSteps;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price labels
      ctx.fillStyle = "#787b86";
      ctx.font = `${isMobile ? 10 : 11}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Vertical grid (time)
    const timeSteps = Math.min(6, visible.length);
    for (let i = 0; i < timeSteps; i++) {
      const idx = Math.floor((i / Math.max(1, timeSteps - 1)) * (visible.length - 1));
      const x = indexToX(idx);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      if (visible[idx]) {
        const date = new Date(visible[idx].time * 1000);
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = "#787b86";
        ctx.font = `${isMobile ? 9 : 10}px "IBM Plex Mono", monospace`;
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

      const color = isBullish ? "#26a69a" : "#ef5350";
      const wickColor = isBullish ? "#26a69a" : "#ef5350";

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

      // Highlight hovered candle
      if (hoveredCandle && hoveredCandle.time === candle.time) {
        ctx.strokeStyle = "#2962ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          x - candleBodyWidth / 2 - 2,
          Math.min(openY, closeY) - 2,
          candleBodyWidth + 4,
          Math.abs(closeY - openY) + 4
        );
      }
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

      // Grid levels (behind other markers)
      if (trade.levels) {
        for (const level of trade.levels) {
          if (level.level > 0) {
            const levelColor = "#2962ff";
            const levelY = priceToY(level.openPrice);

            ctx.strokeStyle = levelColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, levelY);
            ctx.lineTo(width - padding.right, levelY);
            ctx.stroke();

            ctx.fillStyle = levelColor;
            ctx.font = "10px 'IBM Plex Mono', monospace";
            ctx.textAlign = "left";
            ctx.fillText(`L${level.level} ${level.openPrice.toFixed(2)}`, width - padding.right + 5, levelY + 3);
          }
        }
        ctx.setLineDash([]);
      }

      // Entry line
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = "#2962ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();

      ctx.fillStyle = "#2962ff";
      ctx.font = "bold 10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`E ${trade.entryPrice.toFixed(2)}`, width - padding.right + 5, entryY + 3);

      // TP line
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = "#26a69a";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();

      ctx.fillStyle = "#26a69a";
      ctx.fillText(`TP ${tpPrice.toFixed(2)}`, width - padding.right + 5, tpY + 3);

      // SL line
      const slY = priceToY(slPrice);
      ctx.strokeStyle = "#ef5350";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, slY);
      ctx.lineTo(width - padding.right, slY);
      ctx.stroke();

      ctx.fillStyle = "#ef5350";
      ctx.fillText(`SL ${slPrice.toFixed(2)}`, width - padding.right + 5, slY + 3);

      ctx.setLineDash([]);

      // Exit marker
      if (trade.exitPrice && displayedCandles.length > 0) {
        const exitCandleTime = getCandleTime(new Date(trade.exitTime), timeframe);
        const exitIdx = displayedCandles.findIndex(c => c.time === Math.floor(exitCandleTime / 1000));

        if (exitIdx >= visibleStart && exitIdx < visibleStart + visibleCount) {
          const relativeIdx = exitIdx - visibleStart;
          const exitX = indexToX(relativeIdx);
          const exitY = priceToY(trade.exitPrice);

          // Diamond marker
          ctx.fillStyle = "#ff9800";
          ctx.beginPath();
          ctx.moveTo(exitX, exitY - 6);
          ctx.lineTo(exitX + 5, exitY);
          ctx.lineTo(exitX, exitY + 6);
          ctx.lineTo(exitX - 5, exitY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#ff9800";
          ctx.font = "bold 9px 'IBM Plex Mono', monospace";
          ctx.textAlign = "left";
          ctx.fillText(`X ${trade.exitPrice.toFixed(2)}`, exitX + 8, exitY + 3);
        }
      }
    }

    // Draw crosshair
    if (mousePos && mousePos.x > padding.left && mousePos.x < width - padding.right) {
      ctx.strokeStyle = "#787b86";
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
        ctx.fillStyle = "#2962ff";
        ctx.fillRect(width - padding.right + 2, mousePos.y - 9, 65, 18);

        ctx.fillStyle = "#ffffff";
        ctx.font = "11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(price.toFixed(2), width - padding.right + 5, mousePos.y + 3);

        // Time label at crosshair
        const candleWidth = chartWidth / visibleCount;
        const candleIndex = Math.floor((mousePos.x - padding.left) / candleWidth);
        if (candleIndex >= 0 && candleIndex < visible.length) {
          const candle = visible[candleIndex];
          const date = new Date(candle.time * 1000);
          const timeStr = date.toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });

          // Background for time label
          const timeLabelWidth = ctx.measureText(timeStr).width + 10;
          ctx.fillStyle = "#2962ff";
          ctx.fillRect(mousePos.x - timeLabelWidth / 2, height - padding.bottom + 2, timeLabelWidth, 16);

          ctx.fillStyle = "#ffffff";
          ctx.font = "10px 'IBM Plex Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(timeStr, mousePos.x, height - padding.bottom + 13);
        }
      }

      ctx.setLineDash([]);
    }

    // Current price line (if playing)
    if (currentTick && isPlaying) {
      const currentPrice = getMidPrice(currentTick);
      const currentY = priceToY(currentPrice);

      ctx.strokeStyle = "#2962ff";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padding.left, currentY);
      ctx.lineTo(width - padding.right, currentY);
      ctx.stroke();

      // Current price label
      ctx.fillStyle = "#2962ff";
      ctx.fillRect(width - padding.right + 2, currentY - 9, 65, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(currentPrice.toFixed(2), width - padding.right + 5, currentY + 3);
    }
  }, [dimensions, displayedCandles, visibleStart, visibleCount, priceRange, trade, config, mousePos, isMobile, currentTick, isPlaying, hoveredCandle]);

  // Render on state changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // ==================== MOUSE/TOUCH HANDLERS ====================

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    // Find hovered candle
    const padding = { left: 10, right: 70 };
    const chartWidth = rect.width - padding.left - padding.right;
    const candleWidth = chartWidth / visibleCount;
    const candleIndex = Math.floor((x - padding.left) / candleWidth);

    const visible = displayedCandles.slice(visibleStart, visibleStart + visibleCount);
    if (candleIndex >= 0 && candleIndex < visible.length) {
      setHoveredCandle(visible[candleIndex]);
    } else {
      setHoveredCandle(null);
    }
  }, [visibleCount, displayedCandles, visibleStart]);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    setHoveredCandle(null);
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

    const centerOffset = visibleCount / 2;
    const newCenterOffset = newCount / 2;
    const newStart = Math.max(0, Math.min(displayedCandles.length - newCount, Math.round(visibleStart + centerOffset - newCenterOffset)));

    setVisibleCount(newCount);
    setVisibleStart(newStart);
  }, [visibleCount, visibleStart, displayedCandles.length]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const touch = e.touches[0];

      setIsDragging(true);
      setDragStartX(touch.clientX);
      setDragStartVisibleStart(visibleStart);

      touchHoldTimerRef.current = setTimeout(() => {
        setIsTouchHolding(true);
        setMousePos({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      }, 300);
    } else if (e.touches.length === 2) {
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
      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
      }

      if (isTouchHolding) {
        const touch = e.touches[0];
        setMousePos({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        });
      } else if (isDragging) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartX;
        const candleWidth = (rect.width - 80) / visibleCount;
        const candleDelta = Math.round(deltaX / candleWidth);

        const newStart = Math.max(0, Math.min(displayedCandles.length - visibleCount, dragStartVisibleStart - candleDelta));
        setVisibleStart(newStart);
      }
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
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
    const allCandles = [...historyCandles, ...tradeCandles];
    setDisplayedCandles(allCandles);
    setCurrentTickIndex(allTicks.length);
    setProgress(100);
    setCurrentTick(allTicks.length > 0 ? allTicks[allTicks.length - 1] : null);
    setIsPlaying(false);

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

        const allCandles = [...history, ...tradeCndl];
        setDisplayedCandles(allCandles);
        setCurrentTickIndex(allTicks.length);
        setProgress(100);
        setIsPlaying(false);
        setCurrentTick(allTicks.length > 0 ? allTicks[allTicks.length - 1] : null);

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
      setDisplayedCandles([...historyCandles]);
      setCurrentTickIndex(0);
      setProgress(0);
      setCurrentTick(null);
      setIsPlaying(true);
    }
  }, [isPlaying, historyCandles]);

  const handleZoomIn = useCallback(() => {
    const newCount = Math.max(MIN_CANDLES_VISIBLE, visibleCount - 10);
    setVisibleCount(newCount);
  }, [visibleCount]);

  const handleZoomOut = useCallback(() => {
    const newCount = Math.min(MAX_CANDLES_VISIBLE, visibleCount + 10);
    const newStart = Math.max(0, Math.min(displayedCandles.length - newCount, visibleStart));
    setVisibleCount(newCount);
    setVisibleStart(newStart);
  }, [visibleCount, visibleStart, displayedCandles.length]);

  // ==================== VALIDATION ====================

  if (!trade) {
    return (
      <div className="text-center py-12 text-[#787b86]">
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
      <div className="text-center py-12 text-[#787b86]">
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

  // Current price info
  const currentPrice = currentTick ? getMidPrice(currentTick) : trade.exitPrice;
  const spread = currentTick?.spread ?? 0.02;

  // ==================== RENDER ====================

  return (
    <div className="space-y-0 bg-[#131722] rounded-lg overflow-hidden">
      {/* Header Bar - TradingView Style */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e222d] border-b border-[#2a2e39]">
        <div className="flex items-center gap-3">
          {/* Symbol */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#d1d4dc] text-sm">XAUUSD</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isBuy ? "bg-[#26a69a]/20 text-[#26a69a]" : "bg-[#ef5350]/20 text-[#ef5350]"
            }`}>
              {isBuy ? "LONG" : "SHORT"}
            </span>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-[#d1d4dc]">
              {currentPrice.toFixed(2)}
            </span>
            <span className={`text-xs font-mono ${
              trade.totalProfit >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"
            }`}>
              {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit.toFixed(2)}€
            </span>
          </div>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-[#2a2e39] text-[#787b86] hover:text-[#d1d4dc] transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-1 px-3 py-2 bg-[#1e222d] border-b border-[#2a2e39] overflow-x-auto">
        {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => handleTimeframeChange(tf)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              timeframe === tf
                ? "bg-[#2962ff] text-white"
                : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]"
            }`}
          >
            {TIMEFRAME_LABELS[tf]}
          </button>
        ))}

        <div className="w-px h-4 bg-[#2a2e39] mx-2" />

        {/* Speed selector */}
        {([1, 2, 5, 10] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              speed === s
                ? "bg-[#2962ff] text-white"
                : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]"
            }`}
          >
            {s}x
          </button>
        ))}

        <div className="flex-1" />

        {/* Play/Reset controls */}
        <button
          onClick={handlePlayPause}
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 ${
            isPlaying
              ? "bg-[#ff9800] text-white"
              : "bg-[#26a69a] text-white"
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Pause</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Replay</span>
            </>
          )}
        </button>

        <button
          onClick={handleReset}
          className="px-2 py-1 rounded text-xs font-medium text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
      </div>

      {/* Main Chart Area with Side Panel */}
      <div className="flex">
        {/* Chart Canvas */}
        <div className="flex-1 relative">
          <div
            ref={containerRef}
            className="w-full"
            style={{ height: dimensions.height }}
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

          {/* Hovered Candle Info Overlay */}
          {hoveredCandle && mousePos && !isMobile && (
            <div className="absolute top-2 left-2 bg-[#1e222d]/95 border border-[#2a2e39] rounded px-2 py-1.5 text-xs font-mono">
              <div className="flex gap-3">
                <span className="text-[#787b86]">O</span>
                <span className="text-[#d1d4dc]">{hoveredCandle.open.toFixed(2)}</span>
                <span className="text-[#787b86]">H</span>
                <span className="text-[#d1d4dc]">{hoveredCandle.high.toFixed(2)}</span>
                <span className="text-[#787b86]">L</span>
                <span className="text-[#d1d4dc]">{hoveredCandle.low.toFixed(2)}</span>
                <span className="text-[#787b86]">C</span>
                <span className={hoveredCandle.close >= hoveredCandle.open ? "text-[#26a69a]" : "text-[#ef5350]"}>
                  {hoveredCandle.close.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e222d] border-t border-[#2a2e39]">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39] transition-colors"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39] transition-colors"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-[10px] text-[#787b86] font-mono ml-1">
            {visibleCount} velas
          </span>
        </div>

        {/* Progress */}
        <div className="flex-1 mx-4 max-w-xs">
          <div className="h-1 bg-[#2a2e39] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2962ff] transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-[#787b86] font-mono">
          <span>{allTicks.length.toLocaleString()} ticks</span>
          <span className={trade.totalProfit >= 0 ? "text-[#26a69a]" : "text-[#ef5350]"}>
            {isBuy ? "+" : ""}{((trade.exitPrice - trade.entryPrice) / PIP_VALUE).toFixed(1)} pips
          </span>
        </div>
      </div>

      {/* Price Levels Legend */}
      <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-[#1e222d] border-t border-[#2a2e39] text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#2962ff]" />
          <span className="text-[#787b86]">Entry</span>
          <span className="font-mono text-[#d1d4dc]">{trade.entryPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#26a69a]" style={{ borderStyle: "dashed" }} />
          <span className="text-[#787b86]">TP</span>
          <span className="font-mono text-[#26a69a]">{tpPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#ef5350]" style={{ borderStyle: "dashed" }} />
          <span className="text-[#787b86]">SL</span>
          <span className="font-mono text-[#ef5350]">{slPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#ff9800]" />
          <span className="text-[#787b86]">Exit</span>
          <span className="font-mono text-[#ff9800]">{trade.exitPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Exit Reason Badge */}
      <div className="flex items-center justify-center py-2 bg-[#1e222d] border-t border-[#2a2e39]">
        <span
          className={`text-xs px-3 py-1 rounded-full ${
            trade.exitReason === "TAKE_PROFIT"
              ? "bg-[#26a69a]/20 text-[#26a69a]"
              : trade.exitReason === "TRAILING_SL"
                ? "bg-[#ff9800]/20 text-[#ff9800]"
                : "bg-[#ef5350]/20 text-[#ef5350]"
          }`}
        >
          {trade.exitReason === "TAKE_PROFIT"
            ? "✓ Take Profit Hit"
            : trade.exitReason === "TRAILING_SL"
              ? "↗ Trailing Stop"
              : "✗ Stop Loss"}
        </span>
      </div>

      {/* Grid levels status */}
      {trade.levels && trade.levels.length > 0 && (
        <div className="bg-[#1e222d] border-t border-[#2a2e39] p-3">
          <div className="text-[10px] text-[#787b86] mb-2 uppercase tracking-wider">
            Niveles de Grid
          </div>
          <LevelsStatus
            levels={trade.levels}
            currentTick={currentTick}
            isBuy={isBuy}
            levelColors={["#7b1fa2", "#f57c00", "#388e3c", "#c2185b"]}
          />
        </div>
      )}

      {/* Synthetic ticks warning */}
      {!hasRealTicks && ticks.length === 0 && (
        <div className="text-center py-2 bg-[#ff9800]/10 border-t border-[#ff9800]/20">
          <span className="text-[#ff9800] text-xs">
            Sin ticks reales - simulando con ticks sintéticos
          </span>
        </div>
      )}
    </div>
  );
}
