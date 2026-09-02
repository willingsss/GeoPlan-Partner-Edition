import React from "react";
import {
  Zap, Building2, MessageSquare, Square, GripVertical, Activity, Flame, Search, Layers, X,
  MapIcon, Loader2, PanelLeftClose
} from "lucide-react";
import { BRAND_CONFIG } from "../types";

export interface MapVerticalBarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searching: boolean;
  setSearching: (v: boolean) => void;
  searchResults: any[];
  setSearchResults: (v: any[]) => void;
  setSearchResult: (v: any) => void;
  showSearchDropdown: boolean;
  setShowSearchDropdown: (v: boolean) => void;
  selectSearchResult: (r: any) => void;
  searchSourceRef: React.MutableRefObject<any>;
  layerOrder: string[];
  setLayerOrder: (v: string[]) => void;
  layerOpacity: Record<string, number>;
  setLayerOpacity: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  showStations: boolean;
  setShowStations: (v: boolean) => void;
  showCommunities: boolean;
  setShowCommunities: (v: boolean) => void;
  showFeedback: boolean;
  setShowFeedback: (v: boolean) => void;
  showMeasure: boolean;
  setShowMeasure: (v: boolean) => void;
  isochroneCoverage: { covered: number; total: number } | null;
  showIsochroneLayer: boolean;
  setShowIsochroneLayer: (v: boolean) => void;
  availableBrands: string[];
  visibleBrands: Set<string>;
  setVisibleBrands: (v: Set<string>) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  heatmapData: any[];
  showFeedbackHeatmap: boolean;
  setShowFeedbackHeatmap: (v: boolean) => void;
  feedbackHeatmapType: "all" | "demand" | "evaluation";
  setFeedbackHeatmapType: (v: "all" | "demand" | "evaluation") => void;
  feedbackHeatmapRating: number;
  setFeedbackHeatmapRating: (v: number) => void;
  regionStats: any[];
  // 精简模式(普通用户): 只显示搜索, 隐藏专业图层控制
  compact?: boolean;
}

/**
 * 垂直功能栏（地图展示与查询：地点搜索 / 图层管理 / 品牌图层 / 叠加图层 / 区域统计）
 */
