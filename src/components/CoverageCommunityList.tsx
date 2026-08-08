import { useState, useMemo } from "react";
import type { CommunityResult } from "../types";
import { Search, ChevronDown, MapPin, Users, Navigation } from "lucide-react";

// =========================================================================
// 盲区社区列表组件 (覆盖分析右侧面板下方)
// 支持: 搜索 / 排序 / 分级筛选 / 分页
// =========================================================================

interface CoverageCommunityListProps {
  communities: CommunityResult[];
  onLocate: (comm: CommunityResult) => void;
  onSelect: (comm: CommunityResult) => void;
}

// 分级色阶映射 (与 communityGradedStyle 保持一致)
const LEVEL_COLORS: Record<string, string> = {
  "极差": "#EF4444",
  "较差": "#F59E0B",
  "一般": "#FACC15",
  "良好": "#84CC16",
  "优秀": "#10B981",
};

const LEVEL_OPTIONS = ["极差", "较差", "一般", "良好", "优秀"];

type SortBy = "population" | "coverage" | "district";

const PAGE_SIZE = 20;

export default function CoverageCommunityList({
  communities,
  onLocate,
  onSelect,
}: CoverageCommunityListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("population");
  const [filterLevels, setFilterLevels] = useState<Set<string>>(new Set(["极差"]));
  const [page, setPage] = useState(1);

  // 过滤 + 排序
  const filtered = useMemo(() => {
    let list = communities.filter((c) => {
      // 搜索匹配社区名
      if (searchQuery && !c.name.includes(searchQuery)) return false;
      // 分级筛选: 若筛选集非空, 必须命中
      // 注: coverageRatio<10 视为"极差", 这里用 isBlindSpot + coverageRatio 兜底推断 level
      const level = inferLevel(c.coverageRatio);
      if (filterLevels.size > 0 && !filterLevels.has(level)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "population") return b.population - a.population;
      if (sortBy === "coverage") return a.coverageRatio - b.coverageRatio;
      if (sortBy === "district") return a.district.localeCompare(b.district, "zh-CN");
      return 0;
    });
    return list;
  }, [communities, searchQuery, sortBy, filterLevels]);

  // 分页
  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // 切换分级筛选
  const toggleLevel = (level: string) => {
    setFilterLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
    setPage(1);
  };

  // 清空搜索/筛选时重置分页
  const handleSearch = (v: string) => {
    setSearchQuery(v);
    setPage(1);
  };
  const handleSort = (v: SortBy) => {
    setSortBy(v);
    setPage(1);
  };

  return (
    <div
      className="w-full flex flex-col rounded-lg animate-fade-in overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid var(--color-muted)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* 标题栏 */}
      <div className="px-2.5 py-1.5 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--color-muted)" }}>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" style={{ color: "var(--color-brand-text)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--color-ink-2)" }}>
            社区列表
          </span>
          <span className="text-[10px] font-num" style={{ color: "var(--color-ink-5)" }}>
            ({filtered.length})
          </span>
        </div>
      </div>

      {/* 工具栏: 搜索 + 排序 */}
      <div className="px-2 py-1.5 space-y-1.5 shrink-0" style={{ borderBottom: "1px solid var(--color-muted)" }}>
        <div className="relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--color-ink-5)" }} />
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索社区名"
            className="w-full h-6 pl-6 pr-2 text-[11px] rounded input-sys"
            style={{ background: "var(--color-surface)" }}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>排序</span>
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value as SortBy)}
            className="flex-1 h-6 text-[10px] rounded input-sys px-1"
            style={{ background: "var(--color-surface)" }}
          >
            <option value="population">人口降序</option>
            <option value="coverage">覆盖率升序</option>
            <option value="district">行政区</option>
          </select>
        </div>
        {/* 分级筛选 chips */}
        <div className="flex flex-wrap gap-1">
          {LEVEL_OPTIONS.map((lv) => {
            const active = filterLevels.has(lv);
            const color = LEVEL_COLORS[lv];
            return (
              <button
                key={lv}
                onClick={() => toggleLevel(lv)}
                className="px-1.5 py-0.5 rounded text-[10px] transition-all"
                style={{
                  background: active ? color + "20" : "transparent",
                  border: `1px solid ${active ? color : "var(--color-line)"}`,
                  color: active ? color : "var(--color-ink-5)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {lv}
              </button>
            );
          })}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-4 text-center text-[11px]" style={{ color: "var(--color-ink-5)" }}>
            无匹配社区
          </div>
        ) : (
          visible.map((c) => {
            const level = inferLevel(c.coverageRatio);
            const color = LEVEL_COLORS[level] || "var(--color-ink-5)";
            return (
              <div
                key={c.id}
                className="px-2 py-1.5 cursor-pointer hover:bg-zinc-50 transition-colors"
                style={{ borderBottom: "1px solid var(--color-subtle)" }}
                onClick={() => onLocate(c)}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-medium truncate" style={{ color: "var(--color-ink-1)" }}>
                    {c.name}
                  </span>
                  <span
                    className="text-[10px] px-1 rounded shrink-0"
                    style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}
                  >
                    {c.district}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] font-num" style={{ color: "var(--color-ink-4)" }}>
                    {c.population.toLocaleString()} 人
                  </span>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-[10px] font-num" style={{ color }}>
                      {c.coverageRatio.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] truncate" style={{ color: "var(--color-ink-5)" }}>
                    {c.coveredBy ? `覆盖: ${c.coveredBy}` : "无覆盖"}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(c); }}
                    className="text-[10px] flex items-center gap-0.5 shrink-0 ml-1"
                    style={{ color: "var(--color-brand-text)" }}
                  >
                    <Navigation className="w-2.5 h-2.5" /> 详情
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="shrink-0 py-1.5 text-[11px] flex items-center justify-center gap-1 hover:bg-zinc-50 transition-colors"
          style={{ borderTop: "1px solid var(--color-muted)", color: "var(--color-brand-text)" }}
        >
          <ChevronDown className="w-3 h-3" /> 加载更多 ({filtered.length - visible.length})
        </button>
      )}
    </div>
  );
}

// 根据 coverageRatio 推断分级 (与后端阈值保持一致)
function inferLevel(ratio: number): string {
  if (ratio >= 90) return "优秀";
  if (ratio >= 60) return "良好";
  if (ratio >= 30) return "一般";
  if (ratio >= 10) return "较差";
  return "极差";
}
