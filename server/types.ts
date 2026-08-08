// GeoPlan 后端共享类型定义
export type BBox = [number, number, number, number];

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
  operator?: string;
  // 等时圈服务区（基于真实路网的可达范围）
  isochroneFastGeom?: any;      // 快充等时圈多边形 (WGS84 GeoJSON Polygon)
  isochroneSlowGeom?: any;      // 慢充等时圈多边形
  isochroneFastUpdated?: string;
  isochroneSlowUpdated?: string;
  isochroneStatus?: "pending" | "ok" | "partial" | "failed";
}


// =========================================================================
export interface FeedbackPoint {
  id: number;
  type: "demand" | "evaluation";
  lng: number;
  lat: number;
  stationId?: number;
  description: string;
  rating?: number;
  submitter: string;
  create_time: string;
  status: "pending" | "approved" | "rejected";
}


// =========================================================================
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
