// =========================================================================
// 高德等时圈服务（星形多方向路径规划法）
// =========================================================================
// 原理：从站点出发，向 N 个方向各规划一条驾车/步行路径，
//       用二分法找到 duration ≈ 目标时长的目的地坐标，
//       连接所有方向的终点构成"等时圈多边形"。
//
// 依据：
//   - 快充：驾车 10 分钟（GB/T 51313-2018 + 用户行为白皮书）
//   - 慢充：步行 15 分钟（住建部"15 分钟生活圈"）
//
// 优势：
//   - 不依赖高德等时圈 API（需单独开通权限）
//   - 仅用基础路径规划接口（已可用）
//   - 学术界常用的星形等时圈近似法
// =========================================================================

import * as turf from "@turf/turf";

const AMAP_BASE = "https://restapi.amap.com/v3";
const FAST_DURATION_SEC = 10 * 60;  // 快充驾车 10 分钟
const SLOW_DURATION_SEC = 15 * 60;  // 慢充步行 15 分钟
const DIRECTIONS = 16;              // 16 个方向（每 22.5°）
const BISECTION_MAX_ITER = 8;       // 二分法最大迭代次数

// 延迟读取 AMAP_KEY，避免模块加载时 .env 尚未加载
function getAmapKey(): string {
  return process.env.VITE_AMAP_KEY || process.env.AMAP_KEY || "";
}

// =========================================================================
// 1. GCJ02 ↔ WGS84 坐标转换（项目已有 WGS84→GCJ02，此处补反向）
// =========================================================================
const PI = 3.1415926535897932384626;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

// WGS84 -> GCJ02（与 server.ts 中一致，供本服务内部使用）
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

// GCJ02 -> WGS84（反向：用偏导近似，精度足够 GIS 应用）
export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  // 先计算 (lng, lat) 处的偏移量（假设原 WGS84 接近 (lng, lat)）
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  // 反向减去偏移
  return [lng - dLng, lat - dLat];
}

// 批量转换 GeoJSON 几何坐标（GCJ02 → WGS84）
function convertGeoJsonGcj02ToWgs84(geom: any): any {
  const cloned = JSON.parse(JSON.stringify(geom));
  turf.coordEach(cloned, (coord) => {
    const [lng, lat] = gcj02ToWgs84(coord[0], coord[1]);
    coord[0] = lng;
    coord[1] = lat;
  });
  return cloned;
}

// =========================================================================
// 2. 并发控制工具（p-limit 风格简易实现）
// =========================================================================
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number, lastError?: string) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  let lastError: string | undefined;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (e: any) {
        lastError = e?.message || String(e);
        results[idx] = undefined as any;
      }
      done++;
      if (onProgress) onProgress(done, items.length, lastError);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// =========================================================================
// 3. 高德路径规划接口调用
// =========================================================================
interface RouteResult {
  duration: number;  // 秒
  distance: number;  // 米
  reached: boolean;  // 是否成功规划
}

