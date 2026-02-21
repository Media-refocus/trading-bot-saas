"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  spread: number;
}

interface Candle {
  time: number; // Unix timestamp en segundos del inicio de la vela
  open: number;
  high: number;
  low: number;
  close: number;
  isComplete: boolean; // Si la vela ya cerró
}

type Timeframe = "1" | "5" | "15" | "60";

const PIP_VALUE = 0.10;
const COLORS = {
  background: "#1e1e2e",
  grid: "#313244",
  text: "#cdd6f4",
  candleUp: "#a6e3a1",
  candleDown: "#f38ba8",
  wickUp: "#a6e3a1",
  wickDown: "#f38ba8",
  entryLine: "#2196f3",
  tpLine: "#26a69a",
  slLine: "#f38ba8",
  levelColors: ["#9c27b0", "#ff9800", "#4caf50", "#e91e63"],
  crosshair: "#89b4fa",
};

/**
 * Motor de simulación de velas estilo MT5
 *
 * Cada tick actualiza la vela actual:
 * - Open: primer tick del período (no cambia)
 * - High: máximo histórico (solo sube)
 * - Low: mínimo histórico (solo baja)
 * - Close: siempre el último tick
 */
export default function SimpleCandleChart({
  ticks,
  trade,
  config,
  hasRealTicks = true,
}: {
  ticks: Tick[];
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [progress, setProgress] = useState(0);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentTickIndex, setCurrentTickIndex] = useState(0);

  // Estado del gráfico: velas formadas hasta ahora
  const [candles, setCandles] = useState<Candle[]>([]);
  const [allTicks, setAllTicks] = useState<Tick[]>([]);

  const speedOptions = [1, 2, 5, 10, 20, 50, 100];

  // Obtener precio mid de un tick
  const getMidPrice = useCallback((tick: Tick) => {
    return (tick.bid + tick.ask) / 2;
  }, []);

  // Obtener timestamp de vela para un tick (en segundos)
  const getCandleTime = useCallback((tick: Tick, tf: Timeframe) => {
    const intervalMs = parseInt(tf) * 60 * 1000;
    const tickTime = new Date(tick.timestamp).getTime();
    return Math.floor(tickTime / intervalMs) * (intervalMs / 1000);
  }, []);

  // Cargar ticks cuando cambia el trade
  useEffect(() => {
    if (!trade) {
      setAllTicks([]);
      setCandles([]);
      return;
    }

    if (ticks.length > 0) {
      // Usar ticks reales
      setAllTicks(ticks);
    } else {
      // Generar ticks sintéticos si no hay reales
      const syntheticTicks = generateSyntheticTicks(
        trade.entryPrice,
        trade.exitPrice,
        new Date(trade.entryTime),
        new Date(trade.exitTime)
      );
      setAllTicks(syntheticTicks);
    }

    // Reset state
    setCandles([]);
    setCurrentTickIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setCurrentPrice(null);
  }, [trade, ticks]);

  // Generar ticks sintéticos para simulación
  const generateSyntheticTicks = useCallback((
    entryPrice: number,
    exitPrice: number,
    entryTime: Date,
    exitTime: Date
  ): Tick[] => {
    const durationMs = exitTime.getTime() - entryTime.getTime();
    // Generar aproximadamente 1 tick cada 2 segundos para trades largos
    // o cada 500ms para trades cortos
    const tickInterval = Math.max(500, Math.min(2000, durationMs / 500));
    const numTicks = Math.max(50, Math.ceil(durationMs / tickInterval));
    const result: Tick[] = [];
    const priceDiff = exitPrice - entryPrice;
    const volatility = Math.abs(priceDiff) * 0.02; // 2% de volatilidad

    let lastPrice = entryPrice;

    for (let i = 0; i < numTicks; i++) {
      const progress = i / (numTicks - 1);
      const basePrice = entryPrice + priceDiff * progress;

      // Añadir algo de "random walk" para hacer más realista
      const noise = (Math.random() - 0.5) * volatility;
      const price = basePrice + noise;
      const spread = 0.02 + Math.random() * 0.03; // Spread variable

      result.push({
        timestamp: new Date(entryTime.getTime() + i * (durationMs / numTicks)),
        bid: price,
        ask: price + spread,
        spread,
      });
    }

    return result;
  }, []);

  // Procesar un tick individual y actualizar velas (estilo MT5)
  const processTick = useCallback((
    tick: Tick,
    currentCandles: Candle[],
    tf: Timeframe
  ): Candle[] => {
    const price = getMidPrice(tick);
    const candleTime = getCandleTime(tick, tf);

    if (currentCandles.length === 0) {
      // Primer tick: crear primera vela
      return [{
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        isComplete: false,
      }];
    }

    const lastCandle = currentCandles[currentCandles.length - 1];

    if (lastCandle.time === candleTime) {
      // Tick dentro de la vela actual: actualizar OHLC
      const updatedCandle: Candle = {
        ...lastCandle,
        high: Math.max(lastCandle.high, price),
        low: Math.min(lastCandle.low, price),
        close: price, // Close siempre es el último precio
        isComplete: false,
      };

      return [
        ...currentCandles.slice(0, -1),
        updatedCandle,
      ];
    } else {
      // Tick de una nueva vela: cerrar anterior y crear nueva
      const completedLastCandle = { ...lastCandle, isComplete: true };
      const newCandle: Candle = {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        isComplete: false,
      };

      return [...currentCandles.slice(0, -1), completedLastCandle, newCandle];
    }
  }, [getMidPrice, getCandleTime]);

  // Reproducción animada tick a tick
  useEffect(() => {
    if (!isPlaying || allTicks.length === 0) return;

    const intervalMs = Math.max(5, 100 / speed); // Velocidad ajustada por ticks
    let idx = currentTickIndex;

    const interval = setInterval(() => {
      if (idx >= allTicks.length) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      const tick = allTicks[idx];
      const price = getMidPrice(tick);

      // Procesar tick y actualizar velas
      setCandles(prev => processTick(tick, prev, timeframe));
      setCurrentPrice(price);
      setProgress(((idx + 1) / allTicks.length) * 100);
      setCurrentTickIndex(idx);
      idx++;
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, allTicks, currentTickIndex, timeframe, getMidPrice, processTick]);

  // Reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTickIndex(0);
    setProgress(0);
    setCurrentPrice(null);
    setCandles([]);
  }, []);

  // Dibujar gráfico
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar tamaño del canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 400 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "400px";
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 400;
    const padding = { top: 20, right: 70, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Limpiar
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Si no hay velas, mostrar mensaje
    if (candles.length === 0) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Presiona Play para iniciar la simulación", width / 2, height / 2);
      return;
    }

    // Calcular rango de precios
    let minPrice = Math.min(...candles.map((c) => c.low));
    let maxPrice = Math.max(...candles.map((c) => c.high));

    // Incluir precios del trade si están disponibles
    if (trade) {
      minPrice = Math.min(minPrice, trade.entryPrice, trade.exitPrice);
      maxPrice = Math.max(maxPrice, trade.entryPrice, trade.exitPrice);

      const isBuy = trade.signalSide === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      minPrice = Math.min(minPrice, tpPrice);
      maxPrice = Math.max(maxPrice, tpPrice);
    }

    // Añadir margen
    const priceRange = maxPrice - minPrice || 1;
    minPrice -= priceRange * 0.08;
    maxPrice += priceRange * 0.08;

    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;

    // Dibujar grid horizontal (precios)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;

    const priceStep = (maxPrice - minPrice) / 6;
    for (let i = 0; i <= 6; i++) {
      const price = minPrice + priceStep * i;
      const y = priceToY(price);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Etiqueta de precio
      ctx.fillStyle = COLORS.text;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Dibujar líneas de precio del trade
    if (trade && candles.length > 0) {
      const isBuy = trade.signalSide === "BUY";

      // Entry line
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = COLORS.entryLine;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.entryLine;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Entry: ${trade.entryPrice.toFixed(2)}`, padding.left + 5, entryY - 5);

      // TP line
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = COLORS.tpLine;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.tpLine;
      ctx.fillText(`TP: ${tpPrice.toFixed(2)}`, padding.left + 5, tpY - 5);

      // Level lines
      trade.levels?.forEach((level, index) => {
        if (level.openPrice !== trade.entryPrice) {
          const levelY = priceToY(level.openPrice);
          ctx.strokeStyle = COLORS.levelColors[index % COLORS.levelColors.length];
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(padding.left, levelY);
          ctx.lineTo(width - padding.right, levelY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = COLORS.levelColors[index % COLORS.levelColors.length];
          ctx.fillText(`L${level.level}`, padding.left + 5, levelY + 12);
        }
      });
    }

    // Calcular ancho de vela
    const candleWidth = Math.max(3, Math.min(30, chartWidth / Math.max(candles.length, 1) * 0.8));
    const bodyWidth = candleWidth * 0.75;

    // Dibujar velas
    candles.forEach((candle, i) => {
      const x = padding.left + (i + 0.5) * (chartWidth / candles.length);
      const isUp = candle.close >= candle.open;

      // Color basado en dirección
      const bodyColor = isUp ? COLORS.candleUp : COLORS.candleDown;
      const wickColor = isUp ? COLORS.wickUp : COLORS.wickDown;

      // Dibujar mecha (wick)
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();

      // Dibujar cuerpo
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyBottom = priceToY(Math.min(candle.open, candle.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      ctx.fillStyle = bodyColor;
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);

      // Si la vela no está completa, dibujar indicador
      if (!candle.isComplete && i === candles.length - 1) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - bodyWidth / 2 - 1, bodyTop - 1, bodyWidth + 2, bodyHeight + 2);
      }
    });

    // Dibujar flecha de entrada (en la primera vela)
    if (trade && candles.length > 0) {
      const isBuy = trade.signalSide === "BUY";
      const x = padding.left + 0.5 * (chartWidth / candles.length);
      const y = priceToY(trade.entryPrice);

      ctx.fillStyle = isBuy ? COLORS.candleUp : COLORS.candleDown;
      ctx.beginPath();

      if (isBuy) {
        // Flecha hacia arriba
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x - 8, y + 22);
        ctx.lineTo(x + 8, y + 22);
        ctx.closePath();
      } else {
        // Flecha hacia abajo
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x - 8, y - 22);
        ctx.lineTo(x + 8, y - 22);
        ctx.closePath();
      }
      ctx.fill();

      ctx.font = "bold 10px sans-serif";
      ctx.fillText(isBuy ? "BUY" : "SELL", x + 12, isBuy ? y + 18 : y - 15);
    }

    // Dibujar precio actual (línea horizontal punteada)
    if (currentPrice !== null && candles.length > 0) {
      const currentY = priceToY(currentPrice);
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, currentY);
      ctx.lineTo(width - padding.right, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.crosshair;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(currentPrice.toFixed(2), width - 5, currentY - 5);
    }

  }, [candles, trade, config, currentPrice]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      // Forzar re-render
      setCandles(c => [...c]);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Información de ticks
  const tickInfo = allTicks.length > 0 ? (
    <div className="text-xs text-gray-500">
      {allTicks.length.toLocaleString()} ticks disponibles
      {currentTickIndex > 0 && ` • Procesados: ${currentTickIndex.toLocaleString()}`}
    </div>
  ) : null;

  if (!trade) {
    return (
      <div className="text-center py-12 text-gray-400">
        Selecciona un trade para ver el gráfico
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800 rounded-lg">
        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">TF:</span>
          <select
            value={timeframe}
            onChange={(e) => {
              setTimeframe(e.target.value as Timeframe);
              handleReset();
            }}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0 text-white"
          >
            <option value="1">M1</option>
            <option value="5">M5</option>
            <option value="15">M15</option>
            <option value="60">H1</option>
          </select>
        </div>

        {/* Velocidad */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0 text-white"
          >
            {speedOptions.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-4 py-1.5 rounded font-medium text-white ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? "⏸ Pausar" : "▶ Play"}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white"
        >
          ⟲ Reset
        </button>

        {/* Precio actual */}
        {currentPrice && (
          <div className="ml-auto text-sm">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-white">{currentPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="space-y-1">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-50"
            style={{ width: `${progress}%` }}
          />
        </div>
        {tickInfo}
      </div>

      {/* Gráfico Canvas */}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden bg-slate-900">
        <canvas ref={canvasRef} />
      </div>

      {/* Info del trade */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-800 rounded-lg text-sm">
        <div>
          <span className="text-gray-400 text-xs">Side</span>
          <div
            className={`font-bold ${
              trade.signalSide === "BUY" ? "text-green-400" : "text-red-400"
            }`}
          >
            {trade.signalSide}
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Entrada</span>
          <div className="font-mono text-white">{trade.entryPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Salida</span>
          <div className="font-mono text-white">{trade.exitPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Profit</span>
          <div
            className={`font-bold ${
              trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {trade.totalProfit >= 0 ? "+" : ""}
            {trade.totalProfit.toFixed(2)}€
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Cierre</span>
          <div
            className={`${
              trade.exitReason === "TAKE_PROFIT"
                ? "text-green-400"
                : trade.exitReason === "TRAILING_SL"
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {trade.exitReason === "TAKE_PROFIT"
              ? "TP"
              : trade.exitReason === "TRAILING_SL"
              ? "Trail"
              : "SL"}
          </div>
        </div>
      </div>

      {/* Mensaje si no hay ticks reales */}
      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          Sin ticks reales - simulando con ticks sintéticos
        </p>
      )}
    </div>
  );
}
