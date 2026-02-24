"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TabId = "settings" | "backtest" | "graph" | "journal";

interface MT5LayoutProps {
  children: {
    settings: React.ReactNode;
    backtest: React.ReactNode;
    graph: React.ReactNode;
    journal: React.ReactNode;
  };
  resultsAvailable?: boolean;
}

export function MT5Layout({ children, resultsAvailable = false }: MT5LayoutProps) {
  const [activeTab, setActiveTab] = useState<TabId>("settings");

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: "settings", label: "Settings" },
    { id: "backtest", label: "Backtest", disabled: !resultsAvailable },
    { id: "graph", label: "Graph", disabled: !resultsAvailable },
    { id: "journal", label: "Journal" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1E1E1E] text-[#CCCCCC] rounded-lg overflow-hidden">
      {/* Tab Bar - Estilo MT5 */}
      <div className="flex bg-[#2D2D2D] border-b border-[#3C3C3C]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-white bg-[#1E1E1E] border-t-2 border-[#0078D4]"
                : "text-[#888888] hover:text-[#CCCCCC] hover:bg-[#333333]",
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "settings" && children.settings}
        {activeTab === "backtest" && children.backtest}
        {activeTab === "graph" && children.graph}
        {activeTab === "journal" && children.journal}
      </div>
    </div>
  );
}

// Panel style for MT5 look
export function MT5Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-[#252526] rounded border border-[#3C3C3C]", className)}>
      {title && (
        <div className="px-4 py-2 border-b border-[#3C3C3C] text-sm font-semibold text-[#CCCCCC] bg-[#2D2D2D]">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// Status bar at bottom
export function MT5StatusBar({
  items,
}: {
  items: { label: string; value: string | number; color?: string }[];
}) {
  return (
    <div className="flex bg-[#007ACC] text-white text-xs px-2 py-1 gap-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="opacity-75">{item.label}:</span>
          <span className={item.color}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
