// SiteResultPanel.tsx
// 选址决策子系统 - 结果面板 (综合评分卡 + 指标卡 + 盲区联动 + Top3推荐 + 方案列表)
// 拆分自 App.tsx; 纯展示组件, 状态+回调全部 props 传入
import { useState } from "react";
import { Target, Radar, Sparkles, Star, Trash2, AlertTriangle } from "lucide-react";
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
  // 选址覆盖的社区明细 (盲区社区联动, 点击看详情)
  coveredCommunities: { id: number; name: string; district: string; population: number; coverageRatio: number; affectedPopulation: number }[];
  onViewCommunity: (comm: any) => void;
  // 选址约束: 周边已有站点 + 拟建品牌 (500m 禁选 + 品牌配额)
  nearbyStations: { name: string; brand: string; distance: number }[];
  siteBrand: string;
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
          blindSpotClusters, activeCandidate, coveredCommunities, onViewCommunity,
          nearbyStations, siteBrand,
          onToggleCompare, onPlaceCandidate, onViewSchemeDetail, onDeleteScheme, onNotify } = props;

  // 候选点一一对应: 从覆盖分析点"在此选址"进来时只显示该候选点; 否则按盲区人口排序 Top3
  const topCandidates = activeCandidate
    ? [activeCandidate]
    : [...blindSpotClusters].sort((a, b) => b.population - a.population).slice(0, 3);

  // 方案按行政区筛选 (纯 UI 状态)
  const [districtFilter, setDistrictFilter] = useState("all");
  const schemeDistricts = [...new Set(schemes.map(s => s.district).filter(Boolean))] as string[];
  const filteredSchemes = districtFilter === "all"
    ? schemes
    : schemes.filter(s => s.district === districtFilter);

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
          {/* 覆盖社区明细 - 盲区社区联动 (点击查看社区详情) */}
          {coveredCommunities.length > 0 && (
            <div className="mt-1.5 rounded-lg px-2.5 py-2"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Radar className="w-3 h-3 text-emerald-500" />
                <p className="text-[10px] text-zinc-600">覆盖社区明细（{coveredCommunities.length}）</p>
                <span className="text-[9px] px-1 py-0 rounded ml-auto"
                  style={{ background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
                  点击看详情
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {coveredCommunities.map(c => (
                  <button key={c.id}
                    onClick={() => onViewCommunity(c)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md transition-all hover:bg-white text-left"
                    style={{ border: "1px solid var(--color-muted)" }}>
                    <span className="text-[10px] text-zinc-700 font-medium flex-1 truncate">{c.name}</span>
                    <span className="text-[9px] text-zinc-400 shrink-0">{c.district}</span>
                    <span className="text-[9px] font-semibold font-num text-emerald-600 shrink-0">{c.coverageRatio}%</span>
                    <span className="text-[9px] font-num text-zinc-500 shrink-0">{c.affectedPopulation.toLocaleString()}人</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* 选址约束: 500m 内已有站点禁止 + 品牌配额提示 */}
          {nearbyStations.length > 0 && (
            <div className="mt-1.5 rounded-lg px-2.5 py-2"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <p className="text-[10px] text-zinc-600">选址约束</p>
              </div>
              {(() => {
                const close = nearbyStations.filter(s => s.distance < 500);
                const sameBrand = nearbyStations.filter(s => s.brand === siteBrand);
                return (
                  <div className="space-y-1">
                    {close.length > 0 && (
                      <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <p className="text-[9px] font-semibold text-red-600 mb-1">⚠ 距以下已有站点 &lt;500m（建议避免）：</p>
                        {close.map(s => (
                          <p key={s.name} className="text-[9px] text-red-500 flex justify-between">
                            <span className="truncate">{s.name}（{s.brand}）</span>
                            <span className="font-num shrink-0 ml-2">{s.distance}m</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[9px]" style={{ color: "var(--color-ink-4)" }}>
                      <span>周边 1.5km 共 <b className="font-num text-zinc-700">{nearbyStations.length}</b> 站</span>
                      <span className="text-zinc-300">|</span>
                      <span>
                        同品牌「{siteBrand}」<b className="font-num" style={{ color: sameBrand.length > 2 ? "#EF4444" : "#059669" }}>{sameBrand.length}</b> 站
                        {sameBrand.length > 2 && <span className="text-red-500">（配额偏满）</span>}
                      </span>
                    </div>
                    {close.length === 0 && (
                      <p className="text-[9px] text-emerald-600">✅ 500m 内无已有站点，符合选址间距约束</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
      {/* 已保存方案 - Linear 风: 标签按钮 */}
      {schemes.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[10px] text-zinc-500">
              已保存方案（{filteredSchemes.length}/{schemes.length}）· 勾选 2 个方案进行深度对比
            </p>
            {/* 行政区筛选 */}
            <select
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
              className="ml-auto input-sys h-5 text-[9px] px-1 text-zinc-600"
              title="按行政区筛选方案"
            >
              <option value="all">全部行政区</option>
              {schemeDistricts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            {filteredSchemes.map(s => (
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
