"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
} from "lucide-react";

// ==================== TYPES ====================

export interface BacktestResultHistory {
  id: string;
  timestamp: Date;
  configName: string;
  signalsSource: string;
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPips: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  status: "completed" | "partial" | "error";
  equityCurve?: { time: number; equity: number }[];
}

interface ResultPanelProps {
  results: BacktestResultHistory[];
  onSelectResult?: (result: BacktestResultHistory) => void;
  onDeleteResult?: (id: string) => void;
  onExportCSV?: () => void;
  className?: string;
}

// ==================== COMPONENT ====================

export function ResultPanel({
  results,
  onSelectResult,
  onDeleteResult,
  onExportCSV,
  className,
}: ResultPanelProps) {
  const [sortBy, setSortBy] = useState<keyof BacktestResultHistory>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = [...results];

    // Date filters
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      filtered = filtered.filter((r) => new Date(r.timestamp) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      filtered = filtered.filter((r) => new Date(r.timestamp) <= to);
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [results, sortBy, sortOrder, filterDateFrom, filterDateTo, filterStatus]);

  // Summary metrics
  const summary = useMemo(() => {
    if (filteredResults.length === 0) return null;

    const totalProfit = filteredResults.reduce((sum, r) => sum + r.totalProfit, 0);
    const avgWinRate = filteredResults.reduce((sum, r) => sum + r.winRate, 0) / filteredResults.length;
    const avgSharpe = filteredResults
      .filter((r) => r.sharpeRatio !== null)
      .reduce((sum, r) => sum + (r.sharpeRatio || 0), 0) / filteredResults.filter((r) => r.sharpeRatio !== null).length || 0;
    const maxDD = Math.max(...filteredResults.map((r) => r.maxDrawdownPercent));

    return {
      totalBacktests: filteredResults.length,
      totalProfit,
      avgWinRate,
      avgSharpe,
      maxDrawdown: maxDD,
    };
  }, [filteredResults]);

  const handleSort = (column: keyof BacktestResultHistory) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleSelect = (result: BacktestResultHistory) => {
    setSelectedId(result.id);
    onSelectResult?.(result);
  };

  const SortIcon = ({ column }: { column: keyof BacktestResultHistory }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  return (
    <div className={cn("flex flex-col bg-[#1E1E1E] h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-[#3C3C3C]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#0078D4]" />
          <span className="text-sm font-medium">Historial de Backtests</span>
          <span className="text-xs text-[#888888]">({filteredResults.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("h-7 px-2 text-xs", showFilters && "bg-[#0078D4]/20 text-[#0078D4]")}
          >
            <Filter className="w-3 h-3 mr-1" />
            Filtros
          </Button>
          {onExportCSV && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportCSV}
              className="h-7 px-2 text-xs"
              disabled={filteredResults.length === 0}
            >
              <Download className="w-3 h-3 mr-1" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#252526] border-b border-[#3C3C3C] flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#888888]" />
            <span className="text-xs text-[#888888]">Desde:</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-2 py-1 text-xs bg-[#333333] border border-[#3C3C3C] rounded text-white"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#888888]">Hasta:</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-2 py-1 text-xs bg-[#333333] border border-[#3C3C3C] rounded text-white"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#888888]">Estado:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 text-xs bg-[#333333] border border-[#3C3C3C] rounded text-white"
            >
              <option value="all">Todos</option>
              <option value="completed">Completado</option>
              <option value="partial">Parcial</option>
              <option value="error">Error</option>
            </select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterDateFrom("");
              setFilterDateTo("");
              setFilterStatus("all");
            }}
            className="h-6 px-2 text-xs text-[#888888]"
          >
            Limpiar
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-[#252526]/50">
          <MetricCard
            label="Backtests"
            value={summary.totalBacktests.toString()}
            icon={<BarChart3 className="w-3 h-3" />}
          />
          <MetricCard
            label="Profit Total"
            value={`${summary.totalProfit >= 0 ? "+" : ""}${summary.totalProfit.toFixed(0)}€`}
            positive={summary.totalProfit >= 0}
            icon={summary.totalProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          />
          <MetricCard
            label="Win Rate Medio"
            value={`${summary.avgWinRate.toFixed(0)}%`}
            positive={summary.avgWinRate >= 50}
            icon={<Target className="w-3 h-3" />}
          />
          <MetricCard
            label="Sharpe Medio"
            value={summary.avgSharpe.toFixed(2)}
            positive={summary.avgSharpe >= 1}
            icon={<BarChart3 className="w-3 h-3" />}
          />
          <MetricCard
            label="Max DD"
            value={`${summary.maxDrawdown.toFixed(1)}%`}
            positive={summary.maxDrawdown < 20}
            warning={summary.maxDrawdown >= 20 && summary.maxDrawdown < 35}
            icon={<Shield className="w-3 h-3" />}
          />
        </div>
      )}

      {/* Results Table */}
      <div className="flex-1 overflow-auto">
        {filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#888888] gap-2">
            <BarChart3 className="w-8 h-8 opacity-50" />
            <span className="text-sm">No hay resultados de backtest</span>
            <span className="text-xs">Ejecuta un backtest para ver resultados aquí</span>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[#2D2D2D] sticky top-0">
              <tr>
                <th
                  className="text-left py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("timestamp")}
                >
                  <div className="flex items-center gap-1">
                    Fecha <SortIcon column="timestamp" />
                  </div>
                </th>
                <th
                  className="text-left py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("configName")}
                >
                  <div className="flex items-center gap-1">
                    Config <SortIcon column="configName" />
                  </div>
                </th>
                <th
                  className="text-center py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("totalTrades")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Trades <SortIcon column="totalTrades" />
                  </div>
                </th>
                <th
                  className="text-center py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("winRate")}
                >
                  <div className="flex items-center justify-center gap-1">
                    WR <SortIcon column="winRate" />
                  </div>
                </th>
                <th
                  className="text-right py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("totalProfit")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Profit <SortIcon column="totalProfit" />
                  </div>
                </th>
                <th
                  className="text-right py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("sharpeRatio")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Sharpe <SortIcon column="sharpeRatio" />
                  </div>
                </th>
                <th
                  className="text-right py-2 px-3 text-[#888888] cursor-pointer hover:text-white"
                  onClick={() => handleSort("maxDrawdownPercent")}
                >
                  <div className="flex items-center justify-end gap-1">
                    DD <SortIcon column="maxDrawdownPercent" />
                  </div>
                </th>
                <th className="text-center py-2 px-3 text-[#888888]">Estado</th>
                <th className="text-center py-2 px-3 text-[#888888]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <tr
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "border-b border-[#333333] cursor-pointer transition-colors",
                    selectedId === result.id
                      ? "bg-[#0078D4]/20 border-l-2 border-l-[#0078D4]"
                      : "hover:bg-[#2A2A2A]",
                    result.totalProfit >= 0 ? "bg-[#1A2E1A]/10" : "bg-[#2E1A1A]/10"
                  )}
                >
                  <td className="py-2 px-3 font-mono">
                    {new Date(result.timestamp).toLocaleDateString()}
                    <div className="text-[10px] text-[#666666]">
                      {new Date(result.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{result.configName}</div>
                    <div className="text-[10px] text-[#666666]">{result.signalsSource}</div>
                  </td>
                  <td className="py-2 px-3 text-center font-mono">{result.totalTrades}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={cn(
                        "font-mono",
                        result.winRate >= 50 ? "text-[#00C853]" : "text-[#FF5252]"
                      )}
                    >
                      {result.winRate.toFixed(0)}%
                    </span>
                  </td>
                  <td
                    className={cn(
                      "py-2 px-3 text-right font-mono font-semibold",
                      result.totalProfit >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                    )}
                  >
                    {result.totalProfit >= 0 ? "+" : ""}
                    {result.totalProfit.toFixed(2)}€
                    <div className="text-[10px] text-[#666666]">
                      {result.totalProfitPips >= 0 ? "+" : ""}
                      {result.totalProfitPips.toFixed(0)} pips
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {result.sharpeRatio !== null ? result.sharpeRatio.toFixed(2) : "-"}
                  </td>
                  <td
                    className={cn(
                      "py-2 px-3 text-right font-mono",
                      result.maxDrawdownPercent < 20
                        ? "text-[#00C853]"
                        : result.maxDrawdownPercent < 35
                          ? "text-[#FFA500]"
                          : "text-[#FF5252]"
                    )}
                  >
                    {result.maxDrawdownPercent.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-center">
                    <StatusBadge status={result.status} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(result);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      {onDeleteResult && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteResult(result.id);
                          }}
                          className="h-6 w-6 p-0 hover:text-[#FF5252]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mini Chart - Equity Curve Summary */}
      {filteredResults.length > 0 && (
        <div className="h-24 px-4 py-2 bg-[#252526] border-t border-[#3C3C3C]">
          <div className="text-[10px] text-[#888888] mb-1">Equity Curve Acumulada</div>
          <MiniEquityChart results={filteredResults} />
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function MetricCard({
  label,
  value,
  positive,
  warning,
  icon,
}: {
  label: string;
  value: string;
  positive?: boolean;
  warning?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#252526] p-2 rounded border border-[#3C3C3C]">
      <div className="flex items-center gap-1 text-[10px] text-[#888888] mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "text-sm font-semibold font-mono",
          positive && "text-[#00C853]",
          warning && "text-[#FFA500]",
          !positive && !warning && "text-white"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BacktestResultHistory["status"] }) {
  const styles = {
    completed: "bg-[#00C853]/20 text-[#00C853]",
    partial: "bg-[#FFA500]/20 text-[#FFA500]",
    error: "bg-[#FF5252]/20 text-[#FF5252]",
  };

  const labels = {
    completed: "OK",
    partial: "Parcial",
    error: "Error",
  };

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

function MiniEquityChart({ results }: { results: BacktestResultHistory[] }) {
  // Calculate cumulative equity
  const cumulativeEquity = useMemo(() => {
    let running = 0;
    return results
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((r) => {
        running += r.totalProfit;
        return { time: new Date(r.timestamp).getTime(), equity: running };
      });
  }, [results]);

  if (cumulativeEquity.length < 2) return null;

  const minEquity = Math.min(...cumulativeEquity.map((p) => p.equity), 0);
  const maxEquity = Math.max(...cumulativeEquity.map((p) => p.equity), 0);
  const range = maxEquity - minEquity || 1;

  const points = cumulativeEquity
    .map((p, i) => {
      const x = (i / (cumulativeEquity.length - 1)) * 100;
      const y = 100 - ((p.equity - minEquity) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const isPositive = cumulativeEquity[cumulativeEquity.length - 1]?.equity >= 0;
  const strokeColor = isPositive ? "#00C853" : "#FF5252";

  return (
    <svg className="w-full h-12" preserveAspectRatio="none" viewBox="0 0 100 100">
      {/* Grid lines */}
      <line x1="0" y1="50" x2="100" y2="50" stroke="#333333" strokeWidth="0.5" />
      <line x1="0" y1="25" x2="100" y2="25" stroke="#333333" strokeWidth="0.3" strokeDasharray="2,2" />
      <line x1="0" y1="75" x2="100" y2="75" stroke="#333333" strokeWidth="0.3" strokeDasharray="2,2" />

      {/* Zero line */}
      {minEquity < 0 && maxEquity > 0 && (
        <line
          x1="0"
          y1={100 - ((0 - minEquity) / range) * 100}
          x2="100"
          y2={100 - ((0 - minEquity) / range) * 100}
          stroke="#666666"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      )}

      {/* Area fill */}
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={isPositive ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 82, 82, 0.1)"}
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ==================== EXPORT HELPERS ====================

export function exportResultsToCSV(results: BacktestResultHistory[]): string {
  const headers = [
    "Fecha",
    "Config",
    "Señales",
    "Trades",
    "Win Rate %",
    "Profit €",
    "Pips",
    "Sharpe",
    "Max DD %",
    "Profit Factor",
    "Estado",
  ];

  const rows = results.map((r) => [
    new Date(r.timestamp).toISOString(),
    r.configName,
    r.signalsSource,
    r.totalTrades.toString(),
    r.winRate.toFixed(1),
    r.totalProfit.toFixed(2),
    r.totalProfitPips.toFixed(1),
    r.sharpeRatio?.toFixed(2) || "-",
    r.maxDrawdownPercent.toFixed(1),
    r.profitFactor.toFixed(2),
    r.status,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
