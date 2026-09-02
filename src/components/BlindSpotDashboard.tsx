// BlindSpotDashboard.tsx
// 盲区攻坚大屏 - 全屏覆盖 (与决策大屏平级, 红色攻坚主题)
// 数据: /api/v1/stats/blindspot-dashboard
import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { X, RefreshCw, Loader2, AlertTriangle, Users, Percent, Activity, Trophy, MapPin, Target } from "lucide-react";
import "ol/ol.css";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { Style, Fill, Stroke, Circle as CircleStyle, Text as OlText } from "ol/style";
import DashboardStoryNav, {
  type DashboardJumpPayload, type DashboardTarget, type DashboardCandidateSpot, geometryBboxCenter,
} from "./DashboardStoryNav";
import { readFeaturesFromWGS84 } from "../lib/geojsonProjection";
import { wgs84ToGcj02 } from "../lib/coordinate";
import { XUZHOU_CENTER } from "../config/map";

interface BlindSpotDashboardProps {
  open: boolean;
  onBack: () => void;
  onNavigate?: (t: DashboardTarget, payload?: DashboardJumpPayload) => void;
  jumpPayload?: DashboardJumpPayload | null;
}

export default function BlindSpotDashboard({ open, onBack, onNavigate, jumpPayload }: BlindSpotDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  // 深链提示条可见性 (payload 变化时重置)
  const [showJumpTip, setShowJumpTip] = useState(true);
  useEffect(() => { setShowJumpTip(true); }, [jumpPayload]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<OlMap | null>(null);
  const blindLayerRef = useRef<VectorLayer | null>(null);
  const stationLayerRef = useRef<VectorLayer | null>(null);
  const districtChartRef = useRef<HTMLDivElement>(null);
  const districtChartInstRef = useRef<echarts.ECharts | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/stats/blindspot-dashboard");
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

  // ===== 地图初始化 (高德底图) =====
  useEffect(() => {
    if (!open || !mapRef.current || mapInstanceRef.current) return;
    const map = new OlMap({
      target: mapRef.current,
      // 与决策大屏初始视图保持一致 (XUZHOU_CENTER 为 WGS84, 转 GCJ02 与高德底图对齐)
      view: new View({ center: fromLonLat(wgs84ToGcj02(XUZHOU_CENTER[0], XUZHOU_CENTER[1])), zoom: 11 }),
      layers: [
        // 高德纯白底图 (标准瓦片 + CSS 滤镜处理成简约白)
        new TileLayer({
          className: "basemap-pure-white",
          source: new XYZ({ url: "https://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", crossOrigin: "anonymous" }),
        }),
      ],
      controls: [],
    });
    mapInstanceRef.current = map;
    // 等布局完成后校正尺寸, 防止容器未撑开时初始化为 0 尺寸
    requestAnimationFrame(() => mapInstanceRef.current?.updateSize());
    return () => { map.setTarget(undefined); mapInstanceRef.current = null; };
  }, [open]);

  // ===== 盲区红面 + 站点图层 =====
  useEffect(() => {
    if (!open || !mapInstanceRef.current || !data) return;
    const map = mapInstanceRef.current;
    // 盲区面 (小区边界为 WGS84, 需转 GCJ02 与高德底图对齐; 站点为高德POI GCJ02 无需转换)
    if (blindLayerRef.current) { map.removeLayer(blindLayerRef.current); blindLayerRef.current = null; }
    if (data.blindAreas?.features?.length) {
      const src = new VectorSource({ features: readFeaturesFromWGS84(data.blindAreas) });
      const layer = new VectorLayer({
        source: src,
        style: (f) => new Style({
          fill: new Fill({ color: "rgba(235,130,130,0.4)" }),
          stroke: new Stroke({ color: "rgba(214,104,104,0.8)", width: 1.2 }),
          text: new OlText({
            text: f.get("name") || "",
            font: "bold 10px sans-serif",
            fill: new Fill({ color: "#A63D3D" }),
            stroke: new Stroke({ color: "#FFFFFF", width: 2.5 }),
            offsetY: -4,
          }),
        }),
      });
      map.addLayer(layer);
      blindLayerRef.current = layer;
    }
    // 站点点
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
          image: new CircleStyle({ radius: 3, fill: new Fill({ color: "#3FA98C" }), stroke: new Stroke({ color: "#FFFFFF", width: 1 }) }),
        }),
      });
      map.addLayer(layer);
      stationLayerRef.current = layer;
    }
  }, [open, data]);

  // ===== 各区盲区分布柱图 =====
  useEffect(() => {
    if (!open || !data || !districtChartRef.current) return;
    if (districtChartInstRef.current) districtChartInstRef.current.dispose();
    const chart = echarts.init(districtChartRef.current);
    const list = data.districtBlindList || [];
    chart.setOption({
      tooltip: { trigger: "axis", formatter: (p: any) => {
        const i = p[0]?.dataIndex;
        const item = list[i];
        return item ? `${item.district}<br/>盲区 ${item.blind} 个 · 影响 ${item.blindPop.toLocaleString()} 人<br/>盲区率 ${item.rate}%` : "";
      } },
      grid: { left: 42, right: 12, top: 14, bottom: 26 },
      xAxis: { type: "category", data: list.map(d => d.district), axisLabel: { color: "#5A7BA0", fontSize: 9, rotate: 24 }, axisLine: { lineStyle: { color: "rgba(27,42,74,0.15)" } } },
      yAxis: { type: "value", axisLabel: { color: "#5A7BA0", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(27,42,74,0.08)" } } },
      series: [
        { name: "盲区社区", type: "bar", data: list.map(d => d.blind), barWidth: "40%", itemStyle: { color: "#E08D5A", borderRadius: [3, 3, 0, 0] } },
        { name: "盲区人口(百人)", type: "bar", data: list.map(d => Math.round(d.blindPop / 100)), barWidth: "40%", itemStyle: { color: "#6B9AC4", borderRadius: [3, 3, 0, 0] } },
      ],
    });
    districtChartInstRef.current = chart;
    const onResize = () => districtChartInstRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    return () => { districtChartInstRef.current?.dispose(); districtChartInstRef.current = null; };
  }, [open]);

  if (!open) return null;
  const kpi = data?.kpi || {};
  const topBlindSpots = data?.topBlindSpots || [];

  // 深链跳转: 携带 Top3 盲区质心作为候选点进入选址决策大屏
  const gotoScheme = () => {
    if (!onNavigate) return;
    const areaById = new Map<string, any>();
    (data?.blindAreas?.features || []).forEach((f: any) => areaById.set(String(f.properties?.id), f));
    const candidateSpots: DashboardCandidateSpot[] = topBlindSpots.slice(0, 3)
      .map((c: any) => {
        const f = areaById.get(String(c.id));
        const center = f ? geometryBboxCenter(f.geometry) : null;
        return center ? { id: c.id, name: c.name, district: c.district, population: c.population, lng: center[0], lat: center[1] } : null;
      })
      .filter((x): x is DashboardCandidateSpot => !!x);
    onNavigate("scheme", { from: "blindspot", candidateSpots });
  };

  const kpiCards = [
    { label: "盲区社区数", value: kpi.blindSpotCommunities ?? 0, unit: "个", icon: AlertTriangle, color: "#E08D5A" },
    { label: "盲区影响人口", value: kpi.blindPopulation ?? 0, unit: "人", icon: Users, color: "#D97878" },
    { label: "社区覆盖率", value: kpi.coverageRate ?? 0, unit: "%", icon: Percent, color: "#3FA98C" },
    { label: "盲区人口占比", value: kpi.blindPopRate ?? 0, unit: "%", icon: Activity, color: "#6B9AC4" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: "linear-gradient(160deg, #EAF2F8 0%, #E0ECF5 50%, #D6E6F8 100%)", color: "#1B2A4A", fontFamily: "var(--font-sans)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(90,123,160,0.07) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* ===== 顶部标题栏 — 淡色液态玻璃 ===== */}
      <header className="shrink-0 flex items-center justify-between px-6 relative" style={{ height: 64, background: "linear-gradient(165deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.42) 100%)", backdropFilter: "blur(20px) saturate(1.6) brightness(1.03)", WebkitBackdropFilter: "blur(20px) saturate(1.6) brightness(1.03)", borderBottom: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 4px 24px -12px rgba(27,42,74,0.12)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(224,141,90,0.14)", border: "1px solid rgba(224,141,90,0.3)" }}>
            <Target className="w-5 h-5" style={{ color: "#D97F4A" }} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-wide" style={{ color: "#1B2A4A" }}>徐州新能源充电盲区攻坚大屏</h1>
            <p className="text-[10.5px] tracking-wider" style={{ color: "#7A8A9A" }}>BLIND SPOT ASSAULT DASHBOARD · XUZHOU</p>
          </div>
        </div>

        {onNavigate && <DashboardStoryNav current="blindspot" onNavigate={onNavigate} />}

        <div className="flex items-center gap-4 text-[11.5px]">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" style={{ color: "#E08D5A" }} />
            <span className="font-num" style={{ color: "#5A7BA0" }}>{now.toLocaleString("zh-CN", { hour12: false })}</span>
          </div>
          <span style={{ color: "rgba(90,123,160,0.35)" }}>|</span>
          <span style={{ color: "#7A8A9A" }}>数据更新: <span className="font-num" style={{ color: "#D97F4A" }}>{data?.updateTime || "加载中..."}</span></span>
          <button onClick={loadData} className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.6)" }} title="刷新数据">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#E08D5A" }} /> : <RefreshCw className="w-3.5 h-3.5" style={{ color: "#5A7BA0" }} />}
          </button>
          <button onClick={onBack} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.65)", color: "#1B2A4A" }}>
            <X className="w-3.5 h-3.5" /> 返回
          </button>
        </div>
      </header>

      {/* ===== 主体三列 ===== */}
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
          {/* 攻坚说明卡 → 点击携带 Top3 候选点进入选址决策大屏 */}
          <div
            onClick={onNavigate ? gotoScheme : undefined}
            className={`rounded-xl p-3 dash-card ${onNavigate ? "cursor-pointer transition-transform hover:scale-[1.02]" : ""}`}
            style={{ border: "1px solid rgba(224,141,90,0.3)" }}
          >
            <p className="text-[10px] leading-relaxed" style={{ color: "#5A7BA0" }}>
              <span style={{ color: "#D97F4A" }}>攻坚目标：</span>优先在高影响人口盲区布设充电站。图中红色面为覆盖缺口社区，绿色点为现有充电站。
            </p>
            {onNavigate && (
              <div className="mt-2 pt-2 flex items-center justify-end gap-1 text-[11px] font-medium" style={{ borderTop: "1px dashed rgba(224,141,90,0.35)", color: "#B8862F" }}>
                基于盲区生成选址建议 · 进入行动大屏 <span>→</span>
              </div>
            )}
          </div>
        </aside>

        {/* 中央地图 */}
        <main className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 rounded-xl overflow-hidden relative dash-card">
            <div ref={mapRef} className="w-full h-full" />
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
              <Target className="w-3 h-3" style={{ color: "#E08D5A" }} />
              <span className="text-[11px]" style={{ color: "#1B2A4A" }}>盲区分布（红面）+ 充电站（绿点）</span>
            </div>
            {/* 深链提示条: 来自决策大屏的跳转上下文 */}
            {jumpPayload?.from === "main" && showJumpTip && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px]" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(224,141,90,0.4)" }}>
                <Activity className="w-3 h-3" style={{ color: "#E08D5A" }} />
                <span style={{ color: "#D97F4A" }}>决策大屏跳转</span>
                <span style={{ color: "rgba(90,123,160,0.4)" }}>|</span>
                <span style={{ color: "#5A7BA0" }}>盲区社区 <span className="font-num font-bold" style={{ color: "#D97F4A" }}>{jumpPayload.blindSpotCount ?? kpi.blindSpotCommunities ?? 0}</span> 个</span>
                <button onClick={() => setShowJumpTip(false)} className="ml-1 w-5 h-5 rounded flex items-center justify-center transition-colors" style={{ color: "#7A8A9A" }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
              <span className="flex items-center gap-1" style={{ color: "#5A7BA0" }}><span className="w-3 h-3 rounded-sm" style={{ background: "rgba(235,130,130,0.55)" }} />盲区社区</span>
              <span className="flex items-center gap-1" style={{ color: "#5A7BA0" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3FA98C" }} />充电站</span>
            </div>
          </div>
        </main>

        {/* 右侧图表列 */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-3">
          {/* 各区盲区分布 */}
          <div className="rounded-xl p-3 flex flex-col dash-card" style={{ height: 210 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3 h-3" style={{ color: "#E08D5A" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>各区盲区分布</h3>
            </div>
            <div ref={districtChartRef} className="flex-1" />
          </div>

          {/* Top10 盲区社区 */}
          <div className="rounded-xl p-3 flex-1 flex flex-col min-h-0 dash-card">
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3 h-3" style={{ color: "#D97878" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>Top10 盲区社区（按人口）</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {topBlindSpots.length === 0 ? (
                <p className="text-[10.5px] text-center py-4" style={{ color: "#A8B4C4" }}>暂无盲区数据</p>
              ) : topBlindSpots.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(224,141,90,0.18)" }}>
                  <span className="w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold" style={{ background: i < 3 ? "rgba(217,168,67,0.22)" : "rgba(90,123,160,0.12)", color: i < 3 ? "#B8862F" : "#7A8A9A" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate" style={{ color: "#1B2A4A" }}>{c.name}</p>
                    <p className="text-[9px]" style={{ color: "#A8B4C4" }}>{c.district} · 距最近站 {c.nearestDistance}km</p>
                  </div>
                  <span className="text-[11px] font-num" style={{ color: "#D97F4A" }}>{c.population.toLocaleString()}</span>
                  <span className="text-[9px]" style={{ color: "#A8B4C4" }}>人</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
