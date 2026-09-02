// SchemeDashboard.tsx
// 选址决策大屏 - 全屏覆盖 (与决策大屏平级, 金色决策主题)
// 数据: /api/v1/stats/scheme-dashboard
import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { X, RefreshCw, Loader2, Target, Trophy, Users, Gauge, Activity, BarChart3, Zap, MapPin } from "lucide-react";
import "ol/ol.css";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import GeoJSON from "ol/format/GeoJSON";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Point, Circle } from "ol/geom";
import { Style, Fill, Stroke, Circle as CircleStyle, Text as OlText } from "ol/style";
import DashboardStoryNav, {
  type DashboardJumpPayload, type DashboardTarget, type DashboardCandidateSpot,
} from "./DashboardStoryNav";

interface SchemeDashboardProps {
  open: boolean;
  onBack: () => void;
  onNavigate?: (t: DashboardTarget, payload?: DashboardJumpPayload) => void;
  jumpPayload?: DashboardJumpPayload | null;
}

export default function SchemeDashboard({ open, onBack, onNavigate, jumpPayload }: SchemeDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<OlMap | null>(null);
  const schemeLayerRef = useRef<VectorLayer | null>(null);
  const stationLayerRef = useRef<VectorLayer | null>(null);
  const circleLayerRef = useRef<VectorLayer | null>(null);
  const scoreChartRef = useRef<HTMLDivElement>(null);
  const scoreChartInstRef = useRef<echarts.ECharts | null>(null);
  const brandChartRef = useRef<HTMLDivElement>(null);
  const brandChartInstRef = useRef<echarts.ECharts | null>(null);
  const candidateLayerRef = useRef<VectorLayer | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("geoplan_token") || "";
      const res = await fetch("/api/v1/stats/scheme-dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (j.success) setData(j.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    loadData();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // 地图
  useEffect(() => {
    if (!open || !mapRef.current || mapInstanceRef.current) return;
    const map = new OlMap({
      target: mapRef.current,
      view: new View({ center: fromLonLat([117.2, 34.26]), zoom: 10.5 }),
      layers: [
        // 高德暗色底图 (深海军蓝滤镜呼应金色决策主题)
        new TileLayer({
          className: "basemap-tint-navy",
          source: new XYZ({ url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", crossOrigin: "anonymous" }),
        }),
      ],
      controls: [],
    });
    mapInstanceRef.current = map;
    return () => { map.setTarget(undefined); mapInstanceRef.current = null; candidateLayerRef.current = null; };
  }, [open]);

  // 方案点图层 (按评分大小/颜色)
  useEffect(() => {
    if (!open || !mapInstanceRef.current || !data) return;
    const map = mapInstanceRef.current;

    // 现有充电站背景点 (浅色小点)
    if (stationLayerRef.current) { map.removeLayer(stationLayerRef.current); stationLayerRef.current = null; }
    const allStations = data.allStations || [];
    if (allStations.length) {
      const src = new VectorSource({
        features: allStations.map((s: any) => new Feature({
          geometry: new Point(fromLonLat([s.lng, s.lat])),
          name: s.name,
        })),
      });
      const layer = new VectorLayer({
        source: src,
        style: new Style({
          image: new CircleStyle({ radius: 2.5, fill: new Fill({ color: "rgba(90,123,160,0.4)" }) }),
        }),
      });
      map.addLayer(layer);
      stationLayerRef.current = layer;
    }

    // 方案服务区圆 (radius 米, 3857 近似)
    if (circleLayerRef.current) { map.removeLayer(circleLayerRef.current); circleLayerRef.current = null; }
    const schemeFeatures = data.schemePositions?.features || [];
    if (schemeFeatures.length) {
      const circleSrc = new VectorSource({
        features: schemeFeatures.map((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          return new Feature({
            geometry: new Circle(fromLonLat([lng, lat]), Number(f.properties?.radius || 800)),
          });
        }),
      });
      const layer = new VectorLayer({
        source: circleSrc,
        style: new Style({
          fill: new Fill({ color: "rgba(63,169,140,0.14)" }),
          stroke: new Stroke({ color: "rgba(63,169,140,0.55)", width: 1 }),
        }),
      });
      map.addLayer(layer);
      circleLayerRef.current = layer;
    }

    // 方案点
    if (schemeLayerRef.current) { map.removeLayer(schemeLayerRef.current); schemeLayerRef.current = null; }
    const features = data.schemePositions?.features || [];
    if (!features.length) return;
    const src = new VectorSource({ features: new GeoJSON().readFeatures(data.schemePositions, { featureProjection: "EPSG:3857" }) });
    const layer = new VectorLayer({
      source: src,
      style: (f) => {
        const score = Number(f.get("score") || 0);
        const color = score >= 85 ? "#3FA98C" : score >= 70 ? "#D9A843" : "#E08D5A";
        return new Style({
          image: new CircleStyle({
            radius: 5 + Math.min(5, score / 20),
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#FFFFFF", width: 2 }),
          }),
          text: new OlText({
            text: f.get("name") ? String(f.get("name")).slice(0, 4) : "",
            font: "bold 9px sans-serif",
            fill: new Fill({ color: "#1B2A4A" }),
            stroke: new Stroke({ color: "#FFFFFF", width: 2.5 }),
            offsetY: -10,
          }),
        });
      },
    });
    map.addLayer(layer);
    schemeLayerRef.current = layer;

    // 深链: 来自盲区攻坚大屏的 Top3 盲区候选点 (橙色高亮)
    if (candidateLayerRef.current) { map.removeLayer(candidateLayerRef.current); candidateLayerRef.current = null; }
    const spots = jumpPayload?.candidateSpots || [];
    if (spots.length) {
      const candSrc = new VectorSource({
        features: spots.map((s: DashboardCandidateSpot) => new Feature({
          geometry: new Point(fromLonLat([s.lng, s.lat])),
          candName: s.name,
          candDistrict: s.district,
          candPop: s.population,
        })),
      });
      const candLayer = new VectorLayer({
        source: candSrc,
        style: (f) => new Style({
          image: new CircleStyle({
            radius: 10,
            fill: new Fill({ color: "rgba(224,141,90,0.3)" }),
            stroke: new Stroke({ color: "#E08D5A", width: 2.5 }),
          }),
          text: new OlText({
            text: `候选 · ${String(f.get("candName")).slice(0, 8)}`,
            font: "bold 10px sans-serif",
            fill: new Fill({ color: "#B8632F" }),
            stroke: new Stroke({ color: "#FFFFFF", width: 3 }),
            offsetY: -18,
          }),
        }),
      });
      map.addLayer(candLayer);
      candidateLayerRef.current = candLayer;
    }
  }, [open, data, jumpPayload]);

  // 评分分布柱图
  useEffect(() => {
    if (!open || !data || !scoreChartRef.current) return;
    if (scoreChartInstRef.current) scoreChartInstRef.current.dispose();
    const chart = echarts.init(scoreChartRef.current);
    const bins = data.scoreBins || [];
    chart.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 32, right: 10, top: 14, bottom: 24 },
      xAxis: { type: "category", data: bins.map((b: any) => b.label), axisLabel: { color: "#5A7BA0", fontSize: 9 }, axisLine: { lineStyle: { color: "rgba(27,42,74,0.15)" } } },
      yAxis: { type: "value", minInterval: 1, axisLabel: { color: "#5A7BA0", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(27,42,74,0.08)" } } },
      series: [{ type: "bar", data: bins.map((b: any) => b.count), barWidth: "50%", itemStyle: { color: "#D9A843", borderRadius: [3, 3, 0, 0] } }],
    });
    scoreChartInstRef.current = chart;
  }, [open, data]);

  // 品牌方案分布环图
  useEffect(() => {
    if (!open || !data || !brandChartRef.current) return;
    if (brandChartInstRef.current) brandChartInstRef.current.dispose();
    const chart = echarts.init(brandChartRef.current);
    const dist = data.brandSchemeDist || [];
    chart.setOption({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { orient: "vertical", right: 2, top: "middle", itemWidth: 8, itemHeight: 8, itemGap: 6, textStyle: { color: "#5A7BA0", fontSize: 9 } },
      series: [{
        type: "pie", radius: ["38%", "56%"], center: ["36%", "50%"],
        label: { show: false }, labelLine: { show: false },
        data: dist.map((d: any) => ({ name: d.name, value: d.value, itemStyle: { color: ["#3FA98C", "#D9A843", "#6B9AC4", "#9B8AC4", "#E08D5A"][dist.indexOf(d) % 5] } })),
      }],
    });
    brandChartInstRef.current = chart;
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    return () => {
      scoreChartInstRef.current?.dispose(); scoreChartInstRef.current = null;
      brandChartInstRef.current?.dispose(); brandChartInstRef.current = null;
    };
  }, [open]);

  if (!open) return null;
  const kpi = data?.kpi || {};
  const schemeRank = data?.schemeRank || [];

  const kpiCards = [
    { label: "已保存方案", value: kpi.totalSchemes ?? 0, unit: "个", icon: Target, color: "#D9A843" },
    { label: "方案平均分", value: kpi.avgScore ?? 0, unit: "分", icon: Gauge, color: "#3FA98C" },
    { label: "最高分方案", value: kpi.maxScore ?? 0, unit: "分", icon: Trophy, color: "#6B9AC4" },
    { label: "覆盖总人口", value: kpi.totalCoveredPop ?? 0, unit: "人", icon: Users, color: "#9B8AC4" },
    { label: "平均覆盖人口", value: kpi.avgCoveredPop ?? 0, unit: "人/方案", icon: Users, color: "#D98BA8" },
    { label: "盲区消除均值", value: kpi.avgBlindReduction ?? 0, unit: "%", icon: Activity, color: "#E08D5A" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: "linear-gradient(160deg, #EAF2F8 0%, #E0ECF5 50%, #D6E6F8 100%)", color: "#1B2A4A", fontFamily: "var(--font-sans)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(90,123,160,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <header className="shrink-0 flex items-center justify-between px-6 relative" style={{ height: 64, background: "linear-gradient(165deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.42) 100%)", backdropFilter: "blur(20px) saturate(1.6) brightness(1.03)", WebkitBackdropFilter: "blur(20px) saturate(1.6) brightness(1.03)", borderBottom: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 4px 24px -12px rgba(27,42,74,0.12)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EAF2F8 0%, #D6E6F2 100%)", border: "1px solid rgba(90,123,160,0.35)" }}>
            <Zap className="w-5 h-5" style={{ color: "#1B2A4A" }} fill="#1B2A4A" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-wide" style={{ color: "#1B2A4A" }}>徐州新能源充电选址决策大屏</h1>
            <p className="text-[10.5px] tracking-wider" style={{ color: "#7A8A9A" }}>SITE SELECTION DECISION DASHBOARD · XUZHOU</p>
          </div>
        </div>

        {onNavigate && <DashboardStoryNav current="scheme" onNavigate={onNavigate} />}

        <div className="flex items-center gap-4 text-[11.5px]">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" style={{ color: "#D9A843" }} />
            <span className="font-num" style={{ color: "#5A7BA0" }}>{now.toLocaleString("zh-CN", { hour12: false })}</span>
          </div>
          <span style={{ color: "rgba(90,123,160,0.35)" }}>|</span>
          <span style={{ color: "#7A8A9A" }}>数据更新: <span className="font-num" style={{ color: "#B8862F" }}>{data?.updateTime || "加载中..."}</span></span>
          <button onClick={loadData} className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.6)" }} title="刷新数据">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#D9A843" }} /> : <RefreshCw className="w-3.5 h-3.5" style={{ color: "#5A7BA0" }} />}
          </button>
          <button onClick={onBack} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.65)", color: "#1B2A4A" }}>
            <X className="w-3.5 h-3.5" /> 返回
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-3 p-3 min-h-0 relative">
        {/* 左侧 KPI */}
        <aside className="w-[220px] shrink-0 flex flex-col gap-3">
          {kpiCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="rounded-xl p-3.5 flex-1 flex flex-col justify-between relative overflow-hidden dash-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "#7A8A9A" }}>{card.label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${card.color}35` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[30px] font-bold font-num leading-none" style={{ color: card.color }}>{card.value.toLocaleString()}</span>
                  <span className="text-[11px]" style={{ color: "#A8B4C4" }}>{card.unit}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl" style={{ background: `linear-gradient(90deg, transparent, ${card.color}40, transparent)` }} />
              </div>
            );
          })}
          {/* 盲区候选点 (深链来自攻坚大屏) */}
          {(jumpPayload?.candidateSpots?.length || 0) > 0 && (
            <div className="rounded-xl p-3 dash-card" style={{ border: "1px solid rgba(224,141,90,0.3)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3 h-3" style={{ color: "#E08D5A" }} />
                <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>盲区候选点 · Top3</h3>
              </div>
              <div className="space-y-1.5">
                {jumpPayload!.candidateSpots!.map((s: DashboardCandidateSpot, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(224,141,90,0.2)" }}>
                    <span className="w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold" style={{ background: "rgba(224,141,90,0.2)", color: "#B8632F" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate" style={{ color: "#1B2A4A" }}>{s.name}</p>
                      <p className="text-[9px]" style={{ color: "#A8B4C4" }}>{s.district || ""} · 影响人口 {(s.population || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9.5px] mt-2" style={{ color: "#A8B4C4" }}>来自盲区攻坚大屏 · 按人口排序的覆盖缺口</p>
            </div>
          )}
          <div className="rounded-xl p-3 dash-card">
            <p className="text-[10px] leading-relaxed" style={{ color: "#5A7BA0" }}>
              <span style={{ color: "#B8862F" }}>决策逻辑：</span>地图点按综合评分着色（绿≥85 / 黄70-84 / 橙&lt;70），点击右侧排行可定位。评分=人口收益+社会效益+竞争避让+盲区消除。
            </p>
          </div>
        </aside>

        {/* 中央地图 */}
        <main className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 rounded-xl overflow-hidden relative dash-card">
            <div ref={mapRef} className="w-full h-full" />
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
              <Target className="w-3 h-3" style={{ color: "#D9A843" }} />
              <span className="text-[11px]" style={{ color: "#1B2A4A" }}>选址方案分布（按评分着色）</span>
            </div>
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
              <span className="flex items-center gap-1" style={{ color: "#5A7BA0" }}><span className="w-2 h-2 rounded-full" style={{ background: "#3FA98C" }} />≥85 优</span>
              <span className="flex items-center gap-1" style={{ color: "#5A7BA0" }}><span className="w-2 h-2 rounded-full" style={{ background: "#D9A843" }} />70-84 良</span>
              <span className="flex items-center gap-1" style={{ color: "#5A7BA0" }}><span className="w-2 h-2 rounded-full" style={{ background: "#E08D5A" }} />&lt;70 待优化</span>
              {(jumpPayload?.candidateSpots?.length || 0) > 0 && (
                <span className="flex items-center gap-1" style={{ color: "#D97F4A" }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(224,141,90,0.35)", border: "1.5px solid #E08D5A" }} />盲区候选</span>
              )}
            </div>
          </div>

          {/* ===== 底部动态条: 最近方案/反馈 ===== */}
          <div className="shrink-0 rounded-xl overflow-hidden dash-card" style={{ height: 44 }}>
            <div className="flex items-center h-full">
              <div className="shrink-0 px-3 h-full flex items-center gap-1.5 text-[11px] font-medium" style={{ background: "rgba(217,168,67,0.12)", borderRight: "1px solid rgba(255,255,255,0.65)", color: "#B8862F" }}>
                <Activity className="w-3 h-3" />
                实时动态
              </div>
              <div className="flex-1 overflow-hidden relative">
                {(data?.ticker || []).length > 0 ? (
                  <div className="flex items-center whitespace-nowrap animate-marquee" style={{ animationDuration: `${Math.max(18, (data.ticker || []).length * 3.5)}s` }}>
                    {[...(data.ticker || []), ...(data.ticker || [])].map((item: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-2 px-6 text-[11.5px]" style={{ color: "#5A7BA0" }}>
                        <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: item.type === "方案" ? "rgba(63,169,140,0.14)" : item.type === "评价" ? "rgba(155,138,196,0.14)" : "rgba(217,168,67,0.14)", color: item.type === "方案" ? "#2E8B74" : item.type === "评价" ? "#8478B5" : "#B8862F" }}>
                          {item.type}
                        </span>
                        <span style={{ color: "#5A7BA0" }}>{item.content}</span>
                        <span className="text-[10px]" style={{ color: "#A8B4C4" }}>— {item.submitter} · {item.time}</span>
                        <span className="mx-2" style={{ color: "rgba(90,123,160,0.4)" }}>◆</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center h-full px-6 text-[11px]" style={{ color: "#A8B4C4" }}>暂无动态</div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* 右侧图表列 */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-3">
          {/* 方案评分排行 */}
          <div className="rounded-xl p-3 flex-1 flex flex-col min-h-0 dash-card" style={{ height: 230 }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="w-3 h-3" style={{ color: "#D9A843" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>方案评分排行</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {schemeRank.length === 0 ? (
                <p className="text-[10.5px] text-center py-4" style={{ color: "#A8B4C4" }}>暂无已保存方案</p>
              ) : schemeRank.slice(0, 8).map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(63,169,140,0.18)" }}>
                  <span className="w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold" style={{ background: i < 3 ? "rgba(217,168,67,0.22)" : "rgba(90,123,160,0.12)", color: i < 3 ? "#B8862F" : "#7A8A9A" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate" style={{ color: "#1B2A4A" }}>{s.name} <span style={{ color: "#A8B4C4" }}>· {s.brand}</span></p>
                    <p className="text-[9px]" style={{ color: "#A8B4C4" }}>覆盖 {s.coveredPopulation.toLocaleString()} 人 · {s.coveredCommunities} 社区 · 盲区消除 {s.blindReduction}%</p>
                  </div>
                  <span className="text-[13px] font-bold font-num" style={{ color: s.score >= 85 ? "#3FA98C" : s.score >= 70 ? "#D9A843" : "#E08D5A" }}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 评分分布 */}
          <div className="rounded-xl p-3 flex flex-col dash-card" style={{ height: 170 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3" style={{ color: "#D9A843" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>方案评分分布</h3>
            </div>
            <div ref={scoreChartRef} className="flex-1" />
          </div>

          {/* 品牌方案分布 */}
          <div className="rounded-xl p-3 flex flex-col dash-card" style={{ height: 170 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3" style={{ color: "#3FA98C" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>各品牌方案数</h3>
            </div>
            <div ref={brandChartRef} className="flex-1" />
          </div>
        </aside>
      </div>
    </div>
  );
}
