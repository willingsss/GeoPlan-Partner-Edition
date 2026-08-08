import React from "react";
import { BarChart3, Users, MapPin, ChevronDown, Target } from "lucide-react";
import type { CoverageSummary, CommunityResult, BlindSpotCluster } from "../types";
import CoverageCommunityList from "./CoverageCommunityList";

export interface CoverageResultPanelProps {
  coverageSummary: CoverageSummary | null;
  coverageResults: CommunityResult[];
  blindSpotClusters: BlindSpotCluster[];
  clusterSortBy: "population" | "communityCount";
  setClusterSortBy: (s: "population" | "communityCount") => void;
  expandedClusterId: number | null;
  setExpandedClusterId: (id: number | null) => void;
  communityDetail: CommunityResult | null;
  setCommunityDetail: (d: CommunityResult | null) => void;
  setCommunityDetailOpen: (v: boolean) => void;
  rightPanelTab: string;
  setRightPanelTab: (t: string) => void;
  coverageChartRef: React.MutableRefObject<any>;
  coveragePieChartRef: React.MutableRefObject<any>;
  stationEffChartRef: React.MutableRefObject<any>;
  onLocateCommunity: (comm: any) => void;
  onSelectSiteAt: (lng: number, lat: number) => void;
}

/**
 * 覆盖分析结果面板（右侧：覆盖率图表 / 候选点 / 社区列表）
 */
