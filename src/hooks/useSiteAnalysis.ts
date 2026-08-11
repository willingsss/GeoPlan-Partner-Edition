// useSiteAnalysis.ts
// 选址决策子系统状态 Hook (拆分自 App.tsx)
// 策略: hook 留 App 层 (状态被地图图层/site 联动共用), 面板组件纯展示 props 化
import { useRef, useState } from "react";

export interface SiteMetrics {
  covered_population: number;
  covered_communities: number;
  competition_score: number;
  social_benefit: number;
  [key: string]: any;
}

export interface SavedScheme {
  id: number;
  name: string;
  [key: string]: any;
}

export function useSiteAnalysis() {
  // 选址参数
  const [siteChargeMode, setSiteChargeMode] = useState<"fast" | "slow">("fast");
  const [siteBrand, setSiteBrand] = useState<string>("国家电网");
  const [siteRadius, setSiteRadius] = useState(800);
  const siteRadiusRef = useRef(siteRadius);

  // 虚拟站点 + 评估结果
  const [virtualStation, setVirtualStation] = useState<{ lng: number; lat: number } | null>(null);
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  // siteInBlindSpot 在 useCoverageAnalysis (盲区联动判断)

  // 方案管理
  const [schemes, setSchemes] = useState<SavedScheme[]>([]);
  const [schemeName, setSchemeName] = useState("");
  const [compareSchemes, setCompareSchemes] = useState<number[]>([]);

  // 弹窗 (ROI / 深度对比 / 竞争态势 / 缺口预测)
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  const [roiInitParams, setRoiInitParams] = useState<{
    fastChargers: number;
    slowChargers: number;
    coveredPopulation: number;
  }>({ fastChargers: 4, slowChargers: 6, coveredPopulation: 0 });
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [competitionDialogOpen, setCompetitionDialogOpen] = useState(false);
  const [gapDialogOpen, setGapDialogOpen] = useState(false);

  // 方案列表加载 (供 App 初始化时调用)
  const [schemesLoaded, setSchemesLoaded] = useState(false);

  return {
    // 参数
    siteChargeMode, setSiteChargeMode,
    siteBrand, setSiteBrand,
    siteRadius, setSiteRadius,
    siteRadiusRef,
    // 虚拟站点 + 结果
    virtualStation, setVirtualStation,
    siteMetrics, setSiteMetrics,
    siteLoading, setSiteLoading,
    // 方案
    schemes, setSchemes,
    schemeName, setSchemeName,
    compareSchemes, setCompareSchemes,
    // 弹窗
    roiDialogOpen, setRoiDialogOpen,
    roiInitParams, setRoiInitParams,
    compareDialogOpen, setCompareDialogOpen,
    competitionDialogOpen, setCompetitionDialogOpen,
    gapDialogOpen, setGapDialogOpen,
    schemesLoaded, setSchemesLoaded,
  };
}
