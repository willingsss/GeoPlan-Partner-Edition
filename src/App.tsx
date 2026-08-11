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

import { useCoverageAnalysis } from "./hooks/useCoverageAnalysis";
import { useSiteAnalysis } from "./hooks/useSiteAnalysis";
import SiteControlBar from "./components/SiteControlBar";
import SiteResultPanel from "./components/SiteResultPanel";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "ol/ol.css";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import HeatmapLayer from "ol/layer/Heatmap";
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
import { Translate, Draw } from "ol/interaction";
import { createBox } from "ol/interaction/Draw";
import { defaults as defaultControls } from "ol/control";
import Overlay from "ol/Overlay";
import * as echarts from "echarts";
import * as turf from "@turf/turf";
import {
  Map as MapIcon, Radar, Target, MessageSquare, Bot, Settings,
  Zap, RefreshCw, Save, Send, Building2, Layers, Database, BarChart3,
  Sparkles, X, Gauge, LogOut, User as UserIcon, ShieldCheck,
  MapPin, Navigation, LocateFixed, Route as RouteIcon,
  ChevronLeft, ChevronRight, ChevronDown, Search, Loader2, Square, RotateCcw,
  Copy, Check, Trash2, Menu, GripVertical,
  Flame, Calculator, GitCompare, TrendingUp, FileText,
  LayoutDashboard, Moon, Sun, Keyboard,
  Download, Printer, Activity, Clock, AlertCircle, CheckCircle2,
  Users, Info,
} from "lucide-react";
import {
  BRAND_CONFIG, BRANDS, SubsystemTab,
  ChargingStation, CommunityResult, CoverageSummary, SiteMetrics, SavedScheme,
  BlindSpotCluster, CoverageLevel, StationEfficiency, CoverageHistoryItem,
  User, UserRole, ROLE_PERMISSIONS, ROLE_CONFIG, DEMO_ACCOUNTS,
} from "./types";
import { XUZHOU_CENTER } from "./config/map";
import { gcj02ToWgs84, wgs84ToGcj02 } from "./lib/coordinate";
import MapToolbar, { type MapTool } from "./components/MapToolbar";
import PrintDialog from "./components/PrintDialog";
import RoiDialog from "./components/RoiDialog";
import SchemeCompareDialog from "./components/SchemeCompareDialog";
import CompetitionReport from "./components/CompetitionReport";
import GapPredictionDialog from "./components/GapPredictionDialog";
import { SchemeReportButton } from "./components/SchemeReportPrint";
import Dashboard from "./components/Dashboard";
import ReportCenter from "./components/ReportCenter";
import { ToastProvider, useToast } from "./components/Toast";
import Skeleton from "./components/Skeleton";
import EmptyState from "./components/EmptyState";
import LoginView from "./components/LoginView";
import QueryResultPanel from "./components/QueryResultPanel";
import CoverageControlBar from "./components/CoverageControlBar";
import CoverageResultPanel from "./components/CoverageResultPanel";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import MapVerticalBar from "./components/MapVerticalBar";
import ShortcutsHelp from "./components/ShortcutsHelp";
import CommandPalette from "./components/CommandPalette";
import MapLegend, { LegendGradient } from "./components/MapLegend";
import CoverageCommunityList from "./components/CoverageCommunityList";
import CoverageHistoryCompare from "./components/CoverageHistoryCompare";

// =========================================================================
// 阶段三 任务 3.1.1: 徐州市各区中心坐标 (WGS84 [lng, lat])
// 切换行政区下拉时调用 map.getView().animate 飞行至此坐标
// =========================================================================
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "泉山区": [117.194, 34.244],
  "云龙区": [117.251, 34.253],
  "鼓楼区": [117.185, 34.288],
  "铜山区": [117.169, 34.181],
  "贾汪区": [117.454, 34.443],
  "经济技术开发区": [117.348, 34.285],
};

// =========================================================================
// 品牌图标样式映射
// =========================================================================
// 当前选中的站点 id（用于地图高亮样式，module 级以便 style 函数读取）
let selectedStationId: number | null = null;

function getStationStyle(feature: any): Style {
  const brand = feature.get("brand") || "国家电网";
  const config = BRAND_CONFIG[brand] || { color: "#3b82f6" };
  const isSelected = selectedStationId !== null && feature.get("id") === selectedStationId;
  const radius = isSelected ? 11 : 7;
  // 站点名取 "·" 后第一段（如 "蔚来换电站(鼓楼区…)" -> 简化名）
  const namePart = feature.get("name")?.split("·")[1]?.split("充电")[0] || "";
  // 选中时信息由 Overlay 长窄弹窗显示（名称+桩数），这里只保留高亮圆点
  const text = isSelected ? "" : namePart;
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: isSelected ? "#FBBF24" : config.color }),
      stroke: new Stroke({ color: "#ffffff", width: isSelected ? 3 : 2 }),
    }),
    text: text ? new Text({
      text,
      font: "10px sans-serif",
      offsetY: -14,
      fill: new Fill({ color: "#1F2937" }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }) : undefined,
    zIndex: isSelected ? 100 : undefined,
  });
}

// =========================================================================
// 社区按覆盖率分级着色 (阶段二 任务 2.2)
// 分级色阶: 极差#EF4444 / 较差#F59E0B / 一般#FACC15 / 良好#84CC16 / 优秀#10B981
// 填充透明度 0.35, 描边同色 1px
// =========================================================================
const COVERAGE_LEVEL_COLORS: Record<string, string> = {
  "极差": "#EF4444",
  "较差": "#F59E0B",
  "一般": "#FACC15",
  "良好": "#84CC16",
  "优秀": "#10B981",
};

// 将 hex 色 + alpha 转为 rgba 字符串
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 覆盖率分级筛选 (空/未设置 = 全部显示; 由图例点击切换, module 级供 style 函数读取)
let selectedCoverageLevelsGlobal: Set<string> | null = null;
// 服务区图层显示开关 (图例点击切换, module 级供 style 函数读取)
let showServiceAreaGlobal = true;
// 重叠区图层显示开关 (图例点击切换)
let showOverlapAreaGlobal = true;

