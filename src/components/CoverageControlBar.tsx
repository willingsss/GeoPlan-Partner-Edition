import React from "react";
import { Radar, Download, Printer, Info, MapPin, RefreshCw, Layers, Activity } from "lucide-react";
import type { CoverageSummary } from "../types";

export interface CoverageControlBarProps {
  chargeMode: "fast" | "slow";
  setChargeMode: (m: "fast" | "slow") => void;
  coverageRadius: number;
  setCoverageRadius: (r: number) => void;
  coverageDistrict: string;
  setCoverageDistrict: (d: string) => void;
  serviceAreaMode: "buffer" | "isochrone" | "hybrid";
  setServiceAreaMode: (m: "buffer" | "isochrone" | "hybrid") => void;
  coverageViewMode: string;
  setCoverageViewMode: (m: string) => void;
  regionStats: any[];
  onDistrictChange: (d: string) => void;
  coverageLoading: boolean;
  coverageSummary: CoverageSummary | null;
  coverageResults: any[];
  isochroneCoverage: { covered: number; total: number; fallback: number; ratio: number } | null;
  blindSpotClusters: any[];
  selectedCoverageLevels: Set<string>;
  onToggleCoverageLevel: (level: string) => void;
  showServiceArea: boolean;
  onToggleServiceArea: () => void;
  runCoverageAnalysis: () => void;
  exportCoverageCSV: () => void;
  printCoverageReport: () => void;
}

/**
 * 覆盖分析控制面板（充电模式 / 服务半径 / 行政区 / 服务区模式 / 分析按钮 / 分级图例 / 候选点摘要）
 */
