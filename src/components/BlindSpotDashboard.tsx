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
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat } from "ol/proj";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { Style, Fill, Stroke, Circle as CircleStyle, Text as OlText } from "ol/style";

interface BlindSpotDashboardProps {
  open: boolean;
  onBack: () => void;
}

export default function BlindSpotDashboard({ open, onBack }: BlindSpotDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
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
      view: new View({ center: fromLonLat([117.2, 34.26]), zoom: 10.5 }),
      layers: [
        new TileLayer({
          source: new XYZ({ url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", crossOrigin: "anonymous" }),
        }),
      ],
      controls: [],
    });
    mapInstanceRef.current = map;
    return () => { map.setTarget(undefined); mapInstanceRef.current = null; };
  }, [open]);

  // ===== 盲区红面 + 站点图层 =====
  useEffect(() => {
    if (!open || !mapInstanceRef.current || !data) return;
    const map = mapInstanceRef.current;
    // 盲区面
    if (blindLayerRef.current) { map.removeLayer(blindLayerRef.current); blindLayerRef.current = null; }
    if (data.blindAreas?.features?.length) {
      const src = new VectorSource({ features: new GeoJSON().readFeatures(data.blindAreas, { featureProjection: "EPSG:3857" }) });
      const layer = new VectorLayer({
        source: src,
        style: (f) => new Style({
          fill: new Fill({ color: "rgba(255,77,77,0.5)" }),
          stroke: new Stroke({ color: "rgba(255,77,77,0.85)", width: 1.2 }),
          text: new OlText({
            text: f.get("name") || "",
            font: "10px sans-serif",
            fill: new Fill({ color: "#FFD0D0" }),
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
          image: new CircleStyle({ radius: 3, fill: new Fill({ color: "#00C896" }), stroke: new Stroke({ color: "#0A0A0F", width: 1 }) }),
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
      xAxis: { type: "category", data: list.map(d => d.district), axisLabel: { color: "#A1A1AA", fontSize: 9, rotate: 24 }, axisLine: { lineStyle: { color: "#3F3F46" } } },
      yAxis: { type: "value", axisLabel: { color: "#A1A1AA", fontSize: 9 }, splitLine: { lineStyle: { color: "#27272A" } } },
      series: [
        { name: "盲区社区", type: "bar", data: list.map(d => d.blind), barWidth: "40%", itemStyle: { color: "#FF6B35", borderRadius: [3, 3, 0, 0] } },
        { name: "盲区人口(百人)", type: "bar", data: list.map(d => Math.round(d.blindPop / 100)), barWidth: "40%", itemStyle: { color: "#38BDF8", borderRadius: [3, 3, 0, 0] } },
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

  const kpiCards = [
    { label: "盲区社区数", value: kpi.blindSpotCommunities ?? 0, unit: "个", icon: AlertTriangle, color: "#FF6B35" },
    { label: "盲区影响人口", value: kpi.blindPopulation ?? 0, unit: "人", icon: Users, color: "#FF4D4D" },
    { label: "社区覆盖率", value: kpi.coverageRate ?? 0, unit: "%", icon: Percent, color: "#00C896" },
    { label: "盲区人口占比", value: kpi.blindPopRate ?? 0, unit: "%", icon: Activity, color: "#38BDF8" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: "#0A0A0F", color: "#E4E4E7", fontFamily: "var(--font-sans)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* ===== 顶部标题栏 ===== */}
      <header className="shrink-0 flex items-center justify-between px-6 relative" style={{ height: 64, background: "rgba(24,24,27,0.7)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,107,53,0.12)", border: "1px solid rgba(255,107,53,0.25)" }}>
            <Target className="w-5 h-5" style={{ color: "#FF6B35" }} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-wide" style={{ color: "#FAFAFA" }}>徐州新能源充电盲区攻坚大屏</h1>
            <p className="text-[10.5px] text-zinc-500 tracking-wider">BLIND SPOT ASSAULT DASHBOARD · XUZHOU</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11.5px]">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span className="text-zinc-300 font-num">{now.toLocaleString("zh-CN", { hour12: false })}</span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">数据更新: <span className="text-orange-300 font-num">{data?.updateTime || "加载中..."}</span></span>
          <button onClick={loadData} className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" title="刷新数据">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" /> : <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
          <button onClick={onBack} className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#D4D4D8" }}>
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
              <div key={i} className="rounded-xl p-3.5 flex-1 flex flex-col justify-between relative overflow-hidden bento-tile" style={{ background: "rgba(24,24,27,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">{card.label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}15`, border: `1px solid ${card.color}25` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[30px] font-bold font-num leading-none" style={{ color: card.color }}>{card.value.toLocaleString()}</span>
                  <span className="text-[11px] text-zinc-600">{card.unit}</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl" style={{ background: `linear-gradient(90deg, transparent, ${card.color}40, transparent)` }} />
              </div>
            );
          })}
          {/* 攻坚说明卡 */}
          <div className="rounded-xl p-3 bento-tile" style={{ background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.12)" }}>
            <p className="text-[10px] leading-relaxed" style={{ color: "#A1A1AA" }}>
              <span style={{ color: "#FF6B35" }}>攻坚目标：</span>优先在高影响人口盲区布设充电站。图中红色面为覆盖缺口社区，绿色点为现有充电站。
            </p>
          </div>
        </aside>

        {/* 中央地图 */}
        <main className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 rounded-xl overflow-hidden relative bento-tile" style={{ background: "rgba(9,9,11,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div ref={mapRef} className="w-full h-full" />
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(9,9,11,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Target className="w-3 h-3 text-orange-400" />
              <span className="text-[11px] text-orange-300">盲区分布（红面）+ 充电站（绿点）</span>
            </div>
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(9,9,11,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="flex items-center gap-1 text-zinc-400"><span className="w-3 h-3 rounded-sm" style={{ background: "rgba(255,77,77,0.5)" }} />盲区社区</span>
              <span className="flex items-center gap-1 text-zinc-400"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00C896" }} />充电站</span>
            </div>
          </div>
        </main>

        {/* 右侧图表列 */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-3">
          {/* 各区盲区分布 */}
          <div className="rounded-xl p-3 flex flex-col bento-tile" style={{ background: "rgba(24,24,27,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)", height: 210 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3 h-3" style={{ color: "#FF6B35" }} />
              <h3 className="text-[11.5px] font-medium text-zinc-300">各区盲区分布</h3>
            </div>
            <div ref={districtChartRef} className="flex-1" />
          </div>

          {/* Top10 盲区社区 */}
          <div className="rounded-xl p-3 flex-1 flex flex-col min-h-0 bento-tile" style={{ background: "rgba(24,24,27,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3 h-3" style={{ color: "#FF4D4D" }} />
              <h3 className="text-[11.5px] font-medium text-zinc-300">Top10 盲区社区（按人口）</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {topBlindSpots.length === 0 ? (
                <p className="text-[10.5px] text-zinc-600 text-center py-4">暂无盲区数据</p>
              ) : topBlindSpots.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.08)" }}>
                  <span className="w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold" style={{ background: i < 3 ? "rgba(255,212,96,0.2)" : "rgba(63,63,70,0.5)", color: i < 3 ? "#FFD460" : "#71717A" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-zinc-300 truncate">{c.name}</p>
                    <p className="text-[9px] text-zinc-600">{c.district} · 距最近站 {c.nearestDistance}km</p>
                  </div>
                  <span className="text-[11px] font-num text-orange-300">{c.population.toLocaleString()}</span>
                  <span className="text-[9px] text-zinc-600">人</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