export default function MapVerticalBar({
  searchQuery, setSearchQuery, searching, setSearching, searchResults, setSearchResults, setSearchResult,
  showSearchDropdown, setShowSearchDropdown, selectSearchResult, searchSourceRef,
  layerOrder, setLayerOrder, layerOpacity, setLayerOpacity,
  showStations, setShowStations, showCommunities, setShowCommunities, showFeedback, setShowFeedback, showMeasure, setShowMeasure,
  isochroneCoverage, showIsochroneLayer, setShowIsochroneLayer,
  availableBrands, visibleBrands, setVisibleBrands,
  showHeatmap, setShowHeatmap, heatmapData, showFeedbackHeatmap, setShowFeedbackHeatmap,
  feedbackHeatmapType, setFeedbackHeatmapType, feedbackHeatmapRating, setFeedbackHeatmapRating,
  regionStats,
  compact = false,
}: MapVerticalBarProps) {
  const dragLayerIdRef = React.useRef<string | null>(null);
  // NIO 风格: 默认收起为窄条, 点击展开为左侧悬浮玻璃卡
  const [collapsed, setCollapsed] = React.useState(true);

  // 收起态: 左侧窄条 (搜索/图层入口), 最大化地图视野
  if (collapsed) {
    return (
      <div className="absolute left-4 top-[68px] z-20 nio-card flex flex-col items-center gap-1 p-1.5 animate-panel-enter">
        <button
          onClick={() => setCollapsed(false)}
          title="展开搜索与图层"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105"
          style={{ background: "var(--color-brand)", boxShadow: "0 2px 10px rgba(0,200,150,0.35)" }}
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCollapsed(false)}
          title="图层管理"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.05] transition-all"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside
      className="absolute left-4 top-[68px] bottom-4 z-20 nio-card flex flex-col overflow-hidden animate-panel-enter map-panel-auto-narrow mobile-map-panel-bottom-sheet"
      style={{ width: 262 }}
    >
      <div
        className="h-9 shrink-0 px-3 flex items-center justify-between z-10"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center gap-1.5">
          <MapIcon className="w-3 h-3 text-zinc-500" />
          <h3 className="text-[11px] font-semibold text-zinc-800">
            图层与搜索
          </h3>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="收起面板"
          className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.05] transition-all"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
                {/* 地点搜索 - Linear 风: 简洁边框 + 等宽提示 */}
                <div className="relative">
                  <div className="flex items-center gap-1.5 input-sys px-2 py-1.5">
                    <Search className="w-3 h-3 text-zinc-400 shrink-0" />
                    <input type="text" value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.trim().length >= 2) {
                          setSearching(true);
                          setShowSearchDropdown(true);
                          fetch(`/api/v1/places/search?keyword=${encodeURIComponent(e.target.value.trim())}`)
                            .then(r => r.json())
                            .then(j => { setSearchResults(j.success ? j.data : []); setSearching(false); })
                            .catch(() => { setSearchResults([]); setSearching(false); });
                        } else {
                          setShowSearchDropdown(false);
                          setSearchResults([]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setShowSearchDropdown(false);
                        if (e.key === "Enter" && searchResults.length > 0) {
                          selectSearchResult(searchResults[0]);
                        }
                      }}
                      onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                      placeholder="地名 / 地址 / POI"
                      className="flex-1 text-[12px] bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 py-0.5" />
                    {searching && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin shrink-0" />}
                    {searchQuery && !searching && (
                      <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowSearchDropdown(false); setSearchResult(null); if (searchSourceRef.current) searchSourceRef.current.clear(); }}
                        className="text-zinc-300 hover:text-zinc-600 shrink-0 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {/* 搜索结果下拉 - Linear 风: 极轻阴影 */}
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md z-50 max-h-60 overflow-y-auto"
                      style={{
                        border: "1px solid var(--color-muted)",
                        boxShadow: "var(--shadow-lg)",
                      }}
                    >
                      {searchResults.map((r, i) => (
                        <button key={i} onClick={() => selectSearchResult(r)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 transition-colors">
                          <p className="text-[12px] font-medium text-zinc-800">{r.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate font-mono">{r.address || r.district}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showSearchDropdown && !searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md z-50 p-3 text-center text-[11px] text-zinc-500"
                      style={{ border: "1px solid var(--color-muted)" }}
                    >
                      未找到匹配地点
                    </div>
                  )}
                </div>

        {/* 精简模式(车主): 只保留搜索, 隐藏图层管理/服务区/品牌/叠加/区域统计 */}
        {!compact && (
        <>
                {/* 图层管理 - 透明度滑块 + 拖拽排序 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-zinc-500">图层管理</p>
                    <span className="text-[9px] text-zinc-400">拖拽排序 · 滑块调透明度</span>
                  </div>
                  {layerOrder.map((id) => {
                    // 图层配置: 显示名 / 主色 / 图标 / 可见性 state+setter
                    const configMap: Record<string, { name: string; color: string; IconComp: any; visible: boolean; setVisible: (v: boolean) => void }> = {
                      stations: { name: "充电站", color: "#00C896", IconComp: Zap, visible: showStations, setVisible: (v: boolean) => setShowStations(v) },
                      communities: { name: "住宅小区", color: "#38BDF8", IconComp: Building2, visible: showCommunities, setVisible: (v: boolean) => setShowCommunities(v) },
                      feedback: { name: "公众反馈", color: "#F59E0B", IconComp: MessageSquare, visible: showFeedback, setVisible: (v: boolean) => setShowFeedback(v) },
                      measure: { name: "测量图层", color: "#00C896", IconComp: Square, visible: showMeasure, setVisible: (v: boolean) => setShowMeasure(v) },
                    };
                    const cfg = configMap[id];
                    if (!cfg) return null;
                    const LayerIcon = cfg.IconComp;
                    return (
                      <div
                        key={id}
                        draggable
                        onDragStart={() => { dragLayerIdRef.current = id; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={() => {
                          const dragId = dragLayerIdRef.current;
                          dragLayerIdRef.current = null;
                          if (!dragId || dragId === id) return;
                          // 重排 layerOrder: 将拖拽项移动到目标项之前
                          const newOrder = [...layerOrder];
                          const dragIdx = newOrder.indexOf(dragId);
                          const dropIdx = newOrder.indexOf(id);
                          newOrder.splice(dragIdx, 1);
                          newOrder.splice(dropIdx, 0, dragId);
                          setLayerOrder(newOrder);
                        }}
                        className="group flex items-center gap-1.5 px-1.5 py-1.5 rounded transition-colors hover:bg-zinc-50"
                        style={{ border: "1px solid var(--color-muted)", cursor: "grab", background: "var(--color-surface)" }}
                      >
                        {/* 拖拽手柄 */}
                        <GripVertical className="w-3 h-3 text-zinc-300 group-hover:text-zinc-500 shrink-0" />
                        {/* 可见性勾选框 */}
                        <input
                          type="checkbox"
                          checked={cfg.visible}
                          onChange={(e) => cfg.setVisible(e.target.checked)}
                          className="accent-emerald-500 w-3 h-3 shrink-0"
                        />
                        {/* 图层图标 */}
                        <LayerIcon className="w-3 h-3 shrink-0" style={{ color: cfg.color }} />
                        {/* 图层名 */}
                        <span className="text-[11px] text-zinc-700 flex-1 truncate">{cfg.name}</span>
                        {/* 透明度滑块 */}
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={layerOpacity[id] ?? 100}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setLayerOpacity(prev => ({ ...prev, [id]: v }));
                          }}
                          className="w-12 h-1 accent-emerald-500 shrink-0"
                          title={`透明度 ${layerOpacity[id] ?? 100}%`}
                        />
                        <span className="text-[9px] text-zinc-400 font-mono w-7 text-right shrink-0">
                          {layerOpacity[id] ?? 100}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 阶段五 等时圈: 服务区图层开关 (仅覆盖分析有结果时显示) */}
                {isochroneCoverage && isochroneCoverage.covered > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 mb-1.5">服务区图层</p>
                    <label
                      className="group flex items-center gap-2 px-1.5 py-1.5 rounded transition-colors hover:bg-zinc-50 cursor-pointer"
                      style={{ border: "1px solid var(--color-muted)", background: "var(--color-surface)" }}
                      title="勾选显示路网等时圈多边形 (紫色虚线), 取消勾选仅显示缓冲区, 便于对比"
                    >
                      <input
                        type="checkbox"
                        checked={showIsochroneLayer}
                        onChange={(e) => setShowIsochroneLayer(e.target.checked)}
                        className="accent-violet-500 w-3 h-3 shrink-0"
                      />
                      <Activity className="w-3 h-3 shrink-0" style={{ color: "#7c3aed" }} />
                      <span className="text-[11px] text-zinc-700 flex-1">等时圈服务区</span>
                      <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                        {isochroneCoverage.covered}/{isochroneCoverage.total}
                      </span>
                    </label>
                  </div>
                )}

                {/* 品牌图层 - Linear 风: 紧凑列表 */}
                <div className="space-y-0.5">
                  <p className="text-[10px] text-zinc-500 mb-1.5">品牌图层</p>
                  {availableBrands.map(brand => (
                    <label key={brand} className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-zinc-50 px-1.5 py-1 rounded transition-colors">
                      <input type="checkbox" checked={visibleBrands.has(brand)}
                        onChange={(e) => {
                          const next = new Set(visibleBrands);
                          e.target.checked ? next.add(brand) : next.delete(brand);
                          setVisibleBrands(next);
                        }}
                        className="accent-emerald-500 w-3 h-3" />
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND_CONFIG[brand].color }}></span>
                      <span className="text-zinc-700 flex-1 truncate">{BRAND_CONFIG[brand].label}</span>
                    </label>
                  ))}
                </div>

                {/* 小区 / 反馈图层 */}
                <div className="space-y-0.5">
                  <p className="text-[10px] text-zinc-500 mb-1.5">叠加图层</p>
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-zinc-50 px-1.5 py-1 rounded transition-colors">
                    <input type="checkbox" checked={showCommunities} onChange={(e) => setShowCommunities(e.target.checked)} className="accent-sky-500 w-3 h-3" />
                    <Building2 className="w-3 h-3 text-sky-500" />
                    <span className="text-zinc-700">住宅小区面</span>
                  </label>
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-zinc-50 px-1.5 py-1 rounded transition-colors">
                    <input type="checkbox" checked={showFeedback} onChange={(e) => setShowFeedback(e.target.checked)} className="accent-amber-500 w-3 h-3" />
                    <MessageSquare className="w-3 h-3 text-amber-500" />
                    <span className="text-zinc-700">公众反馈点</span>
                  </label>
                  {/* 阶段二 任务 2.1.2: 负荷热力图开关 */}
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-zinc-50 px-1.5 py-1 rounded transition-colors">
                    <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} className="accent-rose-500 w-3 h-3" />
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span className="text-zinc-700">负荷热力图</span>
                    {showHeatmap && (
                      <span className="text-[9px] text-zinc-400 ml-auto">{heatmapData.length} 站</span>
                    )}
                  </label>
                  {/* 阶段三 任务 3.3.1: 公众反馈热力图开关 + 类型/评分筛选 */}
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-zinc-50 px-1.5 py-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={showFeedbackHeatmap}
                      onChange={(e) => setShowFeedbackHeatmap(e.target.checked)}
                      className="accent-purple-500 w-3 h-3"
                    />
                    <Flame className="w-3 h-3 text-purple-500" />
                    <span className="text-zinc-700">反馈热力图</span>
                  </label>
                  {/* 反馈热力图筛选面板 (阶段三 任务 3.3.3) */}
                  {showFeedbackHeatmap && (
                    <div
                      className="ml-5 mr-1 mt-0.5 p-2 rounded space-y-1.5"
                      style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 w-8">类型</span>
                        <select
                          value={feedbackHeatmapType}
                          onChange={(e) => setFeedbackHeatmapType(e.target.value as any)}
                          className="flex-1 text-[10px] px-1 py-0.5 rounded input-sys"
                          style={{ background: "var(--color-surface)", color: "var(--color-ink-2)" }}
                        >
                          <option value="all">全部</option>
                          <option value="demand">需求</option>
                          <option value="evaluation">评价</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 w-8">评分</span>
                        <select
                          value={feedbackHeatmapRating}
                          onChange={(e) => setFeedbackHeatmapRating(parseInt(e.target.value))}
                          className="flex-1 text-[10px] px-1 py-0.5 rounded input-sys"
                          style={{ background: "var(--color-surface)", color: "var(--color-ink-2)" }}
                        >
                          <option value={0}>不限</option>
                          <option value={3}>≥ 3 星</option>
                          <option value={4}>≥ 4 星</option>
                          <option value={5}>5 星</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 区域统计 - Linear 风: 等宽数字 + 紧凑网格 */}
                <div className="pt-2.5" style={{ borderTop: "1px solid var(--color-muted)" }}>
                  <p className="text-[10px] text-zinc-500 mb-1.5">区域统计</p>
                  <div className="grid grid-cols-2 gap-1">
                    {regionStats.map(r => (
                      <div
                        key={r.district}
                        className="bg-zinc-50 rounded px-1.5 py-1"
                        style={{ border: "1px solid var(--color-muted)" }}
                      >
                        <p className="text-[10px] text-zinc-500 truncate">{r.district}</p>
                        <p className="text-[13px] font-bold text-zinc-900 font-num">
                          {r.stations || 0}
                          <span className="text-[9px] text-zinc-500 ml-0.5">站</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
        </>
        )}
              </div>
        </aside>
  );
}
