"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, Clock, BarChart3, Info } from "lucide-react";

// ==================== TYPES ====================

interface TradeData {
  entryTime: Date | string;
  totalProfit: number;
  signalSide?: "BUY" | "SELL";
}

interface HeatmapCell {
  label: string;
  value: number;
  winRate: number;
  trades: number;
  wins: number;
  losses: number;
  totalProfit: number;
}

type ViewMode = "weekday" | "session" | "month";

interface PerformanceHeatmapProps {
  trades: TradeData[];
  className?: string;
}

// ==================== CONSTANTS ====================

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Trading sessions (UTC time)
const SESSIONS = [
  { id: "asia", label: "Asia", timeRange: "00:00-08:00 UTC", startHour: 0, endHour: 8 },
  { id: "europe", label: "Europe", timeRange: "08:00-16:00 UTC", startHour: 8, endHour: 16 },
  { id: "usa", label: "USA", timeRange: "16:00-00:00 UTC", startHour: 16, endHour: 24 },
];

// ==================== UTILITY FUNCTIONS ====================

function getTradingSession(date: Date): string {
  const hour = date.getUTCHours();
  for (const session of SESSIONS) {
    if (hour >= session.startHour && hour < session.endHour) {
      return session.id;
    }
  }
  return "usa"; // Edge case: hour 23:59
}

function getColorIntensity(winRate: number, trades: number): { bg: string; text: string } {
  // No trades - dark gray
  if (trades === 0) {
    return { bg: "bg-[#1A1A1A]", text: "text-[#666666]" };
  }

  // Calculate intensity based on win rate
  // Green for >50%, Yellow for ~50%, Red for <50%
  if (winRate >= 70) {
    return { bg: "bg-[#00C853]", text: "text-white" };
  } else if (winRate >= 60) {
    return { bg: "bg-[#4CAF50]", text: "text-white" };
  } else if (winRate >= 55) {
    return { bg: "bg-[#8BC34A]", text: "text-black" };
  } else if (winRate >= 50) {
    return { bg: "bg-[#CDDC39]", text: "text-black" };
  } else if (winRate >= 45) {
    return { bg: "bg-[#FFEB3B]", text: "text-black" };
  } else if (winRate >= 40) {
    return { bg: "bg-[#FFC107]", text: "text-black" };
  } else if (winRate >= 30) {
    return { bg: "bg-[#FF9800]", text: "text-black" };
  } else if (winRate >= 20) {
    return { bg: "bg-[#FF5722]", text: "text-white" };
  } else {
    return { bg: "bg-[#F44336]", text: "text-white" };
  }
}

