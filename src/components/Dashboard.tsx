// =========================================================================
// 决策大屏 (阶段三 任务 3.1)
// 独立全屏深色科技风布局: KPI 卡片 + 中央地图 + ECharts 图表 + 滚动条
// 由 App.tsx 通过 showDashboard state 全屏渲染, 提供"返回主界面"按钮
// =========================================================================
import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Circle as CircleStyle, Fill, Stroke } from "ol/style";
import { fromLonLat } from "ol/proj";
import * as echarts from "echarts";
import {
  X, Zap, BatteryCharging, Percent, AlertTriangle, MessageSquarePlus,
  TrendingUp, BarChart3, Activity, Trophy, RefreshCw, Loader2,
} from "lucide-react";
import { XUZHOU_CENTER } from "../config/map";
import { BRAND_CONFIG } from "../types";
import DashboardStoryNav, { type DashboardJumpPayload, type DashboardTarget } from "./DashboardStoryNav";

interface DashboardProps {
  open: boolean;
  onBack: () => void;
  onNavigate?: (t: DashboardTarget, payload?: DashboardJumpPayload) => void;
}

export default function Dashboard({ open, onBack, onNavigate }: DashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  // 地图与图表引用
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<OlMap | null>(null);
  const stationLayerRef = useRef<VectorLayer | null>(null);
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);

  const brandChartRef = useRef<HTMLDivElement>(null);
  const districtChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const brandChartInstRef = useRef<echarts.ECharts | null>(null);
  const districtChartInstRef = useRef<echarts.ECharts | null>(null);
  const trendChartInstRef = useRef<echarts.ECharts | null>(null);

  // ===== 实时时间 (每秒更新) =====
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  // ===== 数据拉取 =====
  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/stats/dashboard")
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    loadData();
    // 每 60 秒刷新一次数据
    const timer = setInterval(loadData, 60000);
    return () => clearInterval(timer);
  }, [open]);

  // ===== 中央地图初始化 =====
  useEffect(() => {
    if (!open || !mapRef.current || mapInstanceRef.current) return;
    const map = new OlMap({
      target: mapRef.current,
      view: new View({
        center: fromLonLat(XUZHOU_CENTER),
        zoom: 11,
        maxZoom: 18,
      }),
      layers: [
        // 高德暗色风格底图 (墨绿滤镜呼应决策大屏主题色)
        new TileLayer({
          className: "basemap-tint-green",
          source: new XYZ({
            url: "https://webrd0{1-4}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
            crossOrigin: "anonymous",
            attributions: "© 高德地图",
            maxZoom: 20,
          }),
        }),
      ],
      controls: [],
    });
    mapInstanceRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
      stationLayerRef.current = null;
      heatmapLayerRef.current = null;
    };
  }, [open]);

  // ===== 站点图层 + 热力图 (数据到达后渲染) =====
  useEffect(() => {
    if (!open || !data || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 移除旧图层
    if (stationLayerRef.current) {
      map.removeLayer(stationLayerRef.current);
      stationLayerRef.current = null;
    }
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (!data.stations || !data.stations.features?.length) return;

    const source = new VectorSource({ features: new GeoJSON().readFeatures(data.stations, { featureProjection: "EPSG:3857" }) });

    // 站点图层 (彩色圆点)
    const stationLayer = new VectorLayer({
      source,
      style: (feature) => {
        const brand = feature.get("brand") || "其他品牌";
        const color = (BRAND_CONFIG as any)[brand]?.color || "#00C896";
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#fff", width: 1 }),
          }),
        });
      },
    });
    map.addLayer(stationLayer);
    stationLayerRef.current = stationLayer;

    // 热力图叠加 (按充电桩数加权)
    const heatmapLayer = new HeatmapLayer({
      source,
      radius: 22,
      blur: 18,
      weight: (feature) => {
        const fast = Number(feature.get("fast") || 0);
        const slow = Number(feature.get("slow") || 0);
        const total = fast + slow;
        return total > 0 ? Math.min(1, total / 20) : 0.3;
      },
      gradient: ["#000080", "#0066CC", "#00C896", "#FFD460", "#FF6B35"],
    });
    map.addLayer(heatmapLayer);
    heatmapLayerRef.current = heatmapLayer;
  }, [open, data]);

  // ===== ECharts 图表渲染 =====
  useEffect(() => {
    if (!open || !data) return;

    // 品牌市占率环图
    if (brandChartRef.current) {
      if (brandChartInstRef.current) brandChartInstRef.current.dispose();
      const chart = echarts.init(brandChartRef.current);
      chart.setOption({
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        legend: {
          orient: "vertical",
          right: 2,
          top: "middle",
          itemWidth: 8,
          itemHeight: 8,
          itemGap: 6,
          textStyle: { color: "#5A7BA0", fontSize: 9 },
        },
        series: [{
          type: "pie",
          radius: ["40%", "58%"],
          center: ["36%", "50%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: (data.brandShare || []).map((b: any) => ({
            name: b.name,
            value: b.value,
            itemStyle: { color: (BRAND_CONFIG as any)[b.name]?.color || "#00C896" },
          })),
        }],
      });
      brandChartInstRef.current = chart;
    }

    // 行政区分布柱图
    if (districtChartRef.current) {
      if (districtChartInstRef.current) districtChartInstRef.current.dispose();
      const chart = echarts.init(districtChartRef.current);
      const dist = data.districtDist || [];
      chart.setOption({
        tooltip: { trigger: "axis" },
        grid: { left: 40, right: 20, top: 20, bottom: 40 },
        xAxis: {
          type: "category",
          data: dist.map((d: any) => d.district),
          axisLabel: { color: "#5A7BA0", fontSize: 10, rotate: 30 },
          axisLine: { lineStyle: { color: "rgba(27,42,74,0.15)" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#5A7BA0", fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(27,42,74,0.08)" } },
        },
        series: [{
          type: "bar",
          data: dist.map((d: any) => d.stations),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#3FA98C" },
              { offset: 1, color: "rgba(63,169,140,0.15)" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: "55%",
        }],
      });
      districtChartInstRef.current = chart;
    }

    // 增长趋势折线图
    if (trendChartRef.current) {
      if (trendChartInstRef.current) trendChartInstRef.current.dispose();
      const chart = echarts.init(trendChartRef.current);
      const trend = data.growthTrend || [];
      chart.setOption({
        tooltip: { trigger: "axis" },
        legend: { data: ["新增站点", "新增方案", "新增反馈"], textStyle: { color: "#5A7BA0", fontSize: 10 }, top: 0 },
        grid: { left: 40, right: 20, top: 30, bottom: 30 },
        xAxis: {
          type: "category",
          data: trend.map((t: any) => t.month.slice(5)),
          axisLabel: { color: "#5A7BA0", fontSize: 10 },
          axisLine: { lineStyle: { color: "rgba(27,42,74,0.15)" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#5A7BA0", fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(27,42,74,0.08)" } },
        },
        series: [
          { name: "新增站点", type: "line", smooth: true, data: trend.map((t: any) => t.stations), itemStyle: { color: "#3FA98C" }, areaStyle: { color: "rgba(63,169,140,0.12)" } },
          { name: "新增方案", type: "line", smooth: true, data: trend.map((t: any) => t.schemes), itemStyle: { color: "#D9A843" } },
          { name: "新增反馈", type: "line", smooth: true, data: trend.map((t: any) => t.feedback), itemStyle: { color: "#6B9AC4" } },
        ],
      });
      trendChartInstRef.current = chart;
    }
  }, [open, data]);

  // ===== 卸载时 dispose 所有图表 =====
  useEffect(() => {
    if (!open) return;
    return () => {
      brandChartInstRef.current?.dispose();
      districtChartInstRef.current?.dispose();
      trendChartInstRef.current?.dispose();
      brandChartInstRef.current = null;
      districtChartInstRef.current = null;
      trendChartInstRef.current = null;
    };
  }, [open]);

  // ===== 窗口缩放自适应 =====
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      brandChartInstRef.current?.resize();
      districtChartInstRef.current?.resize();
      trendChartInstRef.current?.resize();
      mapInstanceRef.current?.updateSize();
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [open]);

  if (!open) return null;

  const kpi = data?.kpi;
  const ticker = data?.ticker || [];
  const topBlindSpots = data?.topBlindSpots || [];

  // KPI 卡片配置 (盲区社区数支持深链跳转到盲区攻坚大屏)
  const kpiCards: { label: string; value: number; unit: string; icon: typeof Zap; color: string; target?: DashboardTarget }[] = [
    { label: "充电站总数", value: kpi?.totalStations ?? 0, unit: "座", icon: Zap, color: "#3FA98C" },
    { label: "充电桩总数", value: kpi?.totalPorts ?? 0, unit: "桩", icon: BatteryCharging, color: "#D9A843" },
    { label: "区域覆盖率", value: kpi?.coverageRate ?? 0, unit: "%", icon: Percent, color: "#6B9AC4" },
    { label: "盲区社区数", value: kpi?.blindSpotCommunities ?? 0, unit: "个", icon: AlertTriangle, color: "#E08D5A", target: "blindspot" },
    { label: "今日新增反馈", value: kpi?.todayFeedback ?? 0, unit: "条", icon: MessageSquarePlus, color: "#9B8AC4" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #EAF2F8 0%, #E0ECF5 50%, #D6E6F8 100%)",
        color: "#1B2A4A",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Subtle 网格背景纹理 (淡蓝) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(90,123,160,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ===== 顶部标题栏 — 淡色液态玻璃 ===== */}
      <header
        className="shrink-0 flex items-center justify-between px-6 relative"
        style={{
          height: 64,
          background: "linear-gradient(165deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.42) 100%)",
          backdropFilter: "blur(20px) saturate(1.6) brightness(1.03)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6) brightness(1.03)",
          borderBottom: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 4px 24px -12px rgba(27,42,74,0.12)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EAF2F8 0%, #D6E6F2 100%)", border: "1px solid rgba(90,123,160,0.35)" }}>
            <Zap className="w-5 h-5" style={{ color: "#1B2A4A" }} fill="#1B2A4A" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-wide" style={{ color: "#1B2A4A" }}>
              徐州新能源充电设施决策大屏
            </h1>
            <p className="text-[10.5px] tracking-wider" style={{ color: "#7A8A9A" }}>
              XUZHOU NEW ENERGY CHARGING INFRASTRUCTURE DASHBOARD
            </p>
          </div>
        </div>

        {onNavigate && <DashboardStoryNav current="main" onNavigate={onNavigate} />}

        <div className="flex items-center gap-4 text-[11.5px]">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" style={{ color: "#3FA98C" }} />
            <span className="font-num" style={{ color: "#5A7BA0" }}>
              {now.toLocaleString("zh-CN", { hour12: false })}
            </span>
          </div>
          <span style={{ color: "rgba(90,123,160,0.35)" }}>|</span>
          <span style={{ color: "#7A8A9A" }}>
            数据更新: <span className="font-num" style={{ color: "#3FA98C" }}>{data?.updateTime || "加载中..."}</span>
          </span>
          <button
            onClick={loadData}
            className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.6)" }}
            title="刷新数据"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#3FA98C" }} /> : <RefreshCw className="w-3.5 h-3.5" style={{ color: "#5A7BA0" }} />}
          </button>
          <button
            onClick={onBack}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:scale-105"
            style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.65)", color: "#1B2A4A" }}
          >
            <X className="w-3.5 h-3.5" />
            返回主界面
          </button>
        </div>
      </header>

      {/* ===== 主体三列布局 ===== */}
      <div className="flex-1 flex gap-3 p-3 min-h-0 relative">
        {/* ===== 左侧: KPI 卡片列 — 深色玻璃拟态 ===== */}
        <aside className="w-[220px] shrink-0 flex flex-col gap-3">
          {kpiCards.map((card, i) => {
            const Icon = card.icon;
            const clickable = !!card.target && !!onNavigate;
            return (
              <div
                key={i}
                onClick={clickable ? () => onNavigate?.(card.target!, { from: "main", blindSpotCount: kpi?.blindSpotCommunities ?? 0, focusTopBlindSpot: true }) : undefined}
                className={`rounded-xl p-3.5 flex-1 flex flex-col justify-between relative overflow-hidden animate-slide-up dash-card ${clickable ? "group cursor-pointer transition-transform hover:scale-[1.02]" : ""}`}
                style={
                  clickable
                    ? { border: "1px solid rgba(224,141,90,0.4)", boxShadow: "0 8px 32px -12px rgba(224,141,90,0.25), inset 0 1px 1px rgba(255,255,255,0.85)" }
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "#7A8A9A" }}>{card.label}</span>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${card.color}35` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[30px] font-bold font-num leading-none" style={{ color: card.color }}>
                    {card.value.toLocaleString()}
                  </span>
                  <span className="text-[11px]" style={{ color: "#A8B4C4" }}>{card.unit}</span>
                  {clickable && (
                    <span className="ml-auto text-[9px] font-medium group-hover:transition-colors" style={{ color: "#E08D5A" }}>
                      攻坚 →
                    </span>
                  )}
                </div>
                {/* 底部 subtle 装饰线 */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl"
                  style={{ background: `linear-gradient(90deg, transparent, ${card.color}40, transparent)` }}
                />
              </div>
            );
          })}
        </aside>

        {/* ===== 中央: 大地图 ===== */}
        <main className="flex-1 flex flex-col gap-3 min-w-0">
          <div
            className="flex-1 rounded-xl overflow-hidden relative dash-card"
          >
            <div ref={mapRef} className="w-full h-full" />
            {/* 地图角标 — 淡色玻璃 */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
              <TrendingUp className="w-3 h-3" style={{ color: "#3FA98C" }} />
              <span className="text-[11px]" style={{ color: "#1B2A4A" }}>全市充电站分布 + 负荷热力图</span>
            </div>
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.7)" }}>
              {Object.entries(BRAND_CONFIG).slice(0, 6).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1" style={{ color: "#5A7BA0" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />
                  {v.label}
                </span>
              ))}
            </div>
          </div>

          {/* ===== 底部滚动条: 反馈/日志轮播 — 淡色玻璃 ===== */}
          <div
            className="shrink-0 rounded-xl overflow-hidden dash-card"
            style={{ height: 44 }}
          >
            <div className="flex items-center h-full">
              <div className="shrink-0 px-3 h-full flex items-center gap-1.5 text-[11px] font-medium" style={{ background: "rgba(63,169,140,0.12)", borderRight: "1px solid rgba(255,255,255,0.65)", color: "#2E8B74" }}>
                <Activity className="w-3 h-3" />
                实时动态
              </div>
              <div className="flex-1 overflow-hidden relative">
                {ticker.length > 0 ? (
                  <div className="flex items-center whitespace-nowrap animate-marquee" style={{ animationDuration: `${Math.max(20, ticker.length * 4)}s` }}>
                    {[...ticker, ...ticker].map((item, idx) => (
                      <span key={idx} className="inline-flex items-center gap-2 px-6 text-[11.5px]" style={{ color: "#5A7BA0" }}>
                        <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: item.type === "评价" ? "rgba(155,138,196,0.14)" : item.type === "需求" ? "rgba(217,168,67,0.14)" : "rgba(107,154,196,0.14)", color: item.type === "评价" ? "#8478B5" : item.type === "需求" ? "#B8862F" : "#5B88B5" }}>
                          {item.type}
                        </span>
                        <span style={{ color: "#5A7BA0" }}>{item.content}</span>
                        <span className="text-[10px]" style={{ color: "#A8B4C4" }}>— {item.submitter} · {item.time}</span>
                        <span className="mx-2" style={{ color: "rgba(90,123,160,0.4)" }}>◆</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center h-full px-6 text-[11px]" style={{ color: "#A8B4C4" }}>暂无实时动态</div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ===== 右侧: 图表列 — 淡色玻璃 ===== */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-3">
          {/* 品牌市占率环图 */}
          <div className="rounded-xl p-3 flex flex-col dash-card" style={{ height: 200 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3" style={{ color: "#3FA98C" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>品牌市占率</h3>
            </div>
            <div ref={brandChartRef} className="flex-1" />
          </div>

          {/* 行政区分布柱图 */}
          <div className="rounded-xl p-3 flex flex-col dash-card" style={{ height: 200 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3" style={{ color: "#3FA98C" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>行政区分布</h3>
            </div>
            <div ref={districtChartRef} className="flex-1" />
          </div>

          {/* 增长趋势折线图 */}
          <div className="rounded-xl p-3 flex flex-col dash-card" style={{ height: 180 }}>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3" style={{ color: "#3FA98C" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>12 月增长趋势</h3>
            </div>
            <div ref={trendChartRef} className="flex-1" />
          </div>

          {/* Top5 盲区列表 */}
          <div className="rounded-xl p-3 flex-1 flex flex-col min-h-0 dash-card">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="w-3 h-3" style={{ color: "#E08D5A" }} />
              <h3 className="text-[11.5px] font-medium" style={{ color: "#1B2A4A" }}>Top5 盲区社区</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {topBlindSpots.length === 0 ? (
                <p className="text-[10.5px] text-center py-4" style={{ color: "#A8B4C4" }}>暂无盲区数据</p>
              ) : topBlindSpots.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(224,141,90,0.18)" }}>
                  <span className="w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold" style={{ background: i === 0 ? "rgba(217,168,67,0.22)" : i === 1 ? "rgba(107,154,196,0.22)" : i === 2 ? "rgba(224,141,90,0.22)" : "rgba(90,123,160,0.12)", color: i < 3 ? "#1B2A4A" : "#7A8A9A" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate" style={{ color: "#1B2A4A" }}>{c.name}</p>
                    <p className="text-[9px]" style={{ color: "#A8B4C4" }}>{c.district}</p>
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
