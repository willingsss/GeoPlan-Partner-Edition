declare const AMap: any;

// 方向图标组件（用于导航步骤中的转向指示）
function DirectionIcon({ action }: { action: any }) {
  const a = ((Array.isArray(action) ? action[0] : action) || "").toString().toLowerCase().trim();
  const color = "currentColor";
  // 根据高德 action 返回对应方向图标
  if (a.includes("左转") || a.includes("向左")) return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
  );
  if (a.includes("右转") || a.includes("向右")) return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
  );
  if (a.includes("掉头") || a.includes("调头")) return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 12v-2a4 4 0 014-4h10l-4 4"/></svg>
  );
  if (a.includes("靠左")) return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4v18h-4"/><path d="M10 8l-4 4 4 4"/></svg>
  );
  if (a.includes("靠右")) return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h4v18H9"/><path d="M14 8l4 4-4 4"/></svg>
  );
  if (a.includes("到达") || a.includes("目的")) return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
  );
  // 默认: 直行/出发
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V4"/><path d="M8 8l4-4 4 4"/></svg>
  );
}

import React, { useEffect, useRef, useState, useCallback } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import Collection from "ol/Collection";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat, toLonLat } from "ol/proj";
import { Style, Fill, Stroke, Text, Circle as CircleStyle, Icon as IconStyle } from "ol/style";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import Circle from "ol/geom/Circle";
import { Translate } from "ol/interaction";
import Overlay from "ol/Overlay";
import * as echarts from "echarts";
import {
  Map as MapIcon, Radar, Target, MessageSquare, Bot, Settings,
  Zap, RefreshCw, Save, Send, Building2, Layers, Database, BarChart3,
  Sparkles, X, Gauge, LogOut, User as UserIcon, ShieldCheck,
  MapPin, Navigation, LocateFixed, Route as RouteIcon,
  ChevronLeft, ChevronRight, Search, Loader2, Square, RotateCcw,
  Copy, Check, Trash2,
} from "lucide-react";
import {
  BRAND_CONFIG, BRANDS, SubsystemTab,
  CommunityResult, CoverageSummary, SiteMetrics, SavedScheme,
  BlindSpotCluster,
  User, UserRole, ROLE_PERMISSIONS, ROLE_CONFIG, DEMO_ACCOUNTS,
} from "./types";
import { XUZHOU_CENTER } from "./config/map";
import { gcj02ToWgs84, wgs84ToGcj02 } from "./lib/coordinate";

// =========================================================================
// 品牌图标样式映射
// =========================================================================
function getStationStyle(feature: any): Style {
  const brand = feature.get("brand") || "国家电网";
  const config = BRAND_CONFIG[brand] || { color: "#3b82f6" };
  const status = feature.get("status");
  const radius = 7;
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: config.color }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
    text: new Text({
      text: feature.get("name")?.split("·")[1]?.split("充电")[0] || "",
      font: "10px sans-serif",
      offsetY: -14,
      fill: new Fill({ color: "#1F2937" }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
  });
}

// =========================================================================
// AI 回复内容渲染（简易 Markdown 美化）
// =========================================================================
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(<span key={k++}>{text.slice(lastIndex, m.index)}</span>);
    const raw = m[0];
    if (raw.startsWith("**")) parts.push(<strong key={k++} className="font-semibold text-slate-900">{raw.slice(2, -2)}</strong>);
    else if (raw.startsWith("`")) parts.push(<code key={k++} className="bg-slate-200 text-purple-700 px-0.5 rounded text-[9px] font-mono">{raw.slice(1, -1)}</code>);
    else parts.push(<em key={k++} className="italic text-slate-700">{raw.slice(1, -1)}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<span key={k++}>{text.slice(lastIndex)}</span>);
  return <>{parts}</>;
}