function communityGradedStyle(feature: any): Style {
  // 行政区过滤: 非目标区的社区不渲染 (分析后由 _visible 标记控制)
  if (feature.get("_visible") === false) {
    return new Style({});
  }
  const level = feature.get("coverageLevel") as string | undefined;
  const ratio = feature.get("coverageRatio") as number | undefined;
  // 计算有效分级 (有 level 用之, 否则按覆盖率推断)
  let effectiveLevel = level;
  if (!effectiveLevel && typeof ratio === "number") {
    if (ratio >= 90) effectiveLevel = "优秀";
    else if (ratio >= 60) effectiveLevel = "良好";
    else if (ratio >= 30) effectiveLevel = "一般";
    else if (ratio >= 10) effectiveLevel = "较差";
    else effectiveLevel = "极差";
  }
  // 分级筛选: 选中集合非空且该社区级别不在集合 → 不渲染
  if (selectedCoverageLevelsGlobal && selectedCoverageLevelsGlobal.size > 0 && effectiveLevel && !selectedCoverageLevelsGlobal.has(effectiveLevel)) {
    return new Style({});
  }
  // 有 level 时按分级色着色
  if (level && COVERAGE_LEVEL_COLORS[level]) {
    const color = COVERAGE_LEVEL_COLORS[level];
    return new Style({
      fill: new Fill({ color: hexToRgba(color, 0.35) }),
      stroke: new Stroke({ color, width: 1 }),
      text: new Text({
        text: feature.get("name") || "",
        font: "bold 10px sans-serif",
        fill: new Fill({ color: "#1F2937" }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
    });
  }
  // 无 level: 兜底用 coverageRatio 推断
  if (typeof ratio === "number") {
    let inferred = "极差";
    if (ratio >= 90) inferred = "优秀";
    else if (ratio >= 60) inferred = "良好";
    else if (ratio >= 30) inferred = "一般";
    else if (ratio >= 10) inferred = "较差";
    const color = COVERAGE_LEVEL_COLORS[inferred];
    return new Style({
      fill: new Fill({ color: hexToRgba(color, 0.35) }),
      stroke: new Stroke({ color, width: 1 }),
    });
  }
  // 默认灰色填充 (未分析)
  return new Style({
    fill: new Fill({ color: "rgba(161,161,170,0.15)" }),
    stroke: new Stroke({ color: "var(--color-line-strong)", width: 1 }),
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

  // ===== 阶段三/四新增状态 =====
  // 决策大屏全屏开关 (Task 3.1.8)
  const [showDashboard, setShowDashboard] = useState(false);
  // 反馈热力图开关 + 筛选 (Task 3.3)
  const [showFeedbackHeatmap, setShowFeedbackHeatmap] = useState(false);
  const [feedbackHeatmapType, setFeedbackHeatmapType] = useState<"all" | "demand" | "evaluation">("all");
  const [feedbackHeatmapRating, setFeedbackHeatmapRating] = useState<number>(0); // 0 = 不限
  // 命令面板 + 快捷键帮助 (Task 4.1/4.2)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  // 暗色主题 (Task 4.5)
  const [darkTheme, setDarkTheme] = useState<boolean>(() => {
    try { return localStorage.getItem("geoplan-theme") === "dark"; } catch { return false; }
  });
  // ===== 选址决策子系统状态 (useSiteAnalysis hook) =====
  const {
    siteChargeMode, setSiteChargeMode,
    siteBrand, setSiteBrand,
    siteRadius, setSiteRadius, siteRadiusRef,
    virtualStation, setVirtualStation,
    siteMetrics, setSiteMetrics,
    siteLoading, setSiteLoading,
    schemes, setSchemes,
    schemeName, setSchemeName,
    compareSchemes, setCompareSchemes,
    roiDialogOpen, setRoiDialogOpen,
    roiInitParams, setRoiInitParams,
    compareDialogOpen, setCompareDialogOpen,
    competitionDialogOpen, setCompetitionDialogOpen,
    gapDialogOpen, setGapDialogOpen,
    schemesLoaded, setSchemesLoaded,
  } = useSiteAnalysis();
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [aiStationDetail, setAiStationDetail] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);
  const [stationCount, setStationCount] = useState(0);
  // 实际存在数据的品牌列表 (从加载的站点中动态提取, 替代硬编码 BRANDS)
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // ===== 覆盖分析子系统状态 (useCoverageAnalysis hook) =====
  const {
    coverageRadius, setCoverageRadius,
    coverageDistrict, setCoverageDistrict,
    chargeMode, setChargeMode,
    coverageLoading, setCoverageLoading,
    coverageSummary, setCoverageSummary,
    coverageResults, setCoverageResults,
    districtStats, setDistrictStats,
    serviceAreaMode, setServiceAreaMode,
    isochroneCoverage, setIsochroneCoverage,
    showIsochroneLayer, setShowIsochroneLayer,
    isochroneProgress, setIsochroneProgress,
    isochronePolling, setIsochronePolling,
    blindSpotClusters, setBlindSpotClusters,
    lastCoverageSummary, setLastCoverageSummary,
    siteInBlindSpot, setSiteInBlindSpot,
    selectedCluster, setSelectedCluster,
    communityDetail, setCommunityDetail,
    communityDetailOpen, setCommunityDetailOpen,
    clusterSortBy, setClusterSortBy,
    expandedClusterId, setExpandedClusterId,
    coverageLevels, setCoverageLevels,
    stationEfficiency, setStationEfficiency,
    coverageChartCollapsed, setCoverageChartCollapsed,
    coveragePieCollapsed, setCoveragePieCollapsed,
    stationEffCollapsed, setStationEffCollapsed,
    selectedCoverageLevels, setSelectedCoverageLevels,
    showServiceArea, setShowServiceArea,
    showOverlapArea, setShowOverlapArea,
  } = useCoverageAnalysis();

  // 服务区图层显示切换 (图例点击): 关闭时服务区多边形不渲染
  const toggleServiceArea = () => {
    setShowServiceArea(prev => {
      const next = !prev;
      showServiceAreaGlobal = next;
      serviceAreaLayerRef.current?.changed();
      return next;
    });
  };

  // 重叠区图层显示切换 (图例点击): 关闭时重叠区斜线不渲染
  const toggleOverlapArea = () => {
    setShowOverlapArea(prev => {
      const next = !prev;
      showOverlapAreaGlobal = next;
      overlapLayerRef.current?.changed();
      return next;
    });
  };

  // 覆盖率分级筛选切换 (图例点击): 支持多选, 空 = 全部显示
  const toggleCoverageLevel = (level: string) => {
    if (level === "__clear__") {
      setSelectedCoverageLevels(new Set<string>());
      selectedCoverageLevelsGlobal = new Set<string>();
      communityLayerRef.current?.changed();
      return;
    }
    setSelectedCoverageLevels(prev => {
      const next = new Set<string>(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      selectedCoverageLevelsGlobal = next;
      communityLayerRef.current?.changed();
      return next;
    });
  };

  // 覆盖分析
  // 阶段五 等时圈: 服务区模式切换 + 等时圈覆盖率信息
  // 等时圈预计算进度 (管理员后台用)
  // 盲区聚类候选点 (覆盖分析返回)
  // 跨 Tab 保留的最近一次覆盖分析摘要 (供选址面板联动展示)
  // 当前选址是否落在盲区内
  // 地图点击候选点时选中的聚类 (用于弹窗)
  // 社区详情弹窗 (覆盖分析 Tab 点击社区时显示)
  // 候选点面板排序方式 (覆盖分析右下角浮层)
  // 候选点面板展开项 (一次展开一个)

  // 阶段三: 覆盖率分级统计 + 充电站效率 (供饼图/柱图渲染)
  // 阶段三 任务 3.3.3: 右侧三个图表面板 (默认全部展开, 不再折叠)
  // 右侧面板二级 Tab (收纳图表/社区列表/候选点, 避免卡片堆叠混乱)
  const [rightPanelTab, setRightPanelTab] = useState<"charts" | "communities" | "candidates">("charts");
  // 阶段三 任务 3.4.2: 分析进度 (0-100, 分析中 0-90, 完成时 100)
  const [coverageProgress, setCoverageProgress] = useState(0);

  // 阶段四 任务 4.1: 覆盖率渲染模式 (分级着色 / 热力图), 默认分级着色
  const [coverageViewMode, setCoverageViewMode] = useState<"graded" | "heatmap">("graded");
  // 阶段四 任务 4.2: 覆盖分析历史记录 (最多 3 条, 用于并排对比)
  const [coverageHistory, setCoverageHistory] = useState<CoverageHistoryItem[]>([]);

    // 阶段二: 决策分析能力深化 - 弹窗与热力图状态
  const [showHeatmap, setShowHeatmap] = useState(false);           // 负荷热力图开关
  const [heatmapData, setHeatmapData] = useState<any[]>([]);      // 热力图数据

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
  // AI 浮球位置 (右下角为锚点, 用 bottom/right 表示, null = 默认位置)
  const [aiBallPos, setAiBallPos] = useState<{ bottom: number; right: number } | null>(null);
  const aiDragRef = useRef<{ startX: number; startY: number; startBottom: number; startRight: number; moved: boolean }>({ startX: 0, startY: 0, startBottom: 0, startRight: 0, moved: false });
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 系统管理
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [regionStats, setRegionStats] = useState<any[]>([]);
  // 管理界面分类 Tab
  const [adminTab, setAdminTab] = useState<"overview" | "stations" | "users" | "feedback" | "schemes" | "logs" | "report" | "isochrone">("overview");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const sidebarLockRef = useRef(false);
  // 阶段四 任务 4.4.2: 移动端侧边栏抽屉式开关
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    if (sidebarLockRef.current) return;
    sidebarLockRef.current = true;
    setSidebarAnimating(true);
    setSidebarCollapsed(prev => !prev);
    setTimeout(() => { setSidebarAnimating(false); sidebarLockRef.current = false; }, 500);
  }, []);

  // ===== 地图工具栏: Toast 通知 =====
  // 显示全局 Toast (2.5 秒后自动消失)
  const showToast = useCallback((msg: string, type: "info" | "success" = "info") => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  // ===== 全局 Toast Hook (阶段四 任务 4.3.1) =====
  // 同时拿到 Context 版的 showToast, 供接入写操作. 优先用 Context 版本 (支持 success/warning/error)
  const { showToast: showToastCtx } = useToast();

  // ===== 暗色主题切换 (阶段四 任务 4.5) =====
  const toggleTheme = useCallback(() => {
    setDarkTheme(prev => {
      const next = !prev;
      try { localStorage.setItem("geoplan-theme", next ? "dark" : "light"); } catch {}
      // 切换 <html> 上的 .dark 类
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      // 同步切换地图底图 (重新加载瓦片图层)
      const map = mapRef.current;
      if (map) {
        const layers = map.getLayers().getArray();
        // 第一个图层是底图 TileLayer
        const baseLayer = layers[0] as TileLayer | undefined;
        if (baseLayer && baseLayer.getSource() instanceof XYZ) {
          const source = baseLayer.getSource() as XYZ;
          const darkUrl = "https://webrd0{1-4}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}";
          const lightUrl = "https://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
          source.setUrl(next ? darkUrl : lightUrl);
          source.refresh();
        }
      }
      showToastCtx(`已切换到${next ? "暗色" : "亮色"}主题`, "success");
      return next;
    });
  }, [showToastCtx]);

  // 初始化时同步主题到 <html> (阶段四 任务 4.5.3)
  useEffect(() => {
    if (darkTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []); // 仅初始化一次

  // ===== 地图工具栏: 工具切换处理 =====
  // 处理工具按钮点击: 放大/缩小为一次性操作, 框选/多边形/打印暂未实现
  const handleToolChange = useCallback((tool: MapTool | null) => {
    // 平移 = 恢复默认 (清除活动工具)
    if (tool === "pan" || tool === null) {
      setActiveTool(null);
      return;
    }
    // 放大/缩小: 一次性缩放, 不改变活动工具
    if (tool === "zoom-in" || tool === "zoom-out") {
      const map = mapRef.current;
      if (map) {
        const view = map.getView();
        const zoom = view.getZoom() ?? 12;
        view.animate({ zoom: zoom + (tool === "zoom-in" ? 1 : -1), duration: 250 });
      }
      return;
    }
    // 框选查询/多边形查询: 激活对应绘制工具
    if (tool === "query-rectangle" || tool === "query-polygon") {
      setActiveTool(tool);
      return;
    }
    // 打印出图: 打开打印对话框
    if (tool === "print") {
      setPrintDialogOpen(true);
      return;
    }
    // 测距/测面/拾取坐标: 激活对应工具
    setActiveTool(tool);
  }, [showToast]);

  // ===== 地图工具栏: 清除测量结果 =====
  const handleClearMeasurements = useCallback(() => {
    const map = mapRef.current;
    // 清空测量图层
    if (measureSourceRef.current) measureSourceRef.current.clear();
    // 移除所有测量标注 Overlay
    if (map) {
      measureOverlaysRef.current.forEach(o => map.removeOverlay(o));
    }
    measureOverlaysRef.current = [];
    showToast("测量结果已清除");
  }, [showToast]);

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

  // ===== 地图工具栏相关状态 =====
  // 当前激活的地图工具 (null = 默认平移)
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  // 地图是否已初始化完成 (用于传递给 MapToolbar)
  const [mapReady, setMapReady] = useState(false);
  // 全局 Toast 通知 (简单实现, 2.5 秒后自动消失)
  const [toast, setToast] = useState<{ msg: string; type?: "info" | "success" } | null>(null);

  // ===== 空间查询相关状态 =====
  // 查询结果 (命中要素列表 + 查询几何), null = 不显示浮窗
  const [queryResult, setQueryResult] = useState<{
    stations: ChargingStation[];
    communities: CommunityResult[];
    geometry: any;
  } | null>(null);
  // 查询结果浮窗当前激活的 Tab
  const [queryResultTab, setQueryResultTab] = useState<"stations" | "communities">("stations");

  // ===== 打印对话框状态 =====
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // ===== 图层管理状态 =====
  // 图层顺序 (从上到下, 数组前 = 地图顶层), 拖拽可重排
  const [layerOrder, setLayerOrder] = useState<string[]>(["measure", "feedback", "communities", "stations"]);
  // 图层透明度 (0-100), 实时同步到 layer.setOpacity
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({
    stations: 100, communities: 100, feedback: 100, measure: 100,
  });
  // 充电站/测量图层可见性 (小区/反馈复用已有 showCommunities/showFeedback)
  const [showStations, setShowStations] = useState(true);
  const [showMeasure, setShowMeasure] = useState(true);

  // =========================================================================
  // 地图 Refs
  // =========================================================================
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const stationSourceRef = useRef<VectorSource | null>(null);
  const communitySourceRef = useRef<VectorSource | null>(null);
  const serviceAreaSourceRef = useRef<VectorSource | null>(null);
  // 阶段五 等时圈: 通过 ref 让样式函数读取最新开关状态 (避免重建图层)
  const showIsochroneLayerRef = useRef<boolean>(true);
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
  // 阶段三 任务 3.3: 覆盖率分级饼图 + 充电站效率柱图容器
  const coveragePieChartRef = useRef<HTMLDivElement>(null);
  const stationEffChartRef = useRef<HTMLDivElement>(null);
  // 阶段三 任务 3.4.3: 上次分析的社区总数 (供加载态文案使用, 首次为 0)
  const lastCommunityCountRef = useRef<number>(0);

  // 用于在地图事件回调中访问最新值，避免闭包过期
  const activeTabRef = useRef<SubsystemTab>("map");
  const placeVirtualStationRef = useRef<(lng: number, lat: number) => void>(() => {});
  // 覆盖分析结果 ref (供地图点击回调读取最新值, 避免闭包过期)
  const coverageResultsRef = useRef<CommunityResult[]>([]);

  // GIS 分析结果缓存
  const gisResultRef = useRef<{ stations: number[]; communities: number[]; center?: [number, number]; radius?: number } | null>(null);
  const gisBufferSourceRef = useRef<VectorSource | null>(null);
  const aiHighlightSourceRef = useRef<VectorSource | null>(null);
  const aiOverlayRef = useRef<Overlay | null>(null);
  // 选中站点信息条 Overlay (长而窄: 名称 + 快充/慢充数量)
  const stationInfoOverlayRef = useRef<Overlay | null>(null);
  const aiHighlightTimerRef = useRef<number | null>(null);

  // 图层引用 (用于按 Tab 控制可见性, 保留数据不清除)
  const communityLayerRef = useRef<VectorLayer | null>(null);
  const serviceAreaLayerRef = useRef<VectorLayer | null>(null);
  // 行政区边界图层 (分析时划定可视化界限)
  const districtBoundarySourceRef = useRef<VectorSource | null>(null);
  const districtBoundaryLayerRef = useRef<VectorLayer | null>(null);
  const blindSpotLayerRef = useRef<VectorLayer | null>(null);
  const intersectionLayerRef = useRef<VectorLayer | null>(null);
  const virtualStationLayerRef = useRef<VectorLayer | null>(null);
  const feedbackLayerRef = useRef<VectorLayer | null>(null);
  const searchLayerRef = useRef<VectorLayer | null>(null);
  // 候选点 (盲区聚类) 图层引用
  const clusterSourceRef = useRef<VectorSource | null>(null);
  const clusterLayerRef = useRef<VectorLayer | null>(null);
  // 服务区重叠图层引用 (阶段二 任务 2.3)
  const overlapSourceRef = useRef<VectorSource | null>(null);
  const overlapLayerRef = useRef<VectorLayer | null>(null);
  // 原始社区样式函数引用 (切换分级着色时保留原样式以恢复)
  const communityStyleRef = useRef<((feature: any) => Style) | null>(null);
  // 跨 Tab 保留盲区几何 (WGS84 GeoJSON Polygon 数组), 供 evaluate-site 联动判断
  const lastCoverageBlindSpotsRef = useRef<any[] | null>(null);

  // ===== 地图工具栏相关 Refs =====
  // 测量图层 source/layer (存储绘制的折线和多边形)
  const measureSourceRef = useRef<VectorSource | null>(null);
  const measureLayerRef = useRef<VectorLayer | null>(null);
  // 当前 Draw 交互实例 (切换工具时移除)
  const drawInteractionRef = useRef<Draw | null>(null);
  // 测量结果标注 Overlay 列表 (清除时遍历移除)
  const measureOverlaysRef = useRef<Overlay[]>([]);
  // 坐标拾取浮窗 Overlay
  const coordPickerOverlayRef = useRef<Overlay | null>(null);
  // 坐标拾取事件处理函数引用 (切换工具时取消监听)
  const coordPointerMoveHandlerRef = useRef<((e: any) => void) | null>(null);
  const coordClickHandlerRef = useRef<((e: any) => void) | null>(null);
  // activeTool 的 ref (供地图事件回调读取最新值, 避免闭包过期)
  const activeToolRef = useRef<MapTool | null>(null);
  // Toast 定时器引用
  const toastTimerRef = useRef<number | null>(null);

  // ===== 空间查询相关 Refs =====
  // 查询高亮 source/layer (半透明黄色填充, 标记查询几何)
  const querySourceRef = useRef<VectorSource | null>(null);
  const queryLayerRef = useRef<VectorLayer | null>(null);
  // 充电站图层引用 (用于图层管理: 透明度/可见性/z-index)
  const stationLayerRef = useRef<VectorLayer | null>(null);
  // 拖拽排序: 正在拖拽的图层 ID
  const dragLayerIdRef = useRef<string | null>(null);
  // 负荷热力图图层引用 (阶段二 任务 2.1)
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const heatmapSourceRef = useRef<VectorSource | null>(null);
  // 充电站负荷数据缓存 (供弹窗显示, key = stationId)
  const stationLoadCacheRef = useRef<Map<number, { load: number; level: string }>>(new Map());
  // 反馈热力图图层引用 (阶段三 任务 3.3)
  const feedbackHeatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const feedbackHeatmapSourceRef = useRef<VectorSource | null>(null);
  // 反馈数据缓存 (供热力图按类型/评分筛选)
  const feedbackDataRef = useRef<any[]>([]);
  // 阶段四 任务 4.1: 覆盖率热力图图层引用 (社区质心, 权重 = 1 - 覆盖率)
  const coverageHeatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const coverageHeatmapSourceRef = useRef<VectorSource | null>(null);
  // 阶段四 任务 4.2: 覆盖分析历史记录 ref (供 runCoverageAnalysis 写入, 与 state 同步)
  const coverageHistoryRef = useRef<CoverageHistoryItem[]>([]);

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

  // 显示选中站点信息条 (长窄弹窗: 名称 + 快充/慢充数量)
  const showStationInfoPopup = useCallback((station: any) => {
    const overlay = stationInfoOverlayRef.current;
    if (!overlay || !station) return;
    const el = overlay.getElement() as HTMLElement;
    const color = BRAND_CONFIG[station.brand]?.color || "#3b82f6";
    el.innerHTML = `
      <span class="sip-dot" style="background:${color}"></span>
      <span class="sip-name">${station.name || "充电站"}</span>
      <span class="sip-meta">快充 ${station.fastChargers ?? station.fast_chargers ?? 0} · 慢充 ${station.slowChargers ?? station.slow_chargers ?? 0}</span>`;
    overlay.setPosition(fromLonLat([station.lng, station.lat]));
  }, []);

  // 隐藏选中站点信息条
  const hideStationInfoPopup = useCallback(() => {
    stationInfoOverlayRef.current?.setPosition(undefined);
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
    // 行政区边界源 (覆盖分析时高亮显示所选行政区范围)
    districtBoundarySourceRef.current = new VectorSource();
    const blindSpotSource = new VectorSource();
    blindSpotSourceRef.current = blindSpotSource;
    const virtualStationSource = new VectorSource();
    virtualStationSourceRef.current = virtualStationSource;
    const intersectionSource = new VectorSource();
    intersectionSourceRef.current = intersectionSource;
    // 测量图层 source (存储绘制的折线和多边形)
    const measureSource = new VectorSource();
    measureSourceRef.current = measureSource;
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
    // 服务区重叠数据源 (阶段二 任务 2.3)
    const overlapSource = new VectorSource();
    overlapSourceRef.current = overlapSource;

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
    // 保存原始社区样式引用, 供 Tab 切换时恢复 (阶段二 任务 2.2)
    communityStyleRef.current = communityStyle;

    // 服务区重叠区样式: 45° 斜线 pattern 填充 (阶段二 任务 2.3)
    const overlapPatternCanvas = document.createElement("canvas");
    overlapPatternCanvas.width = 8;
    overlapPatternCanvas.height = 8;
    const overlapPctx = overlapPatternCanvas.getContext("2d")!;
    overlapPctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
    overlapPctx.lineWidth = 1;
    overlapPctx.beginPath();
    overlapPctx.moveTo(0, 8);
    overlapPctx.lineTo(8, 0);
    overlapPctx.stroke();
    const overlapPattern = overlapPctx.createPattern(overlapPatternCanvas, "repeat")!;
    const overlapStyle = new Style({
      fill: new Fill({ color: overlapPattern as any }),
      stroke: new Stroke({ color: "#F59E0B", width: 1 }),
    });
    // 重叠区显示开关 (图例点击): 关闭时不渲染
    const overlapStyleFn = () => (showOverlapAreaGlobal ? overlapStyle : new Style({}));

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
      // 服务区图层开关 (图例点击): 关闭时不渲染
      if (!showServiceAreaGlobal) {
        return new Style({});
      }
      // 服务区统一使用品牌主色 (青色), 不再按站点品牌着色, 避免地图颜色杂乱
      const color = "#00C896";
      // 阶段五 等时圈: 等时圈用虚线 + 半透明填充, 缓冲区用实线 + 极淡填充, 视觉可区分且不遮底图
      const source = feature.get("source");
      if (source === "isochrone") {
        // 等时圈图层开关关闭时不渲染 (返回透明样式)
        if (!showIsochroneLayerRef.current) {
          return new Style({});
        }
        return new Style({
          stroke: new Stroke({ color: "#7c3aed", width: 1.5, lineDash: [6, 4] }),
          fill: new Fill({ color: "rgba(124, 58, 237, 0.05)" }),
        });
      }
      return new Style({
        stroke: new Stroke({ color, width: 1 }),
        fill: new Fill({ color: color + "08" }),
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

    const map = new OlMap({
      target: mapContainerRef.current,
      controls: defaultControls({ zoom: false, attribution: false, rotate: false }),
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
        // 行政区边界图层: 分析时高亮显示所选行政区范围 (橙色虚线轮廓)
        (() => { const l = new VectorLayer({
          source: districtBoundarySourceRef.current!,
          style: new Style({
            stroke: new Stroke({ color: "#f97316", width: 3, lineDash: [10, 5] }),
            fill: new Fill({ color: "rgba(249,115,22,0.04)" }),
          }),
          zIndex: 30,
        }); districtBoundaryLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: blindSpotSource, style: blindSpotStyle }); blindSpotLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: intersectionSource, style: intersectionStyle }); intersectionLayerRef.current = l; return l; })(),
        (() => { const l = new VectorLayer({ source: stationSource, style: getStationStyle }); stationLayerRef.current = l; return l; })(),
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
        // 服务区重叠图层 (阶段二 任务 2.3): 斜线 pattern, 仅 coverage Tab 可见
        (() => { const l = new VectorLayer({ source: overlapSource, style: overlapStyleFn, visible: false }); overlapLayerRef.current = l; return l; })(),
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
        // 测量图层 (测距折线 + 测面多边形, 品牌色 #00C896)
        (() => { const l = new VectorLayer({
          source: measureSource,
          style: new Style({
            stroke: new Stroke({ color: "#00C896", width: 2.5, lineCap: "round", lineJoin: "round" }),
            fill: new Fill({ color: "rgba(0,200,150,0.12)" }),
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({ color: "#00C896" }),
              stroke: new Stroke({ color: "#ffffff", width: 2 }),
            }),
          }),
        }); measureLayerRef.current = l; return l; })(),
        // 空间查询高亮图层 (半透明黄色填充, 标记查询几何范围)
        (() => {
          const querySource = new VectorSource();
          querySourceRef.current = querySource;
          const l = new VectorLayer({
            source: querySource,
            style: new Style({
              stroke: new Stroke({ color: "rgba(250,204,21,0.95)", width: 2.5, lineDash: [6, 4] }),
              fill: new Fill({ color: "rgba(250,204,21,0.15)" }),
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({ color: "#facc15" }),
                stroke: new Stroke({ color: "#ffffff", width: 2 }),
              }),
            }),
          });
          queryLayerRef.current = l;
          return l;
        })(),
        // 负荷热力图图层 (阶段二 任务 2.1, 颜色蓝→红, 默认隐藏)
        (() => {
          const hmSource = new VectorSource();
          heatmapSourceRef.current = hmSource;
          const l = new HeatmapLayer({
            source: hmSource,
            visible: false,
            radius: 25,
            blur: 15,
            // 渐变颜色: 蓝 → 青 → 绿 → 黄 → 红
            gradient: ["#0000FF", "#00FFFF", "#00FF00", "#FFFF00", "#FF0000"],
            weight: (feature: any) => {
              const load = feature.get("load") || 0;
              // 归一化到 0-1 (load 30+ 视为最大)
              return Math.min(1, load / 30);
            },
          });
          heatmapLayerRef.current = l;
          return l;
        })(),
        // 反馈热力图图层 (阶段三 任务 3.3, 紫→橙, 默认隐藏)
        (() => {
          const fbSource = new VectorSource();
          feedbackHeatmapSourceRef.current = fbSource;
          const l = new HeatmapLayer({
            source: fbSource,
            visible: false,
            radius: 28,
            blur: 18,
            gradient: ["#1E1B4B", "#7C3AED", "#EC4899", "#F59E0B", "#F97316"],
            weight: (feature: any) => {
              const rating = feature.get("rating") || 3;
              return Math.min(1, rating / 5);
            },
          });
          feedbackHeatmapLayerRef.current = l;
          return l;
        })(),
        // 覆盖率热力图图层 (阶段四 任务 4.1, 蓝→红, 默认隐藏)
        // 权重 = 1 - coverageRatio/100, 覆盖率越低权重越高 (突出盲区)
        (() => {
          const covSource = new VectorSource();
          coverageHeatmapSourceRef.current = covSource;
          const l = new HeatmapLayer({
            source: covSource,
            visible: false,
            radius: 30,
            blur: 20,
            // 渐变颜色: 蓝(高覆盖) → 青 → 黄 → 橙 → 红(低覆盖盲区)
            gradient: ["#0000FF", "#00FFFF", "#FFFF00", "#FFA500", "#FF0000"],
            weight: (feature: any) => {
              const ratio = feature.get("coverageRatio") ?? 0;
              // 覆盖率越低权重越高 (0% 覆盖 → 权重 1, 100% 覆盖 → 权重 0)
              return Math.max(0, Math.min(1, 1 - ratio / 100));
            },
          });
          coverageHeatmapLayerRef.current = l;
          return l;
        })(),
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
    // 标记地图就绪, 触发 MapToolbar 渲染
    setMapReady(true);

    // 选中站点信息条 Overlay (长而窄 HTML 弹窗: 站点名 + 快充/慢充数量)
    const stationInfoEl = document.createElement("div");
    stationInfoEl.className = "station-info-popup";
    const stationInfoOverlay = new Overlay({
      element: stationInfoEl,
      offset: [0, -20],
      positioning: "bottom-center",
      stopEvent: true,
    });
    map.addOverlay(stationInfoOverlay);
    stationInfoOverlayRef.current = stationInfoOverlay;

    // 注意: AI 站点详情原通过 OpenLayers Overlay 渲染, 但 Overlay 会把 React 管理的
    // DOM 节点移到地图 overlay 容器, 导致 React reconciliation 时 insertBefore 失败.
    // 现改为普通 React 模态框 (屏幕中央), 不再使用 map.addOverlay.

    // 鼠标移动
    map.on("pointermove", (e) => {
      const coord = toLonLat(e.coordinate);
      setMousePosition([parseFloat(coord[0].toFixed(5)), parseFloat(coord[1].toFixed(5))]);
    });

    // 地图点击
    map.on("singleclick", (e) => {
      // 坐标拾取/测量模式下, 由专用处理器响应, 跳过默认点击逻辑
      const tool = activeToolRef.current;
      if (tool === "pick-coordinate" || tool === "measure-distance" || tool === "measure-area") return;
      const coord3857 = e.coordinate;
      const coordGcj02 = toLonLat(coord3857);
      // 高德底图坐标为 GCJ02，需转回 WGS84 传给后端
      const [wgsLng, wgsLat] = gcj02ToWgs84(coordGcj02[0], coordGcj02[1]);
      const lng = parseFloat(wgsLng.toFixed(6));
      const lat = parseFloat(wgsLat.toFixed(6));

      // 检查是否点击了充电站 / 候选点 / 重叠区 / 社区
      let clickedStation: any = null;
      let clickedCluster: BlindSpotCluster | null = null;
      let clickedOverlap: any = null;
      let clickedCommunityFeature: any = null;
      map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
        const props = feature.getProperties();
        if (props.brand && props.name) {
          clickedStation = props;
        }
        // 候选点 feature 携带 cluster 属性
        if (props.cluster) {
          clickedCluster = props.cluster as BlindSpotCluster;
        }
        // 服务区重叠区 feature (阶段二 任务 2.3.4)
        if (layer === overlapLayerRef.current) {
          clickedOverlap = props;
        }
        // 社区 feature (阶段二 任务 2.5.2)
        if (layer === communityLayerRef.current) {
          clickedCommunityFeature = feature;
        }
      });

      const currentTab = activeTabRef.current;
      if (clickedStation) {
        // 任意 Tab 下点击充电站都弹出中央模态框 (集成属性展示 + 站点反馈)
        setSelectedStation(clickedStation);
        // 地图高亮选中站点: 金色大圆点 + 上方弹出名称/桩数
        selectedStationId = clickedStation.id;
        stationLayerRef.current?.changed();
        showStationInfoPopup(clickedStation);
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

      // 覆盖分析 Tab: 点击重叠区显示信息 (阶段二 任务 2.3.4)
      if (currentTab === "coverage" && clickedOverlap) {
        const stations = clickedOverlap.stations || [];
        const area = clickedOverlap.area;
        const stationText = stations.length >= 2 ? `${stations[0]} 与 ${stations[1]}` : stations.join("、");
        const areaText = area != null ? ` / 面积 ${Math.round(area).toLocaleString()} 平方米` : "";
        showToast(`${stationText} 服务区重叠${areaText}`);
        return;
      }

      // 覆盖分析 Tab: 点击社区弹出详情弹窗 (阶段二 任务 2.5.2)
      if (currentTab === "coverage" && clickedCommunityFeature) {
        const commId = clickedCommunityFeature.getId() ?? clickedCommunityFeature.get("id");
        const result = coverageResultsRef.current.find((c) => c.id === commId);
        if (result) {
          setCommunityDetail(result);
          setCommunityDetailOpen(true);
          return;
        }
        // 兜底: feature 未匹配到 coverageResults, 用 properties 构造一个临时对象
        const name = clickedCommunityFeature.get("name") || "未命名社区";
        const district = clickedCommunityFeature.get("district") || "未知";
        const population = clickedCommunityFeature.get("population_total") || 0;
        const ratio = clickedCommunityFeature.get("coverageRatio") ?? 0;
        const level = clickedCommunityFeature.get("coverageLevel") ?? "极差";
        const tempResult: CommunityResult = {
          id: typeof commId === "number" ? commId : 0,
          name, district, population,
          coverageRatio: ratio,
          isBlindSpot: level === "极差",
          coveredBy: null,
        };
        setCommunityDetail(tempResult);
        setCommunityDetailOpen(true);
        return;
      }

      // 点击空白处关闭模态框
      setSelectedStation(null);
      selectedStationId = null;
        hideStationInfoPopup();
      stationLayerRef.current?.changed();
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

    return () => { map.setTarget(undefined); setMapReady(false); };
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

  // 保持 coverageResultsRef 与 coverageResults 同步, 供地图点击回调读取最新值
  useEffect(() => {
    coverageResultsRef.current = coverageResults;
  }, [coverageResults]);

  // 阶段五 等时圈: 同步图层开关到 ref 并触发服务区图层重新渲染样式
  useEffect(() => {
    showIsochroneLayerRef.current = showIsochroneLayer;
    serviceAreaSourceRef.current?.changed();
    serviceAreaLayerRef.current?.changed();
  }, [showIsochroneLayer]);

  // 按 Tab 控制图层可见性 (保留数据, 切回可继续使用, 不串到别的功能页)
  useEffect(() => {
    const isMap = activeTab === "map";
    const isSite = activeTab === "site";
    const isCov = activeTab === "coverage";
    // 覆盖分析图层: 仅 coverage Tab 可见
    serviceAreaLayerRef.current?.setVisible(isCov);
    // 行政区边界图层: 仅 coverage Tab 可见
    districtBoundaryLayerRef.current?.setVisible(isCov);
    blindSpotLayerRef.current?.setVisible(isCov);
    // 候选点 (盲区聚类) 图层: 仅 coverage Tab 可见
    clusterLayerRef.current?.setVisible(isCov);
    // 服务区重叠图层: 仅 coverage Tab 可见 (阶段二 任务 2.3.3)
    overlapLayerRef.current?.setVisible(isCov);
    // 选址决策图层: 仅 site Tab 可见
    virtualStationLayerRef.current?.setVisible(isSite);
    intersectionLayerRef.current?.setVisible(isSite);
    // 地图查询图层: 仅 map Tab 可见 (community/feedback 受复选框控制)
    searchLayerRef.current?.setVisible(isMap);
    stationLayerRef.current?.setVisible(isMap && showStations);
    // 社区图层: map Tab 受复选框控制, coverage Tab 在分级着色模式下显示 (阶段二 任务 2.2)
    // 阶段四 任务 4.1.3: coverage Tab 切换到热力图模式时隐藏 communityLayer
    const showCommunityInCoverage = isCov && coverageViewMode === "graded";
    communityLayerRef.current?.setVisible((isMap && showCommunities) || showCommunityInCoverage);
    // 阶段四 任务 4.1.3: 覆盖率热力图图层仅在 coverage Tab + heatmap 模式下可见
    coverageHeatmapLayerRef.current?.setVisible(isCov && coverageViewMode === "heatmap");
    feedbackLayerRef.current?.setVisible(isMap && showFeedback);
    measureLayerRef.current?.setVisible(isMap && showMeasure);
    queryLayerRef.current?.setVisible(isMap);
  }, [activeTab, showStations, showCommunities, showFeedback, showMeasure, coverageViewMode]);

  // 阶段四 任务 4.1.2: 切换到热力图模式时, 用 turf.centroid 计算社区质心并填充热力图 source
  // 权重 = 1 - coverageRatio/100 (覆盖率越低权重越高, 突出盲区)
  useEffect(() => {
    if (!coverageHeatmapSourceRef.current) return;
    // 切换到热力图模式且有分析结果时填充 features
    if (activeTab === "coverage" && coverageViewMode === "heatmap" && coverageResults.length > 0) {
      coverageHeatmapSourceRef.current.clear();
      coverageResults.forEach((comm) => {
        // 从 communitySource 中取对应 Feature 的几何, 用 turf.centroid 计算质心
        const feat = communitySourceRef.current?.getFeatureById(comm.id);
        if (!feat) return;
        const geom = feat.getGeometry();
        if (!geom) return;
        // 将 OL 几何转为 GeoJSON (WGS84), 用 turf 计算质心
        let centerCoord: [number, number] | null = null;
        try {
          const extent = geom.getExtent();
          // 兜底: 用 extent 中心点 (EPSG:3857) 作为质心
          const cx = (extent[0] + extent[2]) / 2;
          const cy = (extent[1] + extent[3]) / 2;
          // 转回经纬度 (GCJ02)
          const [lng, lat] = toLonLat([cx, cy]);
          centerCoord = [lng, lat];
        } catch {
          return;
        }
        if (!centerCoord) return;
        // turf.centroid 输入需为 WGS84, 但底图为 GCJ02; 简化处理: 直接用 GCJ02 坐标投影到 3857
        const feat3857 = new Feature({
          geometry: new Point(fromLonLat(centerCoord)),
        });
        feat3857.set("coverageRatio", comm.coverageRatio);
        feat3857.set("communityId", comm.id);
        feat3857.set("communityName", comm.name);
        coverageHeatmapSourceRef.current!.addFeature(feat3857);
      });
    }
  }, [activeTab, coverageViewMode, coverageResults]);

  // 社区图层样式切换: coverage Tab 用分级着色, 其他 Tab 恢复原样式 (阶段二 任务 2.2.3)
  useEffect(() => {
    if (!communityLayerRef.current) return;
    if (activeTab === "coverage") {
      communityLayerRef.current.setStyle(communityGradedStyle);
    } else {
      communityLayerRef.current.setStyle(communityStyleRef.current || undefined);
    }
  }, [activeTab]);

  // 保持 activeToolRef 与 activeTool 同步, 供地图事件回调读取最新值
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // 切换子系统 Tab 时重置地图工具 (避免测量/拾取状态串到其他功能页)
  useEffect(() => {
    setActiveTool(null);
  }, [activeTab]);

  // ===== 图层管理: 按图层 ID 获取对应 layer ref =====
  const getLayerRefById = useCallback((id: string): React.RefObject<VectorLayer | null> | null => {
    switch (id) {
      case "stations": return stationLayerRef;
      case "communities": return communityLayerRef;
      case "feedback": return feedbackLayerRef;
      case "measure": return measureLayerRef;
      default: return null;
    }
  }, []);

  // ===== 图层管理: 透明度实时同步 =====
  useEffect(() => {
    Object.entries(layerOpacity).forEach(([id, value]) => {
      const ref = getLayerRefById(id);
      ref?.current?.setOpacity((value as number) / 100);
    });
  }, [layerOpacity, getLayerRefById]);

  // ===== 图层管理: 拖拽排序后更新 z-index =====
  useEffect(() => {
    // layerOrder 数组前 = 地图顶层, 设置较高的 zIndex
    layerOrder.forEach((id, idx) => {
      const ref = getLayerRefById(id);
      // zIndex: 数组第 0 项 = 4, 第 1 项 = 3, ... (确保顺序正确)
      ref?.current?.setZIndex(layerOrder.length - idx);
    });
  }, [layerOrder, getLayerRefById]);

  // =========================================================================
  // 地图工具栏: 测量与坐标拾取逻辑
  // 监听 activeTool 变化, 切换 Draw 交互和事件监听
  // =========================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // ===== 清理上一个工具的状态 =====
    // 移除上一个 Draw 交互
    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    // 隐藏坐标拾取浮窗
    if (coordPickerOverlayRef.current) {
      coordPickerOverlayRef.current.setPosition(undefined);
    }
    // 移除坐标拾取的 pointermove / singleclick 监听
    if (coordPointerMoveHandlerRef.current) {
      map.un("pointermove", coordPointerMoveHandlerRef.current);
      coordPointerMoveHandlerRef.current = null;
    }
    if (coordClickHandlerRef.current) {
      map.un("singleclick", coordClickHandlerRef.current);
      coordClickHandlerRef.current = null;
    }
    // 恢复默认光标
    map.getViewport().style.cursor = "";

    const tool = activeTool;

    // ===== 测距: 绘制折线, turf.length 计算累计距离 =====
    if (tool === "measure-distance" || tool === "measure-area") {
      const type = tool === "measure-distance" ? "LineString" : "Polygon";
      const draw = new Draw({
        source: measureSourceRef.current!,
        type: type as any,
        // 绘制过程中的临时样式 (虚线 + 半透明填充)
        style: new Style({
          stroke: new Stroke({ color: "rgba(0,200,150,0.7)", width: 2, lineDash: [5, 5] }),
          fill: new Fill({ color: "rgba(0,200,150,0.08)" }),
          image: new CircleStyle({
            radius: 4,
            fill: new Fill({ color: "#00C896" }),
            stroke: new Stroke({ color: "#ffffff", width: 2 }),
          }),
        }),
      });

      draw.on("drawend", (e) => {
        const feature = e.feature;
        const geom = feature.getGeometry();
        if (!geom) return;

        // 将 feature 转 GeoJSON (3857 -> 4326), 供 turf 计算
        const geojson = new GeoJSON().writeFeatureObject(feature, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        });

        let label = "";
        let position: number[];

        if (tool === "measure-distance") {
          // turf.length 计算累计距离 (公里)
          const length = turf.length(geojson as any, { units: "kilometers" });
          label = length < 1
            ? `距离 ${(length * 1000).toFixed(1)} 米`
            : `距离 ${length.toFixed(3)} 公里`;
          position = (geom as LineString).getLastCoordinate();
        } else {
          // turf.area 计算面积 (平方米), turf.length 计算周长 (公里)
          const area = turf.area(geojson as any);
          const perimeter = turf.length(geojson as any, { units: "kilometers" });
          const areaLabel = area < 1000000
            ? `${area.toFixed(0)} 平方米`
            : `${(area / 1000000).toFixed(3)} 平方公里`;
          label = `面积 ${areaLabel} · 周长 ${perimeter.toFixed(3)} 公里`;
          // 多边形取内部点作为标注位置
          position = (geom as any).getInteriorPoint().getCoordinates();
        }

        // 创建标注 Overlay (半透明黑底白字)
        const el = document.createElement("div");
        el.style.cssText =
          "background:rgba(0,0,0,0.78);color:#fff;padding:3px 8px;border-radius:4px;" +
          "font-size:11px;white-space:nowrap;pointer-events:none;font-family:var(--font-sans);";
        el.textContent = label;
        const overlay = new Overlay({
          element: el,
          positioning: "center-center" as any,
          offset: [0, -12],
          stopEvent: false,
        });
        overlay.setPosition(position);
        map.addOverlay(overlay);
        measureOverlaysRef.current.push(overlay);
      });

      map.addInteraction(draw);
      drawInteractionRef.current = draw;
      // 设置十字光标
      map.getViewport().style.cursor = "crosshair";
      return;
    }

    // ===== 坐标拾取: 鼠标悬停显示双坐标系, 点击复制到剪贴板 =====
    if (tool === "pick-coordinate") {
      // 创建或复用坐标拾取浮窗
      let overlay = coordPickerOverlayRef.current;
      if (!overlay) {
        const el = document.createElement("div");
        el.style.cssText =
          "background:rgba(0,0,0,0.82);color:#fff;padding:5px 9px;border-radius:4px;" +
          "font-size:11px;white-space:nowrap;pointer-events:none;font-family:var(--font-mono);line-height:1.5;";
        el.innerHTML = '<div style="color:#71717A">移动鼠标查看坐标</div>';
        overlay = new Overlay({
          element: el,
          positioning: "bottom-left" as any,
          offset: [12, -12],
          stopEvent: false,
        });
        map.addOverlay(overlay);
        coordPickerOverlayRef.current = overlay;
      }

      // pointermove: 实时显示 WGS84 + GCJ02 双坐标系
      const onPointerMove = (ev: any) => {
        const coord3857 = ev.coordinate;
        const gcj02 = toLonLat(coord3857);
        const [wgsLng, wgsLat] = gcj02ToWgs84(gcj02[0], gcj02[1]);
        const el = overlay!.getElement();
        if (el) {
          el.innerHTML =
            `<div>WGS84&nbsp; ${wgsLng.toFixed(6)}, ${wgsLat.toFixed(6)}</div>` +
            `<div>GCJ02&nbsp; ${gcj02[0].toFixed(6)}, ${gcj02[1].toFixed(6)}</div>`;
        }
        overlay!.setPosition(coord3857);
      };
      map.on("pointermove", onPointerMove);
      coordPointerMoveHandlerRef.current = onPointerMove;

      // singleclick: 复制 WGS84 坐标到剪贴板并 toast 提示
      const onClick = (ev: any) => {
        const gcj02 = toLonLat(ev.coordinate);
        const [wgsLng, wgsLat] = gcj02ToWgs84(gcj02[0], gcj02[1]);
        const text = `${wgsLng.toFixed(6)}, ${wgsLat.toFixed(6)}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(
            () => showToast(`坐标已复制：${text}`, "success"),
            () => showToast(`坐标：${text}`)
          );
        } else {
          showToast(`坐标：${text}`);
        }
      };
      map.on("singleclick", onClick);
      coordClickHandlerRef.current = onClick;

      map.getViewport().style.cursor = "crosshair";
      return;
    }

    // ===== 框选查询 / 多边形查询: 绘制几何, turf.booleanPointInPolygon 筛选命中要素 =====
    if (tool === "query-rectangle" || tool === "query-polygon") {
      const isRect = tool === "query-rectangle";
      // 框选用 Circle + createBox 几何函数, 多边形用 Polygon
      const draw = new Draw({
        source: querySourceRef.current!,
        type: isRect ? ("Circle" as any) : ("Polygon" as any),
        geometryFunction: isRect ? createBox() : undefined,
        style: new Style({
          stroke: new Stroke({ color: "rgba(250,204,21,0.9)", width: 2, lineDash: [6, 4] }),
          fill: new Fill({ color: "rgba(250,204,21,0.12)" }),
          image: new CircleStyle({
            radius: 4,
            fill: new Fill({ color: "#facc15" }),
            stroke: new Stroke({ color: "#ffffff", width: 2 }),
          }),
        }),
      });

      draw.on("drawend", (e) => {
        const feature = e.feature;
        const geom = feature.getGeometry();
        if (!geom) return;

        // 清除上一次查询几何, 保留当前绘制要素
        querySourceRef.current?.clear();
        querySourceRef.current?.addFeature(feature);

        // 将绘制几何转为 GeoJSON (EPSG:4326) 供 turf 判断
        const queryGeoJSON = new GeoJSON().writeFeatureObject(feature, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        });
        const queryPolygon = queryGeoJSON.geometry;

        // ===== 筛选充电站 (Point): turf.booleanPointInPolygon =====
        const matchedStations: ChargingStation[] = [];
        stationSourceRef.current?.getFeatures().forEach((f: any) => {
          try {
            const ptGeo = new GeoJSON().writeFeatureObject(f, {
              featureProjection: "EPSG:3857",
              dataProjection: "EPSG:4326",
            });
            if (turf.booleanPointInPolygon(ptGeo.geometry as any, queryPolygon as any)) {
              const coords = (f.getGeometry() as Point).getCoordinates();
              const lonLat = toLonLat(coords);
              matchedStations.push({
                id: f.get("id") ?? 0,
                name: f.get("name") ?? "",
                brand: f.get("brand") ?? "",
                lng: lonLat[0],
                lat: lonLat[1],
                fastChargers: f.get("fast_chargers") ?? f.get("fastChargers") ?? 0,
                slowChargers: f.get("slow_chargers") ?? f.get("slowChargers") ?? 0,
                address: f.get("address") ?? "",
                status: f.get("status") ?? "",
                district: f.get("district") ?? "",
                updateTime: f.get("update_time") ?? f.get("updateTime") ?? "",
              } as ChargingStation);
            }
          } catch { /* 忽略单个要素的解析错误 */ }
        });

        // ===== 筛选小区 (Polygon): 用 turf.centroid 取中心点再做点判断 =====
        const matchedCommunities: any[] = [];
        communitySourceRef.current?.getFeatures().forEach((f: any) => {
          try {
            const featGeo = new GeoJSON().writeFeatureObject(f, {
              featureProjection: "EPSG:3857",
              dataProjection: "EPSG:4326",
            });
            const centroid = turf.centroid(featGeo as any);
            if (turf.booleanPointInPolygon(centroid.geometry, queryPolygon as any)) {
              const center3857 = fromLonLat(centroid.geometry.coordinates as [number, number]);
              matchedCommunities.push({
                id: f.get("id") ?? 0,
                name: f.get("name") ?? "",
                district: f.get("district") ?? "",
                population: f.get("population_total") ?? f.get("population") ?? 0,
                coverageRatio: f.get("coverage_ratio") ?? 0,
                isBlindSpot: f.get("is_blind_spot") ?? false,
                coveredBy: f.get("covered_by") ?? null,
                _center: center3857,
              });
            }
          } catch { /* 忽略单个要素的解析错误 */ }
        });

        setQueryResult({
          stations: matchedStations,
          communities: matchedCommunities,
          geometry: queryPolygon,
        });
        // 默认切换到有命中结果的 Tab
        setQueryResultTab(matchedStations.length > 0 ? "stations" : "communities");
        showToast(
          `查询完成：充电站 ${matchedStations.length} 个，社区 ${matchedCommunities.length} 个`,
          "success"
        );
        // 绘制完成自动回到平移模式（避免停留在框选状态误触继续绘制）
        // 立即移除绘制交互 + 重置光标（不依赖 effect 重跑，杜绝多余点击）
        map.removeInteraction(draw);
        drawInteractionRef.current = null;
        map.getViewport().style.cursor = "";
        setActiveTool(null);
      });

      map.addInteraction(draw);
      drawInteractionRef.current = draw;
      map.getViewport().style.cursor = "crosshair";
      return;
    }

    // pan / null: 默认平移模式, 无特殊操作
  }, [activeTool, mapReady, showToast]);

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
          const props = json.data.features.map((f: any) => f.properties);
          setFeedbackList(props);
          // 缓存反馈原始数据 (含坐标), 供热力图按类型/评分筛选 (阶段三 任务 3.3)
          feedbackDataRef.current = json.data.features.map((f: any) => ({
            ...f.properties,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }));
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
    // 清空上一次分析的地图结果 (避免行政区切换后旧结果残留)
    serviceAreaSourceRef.current?.clear();
    blindSpotSourceRef.current?.clear();
    clusterSourceRef.current?.clear();
    if (districtBoundarySourceRef.current) districtBoundarySourceRef.current.clear();
    // 重置社区可见性 (等待新结果)
    communitySourceRef.current?.getFeatures().forEach((f: any) => f.set("_visible", true));
    communityLayerRef.current?.changed();
    // 阶段三 任务 3.4.2: 启动进度条动画 (0-90 随机增长, 完成后跳到 100)
    setCoverageProgress(0);
    const progressTimer = window.setInterval(() => {
      setCoverageProgress(prev => {
        const inc = 5 + Math.floor(Math.random() * 11); // 5-15
        return Math.min(90, prev + inc);
      });
    }, 200);
    try {
      const res = await fetch("/api/v1/analysis/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeMode, radius: coverageRadius || undefined, district: coverageDistrict, serviceAreaMode }),
      });
      const json = await res.json();
      if (json.success) {
        setCoverageSummary(json.data.summary);
        setCoverageResults(json.data.communityResults);
        setDistrictStats(json.data.districtStats);
        // 行政区过滤: 只保留目标行政区的社区面, 其他区社区隐藏 (避免"乱入")
        const coveredDistricts = new Set((json.data.communityResults || []).map((c: any) => c.district));
        communitySourceRef.current?.getFeatures().forEach((f: any) => {
          f.set("_visible", coveredDistricts.size === 0 || coveredDistricts.has(f.get("district")));
        });
        communityLayerRef.current?.changed();
        // 阶段五 等时圈: 保存等时圈覆盖率信息 (用于在分析面板展示来源比例)
        setIsochroneCoverage(json.data.isochroneCoverage || null);
        // 阶段三 任务 3.3: 保存分级统计与充电站效率, 供右侧饼图/柱图渲染
        setCoverageLevels(json.data.coverageLevels || []);
        setStationEfficiency(json.data.stationEfficiency || []);
        // 阶段三 任务 3.4.3: 缓存上次分析的社区总数, 供下次分析时的加载态文案使用
        lastCommunityCountRef.current = (json.data.communityResults || []).length;
        // 保存盲区聚类候选点 + 摘要, 供选址面板联动
        const clusters: BlindSpotCluster[] = json.data.blindSpotClusters || [];
        setBlindSpotClusters(clusters);
        setLastCoverageSummary(json.data.summary);
        // 提取盲区几何 (WGS84 GeoJSON Polygon), 跨 Tab 保留供 evaluate-site 联动判断
        lastCoverageBlindSpotsRef.current = (json.data.blindSpots?.features || []).map((f: any) => f.geometry);

        // 阶段四 任务 4.2.3: 压入历史记录, 最多保留 3 条 (超出则 shift 旧的)
        const historyItem: CoverageHistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          params: {
            chargeMode,
            radius: coverageRadius,
            district: coverageDistrict,
            serviceAreaMode,
          },
          summary: json.data.summary,
        };
        coverageHistoryRef.current = [...coverageHistoryRef.current, historyItem].slice(-3);
        setCoverageHistory([...coverageHistoryRef.current]);

        // 渲染服务区
        if (serviceAreaSourceRef.current) {
          serviceAreaSourceRef.current.clear();
          const saFeatures = readFeaturesFromWGS84(json.data.serviceAreas);
          serviceAreaSourceRef.current.addFeatures(saFeatures);
        }
        // 渲染行政区边界 (划定可视化界限)
        if (districtBoundarySourceRef.current) {
          districtBoundarySourceRef.current.clear();
          if (json.data.districtBoundary) {
            const bFeats = readFeaturesFromWGS84({ type: "FeatureCollection", features: [json.data.districtBoundary] });
            districtBoundarySourceRef.current.addFeatures(bFeats);
          }
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
        // 将 coverageRatio 和 level 写入 communitySource 中对应 Feature (阶段二 任务 2.2.2)
        if (communitySourceRef.current) {
          const commResults: any[] = json.data.communityResults || [];
          commResults.forEach((comm: any) => {
            // 按 id 匹配 communitySource 中的 Feature
            const feat = communitySourceRef.current!.getFeatureById(comm.id);
            if (feat) {
              feat.set("coverageRatio", comm.coverageRatio);
              feat.set("coverageLevel", comm.level);
            }
          });
        }
        // 渲染服务区重叠区 (阶段二 任务 2.3.2)
        if (overlapSourceRef.current && json.data.overlapAreas) {
          overlapSourceRef.current.clear();
          const ovFeatures = readFeaturesFromWGS84(json.data.overlapAreas);
          overlapSourceRef.current.addFeatures(ovFeatures);
        }
      }
    } catch (e) { console.error(e); }
    // 阶段三 任务 3.4.2: 分析完成, 进度跳到 100, 500ms 后清零并停止定时器
    window.clearInterval(progressTimer);
    setCoverageProgress(100);
    window.setTimeout(() => setCoverageProgress(0), 500);
    setCoverageLoading(false);
  };

  // =========================================================================
  // 阶段四 任务 4.3: CSV 导出 (前端纯生成, UTF-8 BOM, Excel 友好)
  // =========================================================================
  const exportCoverageCSV = () => {
    if (!coverageResults.length) {
      showToast("暂无分析结果可导出", "info");
      return;
    }
    // 阶段五 等时圈: CSV 首行追加服务区模式信息便于追溯
    const saModeLabel = serviceAreaMode === "buffer" ? "缓冲区" : serviceAreaMode === "isochrone" ? "等时圈" : "混合";
    const header = ["社区名", "行政区", "人口", "覆盖率(%)", "分级", "覆盖充电站"];
    const metaRow = [`# 服务区模式=${saModeLabel}`, `充电模式=${chargeMode === "fast" ? "快充" : "慢充"}`, `服务半径=${coverageRadius || (chargeMode === "fast" ? 800 : 400)}m`, `行政区=${coverageDistrict === "all" ? "全部" : coverageDistrict}`];
    const rows = coverageResults.map(c => [
      c.name,
      c.district,
      c.population,
      c.coverageRatio,
      // 优先用后端返回的 level, 兜底用 coverageRatio 推断
      c.level ?? (c.coverageRatio >= 90 ? "优秀"
        : c.coverageRatio >= 60 ? "良好"
        : c.coverageRatio >= 30 ? "一般"
        : c.coverageRatio >= 10 ? "较差"
        : "极差"),
      c.coveredBy || "无覆盖",
    ]);
    // 在表头前插入元信息行
    const allRows = [metaRow, header, ...rows];
    // CSV 转义: 含逗号/换行/引号的字段用双引号包裹, 内部双引号双写
    const csv = "\uFEFF" + allRows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    // 阶段四 任务 4.3.3: 文件名 覆盖分析_YYYYMMDD_HHmm.csv
    link.download = `覆盖分析_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV 已导出", "success");
  };

  // =========================================================================
  // 阶段四 任务 4.4: 打印报告 (组装 HTML 到新窗口, 触发浏览器打印)
  // =========================================================================
  const printCoverageReport = () => {
    if (!coverageSummary) {
      showToast("暂无分析结果可打印", "info");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("弹窗被拦截, 请允许浏览器弹窗后重试", "info");
      return;
    }
    // 参数显示
    const modeText = chargeMode === "fast" ? "快充" : "慢充";
    const radiusText = `${coverageRadius || (chargeMode === "fast" ? 800 : 400)}m`;
    const districtText = coverageDistrict === "all" ? "全部行政区" : coverageDistrict;
    // 阶段五 等时圈: 报告中标注服务区模式
    const saModeText = serviceAreaMode === "buffer" ? "圆形缓冲区" : serviceAreaMode === "isochrone" ? "路网等时圈" : "混合 (等时圈优先, 缺失回退缓冲区)";
    const isoCovText = isochroneCoverage ? `等时圈 ${isochroneCoverage.covered} 站 / 缓冲回退 ${isochroneCoverage.fallback} 站 (占比 ${isochroneCoverage.ratio}%)` : "";
    // Top10 盲区社区 (按人口降序, 仅"极差"分级)
    const top10Blind = coverageResults
      .filter(c => (c.level ?? (c.coverageRatio < 10 ? "极差" : "")) === "极差")
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
    // Top10 充电站效率 (按覆盖人口降序)
    const top10Stations = stationEfficiency.slice(0, 10);
    const html = `
      <!DOCTYPE html><html><head><title>覆盖分析报告</title>
      <style>
        body { font-family: -apple-system, "Microsoft YaHei", sans-serif; padding: 40px; color: #333; }
        h1 { font-size: 24px; border-bottom: 2px solid #00C896; padding-bottom: 8px; }
        h2 { font-size: 16px; margin-top: 24px; color: #00C896; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; }
        .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
        .metric { border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
        .metric-label { font-size: 11px; color: #666; }
        .metric-value { font-size: 20px; font-weight: bold; color: #00C896; }
        .footer { margin-top: 32px; font-size: 10px; color: #999; text-align: center; }
      </style></head><body>
      <h1>覆盖分析报告</h1>
      <p>生成时间：${new Date().toLocaleString("zh-CN")}</p>
      <h2>分析参数</h2>
      <table><tr><th>充电模式</th><th>服务半径</th><th>行政区</th><th>服务区模式</th></tr>
      <tr><td>${modeText}</td><td>${radiusText}</td><td>${districtText}</td><td>${saModeText}${isoCovText ? `<br/><small style="color:#666;">${isoCovText}</small>` : ""}</td></tr></table>
      <h2>核心指标</h2>
      <div class="metrics">
        <div class="metric"><div class="metric-label">覆盖率</div><div class="metric-value">${coverageSummary.coverageRate}%</div></div>
        <div class="metric"><div class="metric-label">人口覆盖率</div><div class="metric-value">${coverageSummary.populationCoverageRate ?? 0}%</div></div>
        <div class="metric"><div class="metric-label">盲区社区</div><div class="metric-value">${coverageSummary.blindSpotCommunities}</div></div>
        <div class="metric"><div class="metric-label">盲区人口</div><div class="metric-value">${coverageSummary.blindSpotPopulation.toLocaleString()}</div></div>
        <div class="metric"><div class="metric-label">充电站总数</div><div class="metric-value">${coverageSummary.totalStations}</div></div>
        <div class="metric"><div class="metric-label">冗余度</div><div class="metric-value">${coverageSummary.redundancyScore ?? 0}</div></div>
      </div>
      <h2>覆盖率分级统计</h2>
      <table><tr><th>分级</th><th>社区数</th><th>人口</th></tr>
      ${coverageLevels.map(l => `<tr><td>${l.level}</td><td>${l.count}</td><td>${l.population.toLocaleString()}</td></tr>`).join("")}
      </table>
      <h2>Top 10 盲区社区</h2>
      <table><tr><th>排名</th><th>社区名</th><th>行政区</th><th>人口</th><th>覆盖率</th></tr>
      ${top10Blind.length > 0
        ? top10Blind.map((c, i) => `<tr><td>${i + 1}</td><td>${c.name}</td><td>${c.district}</td><td>${c.population.toLocaleString()}</td><td>${c.coverageRatio}%</td></tr>`).join("")
        : `<tr><td colspan="5" style="text-align:center;color:#999;">暂无盲区社区</td></tr>`}
      </table>
      <h2>Top 10 充电站效率</h2>
      <table><tr><th>排名</th><th>充电站</th><th>品牌</th><th>覆盖社区</th><th>覆盖人口</th><th>平均覆盖率</th></tr>
      ${top10Stations.length > 0
        ? top10Stations.map((s, i) => `<tr><td>${i + 1}</td><td>${s.stationName}</td><td>${s.brand}</td><td>${s.coveredCommunities}</td><td>${s.coveredPopulation.toLocaleString()}</td><td>${s.avgCoverageRatio}%</td></tr>`).join("")
        : `<tr><td colspan="6" style="text-align:center;color:#999;">暂无充电站效率数据</td></tr>`}
      </table>
      <div class="footer">GeoPlan 充电覆盖分析平台 · 自动生成</div>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // 延迟 500ms 等待样式渲染后触发打印
    setTimeout(() => printWindow.print(), 500);
    showToast("打印报告已生成", "success");
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
        // 阶段二 任务 2.3.4: 携带 ROI 数据 (基于默认参数估算)
        roi: {
          fastChargers: 4,
          slowChargers: 4,
          coveredPopulation: siteMetrics.covered_population,
        },
      }),
    });
    const json = await res.json();
    if (json.success) {
      setSchemes([...schemes, json.data]);
      setSchemeName("");
      showToast("方案已保存", "success");
    }
  };

  // =========================================================================
  // 阶段二 任务 2.1: 负荷热力图 - 调用后端接口获取数据并渲染 HeatmapLayer
  // =========================================================================
  useEffect(() => {
    if (!showHeatmap) {
      // 关闭: 隐藏图层
      heatmapLayerRef.current?.setVisible(false);
      return;
    }
    // 开启: 调用接口获取数据
    fetch("/api/v1/analysis/heatmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ district: "all" }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.success && heatmapSourceRef.current) {
          const stations = json.data.stations || [];
          setHeatmapData(stations);
          // 缓存负荷数据, 供弹窗显示
          stationLoadCacheRef.current = new Map(
            stations.map((s: any) => [s.id, { load: s.load, level: s.level }])
          );
          // 清空并填充热力图 source
          heatmapSourceRef.current.clear();
          stations.forEach((st: any) => {
            // 后端坐标为 WGS84, 转换为 GCJ02 后投影到底图
            const [gcjLng, gcjLat] = wgs84ToGcj02(st.lng, st.lat);
            const feat = new Feature({
              geometry: new Point(fromLonLat([gcjLng, gcjLat])),
              load: st.load,
              level: st.level,
              stationId: st.id,
            });
            heatmapSourceRef.current!.addFeature(feat);
          });
          heatmapLayerRef.current?.setVisible(true);
        }
      })
      .catch(e => console.error("热力图加载失败:", e));
  }, [showHeatmap]);

  // =========================================================================
  // 阶段三 任务 3.3: 公众反馈热力图 - 按类型/评分筛选渲染
  // =========================================================================
  useEffect(() => {
    const layer = feedbackHeatmapLayerRef.current;
    const source = feedbackHeatmapSourceRef.current;
    if (!layer || !source) return;

    if (!showFeedbackHeatmap) {
      layer.setVisible(false);
      return;
    }

    // 从缓存的反馈数据中按筛选条件渲染
    const all = feedbackDataRef.current || [];
    const filtered = all.filter(f => {
      // 类型筛选
      if (feedbackHeatmapType !== "all" && f.type !== feedbackHeatmapType) return false;
      // 评分筛选 (仅评价类型有 rating, 0 = 不限)
      if (feedbackHeatmapRating > 0) {
        if (f.type !== "evaluation") return false;
        if (Number(f.rating || 0) < feedbackHeatmapRating) return false;
      }
      return true;
    });

    source.clear();
    filtered.forEach(f => {
      // 后端坐标为 WGS84, 转换为 GCJ02 后投影到底图
      const [gcjLng, gcjLat] = wgs84ToGcj02(Number(f.lng), Number(f.lat));
      const feat = new Feature({
        geometry: new Point(fromLonLat([gcjLng, gcjLat])),
        type: f.type,
        rating: f.rating,
        description: f.description,
      });
      source.addFeature(feat);
    });
    layer.setVisible(true);
  }, [showFeedbackHeatmap, feedbackHeatmapType, feedbackHeatmapRating]);

  // =========================================================================
  // 阶段二 任务 2.3.2: ROI 估算按钮 - 打开弹窗 (携带当前选址参数)
  // =========================================================================
  const runRoiEstimate = () => {
    if (!siteMetrics) {
      showToast("请先放置虚拟站点进行选址评估", "info");
      return;
    }
    setRoiInitParams({
      fastChargers: 4,
      slowChargers: 4,
      coveredPopulation: siteMetrics.covered_population || 0,
    });
    setRoiDialogOpen(true);
  };

  // =========================================================================
  // 阶段二 任务 2.2.2: 深度对比 - 打开对比弹窗 (需选中 2 个方案)
  // =========================================================================
  const runCompareSchemes = () => {
    if (compareSchemes.length !== 2) {
      showToast("请选择 2 个方案进行深度对比", "info");
      return;
    }
    setCompareDialogOpen(true);
  };

  // =========================================================================
  // 阶段二 任务 2.4.2: 竞争态势分析按钮
  // =========================================================================
  const runCompetitionAnalysis = () => {
    setCompetitionDialogOpen(true);
  };

  // =========================================================================
  // 阶段二 任务 2.5.2: 缺口预测按钮
  // =========================================================================
  const runGapPrediction = () => {
    setGapDialogOpen(true);
  };

  // =========================================================================
  // 阶段二 任务 2.4.3: 在空白市场选址 (跳转选址 Tab + 放置虚拟站点)
  // =========================================================================
  const placeAtBlankMarket = (lng: number, lat: number) => {
    setActiveTab("site");
    setTimeout(() => placeVirtualStation(lng, lat), 100);
    showToast("已跳转选址决策, 已在该空白市场放置虚拟站点", "success");
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
    if (!coverageChartRef.current || districtStats.length === 0 || rightPanelTab !== "charts") return;
    const container = coverageChartRef.current;
    const chart = echarts.init(container);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { data: ["已覆盖", "盲区"], textStyle: { color: "#6B7280", fontSize: 9 }, top: 0, itemWidth: 10, itemHeight: 8 },
      grid: { left: "2%", right: "3%", bottom: "2%", top: 24, containLabel: true },
      xAxis: { type: "category", data: districtStats.map(d => d.district), axisLabel: { color: "#6B7280", fontSize: 9, rotate: 25 } },
      yAxis: { type: "value", axisLabel: { color: "#9CA3AF", fontSize: 9 }, splitLine: { lineStyle: { color: "#E5E7EB" } } },
      series: [
        { name: "已覆盖", type: "bar", stack: "total", data: districtStats.map(d => d.covered), itemStyle: { color: "#00C896" } },
        { name: "盲区", type: "bar", stack: "total", data: districtStats.map(d => d.blindSpot), itemStyle: { color: "#F56C6C" } },
      ],
    });
    // 确保 flex 布局计算完成后再 resize
    const raf = requestAnimationFrame(() => chart.resize());
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(container);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); chart.dispose(); };
  }, [districtStats, rightPanelTab]);

  // 阶段三 任务 3.3.1: 覆盖率分级饼图 (5 级色阶, 显示各分级社区数占比)
  useEffect(() => {
    if (!coveragePieChartRef.current || coverageLevels.length === 0 || rightPanelTab !== "charts") return;
    // 折叠时不渲染, 避免隐藏后尺寸为 0 导致 ECharts 报错
    if (coveragePieCollapsed) return;
    const container = coveragePieChartRef.current;
    const chart = echarts.init(container);
    // 分级色: 极差红 / 较差橙 / 一般黄 / 良好浅绿 / 优秀深绿
    const levelColorMap: Record<string, string> = {
      "极差": "#EF4444",
      "较差": "#F59E0B",
      "一般": "#FACC15",
      "良好": "#84CC16",
      "优秀": "#10B981",
    };
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "item", formatter: "{b}: {c} 个社区 ({d}%)" },
      legend: { bottom: 0, textStyle: { color: "#6B7280", fontSize: 9 }, itemWidth: 10, itemHeight: 8 },
      series: [{
        type: "pie",
        radius: ["30%", "55%"],
        center: ["50%", "40%"],
        avoidLabelOverlap: true,
        label: { show: true, formatter: "{b}\n{c}", fontSize: 9, color: "#6B7280" },
        data: coverageLevels.map(l => ({
          name: l.level,
          value: l.count,
          itemStyle: { color: levelColorMap[l.level] || "#9CA3AF" },
        })),
      }],
    });
    const raf = requestAnimationFrame(() => chart.resize());
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(container);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); chart.dispose(); };
  }, [coverageLevels, coveragePieCollapsed, rightPanelTab]);

  // 阶段三 任务 3.3.2: 充电站效率 Top10 横向柱图 (按覆盖人口排序)
  useEffect(() => {
    if (!stationEffChartRef.current || stationEfficiency.length === 0 || rightPanelTab !== "charts") return;
    // 折叠时不渲染
    if (stationEffCollapsed) return;
    const container = stationEffChartRef.current;
    const chart = echarts.init(container);
    const top10 = stationEfficiency.slice(0, 10);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: "2%", right: "8%", bottom: "2%", top: 8, containLabel: true },
      xAxis: { type: "value", axisLabel: { color: "#9CA3AF", fontSize: 9 }, splitLine: { lineStyle: { color: "#E5E7EB" } } },
      yAxis: {
        type: "category",
        // 反转使 Top1 显示在最上方
        data: top10.map(s => s.stationName).reverse(),
        axisLabel: { color: "#6B7280", fontSize: 9 },
        inverse: false,
      },
      series: [{
        name: "覆盖人口",
        type: "bar",
        // 同步反转数据以匹配 yAxis 顺序
        data: top10.map(s => s.coveredPopulation).reverse(),
        itemStyle: { color: "#00C896" },
        label: { show: true, position: "right", color: "#6B7280", fontSize: 9 },
      }],
    });
    const raf = requestAnimationFrame(() => chart.resize());
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(container);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); chart.dispose(); };
  }, [stationEfficiency, stationEffCollapsed, rightPanelTab]);

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

  // 阶段五 等时圈: 拉取预计算进度 + 触发预计算 + 轮询
  const fetchIsochroneProgress = useCallback(() => {
    if (!authToken) return;
    authFetch("/api/v1/admin/isochrone-progress")
      .then(r => r.json())
      .then(j => { if (j.success) setIsochroneProgress(j.data); })
      .catch(() => {});
  }, [authToken]);

  const triggerIsochronePrecompute = useCallback(async (force: boolean = false) => {
    if (!authToken) return;
    try {
      const r = await authFetch("/api/v1/admin/precompute-isochrones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const j = await r.json();
      if (j.success) {
        showToastCtx?.(j.message || `已触发 ${force ? "全量" : "增量"}预计算`, "success");
        setIsochronePolling(true);
      } else {
        showToastCtx?.(j.message || "触发失败", "warning");
      }
    } catch (e: any) {
      showToastCtx?.("触发失败: " + e.message, "error");
    }
  }, [authToken, showToastCtx]);

  // 轮询进度: 进入 admin/isochrone Tab 或已有任务在跑时, 每 3 秒拉一次
  useEffect(() => {
    if (activeTab !== "admin" || adminTab !== "isochrone") return;
    fetchIsochroneProgress();
    const shouldPoll = isochronePolling || isochroneProgress?.running;
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      fetchIsochroneProgress();
      // 任务完成后停止轮询
      if (isochroneProgress && !isochroneProgress.running) {
        setIsochronePolling(false);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeTab, adminTab, isochronePolling, isochroneProgress?.running, fetchIsochroneProgress]);

  useEffect(() => {
    if (activeTab === "admin" && authToken) {
      loadAdminData();
    }
  }, [activeTab, authToken, loadAdminData]);

  // =========================================================================
  // 阶段四 任务 4.1: 全局快捷键系统
  // 1/2/3/4 切换 Tab, M/A/C/Q/G/P 触发工具, Ctrl+K 命令面板, Esc 关闭, Ctrl+/ 帮助
  // =========================================================================
  // 所有子系统定义 (提前声明, 供快捷键 useEffect 使用)
  const tabIcons: Record<string, any> = { Map: MapIcon, Radar, Target, MessageSquare, Bot, Settings };
  const allTabs = [
    { id: "map" as const, label: "地图查询", icon: MapIcon },
    { id: "coverage" as const, label: "覆盖分析", icon: Radar },
    { id: "site" as const, label: "选址决策", icon: Target },
    { id: "admin" as const, label: "系统管理", icon: Settings },
  ];
  // 根据角色过滤可见 Tab
  const visibleTabs = allTabs.filter(t => allowedTabs.includes(t.id));

  useEffect(() => {
    if (!currentUser) return;
    const handler = (e: KeyboardEvent) => {
      // 输入框/文本域聚焦时不响应快捷键
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        // 仅响应 Esc 和 Ctrl 组合键
        if (e.key !== "Escape" && !e.ctrlKey && !e.metaKey) return;
      }

      // Ctrl+K / Cmd+K: 命令面板
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }
      // Ctrl+/ 或 Ctrl+?: 快捷键帮助
      if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        setShortcutsHelpOpen(prev => !prev);
        return;
      }
      // Esc: 关闭所有弹窗
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setShortcutsHelpOpen(false);
        // 同时关闭其他弹窗 (ROI/对比/竞争/缺口/打印)
        setRoiDialogOpen(false);
        setCompetitionDialogOpen(false);
        setGapDialogOpen(false);
        setCompareDialogOpen(false);
        setPrintDialogOpen(false);
        return;
      }

      // 以下快捷键在弹窗打开时不响应
      if (commandPaletteOpen || shortcutsHelpOpen || roiDialogOpen || competitionDialogOpen || gapDialogOpen || compareDialogOpen || printDialogOpen) return;

      // 1/2/3/4 切换 Tab (检查角色权限)
      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        const tabMap: Record<string, SubsystemTab> = { "1": "map", "2": "coverage", "3": "site", "4": "admin" };
        const target = tabMap[e.key];
        if (target && allowedTabs.includes(target)) {
          e.preventDefault();
          setActiveTab(target);
          showToastCtx(`已切换到 ${allTabs.find(t => t.id === target)?.label}`, "info");
        }
        return;
      }

      // 地图工具快捷键 (仅地图 Tab 下生效)
      if (activeTab !== "map") return;

      const key = e.key.toLowerCase();
      const toolMap: Record<string, MapTool> = {
        m: "measure-distance",
        a: "measure-area",
        c: "pick-coordinate",
        q: "query-rectangle",
        g: "query-polygon",
      };
      if (toolMap[key]) {
        e.preventDefault();
        handleToolChange(toolMap[key]);
        showToastCtx(`已激活: ${({ m: "测距", a: "测面", c: "坐标拾取", q: "框选查询", g: "多边形查询" } as any)[key]}`, "info");
        return;
      }
      // P: 打印
      if (key === "p") {
        e.preventDefault();
        setPrintDialogOpen(true);
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [currentUser, activeTab, allowedTabs, commandPaletteOpen, shortcutsHelpOpen, roiDialogOpen, competitionDialogOpen, gapDialogOpen, compareDialogOpen, printDialogOpen, handleToolChange, showToastCtx, allTabs]);

  // 社区详情弹窗: 计算距离社区最近的充电站 Top5 (阶段二 任务 2.5.3)
  const nearbyStations = useMemo(() => {
    if (!communityDetail) return [];
    // 从 communitySource 取社区 feature 质心
    const commFeat = communitySourceRef.current?.getFeatureById(communityDetail.id);
    if (!commFeat) return [];
    const geom = commFeat.getGeometry();
    if (!geom || !geom.getExtent) return [];
    const ext = geom.getExtent();
    const center3857: [number, number] = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
    const centerLonLat = toLonLat(center3857);
    const from = turf.point(centerLonLat);
    // 遍历所有充电站, 计算距离
    const stations = stationSourceRef.current?.getFeatures() || [];
    const ranked = stations.map((f: any) => {
      const g = f.getGeometry();
      if (!g) return null;
      const coord = toLonLat(g.getCoordinates());
      const to = turf.point(coord);
      const dist = turf.distance(from, to, { units: "kilometers" });
      return {
        name: f.get("name") || "未知站点",
        brand: f.get("brand") || "其他品牌",
        fastChargers: f.get("fastChargers") || 0,
        slowChargers: f.get("slowChargers") || 0,
        distance: dist,
      };
    }).filter(Boolean) as { name: string; brand: string; fastChargers: number; slowChargers: number; distance: number }[];
    ranked.sort((a, b) => a.distance - b.distance);
    return ranked.slice(0, 5);
  }, [communityDetail]);

  // 命令面板: 命令执行回调 (阶段四 任务 4.2)
  const handleCommandExecute = useCallback((cmd: any) => {
    switch (cmd.id) {
      case "tab-map": setActiveTab("map"); break;
      case "tab-coverage": if (allowedTabs.includes("coverage")) setActiveTab("coverage"); break;
      case "tab-site": if (allowedTabs.includes("site")) setActiveTab("site"); break;
      case "tab-admin": if (allowedTabs.includes("admin")) setActiveTab("admin"); break;
      case "tool-measure-distance": handleToolChange("measure-distance"); break;
      case "tool-measure-area": handleToolChange("measure-area"); break;
      case "tool-pick-coordinate": handleToolChange("pick-coordinate"); break;
      case "tool-query-rectangle": handleToolChange("query-rectangle"); break;
      case "tool-query-polygon": handleToolChange("query-polygon"); break;
      case "tool-print": setPrintDialogOpen(true); break;
      case "clear-measurements": handleClearMeasurements(); break;
      case "open-dashboard": setShowDashboard(true); break;
      case "open-roi": if (siteMetrics) setRoiDialogOpen(true); else showToastCtx("请先放置虚拟站点", "warning"); break;
      case "open-competition": setCompetitionDialogOpen(true); break;
      case "open-gap": setGapDialogOpen(true); break;
      case "toggle-theme": toggleTheme(); break;
    }
  }, [allowedTabs, handleToolChange, handleClearMeasurements, siteMetrics, toggleTheme, showToastCtx]);

  // =========================================================================
  // 渲染
  // =========================================================================

  // -------------------------------------------------------------------------
  // 登录页面
  // -------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <LoginView
        loginForm={loginForm}
        onLoginFormChange={(field, value) => setLoginForm(prev => ({ ...prev, [field]: value }))}
        loginError={loginError}
        loginLoading={loginLoading}
        onLogin={handleLogin}
        onFillDemo={fillDemoAccount}
      />
    );
  }

  return (
    <div
      className="h-screen flex overflow-hidden no-select"
      style={{ background: "var(--color-canvas)", fontFamily: "var(--font-sans)" }}
    >
      {/* 阶段三 任务 3.4.2: 顶部固定进度条 (覆盖分析中显示, 0-100%) */}
      {coverageProgress > 0 && (
        <div
          className="fixed top-0 left-0 right-0 h-1 z-50"
          style={{ background: "transparent" }}
        >
          <div
            className="h-full transition-all duration-200 ease-out"
            style={{
              width: `${coverageProgress}%`,
              background: "var(--color-brand)",
            }}
          />
        </div>
      )}
      {/* ===== 侧边栏 (GIS 指挥甲板) ===== */}
      <Sidebar
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        mobileSidebarOpen={mobileSidebarOpen}
        visibleTabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenDashboard={() => setShowDashboard(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* ===== 右侧主区域 ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 头部 - GIS 指挥甲板: 玻璃拟态 + 精致信息架构 */}
        <TopBar
          activeTab={activeTab}
          visibleTabs={visibleTabs}
          toggleSidebar={toggleSidebar}
          onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)}
          darkTheme={darkTheme}
          toggleTheme={toggleTheme}
          onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          locating={locating}
          onLocate={locateUser}
          map={mapRef.current}
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onClearMeasurements={handleClearMeasurements}
        />

        {/* 内容区域 (垂直功能栏 + 水平分析栏 + 地图) - 主背景改 Zinc-50 */}
        <div className="flex-1 flex min-w-0 overflow-hidden" style={{ background: "var(--color-canvas)" }}>
          {/* ===== 垂直功能栏: 地图展示与查询 (仅地图 Tab, Linear 风紧凑面板) - 阶段四 任务 4.4: 响应式自适应 ===== */}
        {activeTab === "map" && (
          <MapVerticalBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searching={searching}
            setSearching={setSearching}
            searchResults={searchResults}
            setSearchResults={setSearchResults}
            setSearchResult={setSearchResult}
            showSearchDropdown={showSearchDropdown}
            setShowSearchDropdown={setShowSearchDropdown}
            selectSearchResult={selectSearchResult}
            searchSourceRef={searchSourceRef}
            layerOrder={layerOrder}
            setLayerOrder={setLayerOrder}
            layerOpacity={layerOpacity}
            setLayerOpacity={setLayerOpacity}
            showStations={showStations}
            setShowStations={setShowStations}
            showCommunities={showCommunities}
            setShowCommunities={setShowCommunities}
            showFeedback={showFeedback}
            setShowFeedback={setShowFeedback}
            showMeasure={showMeasure}
            setShowMeasure={setShowMeasure}
            isochroneCoverage={isochroneCoverage}
            showIsochroneLayer={showIsochroneLayer}
            setShowIsochroneLayer={setShowIsochroneLayer}
            availableBrands={availableBrands}
            visibleBrands={visibleBrands}
            setVisibleBrands={setVisibleBrands}
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
            heatmapData={heatmapData}
            showFeedbackHeatmap={showFeedbackHeatmap}
            setShowFeedbackHeatmap={setShowFeedbackHeatmap}
            feedbackHeatmapType={feedbackHeatmapType}
            setFeedbackHeatmapType={setFeedbackHeatmapType}
            feedbackHeatmapRating={feedbackHeatmapRating}
            setFeedbackHeatmapRating={setFeedbackHeatmapRating}
            regionStats={regionStats}
          />
        )}

          {/* ===== 主列: 水平分析栏 + 地图 ===== */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* ===== 水平分析栏 (Bento 指挥甲板: 玻璃拟态 + 动态高度) ===== */}
            {(activeTab === "site" || activeTab === "coverage") && (
              <div
                className="shrink-0 flex gap-0 overflow-x-auto animate-panel-enter transition-all"
                style={{
                  // 覆盖分析：窄条（44px 参数 + 84px 指标卡 + 可选历史对比），避免占据地图空间
                  height: activeTab === "site"
                    ? (siteMetrics ? (schemes.length > 0 ? 270 : 200) : 80)
                    : (coverageSummary ? 198 : (coverageLoading ? 80 : 140)),
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(250,250,250,0.85) 100%)",
                  backdropFilter: "blur(16px) saturate(1.2)",
                  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
                  boxShadow: "0 4px 24px -4px rgba(0,0,0,0.06)",
                  zIndex: 10,
                }}
              >
                {/* 选址决策 (仅选址 Tab) */}
                {activeTab === "site" && (
                <div className="flex-1 min-w-[420px] px-3 py-2.5 overflow-y-auto">
                  <SiteControlBar
                    activeTab={activeTab}
                    siteRadius={siteRadius}
                    siteChargeMode={siteChargeMode}
                    siteBrand={siteBrand}
                    schemeName={schemeName}
                    compareSchemes={compareSchemes}
                    virtualStation={virtualStation}
                    siteMetrics={siteMetrics}
                    availableBrands={availableBrands}
                    brands={BRANDS}
                    brandConfig={BRAND_CONFIG}
                    onRadiusChange={(v) => {
                      setSiteRadius(v);
                      siteRadiusRef.current = v;
                      if (virtualStation) evaluateSite(virtualStation.lng, virtualStation.lat);
                    }}
                    onChargeModeChange={setSiteChargeMode}
                    onBrandChange={setSiteBrand}
                    onSchemeNameChange={setSchemeName}
                    onSaveScheme={saveScheme}
                    onRunRoi={runRoiEstimate}
                    onRunCompare={runCompareSchemes}
                  />
                  <SiteResultPanel
                    siteMetrics={siteMetrics}
                    siteInBlindSpot={siteInBlindSpot}
                    lastCoverageSummary={lastCoverageSummary}
                    schemes={schemes}
                    compareSchemes={compareSchemes}
                    onToggleCompare={(id, checked) =>
                      setCompareSchemes(prev =>
                        checked ? (prev.length < 2 ? [...prev, id] : [prev[1], id]) : prev.filter(x => x !== id)
                      )
                    }
                    onNotify={showToast}
                  />
                </div>
                )}

                {/* ===== 覆盖分析控制面板 (CoverageControlBar 组件) ===== */}
        {activeTab === "coverage" && (
          <CoverageControlBar
            chargeMode={chargeMode}
            setChargeMode={setChargeMode}
            coverageRadius={coverageRadius}
            setCoverageRadius={setCoverageRadius}
            coverageDistrict={coverageDistrict}
            setCoverageDistrict={setCoverageDistrict}
            serviceAreaMode={serviceAreaMode}
            setServiceAreaMode={setServiceAreaMode}
            coverageViewMode={coverageViewMode}
            setCoverageViewMode={setCoverageViewMode}
            regionStats={regionStats}
            onDistrictChange={(val) => {
              setCoverageDistrict(val);
              // 切换行政区后飞行至该区中心
              const wgsCenter = DISTRICT_CENTERS[val] || [117.2846, 34.262];
              const [gcjLng, gcjLat] = wgs84ToGcj02(wgsCenter[0], wgsCenter[1]);
              mapRef.current?.getView().animate({
                center: fromLonLat([gcjLng, gcjLat]),
                zoom: val === "all" ? 11 : 12,
                duration: 800,
              });
            }}
            coverageLoading={coverageLoading}
            coverageSummary={coverageSummary}
            coverageResults={coverageResults}
            isochroneCoverage={isochroneCoverage}
            blindSpotClusters={blindSpotClusters}
            selectedCoverageLevels={selectedCoverageLevels}
            onToggleCoverageLevel={toggleCoverageLevel}
            showServiceArea={showServiceArea}
            onToggleServiceArea={toggleServiceArea}
            showOverlapArea={showOverlapArea}
            onToggleOverlapArea={toggleOverlapArea}
            runCoverageAnalysis={runCoverageAnalysis}
            exportCoverageCSV={exportCoverageCSV}
            printCoverageReport={printCoverageReport}
          />
        )}

              </div>
            )}



            {/* ===== 地图容器 (OpenLayers 挂载点) ===== */}
            <div className="flex-1 relative overflow-hidden">
              {/* 地图背景纹理 — subtle 点阵网格, 增强空间感 */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 0,
                  backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  display: activeTab === "admin" ? "none" : "block",
                }}
              />
              {/* 地图 - 阶段四 任务 4.4.2: 移动端全屏 */}
              <div ref={mapContainerRef} className="map-print-container absolute inset-0 w-full h-full mobile-map-fullscreen"
                style={{ zIndex: 1, display: activeTab === "admin" ? "none" : "block" }} />

              {/* 阶段三 任务 3.4.2: 覆盖分析中显示地图半透明遮罩 + 中央文案 */}
              {activeTab === "coverage" && coverageLoading && (
                <div
                  className="absolute inset-0 z-5 flex items-center justify-center animate-fade-in"
                  style={{ background: "rgba(255,255,255,0.6)" }}
                >
                  <div
                    className="rounded-lg px-4 py-3 flex items-center gap-2"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-md)" }}
                  >
                    <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "var(--color-brand)" }} />
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-2)" }}>
                      {/* 阶段三 任务 3.4.3: N 取自上次分析的社区总数, 首次为空时只显示"正在分析..." */}
                      {lastCommunityCountRef.current > 0
                        ? `正在分析 ${lastCommunityCountRef.current} 个社区...`
                        : "正在分析..."}
                    </span>
                  </div>
                </div>
              )}

              {/* 地图工具栏已移至顶部横栏 (避免遮挡地图) */}

              {/* 空间查询结果浮窗已移至主界面顶层 (fixed 视口定位) */}

              {/* 候选点选中弹窗 (地图右上角, Bento 玻璃拟态) */}
              {selectedCluster && (
                <div
                  className="absolute top-16 right-3 z-40 w-[240px] overflow-hidden pointer-events-auto animate-panel-enter bento-tile"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,250,0.9) 100%)",
                    backdropFilter: "blur(20px) saturate(1.4)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    boxShadow: "var(--shadow-elevated)",
                    borderRadius: 14,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* 标题栏 — 品牌色 subtle 背景, 无渐变 */}
                  <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ background: "rgba(0,200,150,0.08)", borderBottom: "1px solid rgba(0,200,150,0.12)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,200,150,0.12)" }}>
                      <MapPin className="w-3.5 h-3.5" style={{ color: "var(--color-brand-text)" }} />
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: "var(--color-brand-text)" }}>候选点 #{selectedCluster.clusterId}</span>
                    <button onClick={() => setSelectedCluster(null)}
                      className="ml-auto w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                      style={{ color: "var(--color-ink-4)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* 内容区 */}
                  <div className="px-3.5 py-3 space-y-2 text-[11px]" style={{ color: "var(--color-ink-2)" }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: "var(--color-ink-4)" }}>覆盖社区</span>
                      <span className="font-semibold font-num" style={{ color: "var(--color-brand-text)" }}>{selectedCluster.communityCount} 个</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: "var(--color-ink-4)" }}>盲区人口</span>
                      <span className="font-semibold font-num" style={{ color: "var(--color-warning)" }}>{selectedCluster.population.toLocaleString()} 人</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: "var(--color-ink-4)" }}>坐标 (WGS84)</span>
                      <span className="font-mono text-[10px]" style={{ color: "var(--color-ink-3)" }}>{selectedCluster.center[0].toFixed(4)}, {selectedCluster.center[1].toFixed(4)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab("site");
                        placeVirtualStation(selectedCluster.center[0], selectedCluster.center[1]);
                        setSelectedCluster(null);
                      }}
                      className="w-full mt-2 text-white text-[11px] font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all btn-brand"
                      style={{ borderRadius: 10 }}
                    >
                      <Target className="w-3.5 h-3.5" /> 在此选址
                    </button>
                  </div>
                </div>
              )}

          {/* 社区详情弹窗 (屏幕中央模态, Bento 玻璃拟态) */}
          {communityDetailOpen && communityDetail && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
              style={{ background: "rgba(9,9,11,0.45)" }}
              onClick={() => { setCommunityDetailOpen(false); setCommunityDetail(null); }}
            >
              <div
                className="w-[380px] overflow-hidden animate-scale-in bento-tile"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.95) 100%)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  boxShadow: "var(--shadow-elevated)",
                  borderRadius: 16,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 标题栏 */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-muted)" }}>
                  <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink-1)" }}>
                    {communityDetail.name}
                  </h3>
                  <button
                    onClick={() => { setCommunityDetailOpen(false); setCommunityDetail(null); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: "var(--color-ink-4)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* 内容区 */}
                <div className="px-4 py-3 space-y-2.5 text-[12px]">
                  {/* 行政区 / 人口 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: "var(--color-ink-5)" }}>行政区</span>
                      <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: "var(--color-subtle)", color: "var(--color-ink-3)" }}>
                        {communityDetail.district}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: "var(--color-ink-5)" }}>人口</span>
                      <span className="font-num font-medium" style={{ color: "var(--color-ink-2)" }}>
                        {communityDetail.population.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* 覆盖率 + 分级色块 */}
                  <div className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: "var(--color-subtle)" }}>
                    <span style={{ color: "var(--color-ink-5)" }}>覆盖率</span>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const ratio = communityDetail.coverageRatio;
                        let level = "极差";
                        if (ratio >= 90) level = "优秀";
                        else if (ratio >= 60) level = "良好";
                        else if (ratio >= 30) level = "一般";
                        else if (ratio >= 10) level = "较差";
                        const color = COVERAGE_LEVEL_COLORS[level];
                        return (
                          <>
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                            <span className="text-[11px]" style={{ color }}>{level}</span>
                            <span className="font-num font-bold text-[13px]" style={{ color }}>
                              {ratio.toFixed(1)}%
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {/* 覆盖充电站列表 (按距离升序, Top5) */}
                  <div>
                    <p className="text-[11px] mb-1.5" style={{ color: "var(--color-ink-5)" }}>附近充电站 (按距离排序)</p>
                    {nearbyStations.length === 0 ? (
                      <p className="text-[11px] py-2 text-center" style={{ color: "var(--color-ink-5)" }}>暂无充电站数据</p>
                    ) : (
                      <div className="space-y-1">
                        {nearbyStations.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-1 px-2 rounded"
                            style={{ background: "var(--color-subtle)" }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: BRAND_CONFIG[s.brand]?.color || "#3b82f6" }}
                              />
                              <span className="text-[11px] truncate" style={{ color: "var(--color-ink-2)" }}>
                                {s.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>
                                {s.brand}
                              </span>
                              <span className="text-[10px] font-num" style={{ color: "var(--color-ink-4)" }}>
                                快{s.fastChargers}/慢{s.slowChargers}
                              </span>
                              <span className="text-[10px] font-num font-medium" style={{ color: "var(--color-brand-text)" }}>
                                {s.distance.toFixed(2)}km
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 盲区: 显示"在此选址"按钮 */}
                  {communityDetail.isBlindSpot && (
                    <button
                      onClick={() => {
                        // 从 communitySource 取质心作为选址坐标
                        const feat = communitySourceRef.current?.getFeatureById(communityDetail.id);
                        if (feat) {
                          const g = feat.getGeometry();
                          if (g && g.getExtent) {
                            const ext = g.getExtent();
                            const center3857: [number, number] = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
                            const centerLonLat = toLonLat(center3857);
                            // 3857 坐标系下底图为 GCJ02, 转回 WGS84 传给 placeVirtualStation
                            const [wgsLng, wgsLat] = gcj02ToWgs84(centerLonLat[0], centerLonLat[1]);
                            setActiveTab("site");
                            placeVirtualStation(wgsLng, wgsLat);
                            setCommunityDetailOpen(false);
                            setCommunityDetail(null);
                          }
                        }
                      }}
                      className="w-full mt-2 text-white text-[12px] font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all btn-brand"
                      style={{ borderRadius: 12 }}
                    >
                      <Target className="w-3.5 h-3.5" /> 在此选址
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}



          {/* AI 站点详情模态框 (Bento 玻璃拟态) */}
          {aiStationDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
              style={{ background: "rgba(9,9,11,0.45)" }}
              onClick={closeAiStationDetail}>
              <div className="w-[340px] overflow-hidden animate-scale-in bento-tile"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.95) 100%)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  boxShadow: "var(--shadow-elevated)",
                  borderRadius: 16,
                }}
                onClick={e => e.stopPropagation()}>
                {/* 标题栏 — 品牌色 subtle 背景, 无渐变 */}
                <div className="relative px-4 py-3 flex items-center gap-2" style={{ background: "rgba(0,200,150,0.06)", borderBottom: "1px solid rgba(0,200,150,0.1)" }}>
                  <button onClick={closeAiStationDetail}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center transition-all"
                    style={{ color: "var(--color-ink-4)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,200,150,0.1)" }}>
                    <span className="text-lg">{BRAND_CONFIG[aiStationDetail.brand]?.icon || "⚡"}</span>
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{aiStationDetail.name}</h3>
                    <p className="text-[11px]" style={{ color: "var(--color-ink-4)" }}>{aiStationDetail.brand} · {aiStationDetail.district}</p>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2.5 text-[12px]" style={{ color: "var(--color-ink-2)" }}>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{aiStationDetail.address || "暂无地址"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>快充 {aiStationDetail.fastChargers || 0}</span>
                    <span className="text-slate-300">|</span>
                    <span>慢充 {aiStationDetail.slowChargers || 0}</span>
                  </div>
                  {aiStationDetail.distanceKm != null && (
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3.5 h-3.5 text-[#00C896] shrink-0" />
                      <span className="text-[#00C896] font-medium">距您 {aiStationDetail.distanceKm} 公里</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 充电站详情模态框 (屏幕中央大框, Bento 玻璃拟态) */}
          {selectedStation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
              style={{ background: "rgba(9,9,11,0.45)" }}
              onClick={() => {
                setSelectedStation(null);
                selectedStationId = null;
        hideStationInfoPopup();
                stationLayerRef.current?.changed();
              }}>
              <div className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in bento-tile"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.95) 100%)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  boxShadow: "var(--shadow-elevated)",
                  borderRadius: 20,
                }}
                onClick={(e) => e.stopPropagation()}>

                {/* 模态框标题栏 — 无渐变, subtle 品牌背景 */}
                <div className="flex justify-between items-center px-6 py-4"
                  style={{ background: "rgba(0,200,150,0.04)", borderBottom: "1px solid rgba(0,200,150,0.08)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                      style={{ background: "rgba(0,200,150,0.1)", color: "var(--color-brand-text)" }}>
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
                  <button onClick={() => {
                    setSelectedStation(null);
                    selectedStationId = null;
        hideStationInfoPopup();
                    stationLayerRef.current?.changed();
                  }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                    style={{ color: "var(--color-ink-4)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                  >
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
                      {/* 阶段五 等时圈: 服务区计算状态徽章 */}
                      <div className="bg-white rounded-lg p-3 border border-slate-200 text-xs">
                        <p className="text-slate-500 mb-1.5 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-violet-500" /> 路网等时圈状态
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(() => {
                            const status = selectedStation.isochroneStatus || "pending";
                            if (status === "ok") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{ background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }}>
                                  <CheckCircle2 className="w-3 h-3" /> 已计算
                                </span>
                              );
                            }
                            if (status === "partial") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{ background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)" }}>
                                  <Clock className="w-3 h-3" /> 部分计算
                                </span>
                              );
                            }
                            if (status === "failed") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)" }}>
                                  <AlertCircle className="w-3 h-3" /> 计算失败
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ background: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)" }}>
                                <Clock className="w-3 h-3" /> 待计算
                              </span>
                            );
                          })()}
                          {selectedStation.isochroneFastUpdated && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              快充 {new Date(selectedStation.isochroneFastUpdated).toLocaleDateString("zh-CN")}
                            </span>
                          )}
                          {selectedStation.isochroneSlowUpdated && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              慢充 {new Date(selectedStation.isochroneSlowUpdated).toLocaleDateString("zh-CN")}
                            </span>
                          )}
                          {!selectedStation.isochroneFastUpdated && !selectedStation.isochroneSlowUpdated && (
                            <span className="text-[10px] text-slate-400">尚未生成等时圈多边形</span>
                          )}
                        </div>
                      </div>

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
                                    <span className="font-bold">{routeInfo.distance >= 1000 ? `${(routeInfo.distance / 1000).toFixed(1)}公里` : `${routeInfo.distance}米`}</span>
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

          {/* 鼠标坐标 - Linear 风: 单色边框, 无毛玻璃, 等宽字体 */}
          {mousePosition && (
            <div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 px-2.5 py-1 rounded-md font-num text-[10px] no-select"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-muted)",
                boxShadow: "var(--shadow-xs)",
                color: "var(--color-ink-3)",
              }}
            >
              <span style={{ color: "var(--color-ink-5)" }}>经度</span>{" "}
              {mousePosition[0].toFixed(6)}
              <span className="mx-1.5" style={{ color: "var(--color-line)" }}>·</span>
              <span style={{ color: "var(--color-ink-5)" }}>纬度</span>{" "}
              {mousePosition[1].toFixed(6)}
            </div>
          )}

          {/* 用户定位与导航浮窗 - Linear 风: 单色边框, 无毛玻璃 (右上角, 除管理页外) */}
          {activeTab !== "admin" && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5 items-end">
            {locateError && (
              <div
                className="rounded-md px-2.5 py-1.5 text-[9px] w-44 text-center"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-danger)", boxShadow: "var(--shadow-xs)" }}
              >
                <p style={{ color: "var(--color-danger)" }}>{locateError}</p>
              </div>
            )}
            {routeInfo && (
              <div
                className="rounded-lg text-[11px] overflow-hidden w-72 max-h-[70vh] flex flex-col animate-scale-in"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-lg)" }}
              >
                {/* 导航头部 - Linear 风: 紧凑, 无渐变 */}
                <div
                  className="px-3 py-2 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--color-muted)", background: "var(--color-surface)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] flex items-center gap-1" style={{ color: "var(--color-ink-5)" }}>
                      <RouteIcon className="w-3 h-3" style={{ color: "var(--color-brand)" }} /> 导航至
                    </p>
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{routeInfo.targetName}</p>
                  </div>
                  <button
                    onClick={clearRoute}
                    className="ml-2 shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
                    style={{ color: "var(--color-ink-5)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-5)"; }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* 总览信息 - Linear 风: 等宽数字, 单色 */}
                <div
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ borderBottom: "1px solid var(--color-muted)", background: "var(--color-subtle)" }}
                >
                  <div className="flex items-center gap-1.5" style={{ color: "var(--color-brand-text)" }}>
                    <RouteIcon className="w-3.5 h-3.5" />
                    <span className="font-num font-semibold text-xs">{routeInfo.distance >= 1000 ? `${(routeInfo.distance / 1000).toFixed(1)}公里` : `${routeInfo.distance}米`}</span>
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: "var(--color-ink-3)" }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span className="font-num font-semibold text-xs">{routeInfo.duration >= 60 ? `${Math.floor(routeInfo.duration / 60)}时${routeInfo.duration % 60}分` : `${routeInfo.duration}分钟`}</span>
                  </div>
                  {routeInfo.steps && routeInfo.steps.length > 0 && (
                    <span className="text-[10px] ml-auto" style={{ color: "var(--color-ink-5)" }}>共 {routeInfo.steps.length} 个路段</span>
                  )}
                </div>
                {/* 步骤列表 - Linear 风: 竖向连接线, 单色 */}
                {routeInfo.steps && routeInfo.steps.length > 0 && (
                  <div className="overflow-y-auto flex-1 max-h-[50vh]">
                    {routeInfo.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2.5 px-3 py-2 last:border-b-0"
                        style={{ borderBottom: "1px solid var(--color-subtle)", background: idx === 0 ? "var(--color-brand-subtle)" : "transparent" }}
                      >
                        {/* 方向图标 */}
                        <div className="shrink-0 w-5 pt-0.5 flex flex-col items-center">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              background: idx === 0 ? "var(--color-brand)" : "var(--color-subtle)",
                              color: idx === 0 ? "#fff" : "var(--color-ink-4)",
                              border: "1px solid " + (idx === 0 ? "var(--color-brand)" : "var(--color-muted)"),
                            }}
                          >
                            <DirectionIcon action={step.action} />
                          </div>
                          {idx < routeInfo.steps.length - 1 && <div className="w-px flex-1 mt-0.5" style={{ background: "var(--color-muted)" }} />}
                        </div>
                        {/* 步骤内容 */}
                        <div className="min-w-0 flex-1 pb-1">
                          <p className={`text-[11px] font-medium ${idx === 0 ? "" : ""}`} style={{ color: idx === 0 ? "var(--color-brand-text)" : "var(--color-ink-2)" }}>
                            {step.instruction || step.action || `路段 ${idx + 1}`}
                          </p>
                          {step.road && <p className="text-[10px] mt-0.5" style={{ color: "var(--color-ink-5)" }}>途经 {step.road}</p>}
                          <p className="text-[10px] mt-0.5 flex gap-2 font-num" style={{ color: "var(--color-ink-5)" }}>
                            <span>{(step.distance || 0) >= 1000 ? `${(step.distance / 1000).toFixed(1)}公里` : `${step.distance || 0}米`}</span>
                            <span>·</span>
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

          {/* 图例 - Linear 风: 单色边框, 无毛玻璃, 紧凑 (覆盖分析 Tab 使用专属 MapLegend, 此处仅其他 Tab 显示) */}
          {activeTab !== "coverage" && (
          <div
            className="absolute bottom-3 left-3 rounded-lg p-2.5 z-10 w-48"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-sm)" }}
          >
            <h5
              className="text-[10px] font-semibold mb-1.5 flex items-center gap-1"
              style={{ color: "var(--color-ink-3)" }}
            >
              <Layers className="w-3 h-3" style={{ color: "var(--color-ink-4)" }} /> 图例
            </h5>
            <ul className="space-y-1 text-[10px]" style={{ color: "var(--color-ink-3)" }}>
              {availableBrands.map(b => (
                <li key={b} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: BRAND_CONFIG[b].color, border: "1px solid rgba(255,255,255,0.4)" }}></span>
                  <span>{BRAND_CONFIG[b].label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 pt-1.5 mt-1" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                <span className="w-2.5 h-2.5 rounded inline-block shrink-0" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.5)" }}></span>
                <span>住宅小区</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded inline-block shrink-0" style={{ background: "rgba(239,68,68,0.3)", border: "1px solid var(--color-danger)" }}></span>
                <span>充电盲区</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded inline-block shrink-0" style={{ background: "rgba(16,185,129,0.3)", border: "1px solid var(--color-success)" }}></span>
                <span>已覆盖区域</span>
              </li>
            </ul>
          </div>
          )}

          {/* --- 系统管理子系统 - Linear 风: 卡片网格优先, 紧凑严谨 --- */}
          {activeTab === "admin" && (
              <div
                className="absolute inset-0 z-30 flex flex-col overflow-hidden"
                style={{ background: "var(--color-canvas)" }}
              >
                {/* 管理界面标题栏 - Linear 风: 紧凑, 单色边框 */}
                <div
                  className="px-5 py-3 flex items-center justify-between shrink-0"
                  style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-muted)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                    >
                      <Settings className="w-4 h-4" style={{ color: "var(--color-ink-2)" }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-ink-1)" }}>系统管理控制台</h3>
                      <span
                        className="text-[10px] px-1.5 py-0 rounded"
                        style={{
                          background: "var(--color-grape-subtle)",
                          color: "var(--color-grape)",
                          border: "1px solid var(--color-grape-border)",
                        }}
                      >
                        管理员
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={loadAdminData}
                    className="btn-brand text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> 刷新
                  </button>
                </div>

                {/* 分类 Tab 栏 - Linear 风: 下划线指示器, 等宽标签 */}
                <div
                  className="px-5 flex gap-0 shrink-0"
                  style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-muted)" }}
                >
                  {([
                    { key: "overview", label: "概览", icon: BarChart3 },
                    { key: "stations", label: "充电站", icon: Zap },
                    { key: "users", label: "用户", icon: UserIcon },
                    { key: "feedback", label: "反馈", icon: MessageSquare },
                    { key: "schemes", label: "方案", icon: Target },
                    { key: "logs", label: "日志", icon: Database },
                    { key: "report", label: "统计报表", icon: FileText },
                    { key: "isochrone", label: "等时圈", icon: Activity },
                  ] as const).map(t => {
                    const Icon = t.icon;
                    const isActive = adminTab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setAdminTab(t.key)}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors relative"
                        style={{
                          color: isActive ? "var(--color-ink-1)" : "var(--color-ink-4)",
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: isActive ? "var(--color-brand)" : "var(--color-ink-5)" }} />
                        {t.label}
                        {isActive && (
                          <span
                            className="absolute left-0 right-0 -bottom-px"
                            style={{ height: 2, background: "var(--color-brand)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 管理内容区 - Linear 风: 紧凑 padding */}
                <div className="flex-1 overflow-auto p-5">

                  {/* ===== 数据概览 - 卡片网格优先 ===== */}
                  {adminTab === "overview" && (
                    <div className="space-y-4 animate-fade-in">
                      {/* 统计卡片 - 大数字 + 图标芯片 + 趋势色 */}
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          { label: "充电站总数", value: adminStations.length, color: "var(--color-brand)", icon: Zap, sub: "活跃站点" },
                          { label: "注册用户", value: users.length, color: "var(--color-accent)", icon: UserIcon, sub: "全角色" },
                          { label: "反馈数据", value: adminFeedback.length, color: "var(--color-warning)", icon: MessageSquare, sub: "评价+需求" },
                          { label: "选址方案", value: adminSchemes.length, color: "var(--color-grape)", icon: Target, sub: "已保存" },
                          { label: "系统日志", value: logs.length, color: "var(--color-danger)", icon: Database, sub: "操作记录" },
                        ].map(s => {
                          const Icon = s.icon;
                          return (
                            <div
                              key={s.label}
                              className="rounded-lg p-3.5 transition-shadow hover:shadow-md"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-medium" style={{ color: "var(--color-ink-4)" }}>{s.label}</span>
                                <div
                                  className="w-7 h-7 rounded-md flex items-center justify-center"
                                  style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                                >
                                  <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                </div>
                              </div>
                              <p className="text-[28px] font-bold font-num leading-none" style={{ color: "var(--color-ink-1)" }}>{s.value}</p>
                              <p className="text-[10px] mt-1.5 font-mono" style={{ color: "var(--color-ink-5)" }}>{s.sub}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* 充电站品牌分布 + 行政区分布 - 卡片网格 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>充电站品牌分布</h4>
                            <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>{adminStations.length} 总数</span>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(
                              adminStations.reduce((acc: any, s: any) => {
                                acc[s.brand] = (acc[s.brand] || 0) + 1;
                                return acc;
                              }, {})
                            ).sort((a: any, b: any) => b[1] - a[1]).map(([brand, count]: any) => {
                              const pct = adminStations.length ? (count / adminStations.length) * 100 : 0;
                              return (
                                <div key={brand} className="flex items-center gap-2.5">
                                  <span className="text-[11px] w-20 truncate" style={{ color: "var(--color-ink-3)" }}>{brand}</span>
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, background: BRAND_CONFIG[brand]?.color || "var(--color-ink-5)" }} />
                                  </div>
                                  <span className="text-[11px] font-num font-semibold w-6 text-right" style={{ color: "var(--color-ink-2)" }}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="rounded-lg p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>行政区充电站分布</h4>
                            <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>按数量排序</span>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(
                              adminStations.reduce((acc: any, s: any) => {
                                acc[s.district] = (acc[s.district] || 0) + 1;
                                return acc;
                              }, {})
                            ).sort((a: any, b: any) => b[1] - a[1]).map(([district, count]: any) => {
                              const pct = adminStations.length ? (count / adminStations.length) * 100 : 0;
                              return (
                                <div key={district} className="flex items-center gap-2.5">
                                  <span className="text-[11px] w-16 truncate" style={{ color: "var(--color-ink-3)" }}>{district}</span>
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, background: "var(--color-accent)" }} />
                                  </div>
                                  <span className="text-[11px] font-num font-semibold w-6 text-right" style={{ color: "var(--color-ink-2)" }}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 最近系统日志 - 时间线卡片 */}
                      <div className="rounded-lg p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>最近系统操作</h4>
                          <button onClick={() => setAdminTab("logs")} className="text-[11px] font-medium hover:underline" style={{ color: "var(--color-brand-text)" }}>
                            查看全部 →
                          </button>
                        </div>
                        <div className="space-y-0 max-h-56 overflow-y-auto">
                          {logs.slice(0, 8).map((l, idx) => (
                            <div
                              key={l.id}
                              className="flex items-center gap-3 text-[11px] py-2"
                              style={{ borderBottom: idx < Math.min(logs.length, 8) - 1 ? "1px solid var(--color-subtle)" : "none" }}
                            >
                              <span className="font-num w-32 shrink-0" style={{ color: "var(--color-ink-5)" }}>{l.create_time}</span>
                              <span
                                className="px-1.5 py-0 rounded font-medium w-16 text-center shrink-0 font-mono text-[10px]"
                                style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)" }}
                              >
                                {l.action}
                              </span>
                              <span className="flex-1 truncate" style={{ color: "var(--color-ink-3)" }}>{l.detail}</span>
                              <span className="shrink-0" style={{ color: "var(--color-ink-5)" }}>— {l.user}</span>
                            </div>
                          ))}
                          {logs.length === 0 && (
                            <div className="py-8 text-center">
                              <Database className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                              <p className="text-[11px]" style={{ color: "var(--color-ink-5)" }}>暂无日志记录</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===== 充电站管理 - 卡片堆叠 ===== */}
                  {adminTab === "stations" && (
                    <div className="animate-fade-in">
                      {/* 工具栏 */}
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>充电站</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>
                            {adminStations.filter((s: any) => {
                              if (!adminSearch) return true;
                              const q = adminSearch.toLowerCase();
                              return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                            }).length} / {adminStations.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-ink-5)" }} />
                            <input
                              type="text"
                              placeholder="搜索名称/品牌/区域..."
                              value={adminSearch}
                              onChange={(e) => setAdminSearch(e.target.value)}
                              className="input-sys text-xs pl-8 pr-3 py-1.5 w-56"
                            />
                          </div>
                          <button
                            onClick={() => setAdminEditing({})}
                            className="btn-brand text-xs px-3 py-1.5 rounded-md flex items-center gap-1 font-medium"
                          >
                            <span className="text-sm leading-none">+</span> 新增
                          </button>
                        </div>
                      </div>

                      {/* 卡片网格 */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {adminStations.filter((s: any) => {
                          if (!adminSearch) return true;
                          const q = adminSearch.toLowerCase();
                          return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                        }).map((s: any) => {
                          const isActive = s.status === "运营中";
                          return (
                            <div
                              key={s.id}
                              className="rounded-lg p-3 transition-shadow hover:shadow-md group"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              {/* 顶部: 名称 + 状态 */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--color-ink-5)" }}>#{s.id}</span>
                                    {isActive && <span className="w-1.5 h-1.5 rounded-full animate-status-pulse" style={{ background: "var(--color-success)" }} />}
                                  </div>
                                  <h5 className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{s.name}</h5>
                                </div>
                                <span
                                  className="text-[10px] px-1.5 py-0 rounded font-medium shrink-0 font-mono"
                                  style={{
                                    background: isActive ? "var(--color-brand-subtle)" : "rgba(245,158,11,0.08)",
                                    color: isActive ? "var(--color-brand-text)" : "var(--color-warning)",
                                    border: "1px solid " + (isActive ? "var(--color-brand-border)" : "rgba(245,158,11,0.25)"),
                                  }}
                                >
                                  {s.status}
                                </span>
                              </div>
                              {/* 中部: 品牌 + 行政区 */}
                              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                <span
                                  className="text-[10px] px-1.5 py-0 rounded font-medium"
                                  style={{ background: (BRAND_CONFIG[s.brand]?.color || "#909399") + "15", color: BRAND_CONFIG[s.brand]?.color || "#909399" }}
                                >
                                  {s.brand}
                                </span>
                                <span className="text-[10px]" style={{ color: "var(--color-ink-4)" }}>· {s.district}</span>
                              </div>
                              {/* 底部: 充电桩数 + 坐标 */}
                              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                                <div className="flex items-center gap-3 text-[11px]">
                                  <span className="flex items-center gap-1">
                                    <Zap className="w-3 h-3" style={{ color: "var(--color-brand)" }} />
                                    <span className="font-num font-semibold" style={{ color: "var(--color-ink-2)" }}>{s.fastChargers}</span>
                                    <span style={{ color: "var(--color-ink-5)" }}>快</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full inline-block" style={{ border: "1.5px solid var(--color-accent)" }} />
                                    <span className="font-num font-semibold" style={{ color: "var(--color-ink-2)" }}>{s.slowChargers}</span>
                                    <span style={{ color: "var(--color-ink-5)" }}>慢</span>
                                  </span>
                                </div>
                                <span className="text-[9px] font-num" style={{ color: "var(--color-ink-5)" }}>
                                  {Number(s.lng).toFixed(4)}, {Number(s.lat).toFixed(4)}
                                </span>
                              </div>
                              {/* 操作按钮 - hover 显示 */}
                              <div className="flex gap-1 mt-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                                <button
                                  onClick={() => setAdminEditing(s)}
                                  className="flex-1 text-[11px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-1"
                                  style={{ background: "var(--color-subtle)", color: "var(--color-ink-3)" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-brand-subtle)"; e.currentTarget.style.color = "var(--color-brand-text)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-3)"; }}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`确定删除充电站「${s.name}」?`)) return;
                                    const r = await authFetch(`/api/v1/stations/${s.id}`, { method: "DELETE" });
                                    const j = await r.json();
                                    if (j.success) { loadAdminData(); alert("已删除"); }
                                    else alert(j.message);
                                  }}
                                  className="flex-1 text-[11px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-1"
                                  style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "var(--color-danger)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {adminStations.filter((s: any) => {
                          if (!adminSearch) return true;
                          const q = adminSearch.toLowerCase();
                          return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                        }).length === 0 && (
                          <div className="col-span-full py-12 text-center">
                            <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>未找到匹配的充电站</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 用户管理 - 卡片网格 ===== */}
                  {adminTab === "users" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>用户</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{users.length}</span>
                        </div>
                        <button
                          onClick={() => setAdminEditing({ _type: "user" })}
                          className="btn-brand text-xs px-3 py-1.5 rounded-md flex items-center gap-1 font-medium"
                        >
                          <span className="text-sm leading-none">+</span> 新增用户
                        </button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {users.map(u => {
                          const isNormal = u.status === "正常";
                          const roleColor = ROLE_CONFIG[u.role as UserRole]?.color || "var(--color-ink-5)";
                          const isAdmin = u.username === "admin";
                          return (
                            <div
                              key={u.id}
                              className="rounded-lg p-3 transition-shadow hover:shadow-md group"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              <div className="flex items-start gap-2.5 mb-2.5">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold font-mono"
                                  style={{ background: roleColor + "15", color: roleColor, border: "1px solid " + roleColor + "30" }}
                                >
                                  {u.username.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <h5 className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{u.username}</h5>
                                    {isAdmin && <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "var(--color-grape)" }} />}
                                  </div>
                                  <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>#{u.id}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                <span
                                  className="text-[10px] px-1.5 py-0 rounded font-medium"
                                  style={{ background: roleColor + "15", color: roleColor }}
                                >
                                  {ROLE_CONFIG[u.role as UserRole]?.label || u.role}
                                </span>
                                <span className="flex items-center gap-1 text-[10px]" style={{ color: isNormal ? "var(--color-success)" : "var(--color-danger)" }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isNormal ? "var(--color-success)" : "var(--color-danger)" }} />
                                  {u.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                                <span className="text-[10px] font-num" style={{ color: "var(--color-ink-5)" }}>{u.create_time}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setAdminEditing({ ...u, _type: "user" })}
                                    className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                                    style={{ background: "var(--color-subtle)", color: "var(--color-ink-3)" }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-brand-subtle)"; e.currentTarget.style.color = "var(--color-brand-text)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-3)"; }}
                                  >
                                    编辑
                                  </button>
                                  {!isAdmin && (
                                    <button
                                      onClick={async () => {
                                        if (!confirm(`确定删除用户「${u.username}」?`)) return;
                                        const r = await authFetch(`/api/v1/users/${u.id}`, { method: "DELETE" });
                                        const j = await r.json();
                                        if (j.success) { loadAdminData(); alert("已删除"); }
                                        else alert(j.message);
                                      }}
                                      className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                                      style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "var(--color-danger)"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                                    >
                                      删除
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ===== 反馈管理 - 卡片列表 ===== */}
                  {adminTab === "feedback" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>反馈</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{adminFeedback.length}</span>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm("确定清空所有违禁驳回的反馈?")) return;
                            const r = await authFetch("/api/v1/feedback/rejected/clear", { method: "DELETE" });
                            const j = await r.json();
                            if (j.success) { loadAdminData(); alert(j.message); }
                            else alert(j.message);
                          }}
                          className="text-xs px-3 py-1.5 rounded-md flex items-center gap-1 font-medium transition-colors"
                          style={{ background: "rgba(239,68,68,0.06)", color: "var(--color-danger)", border: "1px solid rgba(239,68,68,0.2)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                        >
                          <Trash2 className="w-3 h-3" /> 清空违禁
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {adminFeedback.map(f => {
                          const isApproved = f.status === "approved";
                          const isEvaluation = f.type === "evaluation";
                          return (
                            <div
                              key={f.id}
                              className="rounded-lg p-3 group transition-shadow hover:shadow-md"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="shrink-0 flex flex-col items-center gap-1">
                                  <div
                                    className="w-7 h-7 rounded-md flex items-center justify-center"
                                    style={{ background: isEvaluation ? "var(--color-accent-subtle)" : "rgba(245,158,11,0.08)", border: "1px solid " + (isEvaluation ? "var(--color-accent-border)" : "rgba(245,158,11,0.2)") }}
                                  >
                                    {isEvaluation ? <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} /> : <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--color-warning)" }} />}
                                  </div>
                                  <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>#{f.id}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span
                                      className="text-[10px] px-1.5 py-0 rounded font-medium font-mono"
                                      style={{
                                        background: isEvaluation ? "var(--color-accent-subtle)" : "rgba(245,158,11,0.08)",
                                        color: isEvaluation ? "var(--color-accent)" : "var(--color-warning)",
                                      }}
                                    >
                                      {isEvaluation ? "评价" : "需求"}
                                    </span>
                                    {f.rating > 0 && (
                                      <span className="text-[10px]" style={{ color: "var(--color-warning)" }}>{"★".repeat(Math.min(f.rating, 5))}</span>
                                    )}
                                    <span
                                      className="text-[10px] px-1.5 py-0 rounded font-medium ml-auto"
                                      style={{
                                        background: isApproved ? "var(--color-brand-subtle)" : "rgba(239,68,68,0.08)",
                                        color: isApproved ? "var(--color-brand-text)" : "var(--color-danger)",
                                      }}
                                    >
                                      {isApproved ? "已通过" : "违禁驳回"}
                                    </span>
                                  </div>
                                  <p className="text-[12px] mb-1.5 leading-relaxed" style={{ color: "var(--color-ink-2)" }}>{f.description}</p>
                                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--color-ink-5)" }}>
                                    <div className="flex items-center gap-2">
                                      <span style={{ color: "var(--color-ink-4)" }}>{f.submitter}</span>
                                      <span>·</span>
                                      <span className="font-num">{f.create_time}</span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (!confirm("确定删除该反馈?")) return;
                                        const r = await authFetch(`/api/v1/feedback/${f.id}`, { method: "DELETE" });
                                        const j = await r.json();
                                        if (j.success) { loadAdminData(); alert("已删除"); }
                                        else alert(j.message);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded font-medium"
                                      style={{ background: "rgba(239,68,68,0.06)", color: "var(--color-danger)" }}
                                    >
                                      删除
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {adminFeedback.length === 0 && (
                          <div className="py-12 text-center">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>暂无反馈数据</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 方案管理 - 卡片网格 ===== */}
                  {adminTab === "schemes" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>选址方案</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{adminSchemes.length}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {adminSchemes.map(s => (
                          <div
                            key={s.id}
                            className="rounded-lg p-3 transition-shadow hover:shadow-md group"
                            style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>#{s.id}</span>
                                </div>
                                <h5 className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{s.name}</h5>
                              </div>
                              <span
                                className="text-[10px] px-1.5 py-0 rounded font-medium shrink-0"
                                style={{ background: (BRAND_CONFIG[s.brand]?.color || "#909399") + "15", color: BRAND_CONFIG[s.brand]?.color || "#909399" }}
                              >
                                {s.brand}
                              </span>
                            </div>
                            {/* 指标网格 */}
                            <div className="grid grid-cols-2 gap-2 mb-2.5 py-2" style={{ borderTop: "1px solid var(--color-subtle)", borderBottom: "1px solid var(--color-subtle)" }}>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>覆盖人口</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-ink-1)" }}>{s.covered_population}</p>
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>覆盖社区</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-ink-1)" }}>{s.covered_communities}</p>
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>盲区消除</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-success)" }}>{s.blind_spot_reduction}%</p>
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>竞争避让</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-accent)" }}>{s.competition_score}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-num" style={{ color: "var(--color-ink-5)" }}>{s.create_time}</span>
                              <button
                                onClick={async () => {
                                  if (!confirm(`确定删除方案「${s.name}」?`)) return;
                                  const r = await authFetch(`/api/v1/schemes/${s.id}`, { method: "DELETE" });
                                  const j = await r.json();
                                  if (j.success) { loadAdminData(); alert("已删除"); }
                                  else alert(j.message);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{ background: "rgba(239,68,68,0.06)", color: "var(--color-danger)" }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))}
                        {adminSchemes.length === 0 && (
                          <div className="col-span-full py-12 text-center">
                            <Target className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>暂无选址方案</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 系统日志 - 时间线列表 ===== */}
                  {adminTab === "logs" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>系统日志</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{logs.length}</span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {["all", "登录系统", "新增", "修改", "删除", "查询", "选址", "反馈"].map(f => {
                            const isActive = adminLogFilter === f;
                            return (
                              <button
                                key={f}
                                onClick={() => setAdminLogFilter(f)}
                                className="text-[11px] px-2.5 py-1 rounded font-medium transition-colors"
                                style={{
                                  background: isActive ? "var(--color-brand)" : "var(--color-subtle)",
                                  color: isActive ? "#fff" : "var(--color-ink-4)",
                                  border: "1px solid " + (isActive ? "var(--color-brand)" : "var(--color-muted)"),
                                }}
                              >
                                {f === "all" ? "全部" : f}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div
                        className="rounded-lg overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        {logs.filter(l => adminLogFilter === "all" || safeText(l.action).includes(adminLogFilter) || safeText(l.detail).includes(adminLogFilter)).map((l, idx, arr) => (
                          <div
                            key={l.id}
                            className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-subtle)]"
                            style={{ borderBottom: idx < arr.length - 1 ? "1px solid var(--color-subtle)" : "none" }}
                          >
                            {/* 时间线节点 */}
                            <div className="shrink-0 flex flex-col items-center pt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-brand)" }} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-3">
                              <span className="text-[10px] font-num shrink-0 w-32" style={{ color: "var(--color-ink-5)" }}>{l.create_time}</span>
                              <span
                                className="text-[10px] px-1.5 py-0 rounded font-medium shrink-0 font-mono"
                                style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)" }}
                              >
                                {l.action}
                              </span>
                              <span className="text-[11px] truncate flex-1" style={{ color: "var(--color-ink-3)" }}>{l.detail}</span>
                              <span className="text-[10px] shrink-0" style={{ color: "var(--color-ink-5)" }}>— {l.user}</span>
                            </div>
                          </div>
                        ))}
                        {logs.filter(l => adminLogFilter === "all" || safeText(l.action).includes(adminLogFilter) || safeText(l.detail).includes(adminLogFilter)).length === 0 && (
                          <div className="py-12 text-center">
                            <Database className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>暂无日志</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 统计报表中心 (阶段三 任务 3.2.2) - 交叉透视表 + 柱状图 + CSV 导出 ===== */}
                  {adminTab === "report" && (
                    <div className="animate-fade-in">
                      <ReportCenter showToast={showToast} />
                    </div>
                  )}

                  {/* ===== 阶段五 等时圈: 预计算进度监控卡片 ===== */}
                  {adminTab === "isochrone" && (
                    <div className="animate-fade-in space-y-4">
                      {/* 说明卡 */}
                      <div
                        className="rounded-lg p-4"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)" }}
                          >
                            <Activity className="w-4 h-4" style={{ color: "#7c3aed" }} />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>路网等时圈服务区</h4>
                            <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-4)" }}>
                              基于真实路网计算每座充电站的可达范围多边形：快充驾车 10 分钟、慢充步行 15 分钟。
                              数据来自高德路径规划 API，并发 2 路，预计 3-5 分钟跑完全部站点。
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                GB/T 51313-2018
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                15 分钟生活圈
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                高德路径 API
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 状态总览卡 - 4 格 */}
                      <div className="grid grid-cols-4 gap-3">
                        {(() => {
                          const stats = isochroneProgress?.stats;
                          const total = stats?.total ?? adminStations.length;
                          const ok = stats?.ok ?? 0;
                          const partial = stats?.partial ?? 0;
                          const pending = stats?.pending ?? 0;
                          const failed = stats?.failed ?? 0;
                          return [
                            { label: "已计算完成", value: ok, color: "#10B981", icon: CheckCircle2, sub: "快慢充均成功" },
                            { label: "部分成功", value: partial, color: "#F59E0B", icon: Clock, sub: "仅一种模式" },
                            { label: "待计算", value: pending, color: "#6B7280", icon: Clock, sub: "未触发或排队中" },
                            { label: "计算失败", value: failed, color: "#EF4444", icon: AlertCircle, sub: "需重算或检查" },
                          ].map(s => {
                            const Icon = s.icon;
                            const pct = total > 0 ? (s.value / total) * 100 : 0;
                            return (
                              <div
                                key={s.label}
                                className="rounded-lg p-3.5"
                                style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-medium" style={{ color: "var(--color-ink-4)" }}>{s.label}</span>
                                  <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                </div>
                                <p className="text-[24px] font-bold font-num leading-none" style={{ color: s.color }}>{s.value}</p>
                                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                                  <div className="h-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                                </div>
                                <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--color-ink-5)" }}>{pct.toFixed(1)}% · {s.sub}</p>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* 进度卡 */}
                      <div
                        className="rounded-lg p-4"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>预计算进度</h4>
                          <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>
                            {isochroneProgress ? (
                              isochroneProgress.running
                                ? `运行中 · ${isochroneProgress.done}/${isochroneProgress.total}`
                                : isochroneProgress.finishedAt
                                  ? `已完成 · 用时 ${((isochroneProgress.finishedAt - (isochroneProgress.startedAt || 0)) / 1000).toFixed(1)}s`
                                  : "空闲"
                            ) : "加载中..."}
                          </span>
                        </div>

                        {/* 进度条 */}
                        {isochroneProgress && isochroneProgress.total > 0 && (
                          <div className="mb-3">
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${(isochroneProgress.done / isochroneProgress.total) * 100}%`,
                                  background: isochroneProgress.running ? "linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)" : "#10B981"
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>
                              <span>成功 {isochroneProgress.ok ?? 0}</span>
                              <span>部分 {isochroneProgress.skipped ?? 0}</span>
                              <span>失败 {isochroneProgress.failed ?? 0}</span>
                              <span>{((isochroneProgress.done / isochroneProgress.total) * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        )}

                        {/* 错误信息 */}
                        {isochroneProgress?.lastError && (
                          <div
                            className="mb-3 px-2.5 py-1.5 rounded text-[11px] flex items-start gap-1.5"
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="break-all">{isochroneProgress.lastError}</span>
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => triggerIsochronePrecompute(false)}
                            disabled={isochroneProgress?.running}
                            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-all ${
                              isochroneProgress?.running
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                : "btn-brand"
                            }`}
                          >
                            {isochroneProgress?.running
                              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 运行中</>
                              : <><Activity className="w-3.5 h-3.5" /> 增量预计算</>}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("全量重算将覆盖所有现有等时圈数据，确认继续？")) {
                                triggerIsochronePrecompute(true);
                              }
                            }}
                            disabled={isochroneProgress?.running}
                            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-all ${
                              isochroneProgress?.running
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                            }`}
                            title="重新计算所有站点（包括已完成的），耗时长"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> 全量重算
                          </button>
                          <button
                            onClick={fetchIsochroneProgress}
                            className="text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> 刷新进度
                          </button>
                        </div>
                      </div>

                      {/* 站点状态列表 - 仅显示失败和待计算 */}
                      {adminStations.length > 0 && (
                        <div
                          className="rounded-lg p-4"
                          style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>站点状态明细</h4>
                            <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>仅展示待计算 / 失败</span>
                          </div>
                          <div className="max-h-72 overflow-y-auto space-y-1">
                            {adminStations
                              .filter((s: any) => {
                                const st = s.isochroneStatus || "pending";
                                return st === "pending" || st === "failed";
                              })
                              .slice(0, 50)
                              .map((s: any) => {
                                const st = s.isochroneStatus || "pending";
                                const color = st === "failed" ? "#EF4444" : "#F59E0B";
                                const Icon = st === "failed" ? AlertCircle : Clock;
                                return (
                                  <div
                                    key={s.id}
                                    className="flex items-center gap-2 text-[11px] py-1.5 px-2 rounded"
                                    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                                  >
                                    <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                                    <span className="font-mono w-8 shrink-0" style={{ color: "var(--color-ink-5)" }}>#{s.id}</span>
                                    <span className="flex-1 truncate" style={{ color: "var(--color-ink-2)" }}>{s.name}</span>
                                    <span className="shrink-0 text-[10px]" style={{ color: "var(--color-ink-4)" }}>{s.district}</span>
                                    <span
                                      className="px-1.5 py-0 rounded text-[10px] font-medium shrink-0"
                                      style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}
                                    >
                                      {st === "failed" ? "失败" : "待计算"}
                                    </span>
                                  </div>
                                );
                              })}
                            {adminStations.filter((s: any) => {
                              const st = s.isochroneStatus || "pending";
                              return st === "pending" || st === "failed";
                            }).length === 0 && (
                              <div className="py-6 text-center">
                                <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: "#10B981" }} />
                                <p className="text-[11px]" style={{ color: "var(--color-ink-4)" }}>所有站点已计算完成</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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

          {/* ===== 右侧面板 - Bento 玻璃指挥甲板 (图表/社区/候选点) ===== */}
        {/* ===== 覆盖分析结果面板 (CoverageResultPanel 组件) ===== */}
        {activeTab === "coverage" && coverageSummary && (
          <CoverageResultPanel
            coverageSummary={coverageSummary}
            coverageResults={coverageResults}
            blindSpotClusters={blindSpotClusters}
            clusterSortBy={clusterSortBy}
            setClusterSortBy={setClusterSortBy}
            expandedClusterId={expandedClusterId}
            setExpandedClusterId={setExpandedClusterId}
            communityDetail={communityDetail}
            setCommunityDetail={setCommunityDetail}
            setCommunityDetailOpen={setCommunityDetailOpen}
            rightPanelTab={rightPanelTab}
            setRightPanelTab={setRightPanelTab}
            coverageChartRef={coverageChartRef}
            coveragePieChartRef={coveragePieChartRef}
            stationEffChartRef={stationEffChartRef}
            onLocateCommunity={(comm) => {
              const feat = communitySourceRef.current?.getFeatureById(comm.id);
              if (feat && mapRef.current) {
                const geom = feat.getGeometry();
                if (geom) {
                  const centerCoord = geom.getExtent ? [(geom.getExtent()[0] + geom.getExtent()[2]) / 2, (geom.getExtent()[1] + geom.getExtent()[3]) / 2] : null;
                  if (centerCoord) {
                    mapRef.current.getView().animate({ center: centerCoord as [number, number], zoom: 14, duration: 600 });
                  }
                }
              }
            }}
            onSelectSiteAt={(lng, lat) => {
              setActiveTab("site");
              placeVirtualStation(lng, lat);
            }}
          />
        )}


          {/* 选址评估仪表盘 - Bento 玻璃面板 */}
          {activeTab === "site" && siteMetrics && (
            <div
              className="absolute top-16 right-3 w-72 rounded-xl p-3.5 z-20 animate-panel-enter bento-tile"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(250,250,250,0.82) 100%)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "var(--shadow-elevated)",
              }}
            >
              <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--color-ink-2)" }}>
                <Gauge className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} /> 选址评估
              </h4>
              <div ref={siteChartRef} className="w-full h-40" />
              {virtualStation && (
                <div className="mt-2 text-[10px] text-center font-mono" style={{ color: "var(--color-ink-5)" }}>
                  {virtualStation.lng.toFixed(4)}, {virtualStation.lat.toFixed(4)}
                </div>
              )}
            </div>
          )}

          {/* 方案对比雷达图 - Bento 玻璃面板 */}
          {activeTab === "site" && compareSchemes.length >= 2 && (
            <div
              className="absolute bottom-3 right-3 w-72 rounded-xl p-3.5 z-20 animate-panel-enter bento-tile"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(250,250,250,0.82) 100%)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "var(--shadow-elevated)",
              }}
            >
              <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--color-ink-2)" }}>
                <Target className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} /> 方案雷达对比
              </h4>
              <div ref={radarChartRef} className="w-full h-56" />
            </div>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* ===== AI助手悬浮球 + 浮动面板 (Linear 风: 极简图标, 无渐变) ===== */}
      {/* 悬浮球 - 可拖动, 默认往上 20px (bottom: 44) */}
      <div
        className="fixed z-50 select-none"
        style={{ bottom: aiBallPos?.bottom ?? 44, right: aiBallPos?.right ?? 24, cursor: aiDragging ? "grabbing" : "grab" }}
        onMouseDown={(e) => {
          aiDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startBottom: aiBallPos?.bottom ?? 44,
            startRight: aiBallPos?.right ?? 24,
            moved: false,
          };
          setAiDragging(false);
          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - aiDragRef.current.startX;
            const dy = ev.clientY - aiDragRef.current.startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
              aiDragRef.current.moved = true;
              setAiDragging(true);
              // 右下角锚点: 鼠标向右移 → right 减小; 鼠标向下移 → bottom 减小
              const newRight = Math.max(8, Math.min(window.innerWidth - 60, aiDragRef.current.startRight - dx));
              const newBottom = Math.max(8, Math.min(window.innerHeight - 60, aiDragRef.current.startBottom - dy));
              setAiBallPos({ bottom: newBottom, right: newRight });
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
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: aiPanelOpen ? "#18181B" : "var(--color-brand)",
            border: "1px solid " + (aiPanelOpen ? "#27272A" : "var(--color-brand-hover)"),
            boxShadow: aiPanelOpen
              ? "0 4px 16px rgba(0,0,0,0.15)"
              : "0 4px 16px rgba(0,200,150,0.25)",
            transform: aiBotBounce ? "scale(1.08)" : "scale(1)",
            transition: "transform var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)",
          }}
        >
          {aiPanelOpen ? (
            <X className="w-4 h-4 text-white" />
          ) : (
            <div className="relative">
              <Bot className="w-5 h-5 text-white" />
              {/* 状态指示点 */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-300 animate-status-pulse"
                style={{ border: "1.5px solid var(--color-brand)" }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 浮动AI面板 - Bento 3D 玻璃拟态 */}
      <div
        className="fixed z-50 w-[400px] max-w-[calc(100vw-48px)]"
        style={{
          bottom: (aiBallPos?.bottom ?? 44) + 60,
          right: aiBallPos?.right ?? 24,
          opacity: aiPanelOpen ? 1 : 0,
          transform: aiPanelOpen
            ? "perspective(1000px) rotateX(0deg) translateY(0) scale(1)"
            : "perspective(1000px) rotateX(4deg) translateY(12px) scale(0.96)",
          pointerEvents: aiPanelOpen ? "auto" : "none",
          transition: "opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out)",
          transformOrigin: "center bottom",
        }}
      >
        <div
          className="flex flex-col overflow-hidden bento-tile"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,250,0.9) 100%)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "var(--shadow-elevated)",
            borderRadius: 16,
            height: "min(560px, calc(100vh - 140px))",
          }}
        >
          {/* 面板头部 — 玻璃拟态 subtle */}
          <div
            className="shrink-0 px-3 py-2.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: "rgba(255,255,255,0.6)" }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
            >
              <Bot className="w-3.5 h-3.5 text-zinc-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-zinc-900">智能助手</h3>
                <span
                  className="text-[10px] px-1 py-0 rounded"
                  style={{
                    background: "rgba(0,200,150,0.08)",
                    color: "var(--color-brand-text)",
                    border: "1px solid rgba(0,200,150,0.2)",
                  }}
                >
                  在线
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">空间数据驱动 · 多轮对话</p>
            </div>
            <div className="flex items-center gap-1">
              {aiMessages.length > 0 && (
                <button onClick={clearAi}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-500 hover:text-red-500 transition-colors"
                  title="清空对话">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {aiMessages.length === 0 && (
              <div className="py-6 animate-fade-in">
                <div className="flex items-start gap-2.5 mb-4">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-zinc-800 font-medium">GeoPlan AI 助手</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      可分析充电站分布、识别盲区、规划选址、空间查询。试试以下问题：
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {[
                    "徐州市充电设施分布概况",
                    "如何识别充电盲区",
                    "推荐几个选址方案",
                    "充电站品牌各自特点",
                    ...(userLocation ? ["推荐离我最近的充电站"] : []),
                  ].map(q => (
                    <button key={q} onClick={() => { setAiInput(q); }}
                      className="block w-full text-[11.5px] text-left px-2.5 py-1.5 rounded-md text-zinc-700 transition-all hover:bg-zinc-50 group"
                      style={{ border: "1px solid var(--color-muted)" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 group-hover:text-zinc-700 transition-colors">→</span>
                        <span className="flex-1">{q}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {!userLocation && (
                  <button onClick={locateUser}
                    className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1 mx-auto transition-colors"
                    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)", padding: "4px 10px", borderRadius: "var(--radius-sm)" }}>
                    <LocateFixed className="w-3 h-3" /> 启用位置服务
                  </button>
                )}
              </div>
            )}
            {aiMessages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && i === aiMessages.length - 1;
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  <div className="max-w-[88%]">
                    <div
                      className={`px-2.5 py-2 text-[12px] leading-relaxed ${
                        msg.role === "user"
                          ? "text-white whitespace-pre-wrap rounded-br-sm"
                          : "rounded-bl-sm"
                      }`}
                      style={
                        msg.role === "user"
                          ? { background: "var(--color-brand)", borderRadius: "var(--radius-md) var(--radius-md) 2px var(--radius-md)" }
                          : { background: "var(--color-subtle)", border: "1px solid var(--color-muted)", color: "var(--color-ink-1)", borderRadius: "var(--radius-md) var(--radius-md) 2px var(--radius-md)" }
                      }
                    >
                      {msg.role === "user"
                        ? msg.content
                        : (
                          <>
                            {msg.gisResult && (
                              <div className="mb-2">
                                {/* GIS 卡片 - Linear 风: 无渐变, 单色边框 + 大等宽数字 */}
                                <div
                                  className="rounded-md p-2.5 mb-1.5"
                                  style={{
                                    background: "var(--color-surface)",
                                    border: "1px solid var(--color-muted)",
                                    borderLeft: "2px solid var(--color-brand)",
                                  }}
                                >
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Sparkles className="w-3 h-3 text-zinc-700" />
                                    <span className="text-[11px] font-semibold text-zinc-900">
                                      {(msg.gisResult.radius > 0 ? `${(msg.gisResult.radius / 1000).toFixed(1)}公里 缓冲区` : msg.gisResult.district || msg.gisResult.brand) + " 空间分析"}
                                    </span>
                                    <span
                                      className="text-[9px] px-1 py-0 rounded ml-auto"
                                      style={{
                                        background: "rgba(0,200,150,0.08)",
                                        color: "var(--color-brand-text)",
                                      }}
                                    >
                                      空间分析
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    <div
                                      className="rounded px-1.5 py-1 text-center"
                                      style={{ background: "var(--color-subtle)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">{msg.gisResult.count}</p>
                                      <p className="text-[9px] text-zinc-500">充电站</p>
                                    </div>
                                    <div
                                      className="rounded px-1.5 py-1 text-center"
                                      style={{ background: "var(--color-subtle)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">
                                        {msg.gisResult.coveredPopulation >= 10000
                                          ? `${(msg.gisResult.coveredPopulation / 10000).toFixed(1)}万`
                                          : msg.gisResult.coveredPopulation.toLocaleString()}
                                      </p>
                                      <p className="text-[9px] text-zinc-500">覆盖人口</p>
                                    </div>
                                    <div
                                      className="rounded px-1.5 py-1 text-center"
                                      style={{ background: "var(--color-subtle)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">{msg.gisResult.coveredCommunities}</p>
                                      <p className="text-[9px] text-zinc-500">覆盖社区</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => msg.gisResult && visualizeGisAnalysis({
                                      stations: msg.gisResult.stations.map(s => s.id),
                                      communities: [],
                                      center: msg.gisResult.center,
                                      radius: msg.gisResult.radius,
                                    })}
                                    className="w-full text-[11px] py-1 rounded flex items-center justify-center gap-1 transition-colors font-medium"
                                    style={{
                                      background: "var(--color-brand-subtle)",
                                      border: "1px solid var(--color-brand-border)",
                                      color: "var(--color-brand-text)",
                                    }}
                                  >
                                    <MapPin className="w-3 h-3" /> 在地图上查看
                                  </button>
                                </div>

                                {msg.gisResult.stations.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-zinc-500">点击可跳转至地图</p>
                                    {msg.gisResult.stations.map((station) => (
                                      <button
                                        key={station.id}
                                        onClick={() => flyToStationById(station.id)}
                                        className="w-full text-left p-1.5 rounded-md transition-all group"
                                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)" }}
                                      >
                                        <div className="flex items-start gap-1.5">
                                          <MapPin className="w-3 h-3 text-zinc-400 group-hover:text-zinc-900 shrink-0 mt-0.5 transition-colors" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-zinc-800 truncate group-hover:text-zinc-900 transition-colors">
                                              {station.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 mt-0.5">
                                              {station.distanceKm != null && (
                                                <span className="text-emerald-600 font-semibold">{station.distanceKm}公里</span>
                                              )}
                                              <span>{station.brand}</span>
                                              <span>· 快{station.fastChargers}/慢{station.slowChargers}</span>
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
                              : (
                                <div className="flex items-center gap-1.5 text-zinc-500">
                                  <span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse" />
                                  <span className="text-[11px]">思考中...</span>
                                </div>
                              )}
                          </>
                        )}
                    </div>
                    {msg.role === "assistant" && msg.content && (
                      <div className="flex items-center justify-end gap-0.5 mt-1">
                        <button onClick={() => copyAi(msg.content, i)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-100 transition-colors"
                          title={copiedIndex === i ? "已复制" : "复制内容"}>
                          {copiedIndex === i
                            ? <Check className="w-3 h-3 text-emerald-500" />
                            : <Copy className="w-3 h-3 text-zinc-400" />}
                        </button>
                        {isLastAssistant && !aiStreaming && (
                          <button onClick={regenerateAi}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-100 transition-colors"
                            title="重新生成">
                            <RotateCcw className="w-3 h-3 text-zinc-400" />
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

          {/* 输入区域 - Linear 风: 紧凑, 黑底白字发送 */}
          <div
            className="shrink-0 px-3 py-2.5 bg-white"
            style={{ borderTop: "1px solid var(--color-muted)" }}
          >
            <div className="flex gap-1.5 items-end">
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
                placeholder="输入问题 · 回车发送 · Shift+回车换行"
                disabled={aiStreaming}
                rows={1}
                className="input-sys flex-1 text-[12px] px-2.5 py-1.5 text-zinc-900 resize-none overflow-hidden min-h-[32px] max-h-[120px]"
              />
              <button onClick={aiStreaming ? stopAi : sendAiMessage}
                disabled={!aiStreaming && !aiInput.trim()}
                className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center transition-all ${
                  aiStreaming
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white disabled:bg-zinc-200 disabled:text-zinc-400"
                }`}>
                {aiStreaming ? <Square className="w-3 h-3" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 全局 Toast 通知 (底部居中, 2.5 秒自动消失) ===== */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-md text-sm animate-fade-in pointer-events-none"
          style={{
            background: toast.type === "success"
              ? "rgba(0,160,120,0.95)"
              : "rgba(24,24,27,0.95)",
            color: "#fff",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid rgba(255,255,255,0.12)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ===== 打印出图对话框 (工具栏"打印"按钮触发) ===== */}
      {printDialogOpen && (
        <PrintDialog
          map={mapRef.current}
          onClose={() => setPrintDialogOpen(false)}
          showToast={showToast}
        />
      )}

      {/* ===== 决策大屏 (阶段三 任务 3.1, 全屏覆盖) ===== */}
      <Dashboard open={showDashboard} onBack={() => setShowDashboard(false)} />

      {/* ===== 命令面板 (阶段四 任务 4.2, Ctrl+K 唤起) ===== */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={(cmd) => {
          handleCommandExecute(cmd);
          setCommandPaletteOpen(false);
        }}
      />

      {/* ===== 快捷键帮助弹窗 (阶段四 任务 4.1.2, Ctrl+/ 唤起) ===== */}
      <ShortcutsHelp
        open={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
      {/* 空间查询结果弹窗 (右上角横栏下方) */}
      {queryResult && (queryResult.stations.length > 0 || queryResult.communities.length > 0) && (
        <QueryResultPanel
          stations={queryResult.stations}
          communities={queryResult.communities}
          tab={queryResultTab}
          onTabChange={setQueryResultTab}
          onClose={() => {
            setQueryResult(null);
            querySourceRef.current?.clear();
          }}
          onFocusStation={(s) => {
            const map = mapRef.current;
            if (map) map.getView().animate({ center: fromLonLat([s.lng, s.lat]), zoom: 15 });
            // 与地图点击一致的选中交互: 金色高亮 + 上方弹出名称/桩数
            selectedStationId = s.id;
            stationLayerRef.current?.changed();
            showStationInfoPopup(s);
          }}
          onFocusCommunity={(c) => {
            const map = mapRef.current;
            if (map && c._center) map.getView().animate({ center: c._center, zoom: 15 });
          }}
        />
      )}
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(9,9,11,0.4)" }}
      onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-md overflow-hidden animate-scale-in"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}>
        {/* 头部 - Linear 风: 无渐变, 紧凑 */}
        <div
          className="px-5 py-3 flex justify-between items-center"
          style={{ borderBottom: "1px solid var(--color-muted)", background: "var(--color-surface)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
            >
              {isUser ? <UserIcon className="w-3.5 h-3.5" style={{ color: "var(--color-ink-3)" }} /> : <Zap className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />}
            </div>
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink-1)" }}>
              {isUser ? (isEdit ? "编辑用户" : "新增用户") : (isEdit ? "编辑充电站" : "新增充电站")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: "var(--color-ink-5)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-5)"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {isUser ? (
            <>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>用户名</label>
                <input type="text" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>密码 {isEdit && "(留空不改)"}</label>
                <input type="text" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? "******" : "请输入密码"}
                  className="input-sys w-full text-sm px-3 py-2 font-mono" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>角色</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                  <option value="新能源车主">新能源车主</option>
                  <option value="投资商">充电设施投资商</option>
                  <option value="管理员">系统管理员</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                  <option value="正常">正常</option>
                  <option value="禁用">禁用</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>站点名称</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>品牌</label>
                  <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>行政区</label>
                  <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                    {["鼓楼区", "云龙区", "贾汪区", "泉山区", "铜山区"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>经度 (GCJ02)</label>
                  <input type="number" step="0.000001" value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>纬度 (GCJ02)</label>
                  <input type="number" step="0.000001" value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>快充桩数</label>
                  <input type="number" value={form.fast_chargers}
                    onChange={(e) => setForm({ ...form, fast_chargers: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>慢充桩数</label>
                  <input type="number" value={form.slow_chargers}
                    onChange={(e) => setForm({ ...form, slow_chargers: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>详细地址</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>运营状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                  <option value="运营中">运营中</option>
                  <option value="建设中">建设中</option>
                  <option value="停运">停运</option>
                </select>
              </div>
            </>
          )}
        </div>
        {/* 底部操作 - Linear 风: 单色, 无渐变 */}
        <div
          className="px-5 py-3 flex justify-end gap-2"
          style={{ borderTop: "1px solid var(--color-muted)", background: "var(--color-subtle)" }}
        >
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-md font-medium transition-colors"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", color: "var(--color-ink-3)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface)"; }}
          >
            取消
          </button>
          <button
            onClick={() => onSave(form)}
            className="btn-brand text-xs px-4 py-2 rounded-md font-medium"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}


