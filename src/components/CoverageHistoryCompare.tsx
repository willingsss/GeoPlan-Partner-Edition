import { useState } from "react";
import type { CoverageHistoryItem, CoverageSummary } from "../types";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";

// =========================================================================
// 覆盖分析历史对比组件 (阶段四 任务 4.2)
// 并排显示最多 3 张历史分析卡片, 与当前结果对比, 点击触发回溯
// =========================================================================

interface CoverageHistoryCompareProps {
  history: CoverageHistoryItem[];
  current: CoverageSummary | null;
  onRecall: (item: CoverageHistoryItem) => void;
}

// 时间戳格式化为 YYYY-MM-DD HH:mm
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 计算与当前覆盖率的差异 (百分比, 正数=改善, 负数=恶化)
function diffVsCurrent(historyRate: number, current: CoverageSummary | null): number {
  if (!current) return 0;
  return Math.round((historyRate - current.coverageRate) * 10) / 10;
}

export default function CoverageHistoryCompare({
  history,
  current,
  onRecall,
}: CoverageHistoryCompareProps) {
  // 选中的历史卡片 id (用于高亮, 再次点击恢复)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (history.length === 0) return null;

  const handleClick = (item: CoverageHistoryItem) => {
    // 再次点击同一卡片: 取消选中并恢复
    if (selectedId === item.id) {
      setSelectedId(null);
    } else {
      setSelectedId(item.id);
    }
    onRecall(item);
  };

  return (
    <div
      className="rounded-lg p-2"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-muted)",
        borderRadius: 8,
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <History className="w-3 h-3 text-amber-500" />
        <span className="text-[11px] font-semibold" style={{ color: "var(--color-ink-2)" }}>
          历史对比
        </span>
        <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>
          最多保留 3 条 · 点击卡片回溯
        </span>
      </div>

      {/* 历史卡片并排显示 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {history.map((item) => {
          // 判断是否为当前结果 (时间戳最新且参数与当前一致)
          const isCurrent = current && item.summary.coverageRate === current.coverageRate
            && item.summary.blindSpotCommunities === current.blindSpotCommunities;
          const isSelected = selectedId === item.id;
          // 与当前结果差异
          const diff = diffVsCurrent(item.summary.coverageRate, current);
          const diffIcon = diff > 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : diff < 0
              ? <TrendingDown className="w-3 h-3 text-red-500" />
              : <Minus className="w-3 h-3 text-zinc-400" />;
          const diffColor = diff > 0
            ? "text-emerald-600"
            : diff < 0
              ? "text-red-500"
              : "text-zinc-400";
          const diffText = diff > 0 ? `↑${diff}%` : diff < 0 ? `↓${Math.abs(diff)}%` : "持平";

          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className="shrink-0 w-[180px] text-left rounded-md p-1.5 transition-all hover:shadow-md"
              style={{
                background: "var(--color-subtle)",
                border: isCurrent
                  ? "2px solid #F59E0B"
                  : isSelected
                    ? "2px solid #00C896"
                    : "1px solid var(--color-muted)",
                cursor: "pointer",
              }}
              title={isCurrent ? "当前结果" : "点击回溯到此历史结果"}
            >
              {/* 时间戳 */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-num" style={{ color: "var(--color-ink-3)" }}>
                  {formatTime(item.timestamp)}
                </span>
                {isCurrent && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-medium"
                    style={{ background: "#FEF3C7", color: "#92400E" }}
                  >
                    当前
                  </span>
                )}
              </div>

              {/* 参数 */}
              <div className="flex flex-wrap gap-1 mb-1.5">
                <span
                  className="text-[9px] px-1 py-0.5 rounded"
                  style={{ background: "var(--color-surface)", color: "var(--color-ink-4)" }}
                >
                  {item.params.chargeMode === "fast" ? "快充" : "慢充"}
                </span>
                <span
                  className="text-[9px] px-1 py-0.5 rounded"
                  style={{ background: "var(--color-surface)", color: "var(--color-ink-4)" }}
                >
                  {/* 服务半径硬编码值与 server/config/coverageConfig.ts 保持一致 (快充1000m / 慢充400m) */}
                  {item.params.radius || (item.params.chargeMode === "fast" ? 1000 : 400)}m
                </span>
                <span
                  className="text-[9px] px-1 py-0.5 rounded"
                  style={{ background: "var(--color-surface)", color: "var(--color-ink-4)" }}
                >
                  {item.params.district === "all" ? "全部" : item.params.district}
                </span>
              </div>

              {/* 核心指标 */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>覆盖率</span>
                  <span className={`text-[12px] font-bold font-num ${diffColor} flex items-center gap-0.5`}>
                    {diffIcon}
                    {item.summary.coverageRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>盲区社区</span>
                  <span className="text-[11px] font-num text-red-500">
                    {item.summary.blindSpotCommunities}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>盲区人口</span>
                  <span className="text-[11px] font-num text-orange-500">
                    {item.summary.blindSpotPopulation.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 与当前差异 */}
              {!isCurrent && current && (
                <div
                  className="mt-1.5 pt-1 flex items-center justify-between"
                  style={{ borderTop: "1px solid var(--color-muted)" }}
                >
                  <span className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>
                    vs 当前
                  </span>
                  <span className={`text-[10px] font-medium ${diffColor}`}>
                    {diffText}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