function formatProfit(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}€`;
}

// ==================== MAIN COMPONENT ====================

export function PerformanceHeatmap({ trades, className }: PerformanceHeatmapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("weekday");

  // Process trades data for different views
  const heatmapData = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { weekday: [], session: [], month: [] };
    }

    // Initialize data structures
    const weekdayData: HeatmapCell[] = DAYS_OF_WEEK.map((day) => ({
      label: day,
      value: 0,
      winRate: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
    }));

    const sessionData: HeatmapCell[] = SESSIONS.map((s) => ({
      label: s.label,
      value: 0,
      winRate: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
    }));

    const monthData: HeatmapCell[] = MONTHS_SHORT.map((month) => ({
      label: month,
      value: 0,
      winRate: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
    }));

    // Process each trade
    trades.forEach((trade) => {
      const date = new Date(trade.entryTime);
      const profit = trade.totalProfit || 0;
      const isWin = profit >= 0;

      // Weekday (0 = Sunday in JS, adjust to 0 = Monday)
      const jsDay = date.getDay();
      const weekdayIndex = jsDay === 0 ? 6 : jsDay - 1;
      weekdayData[weekdayIndex].trades++;
      weekdayData[weekdayIndex].totalProfit += profit;
      if (isWin) {
        weekdayData[weekdayIndex].wins++;
      } else {
        weekdayData[weekdayIndex].losses++;
      }

      // Session
      const sessionId = getTradingSession(date);
      const sessionIndex = SESSIONS.findIndex((s) => s.id === sessionId);
      if (sessionIndex >= 0) {
        sessionData[sessionIndex].trades++;
        sessionData[sessionIndex].totalProfit += profit;
        if (isWin) {
          sessionData[sessionIndex].wins++;
        } else {
          sessionData[sessionIndex].losses++;
        }
      }

      // Month
      const monthIndex = date.getMonth();
      monthData[monthIndex].trades++;
      monthData[monthIndex].totalProfit += profit;
      if (isWin) {
        monthData[monthIndex].wins++;
      } else {
        monthData[monthIndex].losses++;
      }
    });

    // Calculate win rates
    const calculateWinRate = (cell: HeatmapCell) => {
      cell.winRate = cell.trades > 0 ? (cell.wins / cell.trades) * 100 : 0;
      cell.value = cell.winRate;
    };

    weekdayData.forEach(calculateWinRate);
    sessionData.forEach(calculateWinRate);
    monthData.forEach(calculateWinRate);

    return { weekday: weekdayData, session: sessionData, month: monthData };
  }, [trades]);

  // Get current view data
  const currentData = heatmapData[viewMode];

  // Get view-specific info
  const viewInfo = {
    weekday: {
      title: "By Day of Week",
      icon: Calendar,
      description: "Win rate distribution across weekdays",
    },
    session: {
      title: "By Trading Session",
      icon: Clock,
      description: "Performance by market session (UTC)",
    },
    month: {
      title: "By Month",
      icon: BarChart3,
      description: "Monthly performance breakdown",
    },
  };

  const info = viewInfo[viewMode];
  const IconComponent = info.icon;

  if (!trades || trades.length === 0) {
    return null;
  }

  return (
    <div className={cn("bg-[#1E1E1E] rounded-lg border border-[#3C3C3C]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3C3C3C]">
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-[#0078D4]" />
          <span className="text-sm font-medium text-white">Performance Heatmap</span>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-[#252526] rounded-md p-0.5">
          {([
            { key: "weekday" as ViewMode, label: "Day" },
            { key: "session" as ViewMode, label: "Session" },
            { key: "month" as ViewMode, label: "Month" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                viewMode === tab.key
                  ? "bg-[#0078D4] text-white"
                  : "text-[#888888] hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="p-4">
        <div className="flex items-center gap-1 mb-3">
          <Info className="w-3 h-3 text-[#888888]" />
          <span className="text-xs text-[#888888]">{info.description}</span>
        </div>

        <TooltipProvider delayDuration={150}>
          <div
            className={cn(
              "grid gap-1.5",
              viewMode === "weekday" && "grid-cols-7",
              viewMode === "session" && "grid-cols-3",
              viewMode === "month" && "grid-cols-6"
            )}
          >
            {currentData.map((cell, index) => {
              const colors = getColorIntensity(cell.winRate, cell.trades);
              const fullLabel =
                viewMode === "weekday"
                  ? DAYS_FULL[index]
                  : viewMode === "session"
                  ? `${SESSIONS[index].label} (${SESSIONS[index].timeRange})`
                  : MONTHS_FULL[index];

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-md transition-all cursor-pointer",
                        "min-h-[60px] p-2",
                        "hover:ring-2 hover:ring-white/30",
                        cell.trades === 0 ? "border border-[#333333]" : "",
                        colors.bg,
                        colors.text
                      )}
                    >
                      <span className="text-[10px] font-medium opacity-80">{cell.label}</span>
                      {cell.trades > 0 ? (
                        <>
                          <span className="text-sm font-bold">
                            {cell.winRate.toFixed(0)}%
                          </span>
                          <span className="text-[9px] opacity-70">
                            {cell.trades}t
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] opacity-50">-</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-[#252526] border border-[#3C3C3C] text-white p-3 max-w-[200px]"
                  >
                    <div className="space-y-1.5">
                      <div className="font-semibold text-sm">{fullLabel}</div>
                      {cell.trades > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <span className="text-[#888888]">Win Rate:</span>
                            <span className={cn(
                              "font-mono",
                              cell.winRate >= 50 ? "text-[#00C853]" : "text-[#FF5252]"
                            )}>
                              {cell.winRate.toFixed(1)}%
                            </span>
                            <span className="text-[#888888]">Trades:</span>
                            <span className="font-mono">{cell.trades}</span>
                            <span className="text-[#888888]">Wins:</span>
                            <span className="font-mono text-[#00C853]">{cell.wins}</span>
                            <span className="text-[#888888]">Losses:</span>
                            <span className="font-mono text-[#FF5252]">{cell.losses}</span>
                            <span className="text-[#888888]">Profit:</span>
                            <span className={cn(
                              "font-mono font-semibold",
                              cell.totalProfit >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                            )}>
                              {formatProfit(cell.totalProfit)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-[#888888]">No trades in this period</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#333333]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#888888]">Win Rate:</span>
            <div className="flex items-center gap-0.5">
              {[
                { bg: "bg-[#F44336]", label: "0%" },
                { bg: "bg-[#FF5722]", label: "20%" },
                { bg: "bg-[#FF9800]", label: "30%" },
                { bg: "bg-[#CDDC39]", label: "50%" },
                { bg: "bg-[#8BC34A]", label: "55%" },
                { bg: "bg-[#4CAF50]", label: "60%" },
                { bg: "bg-[#00C853]", label: "70%+" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={cn("w-4 h-3 rounded-sm", item.bg)}
                  title={item.label}
                />
              ))}
            </div>
          </div>
          <div className="text-[10px] text-[#666666]">
            Hover cells for details
          </div>
        </div>
      </div>
    </div>
  );
}

export default PerformanceHeatmap;

// ==================== SEGMENTATION HEATMAP ====================
// Uses pre-calculated segmentation data from backtest engine

import type {
  Segmentation,
  SegmentationByDay,
  SegmentationBySession,
  SegmentationByMonth,
} from "@/lib/backtest-engine";

interface SegmentationHeatmapProps {
  segmentation: Segmentation;
  className?: string;
}

/**
 * Heatmap component that uses pre-calculated segmentation data from the backtest engine.
 * Shows performance by day of week, trading session, and month with color-coded cells.
 */
export function SegmentationHeatmap({ segmentation, className }: SegmentationHeatmapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("weekday");

  // Calculate min/max profit for color scaling across all data
  const profitRange = useMemo(() => {
    const allProfits = [
      ...segmentation.byDay.map((d) => d.profit),
      ...segmentation.bySession.map((s) => s.profit),
      ...segmentation.byMonth.map((m) => m.profit),
    ];
    const min = Math.min(...allProfits, 0);
    const max = Math.max(...allProfits, 0);
    return { min, max, range: max - min || 1 };
  }, [segmentation]);

  // Transform segmentation data to heatmap cells
  const heatmapData = useMemo(() => {
    const weekdayData: HeatmapCell[] = segmentation.byDay.map((d) => ({
      label: d.dayName.slice(0, 3),
      value: d.profit,
      winRate: d.winRate,
      trades: d.trades,
      wins: Math.round(d.trades * (d.winRate / 100)),
      losses: Math.round(d.trades * (1 - d.winRate / 100)),
      totalProfit: d.profit,
    }));

    const sessionData: HeatmapCell[] = segmentation.bySession.map((s) => ({
      label: sessionLabels[s.session] || s.session,
      value: s.profit,
      winRate: s.winRate,
      trades: s.trades,
      wins: Math.round(s.trades * (s.winRate / 100)),
      losses: Math.round(s.trades * (1 - s.winRate / 100)),
      totalProfit: s.profit,
    }));

    const monthData: HeatmapCell[] = segmentation.byMonth.map((m) => ({
      label: formatMonthShort(m.month),
      value: m.profit,
      winRate: m.winRate,
      trades: m.trades,
      wins: Math.round(m.trades * (m.winRate / 100)),
      losses: Math.round(m.trades * (1 - m.winRate / 100)),
      totalProfit: m.profit,
    }));

    return { weekday: weekdayData, session: sessionData, month: monthData };
  }, [segmentation]);

  const currentData = heatmapData[viewMode];

  const viewInfo = {
    weekday: {
      title: "Por D&iacute;a de la Semana",
      icon: Calendar,
      description: "Distribuci&oacute;n de rendimiento por d&iacute;a",
    },
    session: {
      title: "Por Sesi&oacute;n de Trading",
      icon: Clock,
      description: "Rendimiento por sesi&oacute;n de mercado (UTC)",
    },
    month: {
      title: "Por Mes",
      icon: BarChart3,
      description: "Desglose mensual de rendimiento",
    },
  };

  const info = viewInfo[viewMode];
  const IconComponent = info.icon;

  const hasData = segmentation.byDay.some((d) => d.trades > 0) ||
                  segmentation.bySession.some((s) => s.trades > 0) ||
                  segmentation.byMonth.some((m) => m.trades > 0);

  if (!hasData) {
    return null;
  }

  return (
    <div className={cn("bg-[#1E1E1E] rounded-lg border border-[#3C3C3C]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3C3C3C]">
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-[#0078D4]" />
          <span className="text-sm font-medium text-white">Heatmap de Rendimiento</span>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-[#252526] rounded-md p-0.5">
          {([
            { key: "weekday" as ViewMode, label: "D&iacute;a" },
            { key: "session" as ViewMode, label: "Sesi&oacute;n" },
            { key: "month" as ViewMode, label: "Mes" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                viewMode === tab.key
                  ? "bg-[#0078D4] text-white"
                  : "text-[#888888] hover:text-white"
              )}
              dangerouslySetInnerHTML={{ __html: tab.label }}
            />
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="p-4">
        <div className="flex items-center gap-1 mb-3">
          <Info className="w-3 h-3 text-[#888888]" />
          <span className="text-xs text-[#888888]" dangerouslySetInnerHTML={{ __html: info.description }} />
        </div>

        <TooltipProvider delayDuration={150}>
          <div
            className={cn(
              "grid gap-1.5",
              viewMode === "weekday" && "grid-cols-7",
              viewMode === "session" && "grid-cols-4",
              viewMode === "month" && "grid-cols-6"
            )}
          >
            {currentData.map((cell, index) => {
              const colors = getProfitColor(cell.totalProfit, profitRange);
              const fullLabel = getFullLabel(viewMode, index, segmentation);

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-md transition-all cursor-pointer",
                        "min-h-[60px] p-2",
                        "hover:ring-2 hover:ring-white/30",
                        cell.trades === 0 ? "border border-[#333333]" : "",
                        colors.bg,
                        colors.text
                      )}
                    >
                      <span className="text-[10px] font-medium opacity-80">{cell.label}</span>
                      {cell.trades > 0 ? (
                        <>
                          <span className="text-sm font-bold">
                            {cell.winRate.toFixed(0)}%
                          </span>
                          <span className="text-[9px] opacity-70">
                            {cell.trades}t
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] opacity-50">-</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-[#252526] border border-[#3C3C3C] text-white p-3 max-w-[220px]"
                  >
                    <div className="space-y-1.5">
                      <div className="font-semibold text-sm" dangerouslySetInnerHTML={{ __html: fullLabel }} />
                      {cell.trades > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <span className="text-[#888888]">Win Rate:</span>
                            <span className={cn(
                              "font-mono",
                              cell.winRate >= 50 ? "text-[#00C853]" : "text-[#FF5252]"
                            )}>
                              {cell.winRate.toFixed(1)}%
                            </span>
                            <span className="text-[#888888]">Trades:</span>
                            <span className="font-mono">{cell.trades}</span>
                            <span className="text-[#888888]">Wins:</span>
                            <span className="font-mono text-[#00C853]">{cell.wins}</span>
                            <span className="text-[#888888]">Losses:</span>
                            <span className="font-mono text-[#FF5252]">{cell.losses}</span>
                            <span className="text-[#888888]">Profit:</span>
                            <span className={cn(
                              "font-mono font-semibold",
                              cell.totalProfit >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                            )}>
                              {formatProfit(cell.totalProfit)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-[#888888]">Sin operaciones en este per&iacute;odo</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#333333]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#888888]">Profit:</span>
            <div className="flex items-center gap-0.5">
              {[
                { bg: "bg-[#dc2626]", label: "Loss" },
                { bg: "bg-[#fca5a5]", label: "Small loss" },
                { bg: "bg-[#eab308]", label: "Neutral" },
                { bg: "bg-[#86efac]", label: "Small profit" },
                { bg: "bg-[#16a34a]", label: "Profit" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={cn("w-4 h-3 rounded-sm", item.bg)}
                  title={item.label}
                />
              ))}
            </div>
          </div>
          <div className="text-[10px] text-[#666666]">
            Hover para detalles
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SEGMENTATION HEATMAP HELPERS ====================

const sessionLabels: Record<string, string> = {
  ASIAN: "Asia",
  EUROPEAN: "EU",
  US: "USA",
  ALL: "All",
};

const sessionFullLabels: Record<string, string> = {
  ASIAN: "Sesi&oacute;n Asi&aacute;tica (00:00-08:00 UTC)",
  EUROPEAN: "Sesi&oacute;n Europea (08:00-16:00 UTC)",
  US: "Sesi&oacute;n Americana (16:00-00:00 UTC)",
  ALL: "Todas las sesiones",
};

function formatMonthShort(month: string): string {
  const [, monthNum] = month.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return months[parseInt(monthNum, 10) - 1] || month;
}

function formatMonthFull(month: string): string {
  const [year, monthNum] = month.split("-");
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${months[parseInt(monthNum, 10) - 1] || month} ${year}`;
}