function renderAiContent(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (paras: string[]) => {
    if (!paras.length) return;
    const content = paras.map(s => s.trim()).join(" ").trim();
    if (content) blocks.push(<p key={`p-${key++}`} className="my-0.5">{renderInline(content)}</p>);
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // 代码块
    if (trimmed.startsWith("```")) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre key={`pre-${key++}`} className="bg-slate-800 text-slate-100 rounded p-1.5 overflow-x-auto text-[9px] my-1">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const size = level === 1 ? "text-[11px]" : "text-[10px]";
      blocks.push(
        <div key={`h-${key++}`} className={`font-bold text-slate-800 ${size} mt-1.5 mb-0.5`}>
          {renderInline(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // 无序列表
    if (/^[*-]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[*-]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[*-]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-3 space-y-0.5 my-1">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="list-decimal pl-3 space-y-0.5 my-1">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // 普通段落（合并连续行）
    const paras: string[] = [raw];
    i++;
    while (i < lines.length && lines[i].trim() !== "") {
      paras.push(lines[i]);
      i++;
    }
    flushParagraph(paras);
  }

  return <div className="text-[10px] leading-relaxed text-slate-800">{blocks}</div>;
}

export default function App() {
  // =========================================================================
  // 状态管理
  // =========================================================================
  // 认证状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<SubsystemTab>("map");
  const [visibleBrands, setVisibleBrands] = useState<Set<string>>(new Set(BRANDS));
  const [showCommunities, setShowCommunities] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [mapPanelCollapsed, setMapPanelCollapsed] = useState(false);
  const [coverageRadius, setCoverageRadius] = useState<number>(0); // 0 = 使用 chargeMode 预设
  const [coverageDistrict, setCoverageDistrict] = useState<string>("all");
  const [siteChargeMode, setSiteChargeMode] = useState<"fast" | "slow">("fast");
  const [siteBrand, setSiteBrand] = useState<string>("国家电网");
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [aiStationDetail, setAiStationDetail] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);
  const [stationCount, setStationCount] = useState(0);
  // 实际存在数据的品牌列表 (从加载的站点中动态提取, 替代硬编码 BRANDS)
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // 覆盖分析
  const [chargeMode, setChargeMode] = useState<"fast" | "slow">("fast");
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageSummary, setCoverageSummary] = useState<CoverageSummary | null>(null);
  const [coverageResults, setCoverageResults] = useState<CommunityResult[]>([]);
  const [districtStats, setDistrictStats] = useState<any[]>([]);
  // 盲区聚类候选点 (覆盖分析返回)
  const [blindSpotClusters, setBlindSpotClusters] = useState<BlindSpotCluster[]>([]);
  // 跨 Tab 保留的最近一次覆盖分析摘要 (供选址面板联动展示)
  const [lastCoverageSummary, setLastCoverageSummary] = useState<CoverageSummary | null>(null);
  // 当前选址是否落在盲区内
  const [siteInBlindSpot, setSiteInBlindSpot] = useState(false);
  // 地图点击候选点时选中的聚类 (用于弹窗)
  const [selectedCluster, setSelectedCluster] = useState<BlindSpotCluster | null>(null);

  // 选址决策
  const [virtualStation, setVirtualStation] = useState<{ lng: number; lat: number } | null>(null);
  const [siteRadius, setSiteRadius] = useState(800);
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [schemes, setSchemes] = useState<SavedScheme[]>([]);
  const [schemeName, setSchemeName] = useState("");
  const [compareSchemes, setCompareSchemes] = useState<number[]>([]);

  // 公众反馈 (全局反馈列表, 用于系统管理面板统计)
  const [feedbackList, setFeedbackList] = useState<any[]>([]);

  // 充电站中央模态框 (集成属性展示 + 站点反馈子系统)
  const [stationFeedback, setStationFeedback] = useState<any[]>([]);
  const [stationFeedbackLoading, setStationFeedbackLoading] = useState(false);
  const [stationFeedbackForm, setStationFeedbackForm] = useState<{ description: string; rating: number; type: "evaluation" | "demand" }>({ description: "", rating: 5, type: "evaluation" });
  const [submittingStationFeedback, setSubmittingStationFeedback] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "approved" | "rejected">("all");
  const [feedbackSort, setFeedbackSort] = useState<"newest" | "highest">("newest");

  interface AiGisStation {
    id: number;
    name: string;
    brand: string;
    lng: number;
    lat: number;
    address: string;
    district: string;
    fastChargers: number;
    slowChargers: number;
    distanceKm?: number;
  }
  interface AiGisResult {
    type: string;
    radius: number;
    center: [number, number];
    count: number;
    coveredPopulation: number;
    coveredCommunities: number;
    district?: string;
    brand?: string;
    stations: AiGisStation[];
  }
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string; gisResult?: AiGisResult }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiDragging, setAiDragging] = useState(false);
  const [aiBotBounce, setAiBotBounce] = useState(false);
  const aiDragRef = useRef<{ startX: number; startY: number; moved: boolean }>({ startX: 0, startY: 0, moved: false });
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 系统管理
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [regionStats, setRegionStats] = useState<any[]>([]);
  // 管理界面分类 Tab
  const [adminTab, setAdminTab] = useState<"overview" | "stations" | "users" | "feedback" | "schemes" | "logs">("overview");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const sidebarLockRef = useRef(false);

  const toggleSidebar = useCallback(() => {
    if (sidebarLockRef.current) return;
    sidebarLockRef.current = true;
    setSidebarAnimating(true);
    setSidebarCollapsed(prev => !prev);
    setTimeout(() => { setSidebarAnimating(false); sidebarLockRef.current = false; }, 500);
  }, []);

  // 用户定位与导航
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number; accuracy?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number; duration: number; targetName: string;
    steps?: { instruction: string; road: string; distance: number; duration: number; action: string }[];
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  // 管理界面数据
  const [adminStations, setAdminStations] = useState<any[]>([]);
  const [adminFeedback, setAdminFeedback] = useState<any[]>([]);
  const [adminSchemes, setAdminSchemes] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminEditing, setAdminEditing] = useState<any>(null); // 正在编辑的记录 (null=关闭, 空对象=新增)
  const [adminLogFilter, setAdminLogFilter] = useState("all");

  // =========================================================================
  // 地图 Refs
  // =========================================================================
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const stationSourceRef = useRef<VectorSource | null>(null);
  const communitySourceRef = useRef<VectorSource | null>(null);
  const serviceAreaSourceRef = useRef<VectorSource | null>(null);
  const blindSpotSourceRef = useRef<VectorSource | null>(null);
  const virtualStationSourceRef = useRef<VectorSource | null>(null);
  const searchSourceRef = useRef<VectorSource | null>(null);
  const intersectionSourceRef = useRef<VectorSource | null>(null);
  const feedbackSourceRef = useRef<VectorSource | null>(null);
  const userLocationSourceRef = useRef<VectorSource | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const translateRef = useRef<Translate | null>(null);

  const coverageChartRef = useRef<HTMLDivElement>(null);
  const siteChartRef = useRef<HTMLDivElement>(null);
  const radarChartRef = useRef<HTMLDivElement>(null);

  // 用于在地图事件回调中访问最新值，避免闭包过期
  const activeTabRef = useRef<SubsystemTab>("map");
  const placeVirtualStationRef = useRef<(lng: number, lat: number) => void>(() => {});
  const siteRadiusRef = useRef(siteRadius);

  // GIS 分析结果缓存
  const gisResultRef = useRef<{ stations: number[]; communities: number[]; center?: [number, number]; radius?: number } | null>(null);
  const gisBufferSourceRef = useRef<VectorSource | null>(null);
  const aiHighlightSourceRef = useRef<VectorSource | null>(null);
  const aiOverlayRef = useRef<Overlay | null>(null);
  const aiHighlightTimerRef = useRef<number | null>(null);

  // 图层引用 (用于按 Tab 控制可见性, 保留数据不清除)
  const communityLayerRef = useRef<VectorLayer | null>(null);
  const serviceAreaLayerRef = useRef<VectorLayer | null>(null);
  const blindSpotLayerRef = useRef<VectorLayer | null>(null);
  const intersectionLayerRef = useRef<VectorLayer | null>(null);
  const virtualStationLayerRef = useRef<VectorLayer | null>(null);
  const feedbackLayerRef = useRef<VectorLayer | null>(null);
  const searchLayerRef = useRef<VectorLayer | null>(null);
  // 候选点 (盲区聚类) 图层引用
  const clusterSourceRef = useRef<VectorSource | null>(null);
  const clusterLayerRef = useRef<VectorLayer | null>(null);
  // 跨 Tab 保留盲区几何 (WGS84 GeoJSON Polygon 数组), 供 evaluate-site 联动判断
  const lastCoverageBlindSpotsRef = useRef<any[] | null>(null);

  // =========================================================================
  // AI 交互：跳转到指定充电站
  // =========================================================================
  const flyToStationById = useCallback((stationId: number) => {
    // 从 gisResult 的 stations 中查找站点数据
    const lastAiMsg = aiMessages.filter(m => m.role === "assistant" && m.gisResult).pop();
    const gisStation = lastAiMsg?.gisResult?.stations?.find((s: any) => s.id === stationId);
    if (!gisStation) return;

    // 如果已经高亮了同一个站点（第二次点击），不做额外操作
    if (aiStationDetail?.id === stationId) {
      return;
    }

    // 如果详情弹窗正在显示但不是这个站点，先关闭
    if (aiStationDetail && aiStationDetail.id !== stationId) {
      closeAiStationDetail();
    }

    // 设置站点详情
    setAiStationDetail(gisStation);
    if (mapRef.current) {
      const [gcjLng, gcjLat] = wgs84ToGcj02(gisStation.lng, gisStation.lat);
      const center3857 = fromLonLat([gcjLng, gcjLat]);

      // 地图飞到该站点
      mapRef.current.getView().animate({
        center: center3857,
        zoom: 16,
        duration: 800,
      });

      // 添加高亮呼吸效果
      if (aiHighlightSourceRef.current) {
        aiHighlightSourceRef.current.clear();
        const highlightFeature = new Feature({
          geometry: new Point(center3857),
          name: gisStation.name,
        });
        aiHighlightSourceRef.current.addFeature(highlightFeature);

        // 启动呼吸动画定时器
        if (aiHighlightTimerRef.current) clearInterval(aiHighlightTimerRef.current);
        let phase = 0;
        aiHighlightTimerRef.current = window.setInterval(() => {
          phase += 0.08;
          const t = (Math.sin(phase) + 1) / 2; // 0~1
          const radius = 16 + t * 8; // 16~24
          const opacity = 0.15 + t * 0.25; // 0.15~0.4
          const strokeOpacity = 0.5 + t * 0.5; // 0.5~1.0
          highlightFeature.setStyle(new Style({
            image: new CircleStyle({
              radius,
              fill: new Fill({ color: `rgba(168,85,247,${opacity})` }),
              stroke: new Stroke({ color: `rgba(168,85,247,${strokeOpacity})`, width: 2.5 + t * 1.5 }),
            }),
          }));
        }, 50);
      }

      // 设置 Overlay 位置（在站点上方显示卡片）
      if (aiOverlayRef.current) {
        aiOverlayRef.current.setPosition(center3857);
      }
    }
  }, [aiMessages, aiStationDetail]);

  // 关闭 AI 站点详情：清除高亮、overlay、状态
  const closeAiStationDetail = useCallback(() => {
    setAiStationDetail(null);
    if (aiHighlightSourceRef.current) aiHighlightSourceRef.current.clear();
    if (aiOverlayRef.current) aiOverlayRef.current.setPosition(undefined);
    if (aiHighlightTimerRef.current) { clearInterval(aiHighlightTimerRef.current); aiHighlightTimerRef.current = null; }
  }, []);

  // 在地图上可视化 GIS 分析结果
  const visualizeGisAnalysis = useCallback((result: { stations: number[]; communities: number[]; center?: [number, number]; radius?: number }) => {
    if (!mapRef.current) return;
    // 切换到地图 Tab
    if (activeTab !== "map") {
      setActiveTab("map");
    }
    setTimeout(() => {
      if (!mapRef.current) return;
      const view = mapRef.current.getView();

      // 绘制缓冲区圆
      if (result.center && result.radius && result.radius > 0 && gisBufferSourceRef.current) {
        gisBufferSourceRef.current.clear();
        const [wgsLng, wgsLat] = result.center;
        const [gcjLng, gcjLat] = wgs84ToGcj02(wgsLng, wgsLat);
        const center3857 = fromLonLat([gcjLng, gcjLat]);
        const circle = new Circle(center3857, result.radius);
        const bufferFeature = new Feature({ geometry: circle });
        gisBufferSourceRef.current.addFeature(bufferFeature);

        // 飞图到中心位置
        view.fit(circle.getExtent(), { padding: [80, 80, 80, 80], duration: 800 });
      } else if (result.stations.length > 0 && stationSourceRef.current) {
        // 没有缓冲区时，飞图到第一个站点
        const features = stationSourceRef.current.getFeatures();
        const firstStation = features.find((f: any) => f.get("id") === result.stations[0]);
        if (firstStation) {
          const lng = firstStation.get("lng");
          const lat = firstStation.get("lat");
          if (lng != null && lat != null) {
            const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat);
            view.animate({
              center: fromLonLat([gcjLng, gcjLat]),
              zoom: 14,
              duration: 800,
            });
          }
        }
      }
    }, 100);
  }, [activeTab]);

  // =========================================================================
  // 初始化地图
  // =========================================================================
  useEffect(() => {
    // 登录前不渲染主界面，容器不存在，跳过初始化
    if (!currentUser) return;
    if (!mapContainerRef.current) return;

    const stationSource = new VectorSource();
    stationSourceRef.current = stationSource;
    const communitySource = new VectorSource();
    communitySourceRef.current = communitySource;
    const serviceAreaSource = new VectorSource();
    serviceAreaSourceRef.current = serviceAreaSource;
    const blindSpotSource = new VectorSource();
    blindSpotSourceRef.current = blindSpotSource;
    const virtualStationSource = new VectorSource();
    virtualStationSourceRef.current = virtualStationSource;
    const intersectionSource = new VectorSource();
    intersectionSourceRef.current = intersectionSource;
    const feedbackSource = new VectorSource();
    feedbackSourceRef.current = feedbackSource;
    const userLocationSource = new VectorSource();
    userLocationSourceRef.current = userLocationSource;
    const routeSource = new VectorSource();
    routeSourceRef.current = routeSource;
    const searchSource = new VectorSource();
    searchSourceRef.current = searchSource;
    const gisBufferSource = new VectorSource();
    gisBufferSourceRef.current = gisBufferSource;
    const aiHighlightSource = new VectorSource();
    aiHighlightSourceRef.current = aiHighlightSource;
    // 候选点 (盲区聚类) 数据源
    const clusterSource = new VectorSource();
    clusterSourceRef.current = clusterSource;

    const communityStyle = (feature: any) => {
      const popCount = feature.get("population_total") || 10000;
      let fillCol = "rgba(0,200,150,0.06)";
      if (popCount > 14000) fillCol = "rgba(0,200,150,0.14)";
      else if (popCount > 10000) fillCol = "rgba(0,200,150,0.10)";
      return new Style({
        stroke: new Stroke({ color: "rgba(0,200,150,0.5)", width: 1.5 }),
        fill: new Fill({ color: fillCol }),
        text: new Text({
          text: feature.get("name") || "",
          font: "bold 10px sans-serif",
          fill: new Fill({ color: "#1F2937" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      });
    };

    const blindSpotStyle = new Style({
      stroke: new Stroke({ color: "#ef4444", width: 2.5 }),
      fill: new Fill({ color: "rgba(239,68,68,0.3)" }),
      text: new Text({
        text: "盲区",
        font: "bold 10px sans-serif",
        fill: new Fill({ color: "#7f1d1d" }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
    });

    const serviceAreaStyle = (feature: any) => {
      const brand = feature.get("brand") || "";
      const color = BRAND_CONFIG[brand]?.color || "#3b82f6";
      return new Style({
        stroke: new Stroke({ color, width: 1.5, lineDash: [4, 4] }),
        fill: new Fill({ color: color + "15" }),
      });
    };

    const virtualStationStyle = new Style({
      image: new CircleStyle({
        radius: 12,
        fill: new Fill({ color: "#fbbf24" }),
        stroke: new Stroke({ color: "#ffffff", width: 3 }),
      }),
      text: new Text({
        text: "📍 拖拽我",
        font: "bold 11px sans-serif",
        offsetY: -22,
        fill: new Fill({ color: "#92400e" }),
        stroke: new Stroke({ color: "#ffffff", width: 3 }),
      }),
    });

    const intersectionStyle = (feature: any) => {
      const ratio = feature.get("coverage_ratio") || 0;
      return new Style({
        stroke: new Stroke({ color: "#22c55e", width: 2 }),
        fill: new Fill({ color: "rgba(34,197,94,0.35)" }),
        text: new Text({
          text: `${ratio}%`,
          font: "9px sans-serif",
          fill: new Fill({ color: "#052e16" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      });
    };

    const feedbackStyle = (feature: any) => {
      const type = feature.get("type");
      const color = type === "demand" ? "#f97316" : "#06b6d4";
      return new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      });
    };

    const map = new Map({
      target: mapContainerRef.current,
      layers: [
        // 高德地图标准矢量底图 (GCJ02坐标系)
        new TileLayer({
          source: new XYZ({
            url: "https://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            crossOrigin: "anonymous",
            attributions: "© 高德地图 AutoNavi",
            maxZoom: 20,
          }),
        }),
        (() => { const l = new VectorLayer({ source: communitySource, style: communityStyle, visible: false }); communityLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: serviceAreaSource, style: serviceAreaStyle }); serviceAreaLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: blindSpotSource, style: blindSpotStyle }); blindSpotLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: intersectionSource, style: intersectionStyle }); intersectionLayerRef.current = l; return l; })(),
        new VectorLayer({ source: stationSource, style: getStationStyle }),
        (() => { const l = new VectorLayer({ source: virtualStationSource, style: virtualStationStyle }); virtualStationLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: feedbackSource, style: feedbackStyle }); feedbackLayerRef.current = l; return l; })(),
        // 导航路线图层 (最上层)
        new VectorLayer({
          source: routeSource,
          style: new Style({
            stroke: new Stroke({ color: "#00C896", width: 5, lineCap: "round", lineJoin: "round" }),
          }),
        }),
        // 用户位置图层 (最上层)
        new VectorLayer({
          source: userLocationSource,
          style: new Style({
            image: new CircleStyle({
              radius: 10,
              fill: new Fill({ color: "rgba(56,189,248,0.25)" }),
              stroke: new Stroke({ color: "#38BDF8", width: 3 }),
            }),
          }),
        }),
        // 搜索标记图层 (最上层)
        (() => { const l = new VectorLayer({
          source: searchSource,
          style: new Style({
            image: new CircleStyle({
              radius: 12,
              fill: new Fill({ color: "rgba(168,85,247,0.2)" }),
              stroke: new Stroke({ color: "#A855F7", width: 3 }),
            }),
            text: new Text({
              text: "📍",
              font: "20px sans-serif",
              offsetY: -18,
            }),
          }),
        }); searchLayerRef.current = l; return l; })(),
        // 候选点 (盲区聚类) 图层: 金色定位针 + 人口文本, 仅 coverage Tab 可见
        (() => { const l = new VectorLayer({
          source: clusterSource,
          style: (feature: any) => {
            const c: BlindSpotCluster = feature.get("cluster");
            // 人口格式化: >=1000 显示为 "x.xk", 否则原值
            const pop = c?.population ?? 0;
            const popText = pop >= 1000 ? `${(pop / 1000).toFixed(1)}k` : `${pop}`;
            return new Style({
              image: new CircleStyle({
                radius: 10,
                fill: new Fill({ color: "#f59e0b" }),
                stroke: new Stroke({ color: "#ffffff", width: 2 }),
              }),
              text: new Text({
                text: popText,
                font: "bold 10px sans-serif",
                offsetY: -18,
                fill: new Fill({ color: "#92400e" }),
                stroke: new Stroke({ color: "#ffffff", width: 3 }),
              }),
            });
          },
        }); clusterLayerRef.current = l; return l; })(),
        // GIS 分析缓冲区图层
        new VectorLayer({
          source: gisBufferSource,
          style: new Style({
            stroke: new Stroke({ color: "#00C896", width: 2, lineDash: [6, 4] }),
            fill: new Fill({ color: "rgba(0,200,150,0.1)" }),
          }),
        }),
        // AI 高亮站点图层 (呼吸效果)
        new VectorLayer({
          source: aiHighlightSource,
          style: new Style({
            image: new CircleStyle({
              radius: 18,
              fill: new Fill({ color: "rgba(168,85,247,0.25)" }),
              stroke: new Stroke({ color: "#A855F7", width: 3 }),
            }),
          }),
        }),
      ],
      view: new View({
        // 高德地图使用 GCJ02，需将 WGS84 中心点转换后投影到 3857
        center: fromLonLat(wgs84ToGcj02(XUZHOU_CENTER[0], XUZHOU_CENTER[1])),
        zoom: 12,
        minZoom: 10,
        maxZoom: 18,
      }),
    });
    mapRef.current = map;

    // 初始化 AI 站点详情 Overlay
    const overlayEl = document.getElementById("ai-station-overlay");
    if (overlayEl) {
      const overlay = new Overlay({
        element: overlayEl,
        positioning: "bottom-center" as any,
        offset: [0, -30],
        stopEvent: false,
      });
      map.addOverlay(overlay);
      aiOverlayRef.current = overlay;
    }

    // 鼠标移动
    map.on("pointermove", (e) => {
      const coord = toLonLat(e.coordinate);
      setMousePosition([parseFloat(coord[0].toFixed(5)), parseFloat(coord[1].toFixed(5))]);
    });

    // 地图点击
    map.on("singleclick", (e) => {
      const coord3857 = e.coordinate;
      const coordGcj02 = toLonLat(coord3857);
      // 高德底图坐标为 GCJ02，需转回 WGS84 传给后端
      const [wgsLng, wgsLat] = gcj02ToWgs84(coordGcj02[0], coordGcj02[1]);
      const lng = parseFloat(wgsLng.toFixed(6));
      const lat = parseFloat(wgsLat.toFixed(6));

      // 检查是否点击了充电站 / 候选点
      let clickedStation: any = null;
      let clickedCluster: BlindSpotCluster | null = null;
      map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
        const props = feature.getProperties();
        if (props.brand && props.name) {
          clickedStation = props;
        }
        // 候选点 feature 携带 cluster 属性
        if (props.cluster) {
          clickedCluster = props.cluster as BlindSpotCluster;
        }
      });

      const currentTab = activeTabRef.current;
      if (clickedStation) {
        // 任意 Tab 下点击充电站都弹出中央模态框 (集成属性展示 + 站点反馈)
        setSelectedStation(clickedStation);
        setStationFeedback([]);
        setStationFeedbackForm({ description: "", rating: 5, type: "evaluation" });
        setFeedbackFilter("all");
        // 加载该站点的反馈
        if (clickedStation.id) loadStationFeedback(clickedStation.id);
        // 关闭 AI 高亮和 overlay
        if (aiHighlightSourceRef.current) aiHighlightSourceRef.current.clear();
        if (aiOverlayRef.current) aiOverlayRef.current.setPosition(undefined);
        if (aiHighlightTimerRef.current) { clearInterval(aiHighlightTimerRef.current); aiHighlightTimerRef.current = null; }
        setAiStationDetail(null);
        return;
      }

      // 点击候选点: 选中并飞至该点, 弹窗展示
      if (clickedCluster) {
        setSelectedCluster(clickedCluster);
        const [gcjLng, gcjLat] = wgs84ToGcj02(clickedCluster.center[0], clickedCluster.center[1]);
        map.getView().animate({ center: fromLonLat([gcjLng, gcjLat]), zoom: 15, duration: 600 });
        return;
      }

      // 点击空白处关闭模态框
      setSelectedStation(null);
      setSelectedCluster(null);
      // 同时关闭 AI 高亮
      if (aiHighlightSourceRef.current) aiHighlightSourceRef.current.clear();
      if (aiOverlayRef.current) aiOverlayRef.current.setPosition(undefined);
      if (aiHighlightTimerRef.current) { clearInterval(aiHighlightTimerRef.current); aiHighlightTimerRef.current = null; }
      setAiStationDetail(null);

      // 根据当前 Tab 执行不同操作 (传给后端的是 WGS84 坐标)
      if (currentTab === "site") {
        placeVirtualStationRef.current(lng, lat);
      }
    });

    return () => { map.setTarget(undefined); };
  }, [currentUser]);

  // 页面加载时自动定位用户（触发浏览器位置权限弹窗）
  useEffect(() => {
    const timer = setTimeout(() => locateUser(), 500);
    return () => clearTimeout(timer);
  }, []);

  // 保持 activeTabRef 与 activeTab 同步，供地图事件回调读取最新值
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // 按 Tab 控制图层可见性 (保留数据, 切回可继续使用, 不串到别的功能页)
  useEffect(() => {
    const isMap = activeTab === "map";
    const isSite = activeTab === "site";
    const isCov = activeTab === "coverage";
    // 覆盖分析图层: 仅 coverage Tab 可见
    serviceAreaLayerRef.current?.setVisible(isCov);
    blindSpotLayerRef.current?.setVisible(isCov);
    // 候选点 (盲区聚类) 图层: 仅 coverage Tab 可见
    clusterLayerRef.current?.setVisible(isCov);
    // 选址决策图层: 仅 site Tab 可见
    virtualStationLayerRef.current?.setVisible(isSite);
    intersectionLayerRef.current?.setVisible(isSite);
    // 地图查询图层: 仅 map Tab 可见 (community/feedback 受复选框控制)
    searchLayerRef.current?.setVisible(isMap);
    communityLayerRef.current?.setVisible(isMap && showCommunities);
    feedbackLayerRef.current?.setVisible(isMap && showFeedback);
  }, [activeTab, showCommunities, showFeedback]);

  // =========================================================================
  // 认证：会话恢复 / 登录 / 登出
  // =========================================================================
  // 页面加载时尝试从 localStorage 恢复会话
  useEffect(() => {
    const savedToken = localStorage.getItem("geoplan_token");
    if (savedToken) {
      fetch("/api/v1/auth/current", { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.json())
        .then(json => {
          if (json.success) {
            setCurrentUser(json.user);
            setAuthToken(savedToken);
          } else {
            localStorage.removeItem("geoplan_token");
          }
        })
        .catch(() => localStorage.removeItem("geoplan_token"));
    }
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const json = await res.json();
      if (json.success) {
        setCurrentUser(json.user);
        setAuthToken(json.token);
        localStorage.setItem("geoplan_token", json.token);
        setActiveTab("map");
      } else {
        setLoginError(json.message || "登录失败");
      }
    } catch (e) {
      setLoginError("网络错误，请检查服务是否启动");
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    if (authToken) {
      fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("geoplan_token");
    setCurrentUser(null);
    setAuthToken(null);
    setLoginForm({ username: "", password: "" });
    setActiveTab("map");
  };

  // 快速填充演示账号
  const fillDemoAccount = (username: string, password: string) => {
    setLoginForm({ username, password });
    setLoginError("");
  };

  // 带认证头的 fetch 封装
  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
    return fetch(url, { ...options, headers });
  };

  // 当前用户可访问的子系统
  const allowedTabs: SubsystemTab[] = currentUser
    ? ROLE_PERMISSIONS[currentUser.role]
    : [];

  // =========================================================================
  // 辅助：读取后端 GeoJSON 数据并投影到 EPSG:3857
  // 注意: 后端充电站数据来源于高德POI，坐标已是 GCJ02，与高德底图一致，无需转换
  //       小区/反馈等数据为 WGS84，需要转换为 GCJ02
  // =========================================================================
  const readFeaturesFromWGS84 = (geojson: any): any[] => {
    // 深拷贝并转换坐标 WGS84 -> GCJ02
    const converted = JSON.parse(JSON.stringify(geojson));
    const convertCoord = (coord: number[]) => {
      const [lng, lat] = wgs84ToGcj02(coord[0], coord[1]);
      coord[0] = lng;
      coord[1] = lat;
    };
    const walk = (geom: any) => {
      if (!geom) return;
      if (geom.type === "Point") convertCoord(geom.coordinates);
      else if (geom.type === "LineString" || geom.type === "MultiPoint") geom.coordinates.forEach((c: any) => convertCoord(c));
      else if (geom.type === "Polygon" || geom.type === "MultiLineString") geom.coordinates.forEach((ring: any) => ring.forEach((c: any) => convertCoord(c)));
      else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly: any) => poly.forEach((ring: any) => ring.forEach((c: any) => convertCoord(c))));
    };
    if (converted.type === "FeatureCollection") {
      converted.features.forEach((f: any) => walk(f.geometry));
    } else if (converted.type === "Feature") {
      walk(converted.geometry);
    } else {
      walk(converted);
    }
    return new GeoJSON().readFeatures(converted, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
  };

  // 读取已是 GCJ02 坐标的数据 (如高德POI爬取的充电站)，直接投影不做转换
  const readFeaturesFromGCJ02 = (geojson: any): any[] => {
    return new GeoJSON().readFeatures(geojson, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
  };

  // =========================================================================
  // 加载充电站数据 (登录后地图初始化完成才加载)
  // 充电站数据从数据库加载，坐标为 WGS84，需转换为 GCJ02 显示在高德底图上
  // =========================================================================
  useEffect(() => {
    if (!currentUser) return;
    fetch("/api/v1/stations")
      .then(r => r.json())
      .then(json => {
        if (json.success && stationSourceRef.current) {
          const features = readFeaturesFromWGS84(json.data);
          stationSourceRef.current.addFeatures(features);
          setStationCount(features.length);
          // 动态提取实际存在的品牌 (按 BRANDS 预设顺序排序, 未在预设中的排在最后)
          const brandSet = new Set<string>();
          features.forEach((f: any) => {
            const b = f.get("brand");
            if (b) brandSet.add(b);
          });
          const ordered = BRANDS.filter(b => brandSet.has(b))
            .concat(Array.from(brandSet).filter(b => !BRANDS.includes(b)));
          setAvailableBrands(ordered);
          // 同步收紧 visibleBrands, 只保留实际存在的品牌
          setVisibleBrands(prev => new Set(Array.from(prev).filter((b: string) => brandSet.has(b))));
        }
      });
  }, [currentUser]);

  // 加载小区数据
  useEffect(() => {
    if (!currentUser) return;
    fetch("/api/v1/communities")
      .then(r => r.json())
      .then(json => {
        if (json.success && communitySourceRef.current) {
          const features = readFeaturesFromWGS84(json.data);
          communitySourceRef.current.addFeatures(features);
        }
      });
  }, [currentUser]);

  // 加载反馈数据
  useEffect(() => {
    if (!currentUser) return;
    fetch("/api/v1/feedback")
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setFeedbackList(json.data.features.map((f: any) => f.properties));
          if (feedbackSourceRef.current) {
            const features = readFeaturesFromWGS84(json.data);
            feedbackSourceRef.current.addFeatures(features);
          }
        }
      });
  }, [currentUser]);

  // 加载方案列表
  useEffect(() => {
    fetch("/api/v1/schemes").then(r => r.json()).then(json => {
      if (json.success) setSchemes(json.data);
    });
  }, []);

  // 加载区域统计
  useEffect(() => {
    fetch("/api/v1/stats/regions").then(r => r.json()).then(json => {
      if (json.success) setRegionStats(json.data);
    });
  }, []);

  // =========================================================================
  // 品牌图层显示/隐藏
  // =========================================================================
  useEffect(() => {
    if (!stationSourceRef.current) return;
    stationSourceRef.current.getFeatures().forEach(f => {
      const brand = f.get("brand");
      f.setStyle(visibleBrands.has(brand) ? undefined : new Style({}));
    });
  }, [visibleBrands]);

  // 小区/反馈图层可见性已统一由上方 [activeTab, showCommunities, showFeedback] useEffect 控制

  // =========================================================================
  // 覆盖分析
  // =========================================================================
  const runCoverageAnalysis = async () => {
    setCoverageLoading(true);
    try {
      const res = await fetch("/api/v1/analysis/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeMode, radius: coverageRadius || undefined, district: coverageDistrict }),
      });
      const json = await res.json();
      if (json.success) {
        setCoverageSummary(json.data.summary);
        setCoverageResults(json.data.communityResults);
        setDistrictStats(json.data.districtStats);
        // 保存盲区聚类候选点 + 摘要, 供选址面板联动
        const clusters: BlindSpotCluster[] = json.data.blindSpotClusters || [];
        setBlindSpotClusters(clusters);
        setLastCoverageSummary(json.data.summary);
        // 提取盲区几何 (WGS84 GeoJSON Polygon), 跨 Tab 保留供 evaluate-site 联动判断
        lastCoverageBlindSpotsRef.current = (json.data.blindSpots?.features || []).map((f: any) => f.geometry);

        // 渲染服务区
        if (serviceAreaSourceRef.current) {
          serviceAreaSourceRef.current.clear();
          const saFeatures = readFeaturesFromWGS84(json.data.serviceAreas);
          serviceAreaSourceRef.current.addFeatures(saFeatures);
        }
        // 渲染盲区
        if (blindSpotSourceRef.current) {
          blindSpotSourceRef.current.clear();
          const bsFeatures = readFeaturesFromWGS84(json.data.blindSpots);
          blindSpotSourceRef.current.addFeatures(bsFeatures);
        }
        // 渲染候选点 (盲区聚类中心)
        if (clusterSourceRef.current) {
          clusterSourceRef.current.clear();
          clusters.forEach((c: BlindSpotCluster) => {
            // 后端 center 为 WGS84 [lng, lat], 转换为 GCJ02 后投影到底图
            const [gcjLng, gcjLat] = wgs84ToGcj02(c.center[0], c.center[1]);
            const feat = new Feature({ geometry: new Point(fromLonLat([gcjLng, gcjLat])) });
            feat.set("cluster", c);
            clusterSourceRef.current!.addFeature(feat);
          });
        }
      }
    } catch (e) { console.error(e); }
    setCoverageLoading(false);
  };

  // =========================================================================
  // 选址决策：放置虚拟站点 (lng/lat 为 WGS84 坐标)
  // =========================================================================
  const placeVirtualStation = (lng: number, lat: number) => {
    setVirtualStation({ lng, lat });
    if (virtualStationSourceRef.current) {
      virtualStationSourceRef.current.clear();
      // WGS84 -> GCJ02 -> EPSG:3857 投影到高德底图
      const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat);
      const feat = new Feature({ geometry: new Point(fromLonLat([gcjLng, gcjLat])) });
      virtualStationSourceRef.current.addFeature(feat);

      // 添加拖拽交互
      if (translateRef.current) {
        mapRef.current?.removeInteraction(translateRef.current);
      }
      const translate = new Translate({ features: new Collection([feat]) });
      translate.on("translating", (e) => {
        const coord = toLonLat(e.coordinate); // GCJ02
        // 转回 WGS84 传给后端
        const [wgsLng, wgsLat] = gcj02ToWgs84(coord[0], coord[1]);
        const newLng = parseFloat(wgsLng.toFixed(6));
        const newLat = parseFloat(wgsLat.toFixed(6));
        setVirtualStation({ lng: newLng, lat: newLat });
        // 防抖调用评估
        debouncedEvaluate(newLng, newLat);
      });
      mapRef.current?.addInteraction(translate);
      translateRef.current = translate;
    }
    evaluateSite(lng, lat);
  };
  // 保持 ref 指向最新的函数实现，供地图点击回调使用
  placeVirtualStationRef.current = placeVirtualStation;

  const selectSearchResult = useCallback((place: any) => {
    setSearchResult(place);
    setShowSearchDropdown(false);
    setSearchQuery(place.name);
    // 地图飞至该位置
    if (mapRef.current && place.lng && place.lat) {
      const [gcjLng, gcjLat] = wgs84ToGcj02(place.lng, place.lat);
      mapRef.current.getView().animate({
        center: fromLonLat([gcjLng, gcjLat]),
        zoom: 16,
        duration: 800,
      });
      // 添加标记
      if (searchSourceRef.current) {
        searchSourceRef.current.clear();
        const feature = new Feature({
          geometry: new Point(fromLonLat([gcjLng, gcjLat])),
        });
        feature.set("name", place.name);
        searchSourceRef.current.addFeature(feature);
      }
    }
  }, []);

  // 防抖评估
  const evaluateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedEvaluate = (lng: number, lat: number) => {
    if (evaluateTimerRef.current) clearTimeout(evaluateTimerRef.current);
    evaluateTimerRef.current = setTimeout(() => evaluateSite(lng, lat), 300);
  };

  const evaluateSite = async (lng: number, lat: number) => {
    setSiteLoading(true);
    try {
      const res = await authFetch("/api/v1/analysis/evaluate-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lng, lat, radius: siteRadiusRef.current, chargeMode: siteChargeMode,
          // 联动覆盖分析盲区几何, 后端据此返回 in_blind_spot
          coverageBlindSpots: lastCoverageBlindSpotsRef.current || [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        // 合并 in_blind_spot 进 siteMetrics (减少独立 state)
        setSiteMetrics({ ...json.data.metrics, in_blind_spot: json.data.in_blind_spot });
        setSiteInBlindSpot(json.data.in_blind_spot === true);
        // 渲染缓冲区和相交区
        if (intersectionSourceRef.current) {
          intersectionSourceRef.current.clear();
          const iFeatures = readFeaturesFromWGS84(json.data.intersections);
          intersectionSourceRef.current.addFeatures(iFeatures);
        }
      }
    } catch (e) { console.error(e); }
    setSiteLoading(false);
  };

  // 保存方案
  const saveScheme = async () => {
    if (!virtualStation || !siteMetrics) return;
    const name = schemeName || `方案${schemes.length + 1}`;
    const res = await authFetch("/api/v1/schemes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, lng: virtualStation.lng, lat: virtualStation.lat,
        radius: siteRadius, brand: siteBrand, metrics: siteMetrics,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setSchemes([...schemes, json.data]);
      setSchemeName("");
    }
  };

  // =========================================================================
  // 充电站悬浮窗: 加载该站点的反馈列表
  // =========================================================================
  const loadStationFeedback = async (stationId: number) => {
    setStationFeedbackLoading(true);
    try {
      const res = await fetch(`/api/v1/feedback/by-station/${stationId}`);
      const json = await res.json();
      if (json.success) {
        setStationFeedback(json.data || []);
      }
    } catch (e) {
      setStationFeedback([]);
    } finally {
      setStationFeedbackLoading(false);
    }
  };

  // =========================================================================
  // 充电站悬浮窗: 提交对该站点的评价反馈
  // =========================================================================
  const submitStationFeedback = async () => {
    if (!selectedStation || !stationFeedbackForm.description) return;
    setSubmittingStationFeedback(true);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: stationFeedbackForm.type,
          lng: selectedStation.lng,
          lat: selectedStation.lat,
          stationId: selectedStation.id,
          description: stationFeedbackForm.description,
          rating: stationFeedbackForm.rating,
          submitter: currentUser?.username || "匿名用户",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStationFeedbackForm({ description: "", rating: 5, type: "evaluation" });
        // 重新加载该站点反馈
        await loadStationFeedback(selectedStation.id);
        // 同时刷新全局反馈图层
        fetch("/api/v1/feedback").then(r => r.json()).then(j => {
          if (j.success && feedbackSourceRef.current) {
            feedbackSourceRef.current.clear();
            feedbackSourceRef.current.addFeatures(readFeaturesFromWGS84(j.data));
          }
        });
        // 显示审核结果提示 (违禁词驳回时提醒用户)
        if (json.data?.status === "rejected") {
          alert(json.message || "反馈包含违禁内容，已被系统自动驳回");
        }
      } else {
        alert(json.message || "提交失败");
      }
    } finally {
      setSubmittingStationFeedback(false);
    }
  };

  // =========================================================================
  // AI 对话 (SSE 流式，支持多轮上下文、停止、重新生成、复制、清空)
  // =========================================================================
  const aiStoppedRef = useRef(false);

  const scrollAiToBottom = () => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const resizeAiInput = () => {
    const el = aiInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    resizeAiInput();
  }, [aiInput]);

  useEffect(() => {
    scrollAiToBottom();
  }, [aiMessages, aiStreaming]);

  const doAiChat = async (baseMessages: { role: "user" | "assistant"; content: string }[], userText: string) => {
    setAiStreaming(true);
    setAiMessages([...baseMessages, { role: "assistant", content: "" }]);

    try {
      const context = userLocation
        ? `用户当前位置 (WGS84): 经度 ${userLocation.lng.toFixed(6)}, 纬度 ${userLocation.lat.toFixed(6)}`
        : undefined;
      const controller = new AbortController();
      aiAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const history = baseMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          context,
          history,
          userLocation: userLocation ? { lng: userLocation.lng, lat: userLocation.lat } : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.gisResult) {
                setAiMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    gisResult: data.gisResult,
                  };
                  return updated;
                });
                gisResultRef.current = {
                  stations: data.gisResult.stations.map((s: any) => s.id),
                  communities: [],
                  center: data.gisResult.center,
                  radius: data.gisResult.radius,
                };
              }
              if (data.content) {
                setAiMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    role: "assistant",
                    content: updated[updated.length - 1].content + data.content,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        if (aiStoppedRef.current) {
          aiStoppedRef.current = false;
          setAiStreaming(false);
          return;
        }
        setAiMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "⚠️ 请求超时，AI 服务响应较慢，请稍后再试。" };
          return updated;
        });
      } else {
        console.error(e);
        setAiMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "⚠️ AI 服务暂时不可用，请稍后重试。(" + (e?.message || "连接异常") + ")" };
          return updated;
        });
      }
    }
    setAiStreaming(false);
    aiAbortRef.current = null;
  };

  const sendAiMessage = async () => {
    const text = aiInput.trim();
    if (!text || aiStreaming) return;
    setAiInput("");
    if (aiInputRef.current) aiInputRef.current.style.height = "auto";
    const baseMessages = [...aiMessages, { role: "user" as const, content: text }];
    await doAiChat(baseMessages, text);
  };

  const stopAi = () => {
    if (aiAbortRef.current) {
      aiStoppedRef.current = true;
      aiAbortRef.current.abort();
    }
  };

  const regenerateAi = async () => {
    if (aiStreaming) return;
    const lastUserIndex = aiMessages
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter(i => i >= 0)
      .pop();
    if (lastUserIndex === undefined) return;
    const text = aiMessages[lastUserIndex].content;
    const baseMessages = aiMessages.slice(0, lastUserIndex + 1);
    await doAiChat(baseMessages, text);
  };

  const clearAi = () => {
    setAiMessages([]);
    setAiInput("");
    if (aiInputRef.current) aiInputRef.current.style.height = "auto";
  };

  const copyAi = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore
    }
  };

  // =========================================================================
  // 用户定位与导航
  // =========================================================================
  // 在地图上标记用户位置并飞行
  const applyUserLocation = useCallback((loc: { lng: number; lat: number; accuracy?: number }) => {
    setUserLocation(loc);
    if (userLocationSourceRef.current) {
      userLocationSourceRef.current.clear();
      const [gcjLng, gcjLat] = wgs84ToGcj02(loc.lng, loc.lat);
      const feat = new Feature({
        geometry: new Point(fromLonLat([gcjLng, gcjLat])),
        name: "我的位置",
        _type: "userLocation",
      });
      userLocationSourceRef.current.addFeature(feat);
    }
    if (mapRef.current) {
      const [gcjLng, gcjLat] = wgs84ToGcj02(loc.lng, loc.lat);
      mapRef.current.getView().animate({
        center: fromLonLat([gcjLng, gcjLat]),
        zoom: 16,
        duration: 800,
      });
    }
  }, []);

  // 获取用户当前位置 (使用浏览器原生 Geolocation API)
  const locateUser = async () => {
    setLocating(true);
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError("您的浏览器不支持地理定位");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lng: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy };
        applyUserLocation(loc);
        setLocating(false);
      },
      (err) => {
        const msg = err.code === 1 ? "定位权限被拒绝，请在浏览器设置中允许" :
                    err.code === 2 ? "无法获取位置信息" :
                    err.code === 3 ? "定位超时，请重试" : "定位失败";
        setLocateError(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // 绘制导航路线 (用户位置 -> 目标充电站，后端调用高德驾车路径规划 API)
  const drawRoute = async (targetStation: any) => {
    if (!userLocation) {
      alert("请先点击地图右上角的定位按钮获取您的位置");
      return;
    }
    if (!targetStation || !targetStation.lng || !targetStation.lat) return;
    setRouteLoading(true);
    try {
      const res = await fetch(
        `/api/v1/route?fromLng=${userLocation.lng}&fromLat=${userLocation.lat}&toLng=${targetStation.lng}&toLat=${targetStation.lat}`
      );
      const json = await res.json();
      if (!json.success || !json.data?.path?.length) {
        throw new Error(json.message || "路线规划失败");
      }
      const { path, distance, duration, steps } = json.data;
      const coords3857 = path.map((p: [number, number]) => fromLonLat(p));
      if (routeSourceRef.current) {
        routeSourceRef.current.clear();
        routeSourceRef.current.addFeature(new Feature({ geometry: new LineString(coords3857) }));
      }
      setRouteInfo({ distance, duration: Math.round(duration / 60), targetName: targetStation.name, steps: steps || [] });
      if (mapRef.current && routeSourceRef.current) {
        const extent = routeSourceRef.current.getExtent();
        mapRef.current.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 600 });
      }
    } catch (e: any) {
      alert("高德驾车导航失败: " + (e.message || "无法获取真实驾车路线"));
      clearRoute();
    }
    setRouteLoading(false);
  };

  // 清除导航路线
  const clearRoute = () => {
    if (routeSourceRef.current) routeSourceRef.current.clear();
    setRouteInfo(null);
  };

  // =========================================================================
  // ECharts: 覆盖分析看板
  // =========================================================================
  useEffect(() => {
    if (!coverageChartRef.current || districtStats.length === 0) return;
    const chart = echarts.init(coverageChartRef.current);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { data: ["已覆盖", "盲区"], textStyle: { color: "#6B7280" }, top: 0 },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "category", data: districtStats.map(d => d.district), axisLabel: { color: "#6B7280" } },
      yAxis: { type: "value", axisLabel: { color: "#9CA3AF" }, splitLine: { lineStyle: { color: "#E5E7EB" } } },
      series: [
        { name: "已覆盖", type: "bar", stack: "total", data: districtStats.map(d => d.covered), itemStyle: { color: "#00C896" } },
        { name: "盲区", type: "bar", stack: "total", data: districtStats.map(d => d.blindSpot), itemStyle: { color: "#F56C6C" } },
      ],
    });
    return () => chart.dispose();
  }, [districtStats]);

  // ECharts: 选址评估实时指标
  useEffect(() => {
    if (!siteChartRef.current || !siteMetrics) return;
    const chart = echarts.init(siteChartRef.current);
    chart.setOption({
      backgroundColor: "transparent",
      series: [{
        type: "gauge", radius: "90%",
        progress: { show: true, width: 12 },
        axisLine: { lineStyle: { width: 12, color: [[0.3, "#F56C6C"], [0.7, "#E6A23C"], [1, "#00C896"]] } },
        detail: { valueAnimation: true, formatter: "{value}", color: "#1F2937", fontSize: 20 },
        title: { color: "#6B7280", fontSize: 11 },
        data: [
          { value: siteMetrics.social_benefit, name: "社会效益评分" },
        ],
      }],
    });
    return () => chart.dispose();
  }, [siteMetrics]);

  // ECharts: 方案雷达图对比
  useEffect(() => {
    if (!radarChartRef.current || compareSchemes.length < 2) return;
    const s1 = schemes.find(s => s.id === compareSchemes[0]);
    const s2 = schemes.find(s => s.id === compareSchemes[1]);
    if (!s1 || !s2) return;
    const chart = echarts.init(radarChartRef.current);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {},
      legend: { data: [s1.name, s2.name], textStyle: { color: "#6B7280" }, bottom: 0 },
      radar: {
        indicator: [
          { name: "覆盖人口", max: 20000 },
          { name: "盲区消除率", max: 100 },
          { name: "竞争避让度", max: 100 },
          { name: "社会效益", max: 100 },
          { name: "覆盖社区数", max: 10 },
        ],
        axisName: { color: "#6B7280", fontSize: 11 },
        splitLine: { lineStyle: { color: "#E5E7EB" } },
        splitArea: { areaStyle: { color: ["#F5F7FA", "#FFFFFF"] } },
      },
      series: [{
        type: "radar",
        data: [
          { value: [s1.covered_population, s1.blind_spot_reduction, s1.competition_score, s1.social_benefit, s1.covered_communities], name: s1.name, itemStyle: { color: "#00C896" }, areaStyle: { color: "rgba(0,200,150,0.2)" } },
          { value: [s2.covered_population, s2.blind_spot_reduction, s2.competition_score, s2.social_benefit, s2.covered_communities], name: s2.name, itemStyle: { color: "#38BDF8" }, areaStyle: { color: "rgba(56,189,248,0.2)" } },
        ],
      }],
    });
    return () => chart.dispose();
  }, [compareSchemes, schemes]);

  const asArray = (value: any) => Array.isArray(value) ? value : [];
  const safeText = (value: any) => String(value ?? "");

  const normalizeStations = (data: any) => {
    if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
      return data.features.map((f: any) => ({ ...(f.properties || {}), id: f.id || f.properties?.id }));
    }
    return asArray(data);
  };

  // 加载管理数据 (管理员专用)
  const loadAdminData = useCallback(() => {
    if (!authToken) return;

    authFetch("/api/v1/users")
      .then(r => r.json())
      .then(j => setUsers(j.success ? asArray(j.data) : []))
      .catch(() => setUsers([]));

    authFetch("/api/v1/logs")
      .then(r => r.json())
      .then(j => setLogs(j.success ? asArray(j.data) : []))
      .catch(() => setLogs([]));

    authFetch("/api/v1/stations")
      .then(r => r.json())
      .then(j => setAdminStations(j.success ? normalizeStations(j.data) : []))
      .catch(() => setAdminStations([]));

    authFetch("/api/v1/feedback/all")
      .then(r => r.json())
      .then(j => setAdminFeedback(j.success ? asArray(j.data) : []))
      .catch(() => setAdminFeedback([]));

    authFetch("/api/v1/schemes")
      .then(r => r.json())
      .then(j => setAdminSchemes(j.success ? asArray(j.data) : []))
      .catch(() => setAdminSchemes([]));
  }, [authToken]);

  useEffect(() => {
    if (activeTab === "admin" && authToken) {
      loadAdminData();
    }
  }, [activeTab, authToken, loadAdminData]);

  // =========================================================================
  // 渲染
  // =========================================================================
  const tabIcons: Record<string, any> = { Map: MapIcon, Radar, Target, MessageSquare, Bot, Settings };

  // 所有子系统定义
  const allTabs = [
    { id: "map" as const, label: "地图查询", icon: MapIcon },
    { id: "coverage" as const, label: "覆盖分析", icon: Radar },
    { id: "site" as const, label: "选址决策", icon: Target },
    { id: "admin" as const, label: "系统管理", icon: Settings },
  ];
  // 根据角色过滤可见 Tab
  const visibleTabs = allTabs.filter(t => allowedTabs.includes(t.id));

  // -------------------------------------------------------------------------
  // 登录页面
  // -------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #134E4A 100%)" }}>
        {/* 径向光晕装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(0,200,150,0.15)" }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(56,189,248,0.12)" }}></div>
        </div>

        <div className="relative w-full max-w-[420px]">
          {/* Logo + 品牌名 */}
          <div className="text-center mb-6">
            <div className="inline-flex p-2.5 rounded-2xl shadow-lg mb-3"
              style={{ background: "linear-gradient(135deg, #00C896 0%, #38BDF8 100%)" }}>
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-[28px] font-semibold bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #00C896 0%, #38BDF8 100%)" }}>GeoPlan</h1>
            <p className="text-[13px] text-slate-400 mt-1"></p>
          </div>

          {/* 登录卡片 */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: "#00C896" }} /> 用户登录
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[13px] text-slate-600 font-medium block mb-1.5">用户名</label>
                <input type="text" value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="请输入用户名"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  style={{ borderRadius: "4px" }}
                  onFocus={(e) => { e.target.style.borderColor = "#00C896"; e.target.style.boxShadow = "0 0 0 2px rgba(0,200,150,0.2)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="text-[13px] text-slate-600 font-medium block mb-1.5">密码</label>
                <input type="password" value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="请输入密码"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  style={{ borderRadius: "4px" }}
                  onFocus={(e) => { e.target.style.borderColor = "#00C896"; e.target.style.boxShadow = "0 0 0 2px rgba(0,200,150,0.2)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {loginError && (
                <div className="text-[12px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {loginError}
                </div>
              )}

              <button onClick={handleLogin} disabled={loginLoading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #00C896 0%, #4FD4B1 100%)", borderRadius: "4px" }}
                onMouseEnter={(e) => { if (!loginLoading) e.currentTarget.style.background = "linear-gradient(90deg, #4FD4B1 0%, #00C896 100%)"; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(90deg, #00C896 0%, #4FD4B1 100%)"; e.currentTarget.style.transform = "scale(1)"; }}
              >
                {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 rotate-180" />}
                {loginLoading ? "登录中..." : "登录系统"}
              </button>
            </div>

            {/* 演示账号快捷登录 */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[12px] text-slate-500 font-medium mb-2.5">演示账号 (点击快速填充)</p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map(acc => {
                  const cfg = ROLE_CONFIG[acc.role];
                  return (
                    <button key={acc.username} onClick={() => fillDemoAccount(acc.username, acc.password)}
                      className="w-full flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 text-left transition-all">
                      <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }}></span>
                      <div className="flex-1">
                        <p className="text-[13px] text-slate-700 font-semibold">{acc.username}</p>
                        <p className="text-[11px] text-slate-400">{cfg.desc}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ background: cfg.color + "15", color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex font-sans overflow-hidden" style={{ background: "#F5F7FA" }}>
      {/* 侧边栏收纳按钮呼吸动画 + AI高亮呼吸动画 */}
      <style>{`
        @keyframes sidebarPulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 6px rgba(56,189,248,0.15); }
          50% { box-shadow: 0 2px 12px rgba(0,0,0,0.4), 0 0 12px rgba(56,189,248,0.35); }
        }
        @keyframes aiHighlightPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        .ai-station-overlay {
          position: absolute !important;
          background: transparent;
          pointer-events: none;
          z-index: 10;
        }
        .ai-station-overlay::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid white;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
        }
      `}</style>
      {/* ===== 侧边栏 (可折叠) ===== */}
      <aside className={`${sidebarCollapsed ? "w-[64px]" : "w-[220px]"} shrink-0 flex flex-col text-slate-300 relative overflow-hidden`}
        style={{
          background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
          transition: `width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}>
        {/* Logo 区 */}
        <div className="flex items-center"
          style={{
            height: sidebarCollapsed ? "auto" : "60px",
            paddingTop: sidebarCollapsed ? "16px" : 0,
            paddingBottom: sidebarCollapsed ? "4px" : 0,
            paddingLeft: sidebarCollapsed ? "12px" : "20px",
            paddingRight: sidebarCollapsed ? "12px" : "16px",
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
            borderBottom: sidebarCollapsed ? "none" : "1px solid rgba(255,255,255,0.05)",
            transition: "padding 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            position: "relative",
          }}>
          {/* 图标 */}
          <div onClick={sidebarCollapsed ? toggleSidebar : undefined}
            onMouseEnter={() => { if (sidebarCollapsed) { const el = document.getElementById("sidebar-icon"); if (el) el.style.transform = "scale(1.1)"; } }}
            onMouseLeave={() => { if (sidebarCollapsed) { const el = document.getElementById("sidebar-icon"); if (el) el.style.transform = "scale(1)"; } }}
            className="p-1.5 rounded-lg shadow-lg cursor-pointer transition-transform duration-300 shrink-0"
            id="sidebar-icon"
            style={{
              background: "linear-gradient(135deg, #00C896 0%, #38BDF8 100%)",
              transition: sidebarCollapsed ? "transform 0.3s ease, box-shadow 0.3s ease" : "none",
              boxShadow: sidebarCollapsed ? "0 4px 15px rgba(0,200,150,0.3)" : "0 4px 6px rgba(0,0,0,0.3)",
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title={sidebarCollapsed ? "展开侧边栏" : "GeoPlan"}>
            <Zap className="text-white" style={{ width: 20, height: 20 }} />
          </div>
          {/* GeoPlan 标题 */}
          <div style={{
            marginLeft: "12px",
            flex: 1,
            opacity: sidebarCollapsed ? 0 : 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            transition: "opacity 0.35s ease, width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            width: sidebarCollapsed ? 0 : "auto",
            pointerEvents: sidebarCollapsed ? "none" : "auto",
          }}>
            <span className="text-[18px] font-semibold bg-clip-text text-transparent whitespace-nowrap"
              style={{ backgroundImage: "linear-gradient(90deg, #00C896 0%, #38BDF8 100%)" }}>GeoPlan</span>
            <p className="text-[10px] text-slate-500 whitespace-nowrap">充电设施规划平台</p>
          </div>
          {/* 收纳按钮 - 在文字最右侧，吸入到图标中心 */}
          <button onClick={toggleSidebar}
            style={{
              position: "absolute",
              top: "50%",
              left: sidebarCollapsed ? "50%" : "calc(100% - 26px)",
              transform: `translate(-50%, -50%) scale(${sidebarCollapsed ? 0 : 1})`,
              opacity: sidebarCollapsed ? 0 : 1,
              pointerEvents: sidebarCollapsed ? "none" : "auto",
              transition: "left 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
              width: 20, height: 20,
              borderRadius: "50%",
              border: "1px solid rgba(71,85,105,0.8)",
              background: "linear-gradient(135deg, #334155, #1E293B)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3), 0 0 6px rgba(56,189,248,0.15)",
              animation: sidebarCollapsed ? "none" : "sidebarPulse 2.5s ease-in-out infinite",
            }}
            title="收起侧边栏">
            <ChevronLeft style={{ width: 12, height: 12, color: "white" }} />
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <p className="text-[10px] text-slate-500 font-bold uppercase px-2 mb-2 tracking-wider">功能菜单</p>
          )}
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                title={sidebarCollapsed ? tab.label : undefined}
                className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3"} py-2 rounded-lg text-[13px] font-medium transition-all ${
                  active ? "text-white" : "text-slate-400 hover:text-slate-800 hover:bg-white/5"
                }`}
                style={active ? { background: "rgba(0,200,150,0.12)", color: "#4FD4B1" } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* 底部: 数据库状态 + 用户信息 */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-1.5"} text-[11px] text-slate-500 ${sidebarCollapsed ? "px-0" : "px-2"}`}>
            <Database className="w-3.5 h-3.5 shrink-0" style={{ color: "#00C896" }} />
            {!sidebarCollapsed && <span>MySQL · 在线</span>}
          </div>
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center px-1" : "gap-2 px-2"} py-2 rounded-lg bg-white/5`}>
            <UserIcon className="w-4 h-4 shrink-0" style={{ color: ROLE_CONFIG[currentUser.role].color }} />
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 leading-tight min-w-0">
                  <p className="text-[12px] text-white font-semibold truncate">{currentUser.username}</p>
                  <p className="text-[10px] truncate" style={{ color: ROLE_CONFIG[currentUser.role].color }}>{ROLE_CONFIG[currentUser.role].label}</p>
                </div>
                <button onClick={handleLogout} title="退出登录"
                  className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ===== 右侧主区域 ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 头部 (60px, 白色) */}
        <header className="h-[60px] shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-5 z-30"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-semibold text-slate-800">
              {visibleTabs.find(t => t.id === activeTab)?.label || "GeoPlan"}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono"
              style={{ background: "rgba(0,200,150,0.1)", color: "#00A078", border: "1px solid rgba(0,200,150,0.25)" }}>
              徐州·v1.0
            </span>
          </div>
          <p className="text-[12px] text-slate-400 hidden md:block"></p>
        </header>

        {/* 内容区域 (垂直功能栏 + 水平分析栏 + 地图) */}
        <div className="flex-1 flex min-w-0 overflow-hidden" style={{ background: "#F5F7FA" }}>
          {/* ===== 垂直功能栏: 地图展示与查询 (仅地图 Tab, 紧邻左侧 Tab 侧边栏, 可收起) ===== */}
          {activeTab === "map" && (
            <aside
              className="shrink-0 bg-white border-r border-slate-200 overflow-y-auto transition-all duration-300 flex flex-col"
              style={{ width: mapPanelCollapsed ? 14 : 280 }}
            >
              {mapPanelCollapsed ? (
                <button
                  onClick={() => setMapPanelCollapsed(false)}
                  className="w-full h-10 flex items-center justify-center hover:bg-slate-50"
                  title="展开功能栏"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ) : (
                <>
                  <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-slate-200 sticky top-0 bg-white z-10">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapIcon className="w-4 h-4 text-blue-500" /> 图层控制与查询
                    </h3>
                    <button
                      onClick={() => setMapPanelCollapsed(true)}
                      className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 transition-colors"
                      title="收起功能栏"
                    >
                      <ChevronLeft className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                  <div className="p-3 space-y-3">
                    {/* 地点搜索 */}
                    <div className="relative">
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-[#A855F7] focus-within:ring-1 focus-within:ring-purple-200 transition-all">
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                          placeholder="搜索地名、地址、POI..."
                          className="flex-1 text-xs bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 py-0.5" />
                        {searching && <Loader2 className="w-3 h-3 text-purple-400 animate-spin shrink-0" />}
                        {searchQuery && !searching && (
                          <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowSearchDropdown(false); setSearchResult(null); if (searchSourceRef.current) searchSourceRef.current.clear(); }}
                            className="text-slate-300 hover:text-slate-500 shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {/* 搜索结果下拉 */}
                      {showSearchDropdown && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                          {searchResults.map((r, i) => (
                            <button key={i} onClick={() => selectSearchResult(r)}
                              className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b border-slate-100 last:border-b-0 transition-colors">
                              <p className="text-xs font-medium text-slate-700">{r.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{r.address || r.district}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {showSearchDropdown && !searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3 text-center text-xs text-slate-400">
                          未找到匹配地点
                        </div>
                      )}
                    </div>
                    {/* 品牌图层 */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500 font-bold uppercase">充电站品牌图层</p>
                      {availableBrands.map(brand => (
                        <label key={brand} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                          <input type="checkbox" checked={visibleBrands.has(brand)}
                            onChange={(e) => {
                              const next = new Set(visibleBrands);
                              e.target.checked ? next.add(brand) : next.delete(brand);
                              setVisibleBrands(next);
                            }}
                            className="accent-blue-500" />
                          <span className="w-3 h-3 rounded-full" style={{ background: BRAND_CONFIG[brand].color }}></span>
                          <span className="text-slate-700">{BRAND_CONFIG[brand].label}</span>
                        </label>
                      ))}
                    </div>
                    {/* 小区 / 反馈图层 */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                        <input type="checkbox" checked={showCommunities} onChange={(e) => setShowCommunities(e.target.checked)} className="accent-blue-500" />
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-slate-700">住宅小区面图层</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded">
                        <input type="checkbox" checked={showFeedback} onChange={(e) => setShowFeedback(e.target.checked)} className="accent-blue-500" />
                        <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-slate-700">公众反馈点</span>
                      </label>
                    </div>
                    {/* 区域统计 */}
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1.5">区域统计</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {regionStats.map(r => (
                          <div key={r.district} className="bg-slate-50 border border-slate-200 rounded p-1.5">
                            <p className="text-[11px] text-slate-500">{r.district}</p>
                            <p className="text-base font-bold text-blue-400">{r.stations || 0} <span className="text-[11px] text-slate-500">站</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </aside>
          )}

          {/* ===== 主列: 水平分析栏 + 地图 ===== */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* ===== 水平分析栏 (选址决策 / 覆盖分析, 按当前 Tab 单独显示) ===== */}
            {(activeTab === "site" || activeTab === "coverage") && (
              <div className="shrink-0 h-40 bg-white border-b border-slate-200 flex gap-0 overflow-x-auto">
                {/* 选址决策 (仅选址 Tab) */}
                {activeTab === "site" && (
                <div className="flex-1 min-w-[420px] p-2 overflow-y-auto">
                  {/* 标题栏 */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Target className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-slate-800">选址决策</span>
                    <span className="text-[11px] text-slate-400">点击地图放置虚拟站点, 拖拽调整位置</span>
                  </div>
                  {/* 参数控件区 */}
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    {/* 服务半径 */}
                    <div className="flex items-center gap-1.5 min-w-[170px]">
                      <span className="text-slate-500">服务半径</span>
                      <input type="range" min="300" max="1500" step="50" value={siteRadius}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setSiteRadius(v);
                          siteRadiusRef.current = v;
                          if (virtualStation) evaluateSite(virtualStation.lng, virtualStation.lat);
                        }}
                        className="flex-1 accent-amber-500" />
                      <span className="font-mono text-blue-500 text-xs">{siteRadius}m</span>
                    </div>
                    {/* 充电模式 (琥珀色分段控件) */}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">充电模式</span>
                      <div className="flex gap-1">
                        <button onClick={() => setSiteChargeMode("fast")}
                          className={`h-8 px-3 rounded-md text-xs ${siteChargeMode === "fast" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}>快充</button>
                        <button onClick={() => setSiteChargeMode("slow")}
                          className={`h-8 px-3 rounded-md text-xs ${siteChargeMode === "slow" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}>慢充</button>
                      </div>
                    </div>
                    {/* 拟建品牌 */}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">拟建品牌</span>
                      <select value={siteBrand} onChange={(e) => setSiteBrand(e.target.value)}
                        className="h-8 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-700 outline-none">
                        {(availableBrands.length ? availableBrands : BRANDS).map(b => (
                          <option key={b} value={b}>{BRAND_CONFIG[b]?.label || b}</option>
                        ))}
                      </select>
                    </div>
                    {/* 保存方案 (仅虚拟站点存在时显示) */}
                    {virtualStation && (
                      <div className="flex items-center gap-1">
                        <input type="text" value={schemeName} onChange={(e) => setSchemeName(e.target.value)}
                          placeholder="方案名称" className="h-8 w-28 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-700" />
                        <button onClick={saveScheme} className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 rounded-md flex items-center gap-1">
                          <Save className="w-3 h-3" /> 保存方案
                        </button>
                      </div>
                    )}
                  </div>
                  {/* 指标卡 4 格 + 盲区联动 */}
                  {siteMetrics && (
                    <>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div className="relative bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                          <p className="text-[11px] text-emerald-700">覆盖人口</p>
                          <p className="text-lg font-bold text-emerald-600">{siteMetrics.covered_population.toLocaleString()}</p>
                        </div>
                        <div className="relative bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                          <p className="text-[11px] text-blue-700">覆盖社区</p>
                          <p className="text-lg font-bold text-blue-600">{siteMetrics.covered_communities}</p>
                        </div>
                        <div className="relative bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                          <p className="text-[11px] text-amber-700">避让度</p>
                          <p className="text-lg font-bold text-amber-600">{siteMetrics.competition_score}</p>
                        </div>
                        <div className="relative bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                          <p className="text-[11px] text-purple-700">效益</p>
                          <p className="text-lg font-bold text-purple-600">{siteMetrics.social_benefit}</p>
                        </div>
                      </div>
                      {/* 盲区联动: 选址落在盲区时高亮提示 */}
                      {siteInBlindSpot && (
                        <div className="mt-2 bg-amber-50 border border-amber-300 text-amber-700 rounded-md px-3 py-1 text-xs flex items-center gap-1">
                          <Target className="w-3.5 h-3.5" /> 该选址将消除盲区
                        </div>
                      )}
                      {/* 当前区域盲区概况 (来自覆盖分析) */}
                      {lastCoverageSummary && (
                        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-2">
                          <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                            <Radar className="w-3 h-3 text-blue-500" /> 当前区域盲区概况
                            <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">来自覆盖分析</span>
                          </p>
                          <div className="grid grid-cols-3 gap-2 mt-1 text-center">
                            <div><p className="text-[10px] text-slate-500">覆盖率</p><p className="text-sm font-bold text-green-500">{lastCoverageSummary.coverageRate}%</p></div>
                            <div><p className="text-[10px] text-slate-500">盲区社区</p><p className="text-sm font-bold text-red-400">{lastCoverageSummary.blindSpotCommunities}</p></div>
                            <div><p className="text-[10px] text-slate-500">盲区人口</p><p className="text-sm font-bold text-orange-400">{lastCoverageSummary.blindSpotPopulation.toLocaleString()}</p></div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* 已保存方案 (紧凑列表, 点击切换对比) */}
                  {schemes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] text-slate-500 font-bold">已保存方案 ({schemes.length}) · 点击对比</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {schemes.map(s => (
                          <button key={s.id} onClick={() => setCompareSchemes(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : prev.length < 2 ? [...prev, s.id] : [prev[1], s.id])}
                            className={`text-xs px-2 py-1 rounded-md border ${compareSchemes.includes(s.id) ? "bg-amber-50 border-amber-400 text-amber-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* 覆盖分析 (仅覆盖分析 Tab) */}
                {activeTab === "coverage" && (
                <div className="flex-1 min-w-[420px] p-2 overflow-y-auto">
                  {/* 标题栏 */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Radar className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-slate-800">覆盖分析</span>
                    <span className="text-[11px] text-slate-400">分析充电服务覆盖范围与盲区分布</span>
                  </div>
                  {/* 参数控件区 */}
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    {/* 充电模式 (蓝色分段控件) */}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">充电模式</span>
                      <div className="flex gap-1">
                        <button onClick={() => setChargeMode("fast")}
                          className={`h-8 px-3 rounded-md text-xs ${chargeMode === "fast" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"}`}>快充</button>
                        <button onClick={() => setChargeMode("slow")}
                          className={`h-8 px-3 rounded-md text-xs ${chargeMode === "slow" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"}`}>慢充</button>
                      </div>
                    </div>
                    {/* 自定义半径 */}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">自定义半径</span>
                      <input type="number" min={300} max={2000} step={50} value={coverageRadius || ""}
                        onChange={(e) => setCoverageRadius(Math.max(0, Math.min(2000, parseInt(e.target.value) || 0)))}
                        placeholder="预设"
                        className="h-8 w-20 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-700" />
                      <button onClick={() => setCoverageRadius(0)}
                        className="text-[11px] text-slate-400 hover:text-slate-600 underline">预设</button>
                    </div>
                    {/* 行政区筛选 */}
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">行政区</span>
                      <select value={coverageDistrict} onChange={(e) => setCoverageDistrict(e.target.value)}
                        className="h-8 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-700 outline-none">
                        <option value="all">全部行政区</option>
                        {[...new Set(regionStats.map(r => r.district))].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    {/* 开始分析 */}
                    <button onClick={runCoverageAnalysis} disabled={coverageLoading}
                      className={`h-8 px-4 rounded-md text-xs font-bold flex items-center gap-1 ${coverageLoading ? "bg-slate-300 text-slate-500" : "bg-emerald-500 hover:bg-emerald-600 text-white"}`}>
                      {coverageLoading ? <><RefreshCw className="w-3 h-3 animate-spin" /> 分析中</> : <><Radar className="w-3 h-3" /> 开始分析</>}
                    </button>
                  </div>
                  {/* 分析摘要 4 格渐变指标卡 */}
                  {coverageSummary && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div className="relative bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                        <p className="text-[11px] text-green-700">覆盖率</p>
                        <p className="text-lg font-bold text-green-600">{coverageSummary.coverageRate}%</p>
                      </div>
                      <div className="relative bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                        <p className="text-[11px] text-red-700">盲区社区</p>
                        <p className="text-lg font-bold text-red-600">{coverageSummary.blindSpotCommunities}</p>
                      </div>
                      <div className="relative bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
                        <p className="text-[11px] text-orange-700">盲区人口</p>
                        <p className="text-lg font-bold text-orange-600">{coverageSummary.blindSpotPopulation.toLocaleString()}</p>
                      </div>
                      <div className="relative bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-md pl-3 pr-2 py-1.5 overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                        <p className="text-[11px] text-blue-700">充电站</p>
                        <p className="text-lg font-bold text-blue-600">{coverageSummary.totalStations}</p>
                      </div>
                    </div>
                  )}
                  {/* 推荐选址候选点列表 (Top 5) */}
                  {blindSpotClusters.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" /> 推荐选址候选点 (Top 5) · 点击"在此选址"跳转
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {blindSpotClusters.slice(0, 5).map(c => (
                          <div key={c.clusterId} className="bg-amber-50 border border-amber-200 rounded-md px-2 py-1 flex items-center gap-2">
                            <div className="text-xs">
                              <span className="font-bold text-amber-700">#{c.clusterId}</span>
                              <span className="text-slate-500 ml-1">{c.communityCount}社区</span>
                              <span className="text-orange-500 ml-1 font-bold">{c.population.toLocaleString()}人</span>
                            </div>
                            <button onClick={() => { setActiveTab("site"); placeVirtualStation(c.center[0], c.center[1]); }}
                              className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] px-2 py-0.5 rounded">在此选址</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}

            {/* ===== 地图容器 (OpenLayers 挂载点, 保持 absolute inset-0) ===== */}
            <div className="flex-1 relative overflow-hidden">
              {/* 地图 */}
              <div ref={mapContainerRef} className="absolute inset-0 w-full h-full"
                style={{ zIndex: 0, display: activeTab === "admin" ? "none" : "block" }} />

              {/* 候选点选中弹窗 (地图右上角, 点击候选点时显示) */}
              {selectedCluster && (
                <div className="absolute top-3 right-3 z-[5] bg-white rounded-lg shadow-xl border border-amber-200 w-[220px] overflow-hidden pointer-events-auto"
                  onClick={e => e.stopPropagation()}>
                  <div className="px-3 py-2" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)" }}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-bold text-white">候选点 #{selectedCluster.clusterId}</span>
                      <button onClick={() => setSelectedCluster(null)}
                        className="ml-auto w-4 h-4 rounded-full bg-white/25 hover:bg-white/45 flex items-center justify-center text-white text-[10px]">✕</button>
                    </div>
                  </div>
                  <div className="px-3 py-2 space-y-1 text-[11px] text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">覆盖社区</span>
                      <span className="font-bold text-blue-500">{selectedCluster.communityCount} 个</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">盲区人口</span>
                      <span className="font-bold text-orange-500">{selectedCluster.population.toLocaleString()} 人</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">坐标 (WGS84)</span>
                      <span className="font-mono text-slate-600">{selectedCluster.center[0].toFixed(4)}, {selectedCluster.center[1].toFixed(4)}</span>
                    </div>
                    <button
                      onClick={() => {
                        // 跳转选址 Tab 并在该候选点放置虚拟站点
                        setActiveTab("site");
                        placeVirtualStation(selectedCluster.center[0], selectedCluster.center[1]);
                        setSelectedCluster(null);
                      }}
                      className="w-full mt-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-1.5 rounded-md flex items-center justify-center gap-1">
                      <Target className="w-3 h-3" /> 在此选址
                    </button>
                  </div>
                </div>
              )}

          {/* AI 站点详情 Overlay（由 OpenLayers Overlay 控制定位，在站点上方显示） */}
          <div id="ai-station-overlay" className="ai-station-overlay">
            {aiStationDetail && (
              <div className="bg-white rounded-xl shadow-2xl w-[260px] overflow-hidden pointer-events-auto"
                onClick={e => e.stopPropagation()}>
                <div className="relative px-3 py-2.5" style={{ background: `linear-gradient(135deg, ${BRAND_CONFIG[aiStationDetail.brand]?.color || "#00C896"} 0%, #38BDF8 100%)` }}>
                  <button onClick={closeAiStationDetail} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-[10px]">✕</button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{BRAND_CONFIG[aiStationDetail.brand]?.icon || "⚡"}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-white truncate">{aiStationDetail.name}</h3>
                      <p className="text-[10px] text-white/75">{aiStationDetail.brand} · {aiStationDetail.district}</p>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 space-y-1.5 text-[11px] text-slate-700">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{aiStationDetail.address || "暂无地址"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>快充{aiStationDetail.fastChargers || 0}</span>
                    <span className="text-slate-300">|</span>
                    <span>慢充{aiStationDetail.slowChargers || 0}</span>
                  </div>
                  {aiStationDetail.distanceKm != null && (
                    <div className="flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-[#00C896] shrink-0" />
                      <span className="text-[#00C896] font-medium">距您 {aiStationDetail.distanceKm} km</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 充电站详情模态框 (屏幕中央大框, 集成属性展示 + 全面反馈子系统) */}
          {selectedStation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
              onClick={() => setSelectedStation(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
                onClick={(e) => e.stopPropagation()}>

                {/* 模态框标题栏 */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200"
                  style={{ background: "linear-gradient(90deg, rgba(0,200,150,0.05) 0%, rgba(56,189,248,0.05) 100%)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, ${BRAND_CONFIG[selectedStation.brand]?.color || "#00C896"} 0%, #38BDF8 100%)` }}>
                      {BRAND_CONFIG[selectedStation.brand]?.icon || "⚡"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-800 truncate">{selectedStation.name}</h3>
                      <p className="text-xs text-slate-500">
                        <span style={{ color: BRAND_CONFIG[selectedStation.brand]?.color }}>{selectedStation.brand}</span>
                        <span className="mx-1">·</span>{selectedStation.district}
                        <span className="mx-1">·</span>
                        <span className={selectedStation.status === "运营中" ? "text-green-600" : "text-orange-500"}>{selectedStation.status}</span>
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedStation(null)}
                    className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 模态框主体 (左右分栏) */}
                <div className="flex-1 flex overflow-hidden">

                  {/* 左侧: 站点属性信息 */}
                  <div className="w-1/3 border-r border-slate-200 p-5 overflow-y-auto bg-slate-50">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#00C896]" /> 站点属性
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[11px] text-slate-500 mb-1">充电桩配置</p>
                        <div className="flex gap-3">
                          <div className="flex-1 text-center">
                            <p className="text-2xl font-bold text-green-600">{selectedStation.fastChargers}</p>
                            <p className="text-[10px] text-slate-500">快充桩</p>
                          </div>
                          <div className="w-px bg-slate-200"></div>
                          <div className="flex-1 text-center">
                            <p className="text-2xl font-bold text-blue-500">{selectedStation.slowChargers}</p>
                            <p className="text-[10px] text-slate-500">慢充桩</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">品牌</span>
                          <span className="font-medium" style={{ color: BRAND_CONFIG[selectedStation.brand]?.color }}>{selectedStation.brand}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">行政区</span>
                          <span className="text-slate-700">{selectedStation.district}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">运营状态</span>
                          <span className={selectedStation.status === "运营中" ? "text-green-600" : "text-orange-500"}>{selectedStation.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">更新日期</span>
                          <span className="text-slate-700">{selectedStation.updateTime}</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs">
                        <p className="text-slate-500 mb-1">地理坐标 (WGS84)</p>
                        <p className="text-slate-700 font-mono">{selectedStation.lng?.toFixed(6)}, {selectedStation.lat?.toFixed(6)}</p>
                      </div>
                      {selectedStation.address && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs">
                          <p className="text-slate-500 mb-1">详细地址</p>
                          <p className="text-slate-700">{selectedStation.address}</p>
                        </div>
                      )}

                      {/* 导航按钮 */}
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-[#00C896]" /> 导航前往
                        </p>
                        {userLocation ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => drawRoute(selectedStation)}
                                disabled={routeLoading}
                                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                                style={{ background: "linear-gradient(90deg, #00C896 0%, #4FD4B1 100%)" }}
                              >
                                <RouteIcon className="w-3.5 h-3.5" />
                                {routeLoading ? "规划中..." : "去这里"}
                              </button>
                              {routeInfo && routeInfo.targetName === selectedStation.name && (
                                <button
                                  onClick={clearRoute}
                                  className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                                >
                                  清除
                                </button>
                              )}
                            </div>
                            {routeInfo && routeInfo.targetName === selectedStation.name && (
                              <div className="bg-[#00C896]/5 rounded-lg p-2 border border-[#00C896]/20">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1 text-[#00C896]">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                                    <span className="font-bold">{routeInfo.distance >= 1000 ? `${(routeInfo.distance / 1000).toFixed(1)}km` : `${routeInfo.distance}m`}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-blue-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    <span className="font-bold">{routeInfo.duration >= 60 ? `${Math.floor(routeInfo.duration / 60)}时${routeInfo.duration % 60}分` : `${routeInfo.duration}分钟`}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={locateUser}
                            disabled={locating}
                            className="w-full py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center gap-1.5"
                          >
                            <LocateFixed className="w-3.5 h-3.5" />
                            {locating ? "定位中..." : "先获取我的位置"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧: 公众反馈子系统 */}
                  <div className="flex-1 flex flex-col overflow-hidden">

                    {/* 反馈统计概览 */}
                    <div className="px-5 py-3 border-b border-slate-200 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-[#00C896]" /> 公众反馈与评价
                        </h4>
                        <span className="text-xs text-slate-500">{stationFeedback.length} 条反馈</span>
                      </div>
                      {/* 评分统计 */}
                      {(() => {
                        const rated = stationFeedback.filter(f => f.rating && f.status === "approved");
                        const avg = rated.length ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length) : 0;
                        const total = rated.length;
                        const dist = [5, 4, 3, 2, 1].map(n => rated.filter(f => f.rating === n).length);
                        return (
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-slate-800">{avg.toFixed(1)}</p>
                              <p className="text-yellow-400 text-sm">{"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))}</p>
                              <p className="text-[10px] text-slate-500">{total} 人评分</p>
                            </div>
                            <div className="flex-1 space-y-0.5">
                              {[5, 4, 3, 2, 1].map((n, i) => (
                                <div key={n} className="flex items-center gap-2 text-[10px]">
                                  <span className="text-slate-500 w-3">{n}★</span>
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: total ? `${(dist[i] / total) * 100}%` : "0%" }}></div>
                                  </div>
                                  <span className="text-slate-500 w-5 text-right">{dist[i]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 筛选与排序工具栏 */}
                    <div className="px-5 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        {([
                          { key: "all", label: "全部" },
                          { key: "approved", label: "已通过" },
                          { key: "rejected", label: "违禁驳回" },
                        ] as const).map(f => (
                          <button key={f.key} onClick={() => setFeedbackFilter(f.key)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                              feedbackFilter === f.key ? "bg-[#00C896] text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                            }`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <select value={feedbackSort} onChange={(e) => setFeedbackSort(e.target.value as any)}
                        className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 focus:outline-none focus:border-[#00C896]">
                        <option value="newest">最新优先</option>
                        <option value="highest">评分优先</option>
                      </select>
                    </div>

                    {/* 反馈列表 */}
                    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                      {stationFeedbackLoading ? (
                        <div className="text-center py-8 text-slate-400 text-sm">加载中...</div>
                      ) : (() => {
                        let list = stationFeedback;
                        if (feedbackFilter !== "all") list = list.filter(f => f.status === feedbackFilter);
                        if (feedbackSort === "highest") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
                        else list = [...list].sort((a, b) => (b.create_time || "").localeCompare(a.create_time || ""));
                        if (list.length === 0) return <div className="text-center py-8 text-slate-400 text-sm">暂无反馈，快来发表第一条</div>;
                        return list.map(f => (
                          <div key={f.id} className={`rounded-lg border p-3 ${
                            f.status === "approved" ? "bg-white border-slate-200" :
                            "bg-red-50 border-red-200"
                          }`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-sm">{"★".repeat(Math.min(f.rating || 0, 5))}{"☆".repeat(5 - Math.min(f.rating || 0, 5))}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  f.type === "evaluation" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                                }`}>
                                  {f.type === "evaluation" ? "评价" : "需求"}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{f.create_time?.split(" ")[0]}</span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed mb-1.5">{f.description}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-slate-500">— {f.submitter}</span>
                              {f.status === "rejected" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                                  违禁词驳回
                                </span>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* 提交反馈表单 */}
                    <div className="border-t border-slate-200 p-4 bg-white">
                      <h5 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <Send className="w-3.5 h-3.5 text-[#00C896]" /> 发表反馈
                      </h5>
                      <div className="space-y-2">
                        {/* 反馈类型 + 评分 */}
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <button onClick={() => setStationFeedbackForm({ ...stationFeedbackForm, type: "evaluation" })}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium ${stationFeedbackForm.type === "evaluation" ? "bg-[#00C896] text-white" : "bg-slate-100 text-slate-600"}`}>
                              评价
                            </button>
                            <button onClick={() => setStationFeedbackForm({ ...stationFeedbackForm, type: "demand" })}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium ${stationFeedbackForm.type === "demand" ? "bg-[#00C896] text-white" : "bg-slate-100 text-slate-600"}`}>
                              需求建议
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">评分</span>
                            {[1, 2, 3, 4, 5].map(n => (
                              <button key={n} onClick={() => setStationFeedbackForm({ ...stationFeedbackForm, rating: n })}
                                className={`text-base ${n <= stationFeedbackForm.rating ? "text-yellow-400" : "text-slate-300"}`}>
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* 反馈内容 */}
                        <textarea
                          value={stationFeedbackForm.description}
                          onChange={(e) => setStationFeedbackForm({ ...stationFeedbackForm, description: e.target.value })}
                          placeholder={stationFeedbackForm.type === "evaluation" ? "说说您的充电体验（充电速度、环境、排队情况等）..." : "描述您的需求或建议（希望增加什么类型的充电桩、改善什么问题等）..."}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 h-16 resize-none focus:border-[#00C896] focus:outline-none"
                        />
                        <button
                          onClick={submitStationFeedback}
                          disabled={!stationFeedbackForm.description || submittingStationFeedback}
                          className="w-full py-2 rounded-lg text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-1.5"
                          style={{ background: "linear-gradient(90deg, #00C896 0%, #4FD4B1 100%)" }}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {submittingStationFeedback ? "提交中..." : "提交反馈"}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 鼠标坐标 */}
          {mousePosition && (
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur border border-slate-200 text-slate-600 px-2.5 py-1 rounded text-[10px] font-mono z-10 shadow-sm">
              经: {mousePosition[0]}, 纬: {mousePosition[1]}
            </div>
          )}

          {/* 用户定位与导航浮窗 (右上角, 除管理页外所有页面显示) */}
          {activeTab !== "admin" && (
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
            <button
              onClick={locateUser}
              disabled={locating}
              title="定位我的位置"
              className="w-9 h-9 flex items-center justify-center bg-white/95 backdrop-blur border border-slate-200 rounded-lg shadow-lg hover:border-[#00C896] hover:text-[#00C896] transition-all disabled:opacity-60"
            >
              <LocateFixed className={`w-4.5 h-4.5 ${locating ? "text-[#00C896] animate-spin" : "text-slate-500"}`} />
            </button>
            {userLocation && (
              <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-lg text-[10px] w-auto text-center">
                <p className="text-slate-400 whitespace-nowrap">{userLocation.lng.toFixed(5)}, {userLocation.lat.toFixed(5)}</p>
                {userLocation.accuracy && (
                  <p className="text-[8px] text-green-500">±{Math.round(userLocation.accuracy)}m</p>
                )}
              </div>
            )}
            {locateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 shadow-lg text-[9px] w-44 text-center">
                <p className="text-red-600">{locateError}</p>
              </div>
            )}
            {routeInfo && (
              <div className="bg-white/95 backdrop-blur border border-[#00C896]/30 rounded-lg shadow-lg text-[11px] overflow-hidden w-72 max-h-[70vh] flex flex-col">
                {/* 导航头部 */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-500 text-[10px] flex items-center gap-1">
                      <RouteIcon className="w-3 h-3 text-[#00C896]" /> 导航至
                    </p>
                    <p className="text-sm font-bold text-slate-800 truncate">{routeInfo.targetName}</p>
                  </div>
                  <button onClick={clearRoute} className="ml-2 shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-red-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                {/* 总览信息 */}
                <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-1 text-[#00C896]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                    <span className="font-bold text-xs">{routeInfo.distance >= 1000 ? `${(routeInfo.distance / 1000).toFixed(1)}km` : `${routeInfo.distance}m`}</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span className="font-bold text-xs">{routeInfo.duration >= 60 ? `${Math.floor(routeInfo.duration / 60)}时${routeInfo.duration % 60}分` : `${routeInfo.duration}分钟`}</span>
                  </div>
                  {routeInfo.steps && routeInfo.steps.length > 0 && (
                    <span className="text-slate-400 text-[10px] ml-auto">{routeInfo.steps.length}个路段</span>
                  )}
                </div>
                {/* 步骤列表 */}
                {routeInfo.steps && routeInfo.steps.length > 0 && (
                  <div className="overflow-y-auto flex-1 max-h-[50vh]">
                    {routeInfo.steps.map((step, idx) => (
                      <div key={idx} className={`flex gap-2.5 px-3 py-2 border-b border-slate-50 last:border-b-0 ${idx === 0 ? 'bg-blue-50/50' : ''}`}>
                        {/* 方向图标 */}
                        <div className="shrink-0 w-5 pt-0.5 flex flex-col items-center">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <DirectionIcon action={step.action} />
                          </div>
                          {idx < routeInfo.steps.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-0.5" />}
                        </div>
                        {/* 步骤内容 */}
                        <div className="min-w-0 flex-1 pb-1">
                          <p className={`text-[11px] font-medium ${idx === 0 ? 'text-blue-700' : 'text-slate-700'}`}>
                            {step.instruction || step.action || `路段 ${idx + 1}`}
                          </p>
                          {step.road && <p className="text-[10px] text-slate-400 mt-0.5">经 {step.road}</p>}
                          <p className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                            <span>{(step.distance || 0) >= 1000 ? `${(step.distance / 1000).toFixed(1)}km` : `${step.distance || 0}m`}</span>
                            <span>{Math.round((step.duration || 0) / 60) || '<1'}分钟</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
            )}

          {/* 图例 */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-2.5 shadow-lg z-10 w-48">
            <h5 className="text-[10px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-500" /> 图例
            </h5>
            <ul className="space-y-1 text-[9px] text-slate-400">
              {availableBrands.map(b => (
                <li key={b} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: BRAND_CONFIG[b].color }}></span>
                  <span>{BRAND_CONFIG[b].label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 pt-1 border-t border-slate-200">
                <span className="w-3 h-3 rounded bg-green-500/10 border border-green-500/50 inline-block"></span>
                <span>住宅小区</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500 inline-block"></span>
                <span>充电盲区</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500/30 border border-green-500 inline-block"></span>
                <span>已覆盖区域</span>
              </li>
            </ul>
          </div>

          {/* --- 系统管理子系统 (全屏多分类管理界面, 独立渲染) --- */}
          {activeTab === "admin" && (
              <div className="absolute inset-0 z-30 bg-[#F5F7FA] flex flex-col overflow-hidden">
                {/* 管理界面标题栏 */}
                <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#00C896]" />
                    <h3 className="text-base font-semibold text-slate-800">系统管理控制台</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded font-mono"
                      style={{ background: "rgba(168,85,247,0.1)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.25)" }}>
                      管理员模式
                    </span>
                  </div>
                  <button onClick={loadAdminData}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#00C896] hover:bg-[#00A078] text-white flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> 刷新数据
                  </button>
                </div>

                {/* 分类 Tab 栏 */}
                <div className="bg-white border-b border-slate-200 px-6 flex gap-1">
                  {([
                    { key: "overview", label: "数据概览", icon: BarChart3 },
                    { key: "stations", label: "充电站管理", icon: Zap },
                    { key: "users", label: "用户管理", icon: UserIcon },
                    { key: "feedback", label: "反馈管理", icon: MessageSquare },
                    { key: "schemes", label: "方案管理", icon: Target },
                    { key: "logs", label: "系统日志", icon: Database },
                  ] as const).map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.key} onClick={() => setAdminTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all ${
                          adminTab === t.key
                            ? "border-[#00C896] text-[#00C896]"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}>
                        <Icon className="w-4 h-4" /> {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* 管理内容区 */}
                <div className="flex-1 overflow-auto p-6">

                  {/* ===== 数据概览 ===== */}
                  {adminTab === "overview" && (
                    <div className="space-y-4">
                      {/* 统计卡片 */}
                      <div className="grid grid-cols-5 gap-4">
                        {[
                          { label: "充电站总数", value: adminStations.length, color: "#00C896", icon: Zap },
                          { label: "注册用户", value: users.length, color: "#38BDF8", icon: UserIcon },
                          { label: "反馈数据", value: adminFeedback.length, color: "#E6A23C", icon: MessageSquare },
                          { label: "选址方案", value: adminSchemes.length, color: "#A855F7", icon: Target },
                          { label: "系统日志", value: logs.length, color: "#F56C6C", icon: Database },
                        ].map(s => {
                          const Icon = s.icon;
                          return (
                            <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-500">{s.label}</span>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + "15" }}>
                                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                                </div>
                              </div>
                              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* 充电站品牌分布 + 行政区分布 */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                          <h4 className="text-sm font-semibold text-slate-700 mb-3">充电站品牌分布</h4>
                          <div className="space-y-2">
                            {Object.entries(
                              adminStations.reduce((acc: any, s: any) => {
                                acc[s.brand] = (acc[s.brand] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([brand, count]: any) => (
                              <div key={brand} className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 w-20">{brand}</span>
                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full flex items-center justify-end px-1.5"
                                    style={{ width: `${adminStations.length ? (count / adminStations.length) * 100 : 0}%`, background: BRAND_CONFIG[brand]?.color || "#909399" }}>
                                    <span className="text-[10px] text-white font-bold">{count}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                          <h4 className="text-sm font-semibold text-slate-700 mb-3">行政区充电站分布</h4>
                          <div className="space-y-2">
                            {Object.entries(
                              adminStations.reduce((acc: any, s: any) => {
                                acc[s.district] = (acc[s.district] || 0) + 1;
                                return acc;
                              }, {})
                            ).sort((a: any, b: any) => b[1] - a[1]).map(([district, count]: any) => (
                              <div key={district} className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 w-16">{district}</span>
                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#38BDF8] rounded-full flex items-center justify-end px-1.5"
                                    style={{ width: `${adminStations.length ? (count / adminStations.length) * 100 : 0}%` }}>
                                    <span className="text-[10px] text-white font-bold">{count}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 最近系统日志 */}
                      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">最近系统操作</h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {logs.slice(0, 10).map(l => (
                            <div key={l.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-100 last:border-0">
                              <span className="text-slate-400 font-mono w-32">{l.create_time}</span>
                              <span className="text-[#00C896] font-medium w-20">{l.action}</span>
                              <span className="text-slate-600 flex-1">{l.detail}</span>
                              <span className="text-slate-400">— {l.user}</span>
                            </div>
                          ))}
                          {logs.length === 0 && <p className="text-center text-slate-400 py-4">暂无日志</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===== 充电站管理 ===== */}
                  {adminTab === "stations" && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">充电站列表 ({adminStations.length})</h4>
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="搜索名称/品牌/区域..." value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-56 focus:border-[#00C896] focus:outline-none" />
                          <button onClick={() => setAdminEditing({})}
                            className="text-xs px-3 py-1.5 rounded-lg bg-[#00C896] hover:bg-[#00A078] text-white flex items-center gap-1">
                            + 新增
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="text-slate-500">
                              <th className="px-3 py-2 text-left">ID</th>
                              <th className="px-3 py-2 text-left">名称</th>
                              <th className="px-3 py-2 text-left">品牌</th>
                              <th className="px-3 py-2 text-left">行政区</th>
                              <th className="px-3 py-2 text-center">快充</th>
                              <th className="px-3 py-2 text-center">慢充</th>
                              <th className="px-3 py-2 text-left">状态</th>
                              <th className="px-3 py-2 text-left">坐标</th>
                              <th className="px-3 py-2 text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminStations.filter((s: any) => {
                              if (!adminSearch) return true;
                              const q = adminSearch.toLowerCase();
                              return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                            }).map((s: any) => (
                              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-400">{s.id}</td>
                                <td className="px-3 py-2 text-slate-700 font-medium">{s.name}</td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: (BRAND_CONFIG[s.brand]?.color || "#909399") + "15", color: BRAND_CONFIG[s.brand]?.color || "#909399" }}>
                                    {s.brand}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{s.district}</td>
                                <td className="px-3 py-2 text-center text-green-600 font-medium">{s.fastChargers}</td>
                                <td className="px-3 py-2 text-center text-blue-500 font-medium">{s.slowChargers}</td>
                                <td className="px-3 py-2">
                                  <span className={s.status === "运营中" ? "text-green-600" : "text-orange-500"}>{s.status}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">{Number(s.lng).toFixed(4)}, {Number(s.lat).toFixed(4)}</td>
                                <td className="px-3 py-2 text-center">
                                  <button onClick={() => setAdminEditing(s)}
                                    className="text-[#00C896] hover:underline mr-2">编辑</button>
                                  <button onClick={async () => {
                                    if (!confirm(`确定删除充电站「${s.name}」?`)) return;
                                    const r = await authFetch(`/api/v1/stations/${s.id}`, { method: "DELETE" });
                                    const j = await r.json();
                                    if (j.success) { loadAdminData(); alert("已删除"); }
                                    else alert(j.message);
                                  }} className="text-red-500 hover:underline">删除</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===== 用户管理 ===== */}
                  {adminTab === "users" && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">用户列表 ({users.length})</h4>
                        <button onClick={() => setAdminEditing({ _type: "user" })}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[#00C896] hover:bg-[#00A078] text-white flex items-center gap-1">
                          + 新增用户
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr className="text-slate-500">
                              <th className="px-3 py-2 text-left">ID</th>
                              <th className="px-3 py-2 text-left">用户名</th>
                              <th className="px-3 py-2 text-left">角色</th>
                              <th className="px-3 py-2 text-left">状态</th>
                              <th className="px-3 py-2 text-left">注册时间</th>
                              <th className="px-3 py-2 text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-400">{u.id}</td>
                                <td className="px-3 py-2 text-slate-700 font-medium">{u.username}</td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px]"
                                    style={{ background: ROLE_CONFIG[u.role as UserRole]?.color + "15", color: ROLE_CONFIG[u.role as UserRole]?.color }}>
                                    {ROLE_CONFIG[u.role as UserRole]?.label || u.role}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={u.status === "正常" ? "text-green-600" : "text-red-500"}>{u.status}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-500">{u.create_time}</td>
                                <td className="px-3 py-2 text-center">
                                  <button onClick={() => setAdminEditing({ ...u, _type: "user" })}
                                    className="text-[#00C896] hover:underline mr-2">编辑</button>
                                  {u.username !== "admin" && (
                                    <button onClick={async () => {
                                      if (!confirm(`确定删除用户「${u.username}」?`)) return;
                                      const r = await authFetch(`/api/v1/users/${u.id}`, { method: "DELETE" });
                                      const j = await r.json();
                                      if (j.success) { loadAdminData(); alert("已删除"); }
                                      else alert(j.message);
                                    }} className="text-red-500 hover:underline">删除</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===== 反馈管理 ===== */}
                  {adminTab === "feedback" && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">反馈列表 ({adminFeedback.length})</h4>
                        <button onClick={async () => {
                          if (!confirm("确定清空所有违禁驳回的反馈?")) return;
                          const r = await authFetch("/api/v1/feedback/rejected/clear", { method: "DELETE" });
                          const j = await r.json();
                          if (j.success) { loadAdminData(); alert(j.message); }
                          else alert(j.message);
                        }} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200">
                          清空违禁反馈
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="text-slate-500">
                              <th className="px-3 py-2 text-left">ID</th>
                              <th className="px-3 py-2 text-left">类型</th>
                              <th className="px-3 py-2 text-left">评分</th>
                              <th className="px-3 py-2 text-left">内容</th>
                              <th className="px-3 py-2 text-left">提交人</th>
                              <th className="px-3 py-2 text-left">时间</th>
                              <th className="px-3 py-2 text-left">状态</th>
                              <th className="px-3 py-2 text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminFeedback.map(f => (
                              <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-400">{f.id}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${f.type === "evaluation" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"}`}>
                                    {f.type === "evaluation" ? "评价" : "需求"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-yellow-500">{"★".repeat(Math.min(f.rating || 0, 5))}</td>
                                <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{f.description}</td>
                                <td className="px-3 py-2 text-slate-600">{f.submitter}</td>
                                <td className="px-3 py-2 text-slate-500">{f.create_time}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    f.status === "approved" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                  }`}>
                                    {f.status === "approved" ? "已通过" : "违禁驳回"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button onClick={async () => {
                                    if (!confirm("确定删除该反馈?")) return;
                                    const r = await authFetch(`/api/v1/feedback/${f.id}`, { method: "DELETE" });
                                    const j = await r.json();
                                    if (j.success) { loadAdminData(); alert("已删除"); }
                                    else alert(j.message);
                                  }} className="text-red-500 hover:underline">删除</button>
                                </td>
                              </tr>
                            ))}
                            {adminFeedback.length === 0 && (
                              <tr><td colSpan={8} className="text-center text-slate-400 py-8">暂无反馈数据</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===== 方案管理 ===== */}
                  {adminTab === "schemes" && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700">选址方案列表 ({adminSchemes.length})</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr className="text-slate-500">
                              <th className="px-3 py-2 text-left">ID</th>
                              <th className="px-3 py-2 text-left">方案名称</th>
                              <th className="px-3 py-2 text-left">品牌</th>
                              <th className="px-3 py-2 text-center">覆盖人口</th>
                              <th className="px-3 py-2 text-center">覆盖社区</th>
                              <th className="px-3 py-2 text-center">盲区消除</th>
                              <th className="px-3 py-2 text-center">竞争避让</th>
                              <th className="px-3 py-2 text-left">创建时间</th>
                              <th className="px-3 py-2 text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminSchemes.map(s => (
                              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-400">{s.id}</td>
                                <td className="px-3 py-2 text-slate-700 font-medium">{s.name}</td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: (BRAND_CONFIG[s.brand]?.color || "#909399") + "15", color: BRAND_CONFIG[s.brand]?.color || "#909399" }}>
                                    {s.brand}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center text-slate-700">{s.covered_population}</td>
                                <td className="px-3 py-2 text-center text-slate-700">{s.covered_communities}</td>
                                <td className="px-3 py-2 text-center text-green-600">{s.blind_spot_reduction}%</td>
                                <td className="px-3 py-2 text-center text-blue-500">{s.competition_score}</td>
                                <td className="px-3 py-2 text-slate-500">{s.create_time}</td>
                                <td className="px-3 py-2 text-center">
                                  <button onClick={async () => {
                                    if (!confirm(`确定删除方案「${s.name}」?`)) return;
                                    const r = await authFetch(`/api/v1/schemes/${s.id}`, { method: "DELETE" });
                                    const j = await r.json();
                                    if (j.success) { loadAdminData(); alert("已删除"); }
                                    else alert(j.message);
                                  }} className="text-red-500 hover:underline">删除</button>
                                </td>
                              </tr>
                            ))}
                            {adminSchemes.length === 0 && (
                              <tr><td colSpan={9} className="text-center text-slate-400 py-8">暂无选址方案</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ===== 系统日志 ===== */}
                  {adminTab === "logs" && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">系统日志 ({logs.length})</h4>
                        <div className="flex gap-1">
                          {["all", "登录系统", "新增", "修改", "删除", "查询", "选址", "反馈"].map(f => (
                            <button key={f} onClick={() => setAdminLogFilter(f)}
                              className={`text-[11px] px-2.5 py-1 rounded ${adminLogFilter === f ? "bg-[#00C896] text-white" : "bg-slate-100 text-slate-600"}`}>
                              {f === "all" ? "全部" : f}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="text-slate-500">
                              <th className="px-3 py-2 text-left">ID</th>
                              <th className="px-3 py-2 text-left">时间</th>
                              <th className="px-3 py-2 text-left">用户</th>
                              <th className="px-3 py-2 text-left">操作</th>
                              <th className="px-3 py-2 text-left">详情</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.filter(l => adminLogFilter === "all" || safeText(l.action).includes(adminLogFilter) || safeText(l.detail).includes(adminLogFilter)).map(l => (
                              <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-400">{l.id}</td>
                                <td className="px-3 py-2 text-slate-500 font-mono">{l.create_time}</td>
                                <td className="px-3 py-2 text-slate-700">{l.user}</td>
                                <td className="px-3 py-2 text-[#00C896] font-medium">{l.action}</td>
                                <td className="px-3 py-2 text-slate-600">{l.detail}</td>
                              </tr>
                            ))}
                            {logs.length === 0 && (
                              <tr><td colSpan={5} className="text-center text-slate-400 py-8">暂无日志</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                {/* 编辑/新增模态框 */}
                {adminEditing !== null && (
                  <StationEditModal
                    data={adminEditing}
                    onClose={() => setAdminEditing(null)}
                    onSave={async (formData) => {
                      try {
                        if (formData._type === "user") {
                          // 用户保存
                          const isEdit = formData.id;
                          const r = await authFetch(isEdit ? `/api/v1/users/${formData.id}` : "/api/v1/users", {
                            method: isEdit ? "PUT" : "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: formData.username, password: formData.password, role: formData.role, status: formData.status }),
                          });
                          const j = await r.json();
                          if (j.success) { loadAdminData(); setAdminEditing(null); alert(j.message); }
                          else alert(j.message);
                        } else {
                          // 充电站保存
                          const isEdit = formData.id;
                          const r = await authFetch(isEdit ? `/api/v1/stations/${formData.id}` : "/api/v1/stations", {
                            method: isEdit ? "PUT" : "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: formData.name, brand: formData.brand, lng: formData.lng, lat: formData.lat,
                              fast_chargers: parseInt(formData.fast_chargers) || 0, slow_chargers: parseInt(formData.slow_chargers) || 0,
                              address: formData.address, district: formData.district, status: formData.status, operator: formData.operator,
                            }),
                          });
                          const j = await r.json();
                          if (j.success) { loadAdminData(); setAdminEditing(null); alert(j.message); }
                          else alert(j.message);
                        }
                      } catch (e: any) {
                        alert("保存失败: " + e.message);
                      }
                    }}
                  />
                )}
              </div>
          )}

          {/* ===== 右侧图表面板 ===== */}
          {/* 覆盖分析图表 */}
          {activeTab === "coverage" && coverageSummary && (
            <div className="absolute top-3 right-3 w-72 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-lg z-20">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-500" /> 各行政区覆盖率
              </h4>
              <div ref={coverageChartRef} className="w-full h-48" />
            </div>
          )}

          {/* 选址评估仪表盘 */}
          {activeTab === "site" && siteMetrics && (
            <div className="absolute top-3 right-3 w-72 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-lg z-20">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-amber-500" /> 选址评估仪表盘
              </h4>
              <div ref={siteChartRef} className="w-full h-40" />
              {virtualStation && (
                <div className="mt-2 text-[10px] text-slate-400 text-center">
                  坐标: {virtualStation.lng.toFixed(4)}, {virtualStation.lat.toFixed(4)}
                </div>
              )}
            </div>
          )}

          {/* 方案对比雷达图 */}
          {activeTab === "site" && compareSchemes.length >= 2 && (
            <div className="absolute bottom-3 right-3 w-72 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-lg z-20">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-purple-500" /> 方案雷达对比
              </h4>
              <div ref={radarChartRef} className="w-full h-56" />
            </div>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* ===== AI助手悬浮球 + 浮动面板 ===== */}
      {/* 机器人面部悬浮球 */}
      <div
        className="fixed z-50 select-none"
        style={{ bottom: "calc(24px + 20px)", right: "24px" }}
        onMouseDown={(e) => {
          aiDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
          setAiDragging(false);
          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - aiDragRef.current.startX;
            const dy = ev.clientY - aiDragRef.current.startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
              aiDragRef.current.moved = true;
              setAiDragging(true);
            }
          };
          const onUp = () => {
            setAiDragging(false);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        onClick={() => {
          if (aiDragRef.current.moved) return;
          setAiBotBounce(true);
          setTimeout(() => setAiBotBounce(false), 400);
          setAiPanelOpen(!aiPanelOpen);
        }}
      >
        <div
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center cursor-pointer transition-all duration-300 ${aiBotBounce ? "animate-bounce" : ""}`}
          style={{
            background: aiPanelOpen
              ? "linear-gradient(135deg, #6366F1 0%, #A855F7 100%)"
              : "linear-gradient(135deg, #00C896 0%, #38BDF8 100%)",
            boxShadow: aiPanelOpen
              ? "0 4px 20px rgba(168,85,247,0.4)"
              : "0 4px 20px rgba(0,200,150,0.4)",
            transform: aiBotBounce ? "scale(1.15)" : "scale(1)",
          }}
        >
          {/* 机器人面部 SVG */}
          <svg viewBox="0 0 48 48" className="w-10 h-10">
            {/* 头部轮廓 */}
            <rect x="10" y="12" width="28" height="24" rx="8" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
            {/* 天线 */}
            <line x1="24" y1="12" x2="24" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="24" cy="5" r="2" fill="white" opacity="0.8">
              {!aiDragging && !aiPanelOpen && (
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
              )}
            </circle>
            {/* 眼睛 */}
            {aiDragging ? (
              /* 拖动时闭眼 - 横线 */
              <>
                <line x1="16" y1="23" x2="21" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="27" y1="23" x2="32" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </>
            ) : aiPanelOpen ? (
              /* 面板打开时 - 开心弯眼 */
              <>
                <path d="M16 24 Q18.5 20 21 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M27 24 Q29.5 20 32 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </>
            ) : (
              /* 默认 - 圆眼睛带眨眼 */
              <>
                <circle cx="18.5" cy="23" r="2.5" fill="white">
                  <animate attributeName="ry" values="2.5;0.3;2.5" dur="4s" repeatCount="indefinite" begin="2s"/>
                </circle>
                <circle cx="29.5" cy="23" r="2.5" fill="white">
                  <animate attributeName="ry" values="2.5;0.3;2.5" dur="4s" repeatCount="indefinite" begin="2s"/>
                </circle>
              </>
            )}
            {/* 嘴巴 */}
            {aiDragging ? (
              /* 拖动时 - 紧张嘴 */
              <ellipse cx="24" cy="31" rx="3" ry="1.5" fill="none" stroke="white" strokeWidth="1.5"/>
            ) : aiPanelOpen ? (
              /* 面板打开 - 开心大嘴 */
              <path d="M19 30 Q24 35 29 30" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            ) : (
              /* 默认 - 微笑 */
              <path d="M20 30 Q24 33 28 30" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            )}
            {/* 腮红 */}
            <circle cx="14" cy="28" r="2.5" fill="rgba(255,255,255,0.15)"/>
            <circle cx="34" cy="28" r="2.5" fill="rgba(255,255,255,0.15)"/>
          </svg>
        </div>
      </div>

      {/* 浮动AI面板 */}
      <div
        className="fixed z-50 w-[400px] max-w-[calc(100vw-48px)] transition-all duration-300 origin-bottom-right"
        style={{
          bottom: "calc(96px + 20px)",
          right: "24px",
          opacity: aiPanelOpen ? 1 : 0,
          transform: aiPanelOpen ? "scale(1) translateY(0)" : "scale(0.85) translateY(20px)",
          pointerEvents: aiPanelOpen ? "auto" : "none",
        }}
      >
        <div className="bg-white/98 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: "min(560px, calc(100vh - 140px))" }}>
          {/* 面板头部 */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, rgba(0,200,150,0.06) 0%, rgba(168,85,247,0.06) 100%)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00C896 0%, #A855F7 100%)" }}>
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">AI辅助决策助手</h3>
              <p className="text-[10px] text-slate-400">基于DeepSeek · 空间数据驱动</p>
            </div>
            <div className="flex items-center gap-1">
              {aiMessages.length > 0 && (
                <button onClick={clearAi}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-red-50 border border-slate-200 flex items-center justify-center transition-colors"
                  title="清空对话">
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {aiMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(0,200,150,0.1) 0%, rgba(168,85,247,0.1) 100%)" }}>
                  <Sparkles className="w-7 h-7 text-purple-500" />
                </div>
                <p className="text-sm text-slate-500 mb-1">你好，我是GeoPlan AI助手</p>
                <p className="text-xs text-slate-400 mb-4">可以帮您分析充电站、规划选址、空间查询</p>
                <div className="space-y-2">
                  {[
                    "徐州市充电设施分布概况",
                    "如何识别充电盲区",
                    "推荐几个选址方案",
                    "充电站品牌各自特点",
                    ...(userLocation ? ["推荐离我最近的充电站"] : []),
                  ].map(q => (
                    <button key={q} onClick={() => { setAiInput(q); }}
                      className="block w-full text-xs text-left px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-purple-400/50 hover:bg-purple-50/30 text-slate-600 transition-colors">
                      💬 {q}
                    </button>
                  ))}
                </div>
                {!userLocation && (
                  <button onClick={locateUser}
                    className="mt-4 text-xs text-[#00C896] hover:underline flex items-center gap-1 mx-auto">
                    <LocateFixed className="w-3.5 h-3.5" /> 先获取我的位置以启用最近站点推荐
                  </button>
                )}
              </div>
            )}
            {aiMessages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && i === aiMessages.length - 1;
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[88%]">
                    <div className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#00C896] text-white whitespace-pre-wrap rounded-br-md"
                        : "bg-slate-50 border border-slate-100 text-slate-800 shadow-sm rounded-bl-md"
                    }`}>
                      {msg.role === "user"
                        ? msg.content
                        : (
                          <>
                            {msg.gisResult && (
                              <div className="mb-2.5">
                                <div className="bg-gradient-to-r from-[#00C896]/10 to-blue-500/10 border border-[#00C896]/30 rounded-xl p-3 mb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-full bg-[#00C896]/20 flex items-center justify-center">
                                      <Sparkles className="w-4 h-4 text-[#00C896]" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">
                                      {(msg.gisResult.radius > 0 ? `${(msg.gisResult.radius / 1000).toFixed(1)}km 缓冲区` : msg.gisResult.district || msg.gisResult.brand) + " 空间分析"}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                                    <div className="text-center">
                                      <p className="text-xl font-bold text-[#00C896]">{msg.gisResult.count}</p>
                                      <p className="text-[10px] text-slate-500">充电站</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xl font-bold text-blue-500">
                                        {msg.gisResult.coveredPopulation >= 10000
                                          ? `${(msg.gisResult.coveredPopulation / 10000).toFixed(1)}万`
                                          : msg.gisResult.coveredPopulation.toLocaleString()}
                                      </p>
                                      <p className="text-[10px] text-slate-500">覆盖人口</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xl font-bold text-purple-500">{msg.gisResult.coveredCommunities}</p>
                                      <p className="text-[10px] text-slate-500">覆盖社区</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => msg.gisResult && visualizeGisAnalysis({
                                      stations: msg.gisResult.stations.map(s => s.id),
                                      communities: [],
                                      center: msg.gisResult.center,
                                      radius: msg.gisResult.radius,
                                    })}
                                    className="w-full text-xs py-1.5 rounded-lg bg-[#00C896]/10 border border-[#00C896]/30 text-[#00C896] hover:bg-[#00C896]/20 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <MapPin className="w-3.5 h-3.5" /> 在地图上查看
                                  </button>
                                </div>

                                {msg.gisResult.stations.length > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] text-slate-400 font-medium">点击站点名可跳转地图：</p>
                                    {msg.gisResult.stations.map((station) => (
                                      <button
                                        key={station.id}
                                        onClick={() => flyToStationById(station.id)}
                                        className="w-full text-left p-2 bg-white border border-slate-200 rounded-xl hover:border-[#00C896]/50 hover:bg-[#00C896]/5 transition-colors group"
                                      >
                                        <div className="flex items-start gap-2">
                                          <MapPin className="w-3.5 h-3.5 text-[#00C896] shrink-0 mt-0.5" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-700 truncate group-hover:text-[#00C896] transition-colors">
                                              {station.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                              {station.distanceKm != null && (
                                                <span className="text-[#00C896] font-medium">{station.distanceKm}km</span>
                                              )}
                                              <span>{station.brand}</span>
                                              <span>· 快充{station.fastChargers}/慢充{station.slowChargers}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {msg.content
                              ? renderAiContent(msg.content)
                              : <span className="text-slate-400">思考中...</span>}
                          </>
                        )}
                    </div>
                    {msg.role === "assistant" && msg.content && (
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button onClick={() => copyAi(msg.content, i)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
                          title={copiedIndex === i ? "已复制" : "复制内容"}>
                          {copiedIndex === i
                            ? <Check className="w-3.5 h-3.5 text-green-500" />
                            : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                        {isLastAssistant && !aiStreaming && (
                          <button onClick={regenerateAi}
                            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
                            title="重新生成">
                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={aiMessagesEndRef} />
          </div>

          {/* AI 站点详情已移至地图 Overlay */}

          {/* 输入区域 */}
          <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-white/80 backdrop-blur">
            <div className="flex gap-2 items-end">
              <textarea
                ref={aiInputRef}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendAiMessage();
                  }
                }}
                placeholder="输入您的问题，Shift+Enter 换行..."
                disabled={aiStreaming}
                rows={1}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 resize-none overflow-hidden min-h-[36px] max-h-[120px] focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition-all"
              />
              <button onClick={aiStreaming ? stopAi : sendAiMessage}
                disabled={!aiStreaming && !aiInput.trim()}
                className={`text-white px-3 py-2 rounded-xl disabled:bg-slate-200 shrink-0 transition-colors ${
                  aiStreaming ? "bg-red-400 hover:bg-red-500" : "bg-[#A855F7] hover:bg-purple-400"
                }`}>
                {aiStreaming ? <Square className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 充电站/用户编辑模态框组件 (供系统管理界面使用)
// =========================================================================
function StationEditModal({ data, onClose, onSave }: {
  data: any;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
}) {
  if (!data) return null;
  const isUser = data._type === "user";
  const isEdit = !!data.id;
  const [form, setForm] = useState<any>({
    ...data,
    name: data.name || "",
    brand: data.brand || "国家电网",
    lng: data.lng || "",
    lat: data.lat || "",
    fast_chargers: data.fastChargers ?? "",
    slow_chargers: data.slowChargers ?? "",
    address: data.address || "",
    district: data.district || "泉山区",
    status: data.status || "运营中",
    operator: data.operator || "",
    username: data.username || "",
    password: data.password && data.password !== "******" ? data.password : "",
    role: data.role || "新能源车主",
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center"
          style={{ background: "linear-gradient(90deg, rgba(0,200,150,0.05) 0%, rgba(56,189,248,0.05) 100%)" }}>
          <h3 className="text-sm font-semibold text-slate-800">
            {isUser ? (isEdit ? "编辑用户" : "新增用户") : (isEdit ? "编辑充电站" : "新增充电站")}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {isUser ? (
            <>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">用户名</label>
                <input type="text" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">密码 {isEdit && "(留空则不修改)"}</label>
                <input type="text" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? "******" : "请输入密码"}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">角色</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none">
                  <option value="新能源车主">新能源车主</option>
                  <option value="投资商">充电设施投资商</option>
                  <option value="管理员">系统管理员</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none">
                  <option value="正常">正常</option>
                  <option value="禁用">禁用</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">站点名称</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">品牌</label>
                  <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none">
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">行政区</label>
                  <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none">
                    {["鼓楼区", "云龙区", "贾汪区", "泉山区", "铜山区"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">经度 (GCJ02)</label>
                  <input type="number" step="0.000001" value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">纬度 (GCJ02)</label>
                  <input type="number" step="0.000001" value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">快充桩数</label>
                  <input type="number" value={form.fast_chargers}
                    onChange={(e) => setForm({ ...form, fast_chargers: e.target.value })}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">慢充桩数</label>
                  <input type="number" value={form.slow_chargers}
                    onChange={(e) => setForm({ ...form, slow_chargers: e.target.value })}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">详细地址</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">运营状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-[#00C896] focus:outline-none">
                  <option value="运营中">运营中</option>
                  <option value="建设中">建设中</option>
                  <option value="停运">停运</option>
                </select>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
          <button onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
            取消
          </button>
          <button onClick={() => onSave(form)}
            className="text-xs px-4 py-2 rounded-lg text-white"
            style={{ background: "linear-gradient(90deg, #00C896 0%, #4FD4B1 100%)" }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}


