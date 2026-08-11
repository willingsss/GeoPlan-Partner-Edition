// SiteControlBar.tsx
// 选址决策子系统 - 参数控制面板 (拆分自 App.tsx)
// 纯展示组件: 状态+回调全部 props 传入
import { Target, Save, Calculator, GitCompare } from "lucide-react";
import type { SiteMetrics } from "../hooks/useSiteAnalysis";

interface SiteControlBarProps {
  activeTab: string;
  siteRadius: number;
  siteChargeMode: "fast" | "slow";
  siteBrand: string;
  schemeName: string;
  compareSchemes: number[];
  virtualStation: { lng: number; lat: number } | null;
  siteMetrics: SiteMetrics | null;
  availableBrands: string[];
  brands: string[];
  brandConfig: Record<string, { label?: string }>;
  onRadiusChange: (v: number) => void;
  onChargeModeChange: (m: "fast" | "slow") => void;
  onBrandChange: (b: string) => void;
  onSchemeNameChange: (n: string) => void;
  onSaveScheme: () => void;
  onRunRoi: () => void;
  onRunCompare: () => void;
}

export default function SiteControlBar(props: SiteControlBarProps) {
  const {
    activeTab, siteRadius, siteChargeMode, siteBrand, schemeName, compareSchemes,
    virtualStation, siteMetrics, availableBrands, brands, brandConfig,
    onRadiusChange, onChargeModeChange, onBrandChange, onSchemeNameChange,
    onSaveScheme, onRunRoi, onRunCompare,
  } = props;

  return (
    <>
      {activeTab === "site" && (
        <>
          {/* 标题栏 - Linear 风: 紧凑 + 等宽标签 */}
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3 h-3 text-amber-500" />
            <span className="text-[13px] font-semibold text-zinc-900">选址决策</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(245,158,11,0.08)",
                color: "#D97706",
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              决策沙盘
            </span>
            <span className="text-[10px] text-zinc-500 ml-auto">
              点击地图放置 · 拖拽调整
            </span>
          </div>
          {/* 参数控件区 - Linear 风: 分段控件 */}
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {/* 服务半径 - 紧凑滑块 */}
            <div className="flex items-center gap-1.5 min-w-[180px]">
              <span className="text-[10px] text-zinc-500">服务半径</span>
              <input type="range" min="300" max="1500" step="50" value={siteRadius}
                onChange={(e) => onRadiusChange(parseInt(e.target.value))}
                className="flex-1 accent-amber-500 h-1" />
              <span className="font-num text-amber-600 text-[11px] font-semibold w-12 text-right">{siteRadius}米</span>
            </div>
            {/* 充电模式 - Linear 风分段控件 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500">充电模式</span>
              <div
                className="flex rounded p-0.5"
                style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
              >
                <button onClick={() => onChargeModeChange("fast")}
                  className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
                    siteChargeMode === "fast"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}>快充</button>
                <button onClick={() => onChargeModeChange("slow")}
                  className={`h-6 px-2 rounded text-[11px] font-medium transition-all ${
                    siteChargeMode === "slow"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}>慢充</button>
              </div>
            </div>
            {/* 拟建品牌 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500">品牌</span>
              <select value={siteBrand} onChange={(e) => onBrandChange(e.target.value)}
                className="input-sys h-6 text-[11px] px-2 text-zinc-700">
                {(availableBrands.length ? availableBrands : brands).map(b => (
                  <option key={b} value={b}>{brandConfig[b]?.label || b}</option>
                ))}
              </select>
            </div>
            {/* 保存方案 - Linear 风紧凑按钮 */}
            {virtualStation && (
              <div className="flex items-center gap-1">
                <input type="text" value={schemeName} onChange={(e) => onSchemeNameChange(e.target.value)}
                  placeholder="方案名" className="input-sys h-6 w-24 text-[11px] px-2 text-zinc-700" />
                <button onClick={onSaveScheme}
                  className="h-6 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] px-2.5 rounded flex items-center gap-1 transition-colors">
                  <Save className="w-3 h-3" /> 保存
                </button>
              </div>
            )}
            {/* 阶段二 任务 2.3.2: ROI 估算按钮 */}
            {virtualStation && siteMetrics && (
              <button onClick={onRunRoi}
                className="h-6 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                style={{
                  background: "rgba(0,200,150,0.08)",
                  color: "var(--color-brand-text)",
                  border: "1px solid var(--color-brand-border)",
                }}>
                <Calculator className="w-3 h-3" /> ROI 估算
              </button>
            )}
            {/* 阶段二 任务 2.2.2: 深度对比按钮 (需选中 2 个方案) */}
            <button
              onClick={onRunCompare}
              disabled={compareSchemes.length !== 2}
              className={`h-6 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                compareSchemes.length === 2
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              }`}>
              <GitCompare className="w-3 h-3" /> 深度对比 ({compareSchemes.length}/2)
            </button>
          </div>
        </>
      )}
    </>
  );
}
