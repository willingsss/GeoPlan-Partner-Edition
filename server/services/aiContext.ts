import * as turf from "@turf/turf";
import type { ChargingStation } from "../types";
import { chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase } from "../db";
import { queryStationsInRadius, getCommunityCentroids } from "./spatialIndex";

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

  // nearby 和 coverage 类型：基于球面距离的空间分析（R-tree 索引 + 缓存质心）
  if (intent.type === "nearby" || intent.type === "coverage") {
    const center: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : XUZHOU_CENTER;
    const radius = intent.radius || 3000;

    // 半径内的充电站（R-tree bbox 初筛 + 精确球面距离过滤，按距离升序）
    const stationsWithDist = queryStationsInRadius(center[0], center[1], radius);

    // 覆盖社区：质心到圆心距离 <= 半径（复用缓存质心，避免重复计算 turf.centroid）
    const centerPt = turf.point(center);
    let coveredPopulation = 0;
    let coveredCommunities = 0;

    for (const comm of getCommunityCentroids()) {
      const dist = turf.distance(centerPt, turf.point(comm.centroid), { units: "meters" });
      if (dist <= radius) {
        coveredPopulation += comm.population;
        coveredCommunities++;
      }
    }

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
// DeepSeek function calling：将自然语言转为结构化 GIS 意图（正则解析的增强，调用方失败时回退到正则）
// =========================================================================

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

const GIS_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "query_charging_stations",
    description:
      "当用户询问徐州市充电站/充电设施的空间分布、覆盖范围、附近N公里内的站点，或按行政区、品牌查询充电站时调用，用于结构化空间检索参数。",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["nearby", "coverage", "district", "brand"],
          description: "nearby=附近N公里内站点；coverage=覆盖分析；district=按行政区查询；brand=按品牌查询",
        },
        radius_km: { type: "number", description: "查询半径（公里），仅 nearby 需要" },
        district: { type: "string", description: "行政区名称，如 泉山区/云龙区/鼓楼区/铜山区/贾汪区/睢宁县" },
        brand: { type: "string", description: "品牌名称，如 国家电网/特来电/星星充电/蔚来换电" },
        fast_only: { type: "boolean", description: "是否只查询快充站，仅 district 需要" },
      },
      required: ["intent"],
    },
  },
};

function normalizeGisArgs(args: any): ReturnType<typeof parseGisIntent> {
  if (!args || typeof args !== "object") return null;
  const intent = args.intent;
  if (intent === "nearby") {
    const radius = typeof args.radius_km === "number" && args.radius_km > 0 ? args.radius_km * 1000 : undefined;
    return { type: "nearby", radius };
  }
  if (intent === "coverage") return { type: "coverage" };
  if (intent === "district" && typeof args.district === "string" && args.district.trim()) {
    return { type: "district", district: args.district.trim(), fastOnly: !!args.fast_only };
  }
  if (intent === "brand" && typeof args.brand === "string" && args.brand.trim()) {
    return { type: "brand", brand: args.brand.trim() };
  }
  return null;
}

// 用 DeepSeek function calling 解析 GIS 意图；任何失败/超时返回 null，由调用方回退到正则解析
export async function resolveGisIntentByLLM(message: string): Promise<ReturnType<typeof parseGisIntent>> {
  // 延迟读取环境变量，避免模块加载时 .env 尚未加载
  const apiKey = process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey || !message) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: message }],
        tools: [GIS_TOOL_SCHEMA],
        tool_choice: "auto",
        stream: false,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    let args: any = {};
    try {
      args = JSON.parse(toolCall.function?.arguments || "{}");
    } catch {
      return null;
    }
    return normalizeGisArgs(args);
  } catch {
    return null;
  }
}