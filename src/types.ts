// GeoPlan 平台共享类型与常量定义

export interface ChargingStation {
  id: number;
  name: string;
  brand: string;
  lng: number;
  lat: number;
  fastChargers: number;
  slowChargers: number;
  address: string;
  status: string;
  district: string;
  updateTime: string;
}

export interface CommunityResult {
  id: number;
  name: string;
  district: string;
  population: number;
  coverageRatio: number;
  isBlindSpot: boolean;
  coveredBy: string | null;
}

export interface CoverageSummary {
  totalCommunities: number;
  coveredCommunities: number;
  blindSpotCommunities: number;
  coverageRate: number;
  totalPopulation: number;
  blindSpotPopulation: number;
  totalStations: number;
}

// 盲区聚类候选点 (覆盖分析返回, 按 population 降序)
export interface BlindSpotCluster {
  clusterId: number;
  center: [number, number];
  communityCount: number;
  population: number;
}

export interface SiteMetrics {
  covered_population: number;
  covered_communities: number;
  blind_spot_reduction: number;
  competition_score: number;
  social_benefit: number;
  nearby_station_count: number;
  // 该选址是否落在覆盖盲区内 (来自 evaluate-site 联动)
  in_blind_spot?: boolean;
}

export interface SavedScheme {
  id: number;
  name: string;
  lng: number;
  lat: number;
  radius: number;
  brand: string;
  covered_population: number;
  covered_communities: number;
  blind_spot_reduction: number;
  competition_score: number;
  social_benefit: number;
  creator: string;
  create_time: string;
}

export interface FeedbackItem {
  id: number;
  type: "demand" | "evaluation";
  lng: number;
  lat: number;
  description: string;
  rating?: number;
  submitter: string;
  timestamp: string;
  status: string;
}

export type SubsystemTab =
  | "map"
  | "coverage"
  | "site"
  | "admin";

// =========================================================================
// 用户与权限
// =========================================================================
export type UserRole = "新能源车主" | "投资商" | "管理员";

export interface User {
  id: number;
  username: string;
  role: UserRole;
  status: string;
  create_time: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

// 各角色可访问的子系统
export const ROLE_PERMISSIONS: Record<UserRole, SubsystemTab[]> = {
  "新能源车主": ["map"],
  "投资商":     ["map", "coverage", "site"],
  "管理员":     ["map", "coverage", "site", "admin"],
};

// 角色显示信息 (配色遵循 design-system.md: 主色 #00C896, 辅助 #38BDF8, 强调 #A855F7)
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; desc: string }> = {
  "新能源车主": { label: "新能源车主", color: "#00C896", desc: "查询充电站、提交充电需求与评价" },
  "投资商":     { label: "充电设施投资商", color: "#38BDF8", desc: "覆盖分析、选址决策、方案管理" },
  "管理员":     { label: "系统管理员", color: "#A855F7", desc: "全功能权限、用户管理、反馈审核" },
};

// 预设演示账号（密码与 server.ts 保持一致）
export const DEMO_ACCOUNTS: { username: string; password: string; role: UserRole }[] = [
  { username: "admin",        password: "admin123", role: "管理员" },
  { username: "车主_张先生",   password: "123456",   role: "新能源车主" },
  { username: "投资商_王总",   password: "123456",   role: "投资商" },
];

export const BRAND_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  "国家电网": { color: "#00C896", label: "国家电网", icon: "⚡" },
  "特来电": { color: "#38BDF8", label: "特来电", icon: "🔋" },
  "星星充电": { color: "#E6A23C", label: "星星充电", icon: "⭐" },
  "蔚来换电": { color: "#A855F7", label: "蔚来换电", icon: "🔄" },
  "中国石化": { color: "#F56C6C", label: "中国石化", icon: "⛽" },
  "中国石油": { color: "#F97316", label: "中国石油", icon: "⛽" },
  "特斯拉": { color: "#06B6D4", label: "特斯拉", icon: "🚗" },
  "小桔充电": { color: "#84CC16", label: "小桔充电", icon: "🟢" },
  "云快充": { color: "#0EA5E9", label: "云快充", icon: "☁️" },
  "电能侠": { color: "#8B5CF6", label: "电能侠", icon: "🦸" },
  "闪得能源": { color: "#14B8A6", label: "闪得能源", icon: "⚡" },
  "其他品牌": { color: "#909399", label: "其他品牌", icon: "📍" },
};

export const BRANDS = ["国家电网", "特来电", "星星充电", "蔚来换电", "中国石化", "中国石油", "特斯拉", "小桔充电", "云快充", "电能侠", "闪得能源", "其他品牌"];

export const DISTRICTS = ["泉山区", "云龙区", "鼓楼区", "铜山区", "贾汪区", "沛县", "邳州市", "睢宁县", "新沂市", "丰县"];

export const SUBSYSTEM_TABS: { id: SubsystemTab; label: string; icon: string }[] = [
  { id: "map", label: "地图展示与查询", icon: "Map" },
  { id: "coverage", label: "充电覆盖分析", icon: "Radar" },
  { id: "site", label: "商业选址决策", icon: "Target" },
  { id: "admin", label: "系统管理", icon: "Settings" },
];
