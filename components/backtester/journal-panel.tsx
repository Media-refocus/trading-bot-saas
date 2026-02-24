"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface JournalEntry {
  timestamp: Date;
  level: "INFO" | "WARNING" | "ERROR" | "DEBUG";
  message: string;
  details?: string;
}

interface JournalPanelProps {
  entries: JournalEntry[];
  onClear?: () => void;
}

export function JournalPanel({ entries, onClear }: JournalPanelProps) {
  const [filter, setFilter] = useState<"ALL" | "INFO" | "WARNING" | "ERROR">("ALL");

  const filteredEntries = filter === "ALL"
    ? entries
    : entries.filter((e) => e.level === filter);

  const levelColors = {
    INFO: "text-[#00C853]",
    WARNING: "text-[#FFA500]",
    ERROR: "text-[#FF5252]",
    DEBUG: "text-[#888888]",
  };

  const levelBgColors = {
    INFO: "bg-[#00C853]/10",
    WARNING: "bg-[#FFA500]/10",
    ERROR: "bg-[#FF5252]/10",
    DEBUG: "bg-[#333333]/50",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#2D2D2D] border-b border-[#3C3C3C]">
        <span className="text-xs text-[#888888]">Filter:</span>
        {(["ALL", "INFO", "WARNING", "ERROR"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              filter === level
                ? "bg-[#0078D4] text-white"
                : "bg-[#333333] text-[#888888] hover:text-white"
            )}
          >
            {level}
          </button>
        ))}

        <div className="flex-1" />

        <span className="text-xs text-[#888888]">
          {filteredEntries.length} entries
        </span>

        {onClear && (
          <button
            onClick={onClear}
            className="px-2 py-1 text-xs rounded bg-[#333333] text-[#888888] hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#888888]">
            No log entries
          </div>
        ) : (
          <div className="divide-y divide-[#333333]">
            {filteredEntries.map((entry, i) => (
              <div
                key={i}
                className={cn("px-4 py-2 hover:bg-[#2A2A2A]", levelBgColors[entry.level])}
              >
                <div className="flex items-start gap-2">
                  {/* Timestamp */}
                  <span className="text-[#666666] shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>

                  {/* Level */}
                  <span className={cn("shrink-0 w-16", levelColors[entry.level])}>
                    [{entry.level}]
                  </span>

                  {/* Message */}
                  <span className="text-[#CCCCCC] flex-1">{entry.message}</span>
                </div>

                {/* Details */}
                {entry.details && (
                  <div className="mt-1 ml-[120px] text-[#888888] text-[10px] whitespace-pre-wrap">
                    {entry.details}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to generate journal entries from backtest results
export function generateJournalFromResults(results: any): JournalEntry[] {
  const entries: JournalEntry[] = [];

  // Start
  entries.push({
    timestamp: new Date(),
    level: "INFO",
    message: "Backtest started",
    details: `Signals: ${results.totalTrades} | Capital: €${results.initialCapital}`,
  });

  // Process trades
  if (results.tradeDetails) {
    results.tradeDetails.forEach((trade: any, i: number) => {
      const time = new Date(trade.signalTimestamp);

      entries.push({
        timestamp: time,
        level: "INFO",
        message: `Trade #${i + 1}: ${trade.signalSide} @ ${trade.signalPrice?.toFixed(2)}`,
        details: `Entry: ${trade.entryPrice?.toFixed(2)} | Exit: ${trade.exitPrice?.toFixed(2)} | P/L: ${trade.totalProfit?.toFixed(2)}€`,
      });

      if (trade.exitReason === "STOP_LOSS") {
        entries.push({
          timestamp: new Date(time.getTime() + 1000),
          level: "WARNING",
          message: `Trade #${i + 1} closed by Stop Loss`,
        });
      }
    });
  }

  // Summary
  entries.push({
    timestamp: new Date(),
    level: results.totalProfit >= 0 ? "INFO" : "WARNING",
    message: "Backtest completed",
    details: `Total P/L: ${results.totalProfit >= 0 ? "+" : ""}${results.totalProfit?.toFixed(2)}€ | Win Rate: ${results.winRate?.toFixed(1)}%`,
  });

  return entries;
}
