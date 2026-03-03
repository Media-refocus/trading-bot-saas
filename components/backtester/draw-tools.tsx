"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

// ==================== TYPES ====================

export type DrawTool = "cursor" | "horizontal" | "trendline" | "rectangle" | "fibonacci";

export interface DrawShape {
  id: string;
  type: DrawTool;
  color: string;
  // Para líneas horizontales
  price?: number;
  // Para líneas de tendencia y rectángulos
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  // Para fibonacci
  fibLevels?: { level: number; price: number }[];
}

interface DrawToolsState {
  activeTool: DrawTool;
  shapes: DrawShape[];
  selectedColor: string;
  isDrawing: boolean;
  currentShape: DrawShape | null;
}

interface UseDrawToolsReturn {
  state: DrawToolsState;
  setActiveTool: (tool: DrawTool) => void;
  setSelectedColor: (color: string) => void;
  clearAllShapes: () => void;
  deleteShape: (id: string) => void;
  handleMouseDown: (e: React.MouseEvent, priceToY: (price: number) => number, yToPrice: (y: number) => number) => void;
  handleMouseMove: (e: React.MouseEvent, priceToY: (price: number) => number, yToPrice: (y: number) => number) => void;
  handleMouseUp: () => void;
}

// ==================== CONSTANTS ====================

const DRAW_COLORS = [
  { name: "Amarillo", value: "#FFD700" },
  { name: "Azul", value: "#00BFFF" },
  { name: "Rojo", value: "#FF4444" },
  { name: "Verde", value: "#44FF44" },
  { name: "Naranja", value: "#FFA500" },
  { name: "Morado", value: "#AA44FF" },
  { name: "Blanco", value: "#FFFFFF" },
];

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const TOOL_ICONS: Record<DrawTool, string> = {
  cursor: "↖",
  horizontal: "─",
  trendline: "╱",
  rectangle: "▢",
  fibonacci: "Φ",
};

const TOOL_LABELS: Record<DrawTool, string> = {
  cursor: "Cursor",
  horizontal: "Línea Horizontal",
  trendline: "Línea de Tendencia",
  rectangle: "Rectángulo",
  fibonacci: "Fibonacci",
};

// ==================== HOOK ====================