function getFullLabel(viewMode: ViewMode, index: number, segmentation: Segmentation): string {
  if (viewMode === "weekday") {
    return segmentation.byDay[index]?.dayName || "";
  }
  if (viewMode === "session") {
    const session = segmentation.bySession[index]?.session;
    return sessionFullLabels[session] || session || "";
  }
  if (viewMode === "month") {
    return formatMonthFull(segmentation.byMonth[index]?.month || "");
  }
  return "";
}

function getProfitColor(
  value: number,
  range: { min: number; max: number; range: number }
): { bg: string; text: string } {
  // Normalize value to 0-1 range, centered at 0
  let normalized: number;

  if (value >= 0) {
    normalized = range.max > 0 ? value / range.max : 0;
  } else {
    normalized = range.min < 0 ? value / Math.abs(range.min) : 0;
  }

  const intensity = Math.min(Math.abs(normalized), 1);

  // Color scale: red (negative) -> yellow (neutral) -> green (positive)
  if (value < -0.01) {
    // Red scale for losses
    if (intensity > 0.6) return { bg: "bg-[#dc2626]", text: "text-white" };
    if (intensity > 0.3) return { bg: "bg-[#ef4444]", text: "text-white" };
    return { bg: "bg-[#fca5a5]", text: "text-[#7f1d1d]" };
  } else if (value > 0.01) {
    // Green scale for profits
    if (intensity > 0.6) return { bg: "bg-[#16a34a]", text: "text-white" };
    if (intensity > 0.3) return { bg: "bg-[#22c55e]", text: "text-white" };
    return { bg: "bg-[#86efac]", text: "text-[#14532d]" };
  } else {
    // Yellow for neutral (near zero)
    return { bg: "bg-[#eab308]", text: "text-[#713f12]" };
  }
}
