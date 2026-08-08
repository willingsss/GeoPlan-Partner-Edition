import React from "react";
import { Layers, X, Building2 } from "lucide-react";
import { BRAND_CONFIG } from "../types";

export interface QueryResultPanelProps {
  stations: any[];
  communities: any[];
  tab: "stations" | "communities";
  onTabChange: (t: "stations" | "communities") => void;
  onClose: () => void;
  onFocusStation: (s: any) => void;
  onFocusCommunity: (c: any) => void;
}

/**
 * 空间查询结果弹窗（fixed 定位于右上角横栏之下，不遮挡地图主体）
 */
export default function QueryResultPanel({
  stations,
  communities,
  tab,
  onTabChange,
  onClose,
  onFocusStation,
  onFocusCommunity,
}: QueryResultPanelProps) {
  return (
    <div
      className="fixed top-[60px] right-4 z-[60] w-[340px] max-h-[55vh] flex flex-col overflow-hidden animate-panel-enter rounded-xl"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.96) 100%)",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "var(--shadow-elevated)",
      }}
    >
      {/* 标题栏 */}
      <div className="px-3.5 py-2.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(0,200,150,0.08)" }}>
            <Layers className="w-3.5 h-3.5" style={{ color: "var(--color-brand-text)" }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: "var(--color-ink-1)" }}>查询结果</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
          style={{ color: "var(--color-ink-4)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
          title="关闭"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--color-muted)" }}>
        <button
          onClick={() => onTabChange("stations")}
          className="flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors"
          style={{
            color: tab === "stations" ? "var(--color-brand-text)" : "var(--color-ink-4)",
            borderBottom: tab === "stations" ? "2px solid var(--color-brand)" : "2px solid transparent",
          }}
        >
          充电站 ({stations.length})
        </button>
        <button
          onClick={() => onTabChange("communities")}
          className="flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors"
          style={{
            color: tab === "communities" ? "var(--color-brand-text)" : "var(--color-ink-4)",
            borderBottom: tab === "communities" ? "2px solid var(--color-brand)" : "2px solid transparent",
          }}
        >
          社区 ({communities.length})
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {tab === "stations" ? (
          stations.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-zinc-400">该范围内无充电站</div>
          ) : (
            stations.map((s: any, i: number) => (
              <button
                key={`st-${s.id ?? i}`}
                onClick={() => onFocusStation(s)}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BRAND_CONFIG[s.brand]?.color || "#3b82f6" }} />
                  <span className="text-[12px] font-medium text-zinc-800 truncate flex-1">{s.name}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{s.brand}</span>
                </div>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{s.address || s.district}</p>
              </button>
            ))
          )
        ) : (
          communities.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-zinc-400">该范围内无社区</div>
          ) : (
            communities.map((c: any, i: number) => (
              <button
                key={`cm-${c.id ?? i}`}
                onClick={() => onFocusCommunity(c)}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-sky-500 shrink-0" />
                  <span className="text-[12px] font-medium text-zinc-800 truncate flex-1">{c.name}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{c.district}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  人口 {(c.population ?? 0).toLocaleString()}
                  {c.isBlindSpot && <span className="ml-2 text-red-500">盲区</span>}
                </p>
              </button>
            ))
          )
        )}
      </div>
    </div>
  );
}
