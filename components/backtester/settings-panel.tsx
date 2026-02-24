"use client";

import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  config: {
    strategyName: string;
    lotajeBase: number;
    numOrders: number;
    pipsDistance: number;
    maxLevels: number;
    takeProfitPips: number;
    stopLossPips?: number;
    useStopLoss: boolean;
    useTrailingSL?: boolean;
    trailingSLPercent?: number;
    restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
    signalsSource?: string;
    initialCapital?: number;
    useRealPrices?: boolean;
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      session?: "ASIAN" | "EUROPEAN" | "US" | "ALL";
      side?: "BUY" | "SELL";
      daysOfWeek?: number[];
    };
  };
  signalLimit: number;
  signalSources: { file: string; total: number }[];
  signalsInfo: { total: number; bySide: { buy: number; sell: number }; dateRange: { start: string; end: string } } | null;
  onUpdateConfig: <K extends keyof SettingsPanelProps["config"]>(key: K, value: SettingsPanelProps["config"][K]) => void;
  onSetSignalLimit: (limit: number) => void;
  onExecute: () => void;
  isExecuting: boolean;
}

export function SettingsPanel({
  config,
  signalLimit,
  signalSources,
  signalsInfo,
  onUpdateConfig,
  onSetSignalLimit,
  onExecute,
  isExecuting,
}: SettingsPanelProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Grid Layout - 3 columnas */}
      <div className="grid grid-cols-3 gap-4">
        {/* Columna 1: Fuente y Período */}
        <div className="space-y-4">
          <SectionTitle>Fuente de Datos</SectionTitle>

          {/* Signal Source */}
          <InputGroup label="Signal Source">
            <select
              className="mt5-select"
              value={config.signalsSource}
              onChange={(e) => onUpdateConfig("signalsSource", e.target.value)}
            >
              {signalSources?.map((s) => (
                <option key={s.file} value={s.file}>
                  {s.file} ({s.total} signals)
                </option>
              ))}
            </select>
          </InputGroup>

          {/* Stats de señales */}
          {signalsInfo && (
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div className="bg-[#333333] p-2 rounded">
                <div className="text-[#888888]">Total Signals</div>
                <div className="text-lg font-bold">{signalsInfo.total}</div>
              </div>
              <div className="bg-[#333333] p-2 rounded">
                <div className="text-[#888888]">BUY / SELL</div>
                <div className="text-lg font-bold">
                  <span className="text-[#00C853]">{signalsInfo.bySide.buy}</span>
                  <span className="text-[#666666]"> / </span>
                  <span className="text-[#FF5252]">{signalsInfo.bySide.sell}</span>
                </div>
              </div>
            </div>
          )}

          {/* Signal Limit */}
          <InputGroup label="Signals to Test">
            <input
              type="number"
              className="mt5-input"
              min={1}
              max={signalsInfo?.total || 10000}
              value={signalLimit}
              onChange={(e) => onSetSignalLimit(parseInt(e.target.value) || 0)}
            />
          </InputGroup>
        </div>

        {/* Columna 2: Parámetros Grid */}
        <div className="space-y-4">
          <SectionTitle>Grid Parameters</SectionTitle>

          <div className="grid grid-cols-2 gap-2">
            <InputGroup label="Pips Distance">
              <input
                type="number"
                className="mt5-input"
                min={1}
                max={100}
                value={config.pipsDistance}
                onChange={(e) => onUpdateConfig("pipsDistance", parseInt(e.target.value))}
              />
            </InputGroup>

            <InputGroup label="Max Levels">
              <input
                type="number"
                className="mt5-input"
                min={1}
                max={40}
                value={config.maxLevels}
                onChange={(e) => onUpdateConfig("maxLevels", parseInt(e.target.value))}
              />
            </InputGroup>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InputGroup label="Take Profit (pips)">
              <input
                type="number"
                className="mt5-input"
                min={5}
                max={100}
                value={config.takeProfitPips}
                onChange={(e) => onUpdateConfig("takeProfitPips", parseInt(e.target.value))}
              />
            </InputGroup>

            <InputGroup label="Lot Size">
              <input
                type="number"
                className="mt5-input"
                step="0.01"
                min="0.01"
                max="10"
                value={config.lotajeBase}
                onChange={(e) => onUpdateConfig("lotajeBase", parseFloat(e.target.value))}
              />
            </InputGroup>
          </div>

          {/* Trailing SL */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.useTrailingSL}
                onChange={(e) => onUpdateConfig("useTrailingSL", e.target.checked)}
                className="mt5-checkbox"
              />
              <span>Trailing Stop Loss</span>
            </label>
            {config.useTrailingSL && (
              <InputGroup label="Trail Distance (% of TP)">
                <input
                  type="number"
                  className="mt5-input"
                  min={10}
                  max={90}
                  value={config.trailingSLPercent}
                  onChange={(e) => onUpdateConfig("trailingSLPercent", parseInt(e.target.value))}
                />
              </InputGroup>
            )}
          </div>
        </div>

        {/* Columna 3: Capital y Filtros */}
        <div className="space-y-4">
          <SectionTitle>Capital & Filters</SectionTitle>

          <InputGroup label="Initial Capital (€)">
            <input
              type="number"
              className="mt5-input"
              step="100"
              min="100"
              max="10000000"
              value={config.initialCapital}
              onChange={(e) => onUpdateConfig("initialCapital", parseFloat(e.target.value))}
            />
          </InputGroup>

          {/* Session Filter */}
          <InputGroup label="Session">
            <select
              className="mt5-select"
              value={config.filters?.session || ""}
              onChange={(e) =>
                onUpdateConfig("filters", {
                  ...config.filters,
                  session: (e.target.value as any) || undefined,
                })
              }
            >
              <option value="">All Sessions</option>
              <option value="ASIAN">Asian (00:00-08:00 UTC)</option>
              <option value="EUROPEAN">European (08:00-16:00 UTC)</option>
              <option value="US">US (13:00-21:00 UTC)</option>
            </select>
          </InputGroup>

          {/* Side Filter */}
          <InputGroup label="Direction">
            <select
              className="mt5-select"
              value={config.filters?.side || ""}
              onChange={(e) =>
                onUpdateConfig("filters", {
                  ...config.filters,
                  side: (e.target.value as any) || undefined,
                })
              }
            >
              <option value="">Both</option>
              <option value="BUY">BUY Only</option>
              <option value="SELL">SELL Only</option>
            </select>
          </InputGroup>

          {/* Day Filter */}
          <div>
            <div className="text-xs text-[#888888] mb-1">Days of Week</div>
            <div className="flex gap-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                const dayNum = i === 6 ? 0 : i + 1;
                const isSelected = config.filters?.daysOfWeek?.includes(dayNum);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const current = config.filters?.daysOfWeek || [];
                      const newDays = isSelected
                        ? current.filter((d) => d !== dayNum)
                        : [...current, dayNum];
                      onUpdateConfig("filters", {
                        ...config.filters,
                        daysOfWeek: newDays.length > 0 ? newDays : undefined,
                      });
                    }}
                    className={cn(
                      "w-7 h-7 text-xs rounded transition-colors",
                      isSelected
                        ? "bg-[#0078D4] text-white"
                        : "bg-[#333333] text-[#888888] hover:bg-[#444444]"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-[#3C3C3C]">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={config.useRealPrices}
              onChange={(e) => onUpdateConfig("useRealPrices", e.target.checked)}
              className="mt5-checkbox"
            />
            <span>Use Real Tick Prices</span>
          </label>
        </div>

        <button
          onClick={onExecute}
          disabled={isExecuting}
          className={cn(
            "px-8 py-3 rounded font-semibold text-white transition-all",
            isExecuting
              ? "bg-[#555555] cursor-not-allowed"
              : "bg-[#0078D4] hover:bg-[#1E90FF] active:scale-95"
          )}
        >
          {isExecuting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Running...
            </span>
          ) : (
            "Start Backtest"
          )}
        </button>
      </div>

      {/* Config Summary */}
      <div className="text-xs text-[#666666] font-mono">
        Config: {config.pipsDistance}p × {config.maxLevels}L × {config.takeProfitPips}TP
        {config.useTrailingSL && ` × ${config.trailingSLPercent}%Trail`}
      </div>
    </div>
  );
}

// Helper components
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-semibold text-[#0078D4] uppercase tracking-wide mb-2">
      {children}
    </div>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-[#888888]">{label}</div>
      {children}
    </div>
  );
}
