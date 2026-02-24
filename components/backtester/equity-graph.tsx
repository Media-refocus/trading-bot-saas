"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EquityPoint {
  timestamp: Date;
  equity: number;
  balance: number;
  drawdown: number;
}

interface EquityGraphProps {
  data: EquityPoint[];
  initialCapital: number;
  width?: number;
  height?: number;
}

export function EquityGraph({
  data,
  initialCapital,
  width = 900,
  height = 400,
}: EquityGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas for high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 40, right: 80, bottom: 40, left: 80 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = "#1E1E1E";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Calculate scales
    const minValue = Math.min(...data.map((d) => d.equity), initialCapital);
    const maxValue = Math.max(...data.map((d) => d.equity), initialCapital);
    const valueRange = maxValue - minValue || 1;

    const xScale = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const yScale = (v: number) => padding.top + chartHeight - ((v - minValue) / valueRange) * chartHeight;

    // Draw grid
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(rect.width - padding.right, y);
      ctx.stroke();

      // Y axis labels
      const value = maxValue - (i / gridLines) * valueRange;
      ctx.fillStyle = "#888888";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`€${value.toFixed(0)}`, padding.left - 10, y + 4);
    }

    // Draw drawdown areas
    ctx.fillStyle = "rgba(255, 82, 82, 0.15)";
    data.forEach((point, i) => {
      if (point.drawdown > 0) {
        const x = xScale(i);
        const baseY = yScale(point.balance);
        const equityY = yScale(point.equity);
        const barWidth = chartWidth / data.length;

        ctx.fillRect(x - barWidth / 2, Math.min(baseY, equityY), barWidth, Math.abs(baseY - equityY));
      }
    });

    // Draw balance line (dashed)
    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = xScale(i);
      const y = yScale(point.balance);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw equity line
    ctx.strokeStyle = "#0078D4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = xScale(i);
      const y = yScale(point.equity);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw area under equity
    const gradient = ctx.createLinearGradient(0, padding.top, 0, rect.height - padding.bottom);
    gradient.addColorStop(0, "rgba(0, 120, 212, 0.3)");
    gradient.addColorStop(1, "rgba(0, 120, 212, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(data[0].equity));
    data.forEach((point, i) => {
      ctx.lineTo(xScale(i), yScale(point.equity));
    });
    ctx.lineTo(xScale(data.length - 1), rect.height - padding.bottom);
    ctx.lineTo(xScale(0), rect.height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw initial capital line
    const initialY = yScale(initialCapital);
    ctx.strokeStyle = "#FFA500";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, initialY);
    ctx.lineTo(rect.width - padding.right, initialY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Initial capital label
    ctx.fillStyle = "#FFA500";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Initial", rect.width - padding.right + 5, initialY - 5);
    ctx.fillText("Capital", rect.width - padding.right + 5, initialY + 10);

    // Draw points on hover
    if (hoveredPoint !== null && data[hoveredPoint]) {
      const point = data[hoveredPoint];
      const x = xScale(hoveredPoint);
      const y = yScale(point.equity);

      // Vertical line
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, rect.height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point
      ctx.fillStyle = "#0078D4";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // X axis labels
    ctx.fillStyle = "#888888";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    const labelStep = Math.ceil(data.length / 6);
    data.forEach((point, i) => {
      if (i % labelStep === 0 || i === data.length - 1) {
        const x = xScale(i);
        const date = new Date(point.timestamp);
        ctx.fillText(date.toLocaleDateString(), x, rect.height - padding.bottom + 20);
      }
    });

  }, [data, initialCapital, hoveredPoint]);

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { left: 80, right: 80 };
    const chartWidth = rect.width - padding.left - padding.right;

    const index = Math.round(((x - padding.left) / chartWidth) * (data.length - 1));
    setHoveredPoint(Math.max(0, Math.min(data.length - 1, index)));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Tooltip content
  const tooltipData = hoveredPoint !== null && data[hoveredPoint] ? data[hoveredPoint] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[#2D2D2D] border-b border-[#3C3C3C]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#0078D4]" />
          <span className="text-xs text-[#888888]">Equity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-[#666666]" style={{ borderStyle: "dashed" }} />
          <span className="text-xs text-[#888888]">Balance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FF5252]/30" />
          <span className="text-xs text-[#888888]">Drawdown</span>
        </div>

        <div className="flex-1" />

        {tooltipData && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[#888888]">
              {new Date(tooltipData.timestamp).toLocaleString()}
            </span>
            <span className="font-mono">
              Equity: <span className={tooltipData.equity >= initialCapital ? "text-[#00C853]" : "text-[#FF5252]"}>
                €{tooltipData.equity.toFixed(2)}
              </span>
            </span>
            <span className="font-mono text-[#888888]">
              Balance: €{tooltipData.balance.toFixed(2)}
            </span>
            {tooltipData.drawdown > 0 && (
              <span className="font-mono text-[#FF5252]">
                DD: €{tooltipData.drawdown.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[#888888]">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}