export function useDrawTools(): UseDrawToolsReturn {
  const [state, setState] = useState<DrawToolsState>({
    activeTool: "cursor",
    shapes: [],
    selectedColor: "#FFD700",
    isDrawing: false,
    currentShape: null,
  });

  const setActiveTool = useCallback((tool: DrawTool) => {
    setState(prev => ({ ...prev, activeTool: tool }));
  }, []);

  const setSelectedColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, selectedColor: color }));
  }, []);

  const clearAllShapes = useCallback(() => {
    setState(prev => ({ ...prev, shapes: [] }));
  }, []);

  const deleteShape = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      shapes: prev.shapes.filter(s => s.id !== id),
    }));
  }, []);

  const generateId = () => `shape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    priceToY: (price: number) => number,
    yToPrice: (y: number) => number
  ) => {
    if (state.activeTool === "cursor") return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = yToPrice(y);

    let newShape: DrawShape | null = null;

    switch (state.activeTool) {
      case "horizontal":
        newShape = {
          id: generateId(),
          type: "horizontal",
          color: state.selectedColor,
          price,
        };
        break;

      case "trendline":
      case "rectangle":
      case "fibonacci":
        newShape = {
          id: generateId(),
          type: state.activeTool,
          color: state.selectedColor,
          startPoint: { x, y },
          endPoint: { x, y },
        };
        break;
    }

    if (newShape) {
      setState(prev => ({
        ...prev,
        isDrawing: true,
        currentShape: newShape,
      }));
    }
  }, [state.activeTool, state.selectedColor]);

  const handleMouseMove = useCallback((
    e: React.MouseEvent,
    priceToY: (price: number) => number,
    yToPrice: (y: number) => number
  ) => {
    if (!state.isDrawing || !state.currentShape) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setState(prev => {
      if (!prev.currentShape) return prev;

      const updatedShape = { ...prev.currentShape };

      if (updatedShape.type === "horizontal") {
        // Línea horizontal se mueve con el precio
        updatedShape.price = yToPrice(y);
      } else {
        updatedShape.endPoint = { x, y };
      }

      return { ...prev, currentShape: updatedShape };
    });
  }, [state.isDrawing, state.currentShape]);

  const handleMouseUp = useCallback(() => {
    if (!state.isDrawing || !state.currentShape) return;

    // Calcular niveles fibonacci si aplica
    let finalShape = state.currentShape;

    if (state.currentShape.type === "fibonacci" &&
        state.currentShape.startPoint &&
        state.currentShape.endPoint) {
      const startPrice = state.currentShape.startPoint.y;
      const endPrice = state.currentShape.endPoint.y;
      const priceDiff = endPrice - startPrice;

      finalShape = {
        ...state.currentShape,
        fibLevels: FIB_LEVELS.map(level => ({
          level,
          price: startPrice + priceDiff * level,
        })),
      };
    }

    setState(prev => ({
      ...prev,
      isDrawing: false,
      currentShape: null,
      shapes: [...prev.shapes, finalShape],
    }));
  }, [state.isDrawing, state.currentShape]);

  return {
    state,
    setActiveTool,
    setSelectedColor,
    clearAllShapes,
    deleteShape,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

// ==================== TOOLBAR COMPONENT ====================

interface DrawToolsToolbarProps {
  activeTool: DrawTool;
  selectedColor: string;
  shapeCount: number;
  onToolChange: (tool: DrawTool) => void;
  onColorChange: (color: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function DrawToolsToolbar({
  activeTool,
  selectedColor,
  shapeCount,
  onToolChange,
  onColorChange,
  onClearAll,
  className,
}: DrawToolsToolbarProps) {
  return (
    <div className={cn("flex items-center gap-1 px-4 py-2 bg-[#252526] border-b border-[#3C3C3C]", className)}>
      <span className="text-xs text-[#888888] mr-2">Draw:</span>

      {/* Tool buttons */}
      {(["cursor", "horizontal", "trendline", "rectangle", "fibonacci"] as DrawTool[]).map((tool) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          title={TOOL_LABELS[tool]}
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded text-sm transition-colors",
            activeTool === tool
              ? "bg-[#0078D4] text-white"
              : "bg-[#333333] text-[#888888] hover:bg-[#444444] hover:text-white"
          )}
        >
          {TOOL_ICONS[tool]}
        </button>
      ))}

      <div className="w-px h-5 bg-[#3C3C3C] mx-2" />

      {/* Color picker */}
      <div className="flex items-center gap-1">
        {DRAW_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            title={color.name}
            className={cn(
              "w-5 h-5 rounded border transition-transform",
              selectedColor === color.value
                ? "border-white scale-110"
                : "border-transparent hover:scale-105"
            )}
            style={{ backgroundColor: color.value }}
          />
        ))}
      </div>

      <div className="w-px h-5 bg-[#3C3C3C] mx-2" />

      {/* Shape count */}
      <span className="text-xs text-[#888888] min-w-[20px]">
        {shapeCount > 0 && `(${shapeCount})`}
      </span>

      {/* Clear all button */}
      {shapeCount > 0 && (
        <button
          onClick={onClearAll}
          className="px-2 py-1 rounded text-xs bg-[#442222] text-[#ff6666] hover:bg-[#553333] transition-colors"
        >
          Borrar todo
        </button>
      )}
    </div>
  );
}

// ==================== OVERLAY COMPONENT ====================

interface DrawToolsOverlayProps {
  shapes: DrawShape[];
  currentShape: DrawShape | null;
  activeTool: DrawTool;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  padding: { top: number; right: number; bottom: number; left: number };
  dimensions: { width: number; height: number };
}

export function DrawToolsOverlay({
  shapes,
  currentShape,
  activeTool,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  priceToY,
  yToPrice,
  padding,
  dimensions,
}: DrawToolsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw shapes on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    // Helper function to draw a single shape
    const drawShape = (shape: DrawShape, alpha: number = 1) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;

      switch (shape.type) {
        case "horizontal":
          if (shape.price !== undefined) {
            const y = priceToY(shape.price);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(dimensions.width - padding.right, y);
            ctx.stroke();

            // Price label
            ctx.globalAlpha = alpha;
            ctx.font = "bold 10px monospace";
            ctx.fillStyle = shape.color;
            ctx.textAlign = "left";
            ctx.fillText(shape.price.toFixed(2), dimensions.width - padding.right + 5, y + 4);
          }
          break;

        case "trendline":
          if (shape.startPoint && shape.endPoint) {
            ctx.beginPath();
            ctx.moveTo(shape.startPoint.x, shape.startPoint.y);
            ctx.lineTo(shape.endPoint.x, shape.endPoint.y);
            ctx.stroke();

            // Draw handles
            ctx.globalAlpha = alpha * 0.8;
            ctx.beginPath();
            ctx.arc(shape.startPoint.x, shape.startPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(shape.endPoint.x, shape.endPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case "rectangle":
          if (shape.startPoint && shape.endPoint) {
            const x = Math.min(shape.startPoint.x, shape.endPoint.x);
            const y = Math.min(shape.startPoint.y, shape.endPoint.y);
            const w = Math.abs(shape.endPoint.x - shape.startPoint.x);
            const h = Math.abs(shape.endPoint.y - shape.startPoint.y);

            ctx.fillStyle = shape.color + "20"; // 20 = 12.5% opacity in hex
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = shape.color;
            ctx.strokeRect(x, y, w, h);

            // Draw handles
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = shape.color;
            ctx.beginPath();
            ctx.arc(shape.startPoint.x, shape.startPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(shape.endPoint.x, shape.endPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case "fibonacci":
          if (shape.startPoint && shape.endPoint && shape.fibLevels) {
            const minPrice = Math.min(shape.startPoint.y, shape.endPoint.y);
            const maxPrice = Math.max(shape.startPoint.y, shape.endPoint.y);

            // Draw base line (0-100%)
            ctx.strokeStyle = shape.color;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(padding.left, shape.startPoint.y);
            ctx.lineTo(dimensions.width - padding.right, shape.startPoint.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(padding.left, shape.endPoint.y);
            ctx.lineTo(dimensions.width - padding.right, shape.endPoint.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw fib levels
            ctx.font = "9px monospace";
            ctx.textAlign = "left";

            for (const fib of shape.fibLevels) {
              const y = minPrice + (maxPrice - minPrice) * fib.level;
              // Invertir para que 0 esté arriba y 1 abajo
              const actualY = shape.startPoint.y + (shape.endPoint.y - shape.startPoint.y) * fib.level;

              ctx.globalAlpha = alpha * 0.6;
              ctx.strokeStyle = shape.color;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.moveTo(padding.left, actualY);
              ctx.lineTo(dimensions.width - padding.right, actualY);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.globalAlpha = alpha;
              ctx.fillStyle = shape.color;
              const label = `${(fib.level * 100).toFixed(1)}%`;
              ctx.fillText(label, dimensions.width - padding.right + 5, actualY + 3);
            }

            // Draw handles
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = shape.color;
            ctx.beginPath();
            ctx.arc(shape.startPoint.x, shape.startPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(shape.endPoint.x, shape.endPoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
      }

      ctx.globalAlpha = 1;
    };

    // Draw all saved shapes
    for (const shape of shapes) {
      drawShape(shape, 0.9);
    }

    // Draw current shape being drawn
    if (currentShape) {
      drawShape(currentShape, 0.7);
    }
  }, [shapes, currentShape, priceToY, padding, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: dimensions.width,
        height: dimensions.height,
        cursor: activeTool === "cursor" ? "default" : "crosshair",
        pointerEvents: activeTool === "cursor" ? "none" : "auto",
        zIndex: 5,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}

// ==================== EXPORTS ====================

export { DRAW_COLORS, TOOL_ICONS, TOOL_LABELS, FIB_LEVELS };
