// SiteResultPanel.tsx
// 选址决策子系统 - 结果面板 (综合评分卡 + 指标卡 + 盲区联动 + Top3推荐 + 方案列表)
// 拆分自 App.tsx; 纯展示组件, 状态+回调全部 props 传入
import { Target, Radar, Sparkles, Star, Trash2 } from "lucide-react";
import { SchemeReportButton } from "./SchemeReportPrint";
import type { SiteMetrics, SavedScheme } from "../hooks/useSiteAnalysis";

interface SiteResultPanelProps {
  siteMetrics: SiteMetrics | null;
  siteInBlindSpot: boolean;
  lastCoverageSummary: { coverageRate: number; blindSpotCommunities: number; blindSpotPopulation: number } | null;
  schemes: SavedScheme[];
  compareSchemes: number[];
  blindSpotClusters: { clusterId: number; center: [number, number]; communityCount: number; population: number }[];
  // 覆盖分析点"在此选址"联动: 只展示该候选点 (一一对应), 为空则显示 Top3 推荐
  activeCandidate: { clusterId: number; center: [number, number]; communityCount: number; population: number } | null;
  onToggleCompare: (id: number, checked: boolean) => void;
  onPlaceCandidate: (lng: number, lat: number) => void;
  onViewSchemeDetail: (id: number) => void;
  onDeleteScheme: (id: number) => void;
  onNotify: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
}

// 综合评分: 归一化加权 (与雷达图维度一致)
function calcScore(m: SiteMetrics): { score: number; grade: string; gradeColor: string } {
  const pop = Math.min(m.covered_population / 20000, 1) * 30;      // 30%
  const comm = Math.min(m.covered_communities / 10, 1) * 15;       // 15%
  const comp = Math.min((m.competition_score ?? 0) / 100, 1) * 20; // 20%
  const benefit = Math.min((m.social_benefit ?? 0) / 100, 1) * 20; // 20%
  const blind = Math.min((m.blind_spot_reduction ?? 0) / 100, 1) * 15; // 15%
  const score = Math.round(pop + comm + comp + benefit + blind);
  if (score >= 85) return { score, grade: "A·优", gradeColor: "#10B981" };
  if (score >= 70) return { score, grade: "B·良", gradeColor: "#38BDF8" };
  if (score >= 55) return { score, grade: "C·中", gradeColor: "#F59E0B" };
  return { score, grade: "D·待优化", gradeColor: "#F43F5E" };
}

export default function SiteResultPanel(props: SiteResultPanelProps) {
  const { siteMetrics, siteInBlindSpot, lastCoverageSummary, schemes, compareSchemes,
          blindSpotClusters, activeCandidate, onToggleCompare, onPlaceCandidate, onViewSchemeDetail, onDeleteScheme, onNotify } = props;

  // 候选点一一对应: 从覆盖分析点"在此选址"进来时只显示该候选点; 否则按盲区人口排序 Top3
  const topCandidates = activeCandidate
    ? [activeCandidate]
    : [...blindSpotClusters].sort((a, b) => b.population - a.population).slice(0, 3);

  return (
    <>
      {/* 推荐选址 Top3 - 来自覆盖分析候选点 */}
      {topCandidates.length > 0 && (
        <div className="mt-1.5 rounded-lg px-2.5 py-2"
          style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <p className="text-[10px] text-zinc-600">
              {activeCandidate ? "当前选址点（来自覆盖分析）" : `推荐选址 Top${topCandidates.length}（按盲区人口）`}
            </p>
            <span className="text-[9px] px-1 py-0 rounded ml-auto"
              style={{ background: "rgba(245,158,11,0.08)", color: "#D97706", border: "1px solid rgba(245,158,11,0.2)" }}>
              点击即评估
            </span>
          </div>
          <div className="space-y-1">
            {topCandidates.map((c, idx) => (
              <button key={c.clusterId}
                onClick={() => onPlaceCandidate(c.center[0], c.center[1])}
                className="w-full flex items-center gap-2 px-2 py-1 rounded-md transition-all hover:bg-white"
                style={{ border: "1px solid var(--color-muted)" }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: idx === 0 ? "#F59E0B" : idx === 1 ? "#38BDF8" : "#A855F7" }}>
                  {idx + 1}
                </span>
                <span className="text-[10px] text-zinc-600 flex-1">盲区社区 {c.communityCount} 个</span>
                <span className="text-[10px] font-semibold font-num text-orange-500">{c.population.toLocaleString()} 人</span>
                <Target className="w-3 h-3 text-zinc-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 综合评分卡 - 选址决策总览 (置于 Top3 推荐之后, 点击候选点后自然可见) */}
      {siteMetrics && (
        <div
          className="mt-2 rounded-lg px-3 py-2.5 flex items-center gap-3 animate-fade-in"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))",
            border: "1px solid rgba(245,158,11,0.2)",
            borderTop: "2px solid #F59E0B",
          }}
        >
          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,0.12)" }}>
            <Star className="w-5 h-5" style={{ color: "#F59E0B" }} />
          </div>
          <div className="flex-1">
            <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">综合评分</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-bold font-num" style={{ color: calcScore(siteMetrics).gradeColor }}>
                {calcScore(siteMetrics).score}
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{
                background: `${calcScore(siteMetrics).gradeColor}1A`,
                color: calcScore(siteMetrics).gradeColor,
                border: `1px solid ${calcScore(siteMetrics).gradeColor}40`,
              }}>
                {calcScore(siteMetrics).grade}
              </span>
            </div>
          </div>
          <div className="text-right text-[9px] text-zinc-400 leading-relaxed">
            <p>人口30% · 社区15%</p>
            <p>竞争20% · 效益20% · 盲区15%</p>
          </div>
        </div>
      )}
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
                {/* 单方案深度评估按钮 (导出报告左边) */}
                <button
                  onClick={() => onViewSchemeDetail(s.id)}
                  className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors"
                  style={{ color: "var(--color-brand-text)", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)" }}
                  title="查看该方案的深度分析"
                >
                  深度评估
                </button>
                {/* 阶段二 任务 2.6.2: 导出报告按钮 */}
                <SchemeReportButton
                  schemeId={s.id}
                  schemeName={s.name}
                  onNotify={onNotify}
                />
                {/* 删除方案按钮 */}
                <button
                  onClick={() => onDeleteScheme(s.id)}
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-red-50"
                  style={{ color: "var(--color-ink-5)" }}
                  title="删除该方案"
                  onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--color-ink-5)"; }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
