// =========================================================================
// useCoverageAnalysis: 充电覆盖分析子系统状态 (从 App.tsx 拆分)
// 覆盖分析 / 等时圈 / 盲区聚类 / 覆盖率分级 / 图表面板
// =========================================================================
import { useState } from "react";
import type {
  CoverageSummary,
  CommunityResult,
  BlindSpotCluster,
  CoverageLevel,
  StationEfficiency,
} from "../types";

export function useCoverageAnalysis() {
  // 覆盖分析参数
  const [coverageRadius, setCoverageRadius] = useState<number>(0); // 0 = 使用 chargeMode 预设
  const [coverageDistrict, setCoverageDistrict] = useState<string>("all");

  // 覆盖分析
  const [chargeMode, setChargeMode] = useState<"fast" | "slow">("fast");
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageSummary, setCoverageSummary] = useState<CoverageSummary | null>(null);
  const [coverageResults, setCoverageResults] = useState<CommunityResult[]>([]);
  const [districtStats, setDistrictStats] = useState<any[]>([]);

  // 阶段五 等时圈: 服务区模式切换 + 等时圈覆盖率信息
  const [serviceAreaMode, setServiceAreaMode] = useState<"buffer" | "isochrone" | "hybrid">("buffer");
  const [isochroneCoverage, setIsochroneCoverage] = useState<{ covered: number; total: number; fallback: number; ratio: number } | null>(null);
  const [showIsochroneLayer, setShowIsochroneLayer] = useState<boolean>(true);
  // 服务区图层显示开关 (图例点击切换)
  const [showServiceArea, setShowServiceArea] = useState<boolean>(true);
  // 等时圈预计算进度 (管理员后台用)
  const [isochroneProgress, setIsochroneProgress] = useState<any>(null);
  const [isochronePolling, setIsochronePolling] = useState<boolean>(false);

  // 盲区聚类候选点 (覆盖分析返回)
  const [blindSpotClusters, setBlindSpotClusters] = useState<BlindSpotCluster[]>([]);
  // 跨 Tab 保留的最近一次覆盖分析摘要 (供选址面板联动展示)
  const [lastCoverageSummary, setLastCoverageSummary] = useState<CoverageSummary | null>(null);
  // 当前选址是否落在盲区内
  const [siteInBlindSpot, setSiteInBlindSpot] = useState(false);
  // 地图点击候选点时选中的聚类 (用于弹窗)
  const [selectedCluster, setSelectedCluster] = useState<BlindSpotCluster | null>(null);
  // 社区详情弹窗 (覆盖分析 Tab 点击社区时显示)
  const [communityDetail, setCommunityDetail] = useState<CommunityResult | null>(null);
  const [communityDetailOpen, setCommunityDetailOpen] = useState(false);
  // 候选点面板排序方式 (覆盖分析右下角浮层)
  const [clusterSortBy, setClusterSortBy] = useState<"population" | "communityCount">("population");
  // 候选点面板展开项 (一次展开一个)
  const [expandedClusterId, setExpandedClusterId] = useState<number | null>(null);

  // 阶段三: 覆盖率分级统计 + 充电站效率 (供饼图/柱图渲染)
  const [coverageLevels, setCoverageLevels] = useState<CoverageLevel[]>([]);
  const [stationEfficiency, setStationEfficiency] = useState<StationEfficiency[]>([]);
  // 覆盖率分级筛选 (空 Set = 全部显示, 支持多选: 点击图例切换)
  const [selectedCoverageLevels, setSelectedCoverageLevels] = useState<Set<string>>(new Set());
  // 阶段三 任务 3.3.3: 右侧三个图表面板 (默认全部展开, 不再折叠)
  const [coverageChartCollapsed, setCoverageChartCollapsed] = useState(false);
  const [coveragePieCollapsed, setCoveragePieCollapsed] = useState(false);
  const [stationEffCollapsed, setStationEffCollapsed] = useState(false);

  return {
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
    showServiceArea, setShowServiceArea,
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
    selectedCoverageLevels, setSelectedCoverageLevels,
    coverageChartCollapsed, setCoverageChartCollapsed,
    coveragePieCollapsed, setCoveragePieCollapsed,
    stationEffCollapsed, setStationEffCollapsed,
  };
}
