"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { getThemeColors } from "@/lib/chart-themes";
import type { OHLC } from "@/lib/candle-compression";
import type { MALine } from "./ma-overlay";

// ==================== TYPES ====================

interface TradeMarker {
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  side: "BUY" | "SELL";
  profit?: number;
}

interface EquityPoint {
  time: number;
  equity: number;
}

interface VolumeBar {
  time: number;
  volume: number;
}

interface CandleChartCanvasProps {
  candles: OHLC[];
  visibleStart?: number;
  visibleCount?: number;
  currentCandleIndex?: number;
  tradeMarkers?: TradeMarker[];
  equityCurve?: EquityPoint[];
  volumeBars?: VolumeBar[];
  maLines?: MALine[];
  config?: {
    takeProfitPips?: number;
  };
  themeId?: string;
  className?: string;
  onZoomChange?: (zoom: number) => void;
  showEquityCurve?: boolean;
  showVolume?: boolean;
  onExportPng?: () => void;
}

// Mouse state for crosshair
interface MouseState {
  x: number;
  y: number;
  isInside: boolean;
  candleIndex: number;
}

// ==================== CONSTANTS ====================

const PIP_VALUE = 0.1;
const CANDLE_BODY_RATIO = 0.65;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;

// ==================== COMPONENT ====================

