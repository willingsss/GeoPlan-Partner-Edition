// SiteResultPanel.tsx
// 选址决策子系统 - 结果面板 (指标卡 + 盲区联动 + 方案列表, 拆分自 App.tsx)
// 纯展示组件: 状态+回调全部 props 传入
import { Target, Radar } from "lucide-react";
import { SchemeReportButton } from "./SchemeReportPrint";
import type { SiteMetrics, SavedScheme } from "../hooks/useSiteAnalysis";

interface SiteResultPanelProps {
  siteMetrics: SiteMetrics | null;
  siteInBlindSpot: boolean;
  lastCoverageSummary: { coverageRate: number; blindSpotCommunities: number; blindSpotPopulation: number } | null;
  schemes: SavedScheme[];
  compareSchemes: number[];
  onToggleCompare: (id: number, checked: boolean) => void;
  onNotify: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
}

export default function SiteResultPanel(props: SiteResultPanelProps) {
  const { siteMetrics, siteInBlindSpot, lastCoverageSummary, schemes, compareSchemes, onToggleCompare, onNotify } = props;

  return (
    <>
      {/* 指标卡 4 格 - Bento 指挥甲板: 3D 磁贴 + 高光边缘 */}
      {siteMetrics && (
        <>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="metric-card rounded-lg px-3 py-2 animate-count-up" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))", border: "1px solid rgba(16,185,129,0.15)", borderTop: "2px solid #10B981", animationDelay: "0ms" }}>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">覆盖人口</p>
              <p className="text-[18px] font-bold text-zinc-900 font-num mt-0.5">{siteMetrics.covered_population.toLocaleString()}</p>
            </div>
            <div className="metric-card rounded-lg px-3 py-2 animate-count-up" style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(56,189,248,0.02))", border: "1px solid rgba(56,189,248,0.15)", borderTop: "2px solid #38BDF8", animationDelay: "50ms" }}>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">覆盖社区</p>
              <p className="text-[18px] font-bold text-zinc-900 font-num mt-0.5">{siteMetrics.covered_communities}</p>
            </div>
            <div className="metric-card rounded-lg px-3 py-2 animate-count-up" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))", border: "1px solid rgba(245,158,11,0.15)", borderTop: "2px solid #F59E0B", animationDelay: "100ms" }}>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">竞争避让</p>
              <p className="text-[18px] font-bold text-zinc-900 font-num mt-0.5">{siteMetrics.competition_score}</p>
            </div>
            <div className="metric-card rounded-lg px-3 py-2 animate-count-up" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02))", border: "1px solid rgba(168,85,247,0.15)", borderTop: "2px solid #A855F7", animationDelay: "150ms" }}>
              <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">社会效益</p>
              <p className="text-[18px] font-bold text-zinc-900 font-num mt-0.5">{siteMetrics.social_benefit}</p>
            </div>
          </div>
          {/* 盲区联动提示 - Linear 风: 极简 */}
          {siteInBlindSpot && (
            <div
              className="mt-1.5 rounded px-2 py-1 text-[11px] flex items-center gap-1.5 animate-fade-in"
              style={{
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "#92400E",
              }}
            >
              <Target className="w-3 h-3" />
              <span>该选址将消除盲区</span>
              <span className="ml-auto text-[10px]">命中盲区</span>
            </div>
          )}
          {/* 当前区域盲区概况 - Linear 风 */}
          {lastCoverageSummary && (
            <div
              className="mt-1.5 rounded px-2 py-1.5"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Radar className="w-3 h-3 text-sky-500" />
                <p className="text-[10px] text-zinc-600">盲区概况</p>
                <span
                  className="text-[9px] px-1 py-0 rounded ml-auto"
                  style={{ background: "var(--color-accent-subtle)", color: "#0284C7", border: "1px solid var(--color-accent-border)" }}
                >
                  来自覆盖分析
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-zinc-500">覆盖率</p>
                  <p className="text-[13px] font-bold text-emerald-600 font-num">{lastCoverageSummary.coverageRate}%</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500">盲区社区</p>
                  <p className="text-[13px] font-bold text-red-500 font-num">{lastCoverageSummary.blindSpotCommunities}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500">盲区人口</p>
                  <p className="text-[13px] font-bold text-orange-500 font-num">{lastCoverageSummary.blindSpotPopulation.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* 已保存方案 - Linear 风: 标签按钮 */}
      {schemes.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-zinc-500 mb-1">
            已保存方案（{schemes.length}）· 勾选 2 个方案进行深度对比
          </p>
          <div className="space-y-1">
            {schemes.map(s => (
              <div key={s.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all ${
                  compareSchemes.includes(s.id)
                    ? "bg-amber-50"
                    : "bg-zinc-50 hover:bg-zinc-100"
                }`}
                style={{ border: `1px solid ${compareSchemes.includes(s.id) ? "rgba(245,158,11,0.3)" : "var(--color-muted)"}` }}
              >
                <input
                  type="checkbox"
                  checked={compareSchemes.includes(s.id)}
                  onChange={(e) => onToggleCompare(s.id, e.target.checked)}
                  className="accent-amber-500 w-3 h-3 shrink-0"
                />
                <span className="text-[11px] text-zinc-700 font-medium flex-1 truncate">{s.name}</span>
                <span className="text-[9px] text-zinc-400">{s.brand}</span>
                {/* 阶段二 任务 2.6.2: 导出报告按钮 */}
                <SchemeReportButton
                  schemeId={s.id}
                  schemeName={s.name}
                  onNotify={onNotify}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