async function planRoute(
  originGcj02: [number, number],
  destGcj02: [number, number],
  mode: "driving" | "walking"
): Promise<RouteResult> {
  const key = getAmapKey();
  if (!key) throw new Error("未配置 VITE_AMAP_KEY");
  const url = `${AMAP_BASE}/direction/${mode}` +
    `?key=${key}` +
    `&origin=${originGcj02[0]},${originGcj02[1]}` +
    `&destination=${destGcj02[0]},${destGcj02[1]}` +
    `&extensions=base&output=JSON`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`高德API HTTP ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "1" || !data.route?.paths?.[0]) {
    return { duration: 0, distance: 0, reached: false };
  }
  const path = data.route.paths[0];
  return {
    duration: parseInt(path.duration) || 0,
    distance: parseInt(path.distance) || 0,
    reached: true,
  };
}

// =========================================================================
// 4. 沿单一方向用二分法找到目标时长的可达点
// =========================================================================
// 给定起点和方向角，找到 duration ≈ targetDuration 的目的地坐标
// 思路：在 [minDist, maxDist] 区间二分，调整目的地距离
async function findReachablePointInDirection(
  originWgs84: [number, number],
  angleDeg: number,
  targetDurationSec: number,
  mode: "driving" | "walking"
): Promise<[number, number] | null> {
  const originGcj02 = wgs84ToGcj02(originWgs84[0], originWgs84[1]);

  // 初始搜索范围：驾车 10 分钟约 0-8 km；步行 15 分钟约 0-1.5 km
  let minDist = mode === "driving" ? 500 : 100;
  let maxDist = mode === "driving" ? 8000 : 1500;
  let bestPoint: [number, number] | null = null;
  let bestDiff = Infinity;

  for (let iter = 0; iter < BISECTION_MAX_ITER; iter++) {
    const midDist = (minDist + maxDist) / 2;
    // 在 WGS84 下沿方位角计算目的地（turf.destination 输入输出都是 WGS84）
    const dest = turf.destination(
      turf.point(originWgs84),
      midDist / 1000,  // km
      angleDeg
    );
    const destWgs84: [number, number] = [
      dest.geometry.coordinates[0],
      dest.geometry.coordinates[1],
    ];
    const destGcj02 = wgs84ToGcj02(destWgs84[0], destWgs84[1]);

    const route = await planRoute(originGcj02, destGcj02, mode);
    if (!route.reached) {
      // 路径规划失败，缩短距离
      maxDist = midDist;
      continue;
    }

    const diff = route.duration - targetDurationSec;
    if (Math.abs(diff) < 30) {  // 误差 30 秒内可接受
      return destWgs84;
    }
    if (Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      bestPoint = destWgs84;
    }
    if (diff > 0) {
      // 时间过长，缩短距离
      maxDist = midDist;
    } else {
      // 时间过短，加长距离
      minDist = midDist;
    }
  }
  return bestPoint;
}

// =========================================================================
// 5. 生成等时圈多边形（主入口）
// =========================================================================
export type IsochroneMode = "fast" | "slow";

export interface IsochroneResult {
  geom: any;             // WGS84 GeoJSON Polygon Feature
  mode: IsochroneMode;
  targetDuration: number; // 秒
  reachedDirections: number;
  totalDirections: number;
}

export async function getIsochrone(
  lng: number,
  lat: number,
  mode: IsochroneMode
): Promise<IsochroneResult> {
  const travelMode = mode === "fast" ? "driving" : "walking";
  const targetDuration = mode === "fast" ? FAST_DURATION_SEC : SLOW_DURATION_SEC;
  const originWgs84: [number, number] = [lng, lat];

  // 16 个方向并行规划
  const angles = Array.from({ length: DIRECTIONS }, (_, i) => (i * 360) / DIRECTIONS);
  const points = await mapLimit(angles, 5, (angle) =>
    findReachablePointInDirection(originWgs84, angle, targetDuration, travelMode as any)
  );

  // 过滤无效点，构建多边形外环
  const ring: [number, number][] = [];
  let reached = 0;
  for (const p of points) {
    if (p) {
      ring.push(p);
      reached++;
    }
  }
  if (ring.length < 3) {
    throw new Error(`等时圈规划失败：仅 ${reached}/${DIRECTIONS} 个方向可达`);
  }
  // 闭合环
  ring.push(ring[0]);

  const polygon = turf.polygon([ring]);
  return {
    geom: polygon,
    mode,
    targetDuration,
    reachedDirections: reached,
    totalDirections: DIRECTIONS,
  };
}

// =========================================================================
// 6. 健康检查
// =========================================================================
export async function checkAmapAvailable(): Promise<boolean> {
  if (!getAmapKey()) return false;
  try {
    const result = await planRoute(
      wgs84ToGcj02(117.28, 34.21),
      wgs84ToGcj02(117.35, 34.21),
      "driving"
    );
    return result.reached;
  } catch {
    return false;
  }
}
