"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { OHLC } from "@/lib/candle-compression";

// ==================== TYPES ====================

interface MiniMapProps {
  candles: OHLC[];
  visibleStart: number;
  visibleCount: number;
  onNavigate: (index: number) => void;
  className?: string;
  height?: number;
}

// ==================== CONSTANTS ====================

const VIEWPORT_COLOR = "rgba(0, 120, 212, 0.3)";
const VIEWPORT_BORDER_COLOR = "#0078D4";
const LINE_COLOR = "#4A90D9";
const AREA_COLOR = "rgba(74, 144, 217, 0.15)";
const BG_COLOR = "#1E1E1E";

// ==================== COMPONENT ====================

export function MiniMap({
  candles,
  visibleStart,
  visibleCount,
  onNavigate,
  className,
  height = 60,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);

  // Drag state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartVisibleStart = useRef(0);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const rect = container.getBoundingClientRect();
      setWidth(rect.width || 800);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Draw mini-map
  const drawMiniMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const padding = { top: 8, right: 10, bottom: 8, left: 10 };

    // Set canvas size
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear with background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Find price range
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const c of candles) {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
    }
    const priceRange = maxPrice - minPrice || 1;

    // Helper to convert index to X
    const indexToX = (index: number) => {
      return padding.left + (index / candles.length) * chartWidth;
    };

    // Helper to convert price to Y
    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
    };

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(indexToX(0), priceToY(candles[0].close));

    for (let i = 1; i < candles.length; i++) {
      ctx.lineTo(indexToX(i), priceToY(candles[i].close));
    }

    // Close the area path
    ctx.lineTo(indexToX(candles.length - 1), height - padding.bottom);
    ctx.lineTo(indexToX(0), height - padding.bottom);
    ctx.closePath();

    ctx.fillStyle = AREA_COLOR;
    ctx.fill();

    // Draw line on top
    ctx.beginPath();
    ctx.moveTo(indexToX(0), priceToY(candles[0].close));

    for (let i = 1; i < candles.length; i++) {
      ctx.lineTo(indexToX(i), priceToY(candles[i].close));
    }

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw viewport rectangle
    const viewportStart = indexToX(visibleStart);
    const viewportEnd = indexToX(Math.min(visibleStart + visibleCount, candles.length));
    const viewportWidth = Math.max(viewportEnd - viewportStart, 10);

    // Viewport fill
    ctx.fillStyle = VIEWPORT_COLOR;
    ctx.fillRect(viewportStart, padding.top, viewportWidth, chartHeight);

    // Viewport border
    ctx.strokeStyle = VIEWPORT_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportStart, padding.top, viewportWidth, chartHeight);

    // Draw handles on viewport (visual cue for draggable)
    const handleWidth = 4;
    ctx.fillStyle = VIEWPORT_BORDER_COLOR;
    ctx.fillRect(viewportStart, padding.top, handleWidth, chartHeight);
    ctx.fillRect(viewportStart + viewportWidth - handleWidth, padding.top, handleWidth, chartHeight);

  }, [candles, visibleStart, visibleCount, width, height]);

  // Render on state changes
  useEffect(() => {
    drawMiniMap();
  }, [drawMiniMap]);

  // Calculate index from X position
  const xToIndex = useCallback((x: number) => {
    const padding = { left: 10, right: 10 };
    const chartWidth = width - padding.left - padding.right;
    const relativeX = x - padding.left;
    const ratio = Math.max(0, Math.min(1, relativeX / chartWidth));
    return Math.floor(ratio * candles.length);
  }, [width, candles.length]);

  // Handle click to navigate
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedIndex = xToIndex(x);

    // Center the viewport on clicked position
    const newStart = Math.max(0, Math.min(candles.length - visibleCount, clickedIndex - Math.floor(visibleCount / 2)));
    onNavigate(newStart);
  }, [xToIndex, candles.length, visibleCount, onNavigate]);

  // Handle mouse down (start drag)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    isDragging.current = true;
    dragStartX.current = x;
    dragStartVisibleStart.current = visibleStart;

    // Change cursor
    canvas.style.cursor = "grabbing";
  }, [visibleStart]);

  // Handle mouse move (drag)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const deltaX = x - dragStartX.current;

    // Calculate delta in index units
    const padding = { left: 10, right: 10 };
    const chartWidth = width - padding.left - padding.right;
    const indexPerPixel = candles.length / chartWidth;

    const deltaIndex = Math.round(deltaX * indexPerPixel);
    const newStart = Math.max(0, Math.min(candles.length - visibleCount, dragStartVisibleStart.current + deltaIndex));

    onNavigate(newStart);
  }, [width, candles.length, visibleCount, onNavigate]);

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "pointer";
    }
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "pointer";
    }
  }, []);

  // No data state
  if (candles.length === 0) {
    return (
      <div
        className={cn("bg-[#1E1E1E] flex items-center justify-center text-[#888888] text-xs", className)}
        style={{ height }}
      >
        Sin datos
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "pointer"
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
