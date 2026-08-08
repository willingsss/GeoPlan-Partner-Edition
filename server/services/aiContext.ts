import * as turf from "@turf/turf";
import type { ChargingStation } from "../types";
import { chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase } from "../db";

// =========================================================================
// 9.9 GIS 意图解析与空间分析
// =========================================================================

export function parseGisIntent(message: string, userLocation?: { lng: number; lat: number }): {
  type: string;
  radius?: number;
  center?: [number, number];
  district?: string;
  brand?: string;
  fastOnly?: boolean;
} | null {
  if (!message) return null;
  const msg = message;

  // 1. 附近 Nkm / N公里 / Nkm内 / 半径 N 公里 / 半径 Nkm
  const nearbyPatterns = [
    /附近\s*(\d+(?:\.\d+)?)\s*(?:km|公里)/i,
    /(\d+(?:\.\d+)?)\s*(?:km|公里)\s*内/i,
    /半径\s*(\d+(?:\.\d+)?)\s*(?:km|公里)/i,
    /半径\s*(\d+(?:\.\d+)?)\s*km/i,
    /(\d+(?:\.\d+)?)\s*km/i,
  ];
  for (const pattern of nearbyPatterns) {
    const match = msg.match(pattern);
    if (match) {
      const radius = parseFloat(match[1]) * 1000;
      return { type: "nearby", radius };
    }
  }

  // 2. 覆盖分析
  if (/覆盖分析|覆盖多少小区|覆盖多少人口|范围内/.test(msg)) {
    return { type: "coverage" };
  }

  // 3. 行政区查询（铜山区、泉山区等）
  const districtMatch = msg.match(/(铜山区|泉山区|鼓楼区|云龙区|贾汪区|睢宁县)/);
  if (districtMatch) {
    const fastOnly = /快充/.test(msg);
    return { type: "district", district: districtMatch[1], fastOnly };
  }

  // 4. 品牌查询（国家电网、特来电、星星充电）
  const brandMatch = msg.match(/(国家电网|特来电|星星充电)/);
  if (brandMatch) {
    return { type: "brand", brand: brandMatch[1] };
  }

  return null;
}

export function doGisAnalysis(intent: ReturnType<typeof parseGisIntent>, userLocation?: { lng: number; lat: number }): {
  stations: ChargingStation[];
  count: number;
  coveredPopulation: number;
  coveredCommunities: number;
  radius: number;
  center: [number, number];
  district?: string;
  brand?: string;
} | null {
  if (!intent) return null;

  const XUZHOU_CENTER: [number, number] = [117.2, 34.2];

  // nearby 和 coverage 类型：基于缓冲区的空间分析
  if (intent.type === "nearby" || intent.type === "coverage") {
    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : XUZHOU_CENTER;
    const radius = intent.radius || 3000;
    // 筛选在圆内的充电站（用 turf.pointInCircle 做不等式判断，更可靠）
    const circle = turf.circle(center, radius / 1000, { units: "kilometers" });
    const stationsInCircle = chargingStations.filter(s => {
      const pt = turf.point([s.lng, s.lat]);
      return turf.booleanPointInPolygon(pt, circle);
    });

    // 计算每个站点到中心的距离并排序
    const centerPt = turf.point(center);
    const stationsWithDist = stationsInCircle.map(s => ({
      ...s,
      distanceKm: Number(turf.distance(centerPt, turf.point([s.lng, s.lat]), { units: "kilometers" }).toFixed(2)),
    }));
    stationsWithDist.sort((a, b) => a.distanceKm - b.distanceKm);

    // 筛选覆盖的社区（社区质心在圆内且距离在半径内）
    let coveredPopulation = 0;
    let coveredCommunities = 0;

    communitiesDatabase.features.forEach((comm: any) => {
      const centroid = turf.centroid(comm);
      const dist = turf.distance(centerPt, centroid, { units: "meters" });
      if (dist <= radius && turf.booleanPointInPolygon(centroid, circle)) {
        coveredPopulation += comm.properties.population_total || 0;
        coveredCommunities++;
      }
    });

    return { stations: stationsWithDist, count: stationsWithDist.length, coveredPopulation, coveredCommunities, radius, center };
  }

  // district 类型：按行政区过滤
  if (intent.type === "district") {
    let stations = chargingStations.filter(s => s.district === intent.district);
    if (intent.fastOnly) {
      stations = stations.filter(s => s.fastChargers > 0);
    }
    const districtCommunities = communitiesDatabase.features.filter(
      (c: any) => c.properties.district === intent.district
    );
    const coveredPopulation = districtCommunities.reduce(
      (sum: number, c: any) => sum + (c.properties.population_total || 0), 0
    );
    return {
      stations,
      count: stations.length,
      coveredPopulation,
      coveredCommunities: districtCommunities.length,
      radius: 0,
      center: XUZHOU_CENTER,
      district: intent.district,
    };
  }

  // brand 类型：按品牌过滤
  if (intent.type === "brand") {
    const stations = chargingStations.filter(s => s.brand === intent.brand);
    return {
      stations,
      count: stations.length,
      coveredPopulation: 0,
      coveredCommunities: 0,
      radius: 0,
      center: XUZHOU_CENTER,
      brand: intent.brand,
    };
  }

  return null;
}

// =========================================================================