export default function CoverageResultPanel({
  coverageSummary, coverageResults, blindSpotClusters,
  clusterSortBy, setClusterSortBy,
  expandedClusterId, setExpandedClusterId,
  communityDetail, setCommunityDetail, setCommunityDetailOpen,
  rightPanelTab, setRightPanelTab,
  coverageChartRef, coveragePieChartRef, stationEffChartRef,
  onLocateCommunity, onSelectSiteAt,
}: CoverageResultPanelProps) {
  return (
    <div
    className="z-20 animate-panel-enter flex flex-col rounded-xl overflow-hidden bento-tile"
    style={{
    position: "fixed",
    right: 12,
    top: 258,
    bottom: 16,
    width: 300,
    background: "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(250,250,250,0.82) 100%)",
    backdropFilter: "blur(20px) saturate(1.4)",
    WebkitBackdropFilter: "blur(20px) saturate(1.4)",
    border: "1px solid rgba(255,255,255,0.25)",
    boxShadow: "var(--shadow-elevated)",
    }}
    >
    {/* Tab 导航栏 - 玻璃风格 */}
    <div className="flex shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2))" }}>
    {([
    { key: "charts", label: "图表", icon: BarChart3, show: true },
    { key: "communities", label: "社区", icon: Users, show: coverageResults.length > 0 },
    { key: "candidates", label: "候选点", icon: MapPin, show: blindSpotClusters.length > 0 },
    ] as const).filter(t => t.show).map(t => {
    const Icon = t.icon;
    const active = rightPanelTab === t.key;
    return (
    <button
    key={t.key}
    onClick={() => setRightPanelTab(t.key)}
    className="flex-1 px-2 py-2.5 text-[11px] font-medium transition-all flex items-center justify-center gap-1"
    style={{
    color: active ? "var(--color-brand-text)" : "var(--color-ink-4)",
    borderBottom: active ? "2px solid var(--color-brand)" : "2px solid transparent",
    background: active ? "rgba(0,200,150,0.06)" : "transparent",
    textShadow: active ? "0 0 8px rgba(0,200,150,0.2)" : "none",
    }}
    >
    <Icon className="w-3.5 h-3.5" />
    {t.label}
    </button>
    );
    })}
    </div>

    {/* Tab 内容区 (统一滚动, 切换带动画) */}
    <div className="flex-1 overflow-y-auto p-2 min-h-0">
    {/* 图表 Tab */}
    {rightPanelTab === "charts" && (
    <div key="charts-tab" className="animate-slide-in-right flex flex-col gap-2 h-full">
    {/* 堆叠柱图: 各行政区覆盖率 */}
    <div className="bento-tile rounded-xl p-2 flex-1 flex flex-col min-h-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(250,250,250,0.85) 100%)", border: "1px solid rgba(255,255,255,0.3)", boxShadow: "var(--shadow-float)" }}>
    <div className="w-full flex items-center gap-1.5 mb-1 shrink-0" style={{ color: "var(--color-ink-2)" }}>
    <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />
    <span className="text-[11px] font-semibold flex-1">各行政区覆盖率</span>
    </div>
    <div ref={coverageChartRef} className="w-full flex-1 min-h-0" style={{ minHeight: 100 }} />
    </div>
    {/* 分级饼图 */}
    <div className="bento-tile rounded-xl p-2 flex-1 flex flex-col min-h-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(250,250,250,0.85) 100%)", border: "1px solid rgba(255,255,255,0.3)", boxShadow: "var(--shadow-float)" }}>
    <div className="w-full flex items-center gap-1.5 mb-1 shrink-0" style={{ color: "var(--color-ink-2)" }}>
    <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />
    <span className="text-[11px] font-semibold flex-1">覆盖率分级</span>
    </div>
    <div ref={coveragePieChartRef} className="w-full flex-1 min-h-0" style={{ minHeight: 100 }} />
    </div>
    {/* 效率柱图 */}
    <div className="bento-tile rounded-xl p-2 flex-1 flex flex-col min-h-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(250,250,250,0.85) 100%)", border: "1px solid rgba(255,255,255,0.3)", boxShadow: "var(--shadow-float)" }}>
    <div className="w-full flex items-center gap-1.5 mb-1 shrink-0" style={{ color: "var(--color-ink-2)" }}>
    <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-ink-4)" }} />
    <span className="text-[11px] font-semibold flex-1">充电站效率 Top10</span>
    </div>
    <div ref={stationEffChartRef} className="w-full flex-1 min-h-0" style={{ minHeight: 120 }} />
    </div>
    </div>
    )}

    {/* 社区列表 Tab */}
    {rightPanelTab === "communities" && coverageResults.length > 0 && (
    <div key="communities-tab" className="animate-slide-in-right">
    <CoverageCommunityList
    communities={coverageResults}
    onLocate={onLocateCommunity}
    onSelect={(comm) => {
    setCommunityDetail(comm);
    setCommunityDetailOpen(true);
    }}
    />
    </div>
    )}

    {/* 候选点 Tab */}
    {rightPanelTab === "candidates" && blindSpotClusters.length > 0 && (
    <div key="candidates-tab" className="animate-slide-in-right">
    {/* 排序栏 */}
    <div className="px-1 py-1.5 flex items-center gap-1" style={{ borderBottom: "1px solid var(--color-muted)" }}>
    <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>排序</span>
    <select
    value={clusterSortBy}
    onChange={(e) => setClusterSortBy(e.target.value as "population" | "communityCount")}
    className="flex-1 h-6 text-[10px] rounded input-sys px-1"
    style={{ background: "var(--color-surface)" }}
    >
    <option value="population">人口降序</option>
    <option value="communityCount">社区数降序</option>
    </select>
    </div>
    {/* 候选点列表 - 直接平铺, 由外层统一滚动 */}
    <div>
    {[...blindSpotClusters]
    .sort((a, b) => {
    if (clusterSortBy === "population") return b.population - a.population;
    return b.communityCount - a.communityCount;
    })
    .map((c) => {
    const expanded = expandedClusterId === c.clusterId;
    return (
    <div
    key={c.clusterId}
    className="px-2 py-1.5 cursor-pointer hover:bg-amber-50/50 transition-colors"
    style={{ borderBottom: "1px solid var(--color-subtle)" }}
    onClick={() => setExpandedClusterId(expanded ? null : c.clusterId)}
    >
    <div className="flex items-center justify-between gap-1">
    <div className="flex items-center gap-1.5 min-w-0">
    <span className="text-[10px] font-mono text-amber-700 font-bold shrink-0">#{c.clusterId}</span>
    <span className="text-[10px] truncate" style={{ color: "var(--color-ink-4)" }}>
    {c.communityCount} 社区
    </span>
    <span className="text-[10px] text-orange-600 font-bold font-num shrink-0">
    {c.population.toLocaleString()} 人
    </span>
    </div>
    <ChevronDown
    className={`w-3 h-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
    style={{ color: "var(--color-ink-5)" }}
    />
    </div>
    {expanded && (
    <div className="mt-1 space-y-1 animate-fade-in">
    <div className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>
    社区数: {c.communityCount} · 人口: {c.population.toLocaleString()}
    </div>
    <div className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>
    质心: {c.center[0].toFixed(4)}, {c.center[1].toFixed(4)}
    </div>
    <button
    onClick={(e) => {
    e.stopPropagation();
    onSelectSiteAt(c.center[0], c.center[1]);
    }}
    className="w-full mt-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1 transition-colors"
    >
    <Target className="w-3 h-3" /> 在此选址
    </button>
    </div>
    )}
    </div>
    );
    })}
    </div>
    </div>
    )}
    </div>
    </div>
  );
}