export default function CoverageControlBar({
  chargeMode, setChargeMode,
  coverageRadius, setCoverageRadius,
  coverageDistrict, setCoverageDistrict,
  serviceAreaMode, setServiceAreaMode,
  coverageViewMode, setCoverageViewMode,
  regionStats, onDistrictChange,
  coverageLoading, coverageSummary, coverageResults, isochroneCoverage, blindSpotClusters,
  selectedCoverageLevels, onToggleCoverageLevel,
  showServiceArea, onToggleServiceArea,
  runCoverageAnalysis, exportCoverageCSV, printCoverageReport,
}: CoverageControlBarProps) {
  return (
    <div className="flex-1 min-w-[420px] px-2.5 py-2">
    {/* 标题栏 */}
    <div className="flex items-center gap-2 mb-1.5">
    <Radar className="w-3 h-3 text-sky-500" />
    <span className="text-[13px] font-semibold text-zinc-900">覆盖分析</span>
    <span
    className="text-[10px] px-1.5 py-0.5 rounded"
    style={{
    background: "var(--color-accent-subtle)",
    color: "#0284C7",
    border: "1px solid var(--color-accent-border)",
    }}
    >
    空间分析
    </span>
    <span className="text-[10px] text-zinc-500 ml-auto">
    服务范围 · 盲区识别
    </span>
    </div>
    {/* 参数控件区 */}
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
    {/* 充电模式 - Linear 风分段控件 */}
    <div className="flex items-center gap-1">
    <span className="text-[10px] text-zinc-500">充电模式</span>
    <div
    className="flex rounded p-0.5"
    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
    >
    <button onClick={() => setChargeMode("fast")}
    className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
    chargeMode === "fast"
    ? "bg-white text-sky-600 shadow-sm"
    : "text-zinc-500 hover:text-zinc-700"
    }`}>快充</button>
    <button onClick={() => setChargeMode("slow")}
    className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
    chargeMode === "slow"
    ? "bg-white text-sky-600 shadow-sm"
    : "text-zinc-500 hover:text-zinc-700"
    }`}>慢充</button>
    </div>
    </div>
    {/* 自定义半径 - Linear 风 */}
    <div className="flex items-center gap-1">
    <span className="text-[10px] text-zinc-500">服务半径</span>
    <input type="number" min={300} max={2000} step={50} value={coverageRadius || ""}
    onChange={(e) => setCoverageRadius(Math.max(0, Math.min(2000, parseInt(e.target.value) || 0)))}
    placeholder="预设"
    className="input-sys h-6 w-16 text-[11px] px-2 text-zinc-700 font-num" />
    <button onClick={() => setCoverageRadius(0)}
    className="text-[10px] text-zinc-400 hover:text-zinc-700 underline">重置</button>
    </div>
    {/* 行政区筛选 */}
    <div className="flex items-center gap-1">
    <span className="text-[10px] text-zinc-500">行政区</span>
    <select value={coverageDistrict} onChange={(e) => onDistrictChange(e.target.value)}
    className="input-sys h-6 text-[11px] px-2 text-zinc-700">
    <option value="all">全部行政区</option>
    {[...new Set(regionStats.map(r => r.district))].map(d => (
    <option key={d} value={d}>{d}</option>
    ))}
    </select>
    </div>
    {/* 阶段五 等时圈: 服务区模式分段控件 (缓冲区 / 等时圈 / 混合) */}
    <div className="flex items-center gap-1">
    <span className="text-[10px] text-zinc-500" title="服务区建模方式: 圆形缓冲区为传统估算, 路网等时圈基于真实道路可达性">服务区模式</span>
    <div
    className="flex rounded p-0.5"
    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
    >
    {([
    { key: "buffer", label: "缓冲区" },
    { key: "isochrone", label: "等时圈" },
    { key: "hybrid", label: "混合" },
    ] as const).map(m => (
    <button key={m.key} onClick={() => setServiceAreaMode(m.key)}
    className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
    serviceAreaMode === m.key
    ? "bg-white text-violet-600 shadow-sm"
    : "text-zinc-500 hover:text-zinc-700"
    }`}
    title={m.key === "buffer" ? "圆形缓冲区 (传统估算, 快充 800m / 慢充 400m)" : m.key === "isochrone" ? "路网等时圈 (驾车 10 分钟 / 步行 15 分钟真实可达范围, 缺失站点不计入)" : "混合模式 (优先等时圈, 缺失回退缓冲区, 推荐)"}
    >
    {m.label}
    </button>
    ))}
    </div>
    </div>
    {/* 开始分析 - Linear 风: 黑底白字主按钮 */}
    <button onClick={runCoverageAnalysis} disabled={coverageLoading}
    className={`h-7 px-3 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
    coverageLoading
    ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
    : "bg-zinc-900 hover:bg-zinc-800 text-white"
    }`}>
    {coverageLoading ? <><RefreshCw className="w-3 h-3 animate-spin" /> 分析中</> : <><Radar className="w-3 h-3" /> 开始分析</>}
    </button>
    {/* 阶段四 任务 4.3.1: 导出 CSV 按钮 (灰色变体) */}
    <button onClick={exportCoverageCSV} disabled={!coverageResults.length}
    className={`h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
    !coverageResults.length
    ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
    }`}
    title="导出当前分析结果为 CSV 文件">
    <Download className="w-3 h-3" /> 导出 CSV
    </button>
    {/* 阶段四 任务 4.4.1: 打印报告按钮 (灰色变体) */}
    <button onClick={printCoverageReport} disabled={!coverageSummary}
    className={`h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
    !coverageSummary
    ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
    }`}
    title="生成打印报告 (新窗口)">
    <Printer className="w-3 h-3" /> 打印报告
    </button>
    </div>

    {/* 阶段四 任务 4.1.1: 渲染模式切换 radio 控件 (分级着色 / 热力图) */}
    {coverageSummary && (
    <div className="flex items-center gap-2 mt-1">
    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
    <Layers className="w-3 h-3" />
    渲染模式
    </span>
    <div
    className="flex rounded p-0.5"
    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
    >
    <button
    onClick={() => setCoverageViewMode("graded")}
    className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
    coverageViewMode === "graded"
    ? "bg-white text-emerald-600 shadow-sm"
    : "text-zinc-500 hover:text-zinc-700"
    }`}
    >
    分级着色
    </button>
    <button
    onClick={() => setCoverageViewMode("heatmap")}
    className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
    coverageViewMode === "heatmap"
    ? "bg-white text-rose-600 shadow-sm"
    : "text-zinc-500 hover:text-zinc-700"
    }`}
    >
    热力图
    </button>
    </div>
    {coverageViewMode === "heatmap" && (
    <span className="text-[9px] text-zinc-400">
    覆盖率越低权重越高 (突出盲区)
    </span>
    )}
    </div>
    )}
    {/* 分析摘要 6 格指标卡 - 紧凑单行排列，保证一屏可见 */}
    {coverageSummary && (
    <div className="flex items-stretch gap-1.5 mt-1.5">
    <div className="metric-card rounded-lg px-2 py-1 animate-count-up flex-1" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))", border: "1px solid rgba(16,185,129,0.15)", borderTop: "2px solid #10B981", animationDelay: "0ms" }}>
    <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider truncate">覆盖率</p>
    <p className="text-[14px] font-bold text-emerald-600 font-num mt-0.5">{coverageSummary.coverageRate}%</p>
    </div>
    <div className="metric-card rounded-lg px-2 py-1 animate-count-up flex-1" style={{ background: "linear-gradient(135deg, rgba(20,184,166,0.08), rgba(20,184,166,0.02))", border: "1px solid rgba(20,184,166,0.15)", borderTop: "2px solid #14B8A6", animationDelay: "40ms" }}>
    <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider truncate">人口覆盖</p>
    <p className="text-[14px] font-bold text-teal-600 font-num mt-0.5">{(coverageSummary.populationCoverageRate ?? 0)}%</p>
    </div>
    <div className="metric-card rounded-lg px-2 py-1 animate-count-up flex-1" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))", border: "1px solid rgba(239,68,68,0.15)", borderTop: "2px solid #EF4444", animationDelay: "80ms" }}>
    <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider truncate">盲区社区</p>
    <p className="text-[14px] font-bold text-red-500 font-num mt-0.5">{coverageSummary.blindSpotCommunities}</p>
    </div>
    <div className="metric-card rounded-lg px-2 py-1 animate-count-up flex-1" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))", border: "1px solid rgba(245,158,11,0.15)", borderTop: "2px solid #F59E0B", animationDelay: "120ms" }}>
    <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider truncate">盲区人口</p>
    <p className="text-[14px] font-bold text-orange-500 font-num mt-0.5">{(coverageSummary.blindSpotPopulation >= 10000) ? (coverageSummary.blindSpotPopulation / 10000).toFixed(1) + "万" : coverageSummary.blindSpotPopulation.toLocaleString()}</p>
    </div>
    <div className="metric-card rounded-lg px-2 py-1 animate-count-up flex-1" style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(56,189,248,0.02))", border: "1px solid rgba(56,189,248,0.15)", borderTop: "2px solid #38BDF8", animationDelay: "160ms" }}>
    <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider truncate">充电站</p>
    <p className="text-[14px] font-bold text-sky-500 font-num mt-0.5">{coverageSummary.totalStations}</p>
    </div>
    <div className="metric-card rounded-lg px-2 py-1 animate-count-up flex-1" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02))", border: "1px solid rgba(168,85,247,0.15)", borderTop: "2px solid #A855F7", animationDelay: "200ms" }}>
    <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider truncate">冗余度</p>
    <p className={`text-[14px] font-bold font-num mt-0.5 ${
    (coverageSummary.redundancyScore ?? 0) >= 30
    ? "text-red-500"
    : (coverageSummary.redundancyScore ?? 0) >= 10
    ? "text-orange-500"
    : "text-emerald-500"
    }`}>{(coverageSummary.redundancyScore ?? 0)}</p>
    </div>
    </div>
    )}
    {/* 阶段五 等时圈: 服务区模式来源统计条 (仅在 isochrone / hybrid 模式且具备数据时显示) */}
    {isochroneCoverage && (serviceAreaMode === "isochrone" || serviceAreaMode === "hybrid") && (
    <div
    className="mt-1 rounded px-2 py-1 flex items-center gap-2 text-[10px]"
    style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)" }}
    >
    <Activity className="w-3 h-3 shrink-0" style={{ color: "#7c3aed" }} />
    <span className="text-zinc-500">服务区来源</span>
    <span className="px-1.5 py-0 rounded font-medium font-mono" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.3)" }}>
    等时圈 {isochroneCoverage.covered} 站
    </span>
    {isochroneCoverage.fallback > 0 && (
    <span className="px-1.5 py-0 rounded font-medium font-mono" style={{ background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)" }}>
    缓冲回退 {isochroneCoverage.fallback} 站
    </span>
    )}
    <span className="ml-auto text-zinc-400 font-mono">
    等时圈占比 {isochroneCoverage.ratio}%
    </span>
    </div>
    )}
    {/* 横向图例条 — 嵌入上方功能区, 不占地图空间 */}
    {coverageSummary && (
    <div className="flex items-center gap-3 mt-1 px-1 py-0.5 rounded text-[10px]" style={{ background: "var(--color-subtle)" }}>
    <span className="text-zinc-500 font-semibold">图例</span>
    <button
      onClick={onToggleServiceArea}
      className="flex items-center gap-1 rounded px-1 py-0.5 transition-all"
      style={{
        border: showServiceArea ? "1px solid rgba(6,182,212,0.4)" : "1px solid transparent",
        background: showServiceArea ? "rgba(6,182,212,0.08)" : "transparent",
        opacity: showServiceArea ? 1 : 0.45,
      }}
      title={showServiceArea ? "隐藏服务区" : "显示服务区"}
    >
      <span className="shrink-0 rounded" style={{ width: 10, height: 10, background: "rgba(6,182,212,0.25)", border: "1px solid rgba(0,0,0,0.06)" }} />
      <span>服务区</span>
    </button>
    <span className="flex items-center gap-1">
    <span className="shrink-0 rounded" style={{ width: 10, height: 10, background: "#F59E0B", border: "1px solid rgba(0,0,0,0.06)" }} />
    重叠区
    </span>
    <span className="flex items-center gap-1">
    <MapPin className="w-2.5 h-2.5 text-amber-500 shrink-0" />
    盲区候选点
    </span>
    <span className="text-zinc-300">|</span>
    <span className="text-zinc-500 font-semibold">分级(可多选)</span>
    {([
      { key: "极差", color: "#EF4444" },
      { key: "较差", color: "#F59E0B" },
      { key: "一般", color: "#FACC15" },
      { key: "良好", color: "#84CC16" },
      { key: "优秀", color: "#10B981" },
    ] as const).map(lv => {
      const active = selectedCoverageLevels.has(lv.key);
      return (
        <button
          key={lv.key}
          onClick={() => onToggleCoverageLevel(lv.key)}
          className="flex items-center gap-1 rounded px-1 py-0.5 transition-all"
          style={{
            border: active ? `1px solid ${lv.color}` : "1px solid transparent",
            background: active ? `${lv.color}14` : "transparent",
            opacity: active || selectedCoverageLevels.size === 0 ? 1 : 0.45,
          }}
          title={active ? `取消筛选「${lv.key}」` : `只显示「${lv.key}」区域`}
        >
          <span className="shrink-0 rounded" style={{ width: 10, height: 10, background: lv.color }} />
          <span>{lv.key}</span>
        </button>
      );
    })}
    {selectedCoverageLevels.size > 0 && (
      <button
        onClick={() => onToggleCoverageLevel("__clear__")}
        className="text-[10px] px-1.5 py-0.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
        title="清除筛选, 显示全部分级"
      >
        清除筛选
      </button>
    )}
    </div>
    )}
    {/* 阶段三 任务 3.4.1: 无分析结果时显示小提示（不再占用大卡片） */}
    {!coverageSummary && !coverageLoading && (
    <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500 animate-fade-in">
    <Info className="w-3 h-3 text-zinc-400" />
    <span>配置参数后点击「开始分析」</span>
    <span className="px-1 rounded" style={{ background: "var(--color-accent-subtle)", color: "#0284C7" }}>快充 800m</span>
    <span className="px-1 rounded" style={{ background: "var(--color-accent-subtle)", color: "#0284C7" }}>全部行政区</span>
    </div>
    )}
    {/* 候选点摘要 - 紧凑单行 */}
    {blindSpotClusters.length > 0 && (
    <div className="mt-1">
    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
    <MapPin className="w-3 h-3 text-amber-500" />
    共 {blindSpotClusters.length} 个候选点 · 详见右侧「候选点」Tab
    </p>
    </div>
    )}
    </div>

  );
}