export function CandleChartCanvas({
  candles,
  visibleStart: externalVisibleStart,
  visibleCount: externalVisibleCount = 60,
  currentCandleIndex = 0,
  tradeMarkers = [],
  equityCurve = [],
  volumeBars = [],
  maLines = [],
  config = {},
  themeId = "mt5",
  className,
  onZoomChange,
  showEquityCurve = false,
  showVolume = false,
  onExportPng,
}: CandleChartCanvasProps) {
  const colors = getThemeColors(themeId);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equityCanvasRef = useRef<HTMLCanvasElement>(null);
  const volumeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isMobile, setIsMobile] = useState(false);

  // Mouse state for crosshair
  const [mouse, setMouse] = useState<MouseState>({
    x: 0,
    y: 0,
    isInside: false,
    candleIndex: -1,
  });

  // Zoom state
  const [zoom, setZoom] = useState(1);

  // Calculate visible range
  const visibleCount = externalVisibleCount;
  const visibleStart = externalVisibleStart ?? Math.max(0, candles.length - visibleCount);
  const visibleEnd = Math.min(candles.length, visibleStart + visibleCount);
  const visibleCandles = candles.slice(visibleStart, visibleEnd);

  // Calculate price range with padding
  const priceRange = useCallback(() => {
    if (visibleCandles.length === 0) {
      return { min: 0, max: 1 };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const c of visibleCandles) {
      min = Math.min(min, c.low);
      max = Math.max(max, c.high);
    }

    // Add trade markers to range
    for (const trade of tradeMarkers) {
      min = Math.min(min, trade.entryPrice, trade.exitPrice);
      max = Math.max(max, trade.entryPrice, trade.exitPrice);

      // Add TP/SL
      const isBuy = trade.side === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + (config.takeProfitPips ?? 50) * PIP_VALUE
        : trade.entryPrice - (config.takeProfitPips ?? 50) * PIP_VALUE;
      const slPrice = isBuy
        ? trade.entryPrice - 50 * PIP_VALUE
        : trade.entryPrice + 50 * PIP_VALUE;

      min = Math.min(min, tpPrice, slPrice);
      max = Math.max(max, tpPrice, slPrice);
    }

    // Add padding
    const padding = (max - min) * 0.1 || 1;
    return { min: min - padding, max: max + padding };
  }, [visibleCandles, tradeMarkers, config]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: rect.width || 800,
        height: rect.height || 400,
      });
      setIsMobile(window.innerWidth < 768);
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    window.addEventListener("resize", updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Draw chart
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
    if (visibleCandles.length === 0) {
      ctx.fillStyle = colors.text;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No hay datos", width / 2, height / 2);
      return;
    }

    const { min: minPrice, max: maxPrice } = priceRange();
    const priceRangeValue = maxPrice - minPrice || 1;

    // Helper functions
    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / priceRangeValue) * chartHeight;

    const yToPrice = (y: number) =>
      minPrice + ((padding.top + chartHeight - y) / chartHeight) * priceRangeValue;

    const indexToX = (index: number) => {
      const candleWidth = (chartWidth * zoom) / visibleCount;
      return padding.left + index * candleWidth + candleWidth / 2;
    };

    const xToIndex = (x: number) => {
      const candleWidth = (chartWidth * zoom) / visibleCount;
      return Math.floor((x - padding.left) / candleWidth);
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
    const timeSteps = Math.min(6, visibleCandles.length);
    for (let i = 0; i < timeSteps; i++) {
      const idx = Math.floor((i / Math.max(1, timeSteps - 1)) * (visibleCandles.length - 1));
      const x = indexToX(idx);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Time labels on X-axis (bottom)
      if (visibleCandles[idx]) {
        const date = new Date(visibleCandles[idx].time * 1000);
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = colors.text;
        ctx.font = `${isMobile ? 9 : 10}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(timeStr, x, height - padding.bottom + 15);
      }
    }

    // Calculate candle dimensions
    const candleSlotWidth = (chartWidth * zoom) / visibleCount;
    const candleBodyWidth = candleSlotWidth * CANDLE_BODY_RATIO;
    const candleWickWidth = 1;

    // Draw candles
    for (let i = 0; i < visibleCandles.length; i++) {
      const candle = visibleCandles[i];
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

      // Highlight current candle in playback
      if (i === currentCandleIndex - visibleStart && currentCandleIndex >= visibleStart && currentCandleIndex < visibleEnd) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - candleBodyWidth / 2 - 2, bodyTop - 2, candleBodyWidth + 4, bodyHeight + 4);
      }
    }

    // Draw MA lines
    for (const ma of maLines) {
      if (!ma.values || ma.values.length === 0) continue;

      ctx.strokeStyle = ma.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      let isFirstPoint = true;
      for (let i = 0; i < visibleCandles.length; i++) {
        const candle = visibleCandles[i];
        // Find matching MA value by time
        const maValue = ma.values.find(v => v.time === candle.time);
        if (!maValue || maValue.value === null) continue;

        const x = indexToX(i);
        const y = priceToY(maValue.value);

        if (isFirstPoint) {
          ctx.moveTo(x, y);
          isFirstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw trade arrows instead of horizontal lines
    for (const trade of tradeMarkers) {
      // Find entry candle index
      const entryTime = Math.floor(new Date(trade.entryTime).getTime() / 1000);
      const entryCandleIdx = visibleCandles.findIndex(c => c.time === entryTime);

      if (entryCandleIdx >= 0) {
        const candle = visibleCandles[entryCandleIdx];
        const x = indexToX(entryCandleIdx);
        const isBuy = trade.side === "BUY";

        // Arrow position: below low for BUY, above high for SELL
        const arrowY = isBuy ? priceToY(candle.low) + 15 : priceToY(candle.high) - 15;
        const arrowColor = isBuy ? "#22c55e" : "#ef4444";

        // Draw arrow
        ctx.fillStyle = arrowColor;
        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 2;

        const arrowSize = 10;
        ctx.beginPath();
        if (isBuy) {
          // Up arrow for BUY
          ctx.moveTo(x, arrowY);
          ctx.lineTo(x - arrowSize / 2, arrowY + arrowSize);
          ctx.lineTo(x + arrowSize / 2, arrowY + arrowSize);
        } else {
          // Down arrow for SELL
          ctx.moveTo(x, arrowY);
          ctx.lineTo(x - arrowSize / 2, arrowY - arrowSize);
          ctx.lineTo(x + arrowSize / 2, arrowY - arrowSize);
        }
        ctx.closePath();
        ctx.fill();

        // Draw entry price label
        const entryY = priceToY(trade.entryPrice);
        ctx.fillStyle = "#2196f3";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`E: ${trade.entryPrice.toFixed(2)}`, width - padding.right + 5, entryY + 4);
      }
    }

    // Draw playback position indicator
    if (currentCandleIndex >= 0 && currentCandleIndex < candles.length) {
      const relativeIndex = currentCandleIndex - visibleStart;
      if (relativeIndex >= 0 && relativeIndex < visibleCandles.length) {
        const x = indexToX(relativeIndex);

        // Vertical line at current position
        ctx.strokeStyle = "#0078D4";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw crosshair if mouse is inside
    if (mouse.isInside && mouse.candleIndex >= 0 && mouse.candleIndex < visibleCandles.length) {
      const candle = visibleCandles[mouse.candleIndex];
      const x = indexToX(mouse.candleIndex);

      // Crosshair lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mouse.x, padding.top);
      ctx.lineTo(mouse.x, height - padding.bottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(padding.left, mouse.y);
      ctx.lineTo(width - padding.right, mouse.y);
      ctx.stroke();

      ctx.setLineDash([]);

      // Price marker on Y-axis
      const price = yToPrice(mouse.y);
      ctx.fillStyle = "#0078D4";
      ctx.fillRect(width - padding.right, mouse.y - 10, 70, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, mouse.y + 4);

      // OHLC Tooltip
      const tooltipX = Math.min(mouse.x + 15, width - 150);
      const tooltipY = Math.max(padding.top + 10, mouse.y - 80);
      const tooltipWidth = 130;
      const tooltipHeight = 95;

      // Tooltip background
      ctx.fillStyle = "rgba(30, 30, 30, 0.95)";
      ctx.strokeStyle = "#3C3C3C";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Tooltip content
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";

      const date = new Date(candle.time * 1000);
      const dateStr = date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
      const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

      ctx.fillText(`${dateStr} ${timeStr}`, tooltipX + 10, tooltipY + 18);

      ctx.font = "11px monospace";
      ctx.fillStyle = "#888888";
      ctx.fillText("O:", tooltipX + 10, tooltipY + 36);
      ctx.fillText("H:", tooltipX + 10, tooltipY + 51);
      ctx.fillText("L:", tooltipX + 10, tooltipY + 66);
      ctx.fillText("C:", tooltipX + 10, tooltipY + 81);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(candle.open.toFixed(2), tooltipX + 30, tooltipY + 36);
      ctx.fillStyle = "#22c55e";
      ctx.fillText(candle.high.toFixed(2), tooltipX + 30, tooltipY + 51);
      ctx.fillStyle = "#ef4444";
      ctx.fillText(candle.low.toFixed(2), tooltipX + 30, tooltipY + 66);
      ctx.fillStyle = candle.close >= candle.open ? "#22c55e" : "#ef4444";
      ctx.fillText(candle.close.toFixed(2), tooltipX + 30, tooltipY + 81);
    }
  }, [dimensions, visibleCandles, visibleStart, visibleCount, priceRange, colors, tradeMarkers, config, isMobile, currentCandleIndex, candles.length, mouse, zoom, maLines]);

  // Mouse event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 20, right: 75, bottom: 35, left: 10 };
    const chartWidth = dimensions.width - padding.left - padding.right;

    const candleWidth = (chartWidth * zoom) / visibleCount;
    const candleIndex = Math.floor((x - padding.left) / candleWidth);

    setMouse({
      x,
      y,
      isInside: x >= padding.left && x <= dimensions.width - padding.right &&
                y >= padding.top && y <= dimensions.height - padding.bottom,
      candleIndex,
    });
  }, [dimensions, zoom, visibleCount]);

  const handleMouseLeave = useCallback(() => {
    setMouse(prev => ({ ...prev, isInside: false }));
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));

    if (newZoom !== zoom) {
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    }
  }, [zoom, onZoomChange]);

  // Render on state changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Draw equity curve in separate canvas
  useEffect(() => {
    if (!showEquityCurve || !equityCanvasRef.current || equityCurve.length === 0) return;

    const canvas = equityCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = 100;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 10, right: 75, bottom: 20, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Find min/max equity
    const minEquity = Math.min(...equityCurve.map(p => p.equity));
    const maxEquity = Math.max(...equityCurve.map(p => p.equity));
    const range = maxEquity - minEquity || 1;

    // Draw equity line
    ctx.strokeStyle = "#0078D4";
    ctx.lineWidth = 2;
    ctx.beginPath();

    equityCurve.forEach((point, i) => {
      const x = padding.left + (i / (equityCurve.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.equity - minEquity) / range) * chartHeight;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw zero line if equity goes negative
    if (minEquity < 10000) {
      const zeroY = padding.top + chartHeight - ((10000 - minEquity) / range) * chartHeight;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Labels
    ctx.fillStyle = colors.text;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`$${maxEquity.toFixed(0)}`, width - padding.right + 5, padding.top + 10);
    ctx.fillText(`$${minEquity.toFixed(0)}`, width - padding.right + 5, height - padding.bottom);
  }, [showEquityCurve, equityCurve, dimensions, colors]);

  // Draw volume bars in separate canvas
  useEffect(() => {
    if (!showVolume || !volumeCanvasRef.current || volumeBars.length === 0) return;

    const canvas = volumeCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = 60;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 5, right: 75, bottom: 15, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Find max volume
    const visibleVolumes = volumeBars.slice(visibleStart, visibleEnd);
    const maxVolume = Math.max(...visibleVolumes.map(v => v.volume), 1);

    // Draw volume bars
    const barWidth = (chartWidth * zoom) / visibleCount;
    
    visibleVolumes.forEach((vol, i) => {
      const x = padding.left + i * barWidth + barWidth * 0.3;
      const barHeight = (vol.volume / maxVolume) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // Color based on price direction (match candle)
      const candle = visibleCandles[i];
      const isBullish = candle && candle.close >= candle.open;
      ctx.fillStyle = isBullish ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)";
      ctx.fillRect(x, y, barWidth * 0.6, barHeight);
    });

    // Volume label
    ctx.fillStyle = colors.text;
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Vol: ${(maxVolume / 1000).toFixed(1)}K`, width - padding.right + 5, padding.top + 10);
  }, [showVolume, volumeBars, dimensions, colors, visibleStart, visibleEnd, visibleCount, zoom, visibleCandles]);

  // Export PNG function
  const exportPng = useCallback(() => {
    const mainCanvas = canvasRef.current;
    const equityCanvas = equityCanvasRef.current;
    const volumeCanvas = volumeCanvasRef.current;
    
    if (!mainCanvas) return;

    // Create composite canvas
    const totalHeight = dimensions.height + 
      (showEquityCurve && equityCanvas ? 100 : 0) + 
      (showVolume && volumeCanvas? 60 : 0);
    
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = dimensions.width * (window.devicePixelRatio || 1);
    exportCanvas.height = totalHeight * (window.devicePixelRatio || 1);
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    // Draw main chart
    ctx.drawImage(mainCanvas, 0, 0);
    
    let offsetY = dimensions.height;

    // Draw volume
    if (showVolume && volumeCanvas) {
      ctx.drawImage(volumeCanvas, 0, offsetY);
      offsetY += 60;
    }

    // Draw equity
    if (showEquityCurve && equityCanvas) {
      ctx.drawImage(equityCanvas, 0, offsetY);
    }

    // Download
    const link = document.createElement("a");
    link.download = "backtester-chart.png";
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, [dimensions, showEquityCurve, showVolume]);

  // Expose export function via ref
  useEffect(() => {
    if (onExportPng) {
      // Parent can call this via callback
    }
  }, [onExportPng]);

  return (
    <div ref={containerRef} className={className} style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", flex: showEquityCurve || showVolume ? "1" : "1", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
      {showVolume && volumeBars.length > 0 && (
        <canvas
          ref={volumeCanvasRef}
          style={{ width: "100%", height: 60, display: "block", borderTop: "1px solid #3C3C3C" }}
        />
      )}
      {showEquityCurve && equityCurve.length > 0 && (
        <canvas
          ref={equityCanvasRef}
          style={{ width: "100%", height: 100, display: "block", borderTop: "1px solid #3C3C3C" }}
        />
      )}
    </div>
  );
}
