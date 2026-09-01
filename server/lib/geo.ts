// 空间几何工具：坐标投影 / bbox / 面积 / 缓冲区（EPSG:3857 平面计算）
import * as turf from "@turf/turf";

// =========================================================================
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

export function toEPSG3857(coord: [number, number]): [number, number] {
  const [lng, lat] = coord;
  const x = (lng * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
}

export function toEPSG4326(coord: [number, number]): [number, number] {
  const [x, y] = coord;
  const lng = (x * 180) / 20037508.34;
  let lat = (y * 180) / 20037508.34;
  lat = (360 * clamp(Math.atan(Math.exp((lat * Math.PI) / 180)), 0, Math.PI) / Math.PI) - 90;
  return [lng, lat];
}

// WGS84 <-> GCJ-02 坐标转换（收敛到共享模块，避免前后端算法漂移）
export { wgs84ToGcj02, gcj02ToWgs84 } from "../../shared/coordinate";

export function projectGeometryTo3857(geom: any): any {
  const cloned = JSON.parse(JSON.stringify(geom));
  turf.coordEach(cloned, (coord) => {
    const projected = toEPSG3857([coord[0], coord[1]]);
    coord[0] = projected[0];
    coord[1] = projected[1];
  });
  return cloned;
}

export function projectGeometryTo4326(geom: any): any {
  const cloned = JSON.parse(JSON.stringify(geom));
  turf.coordEach(cloned, (coord) => {
    const projected = toEPSG4326([coord[0], coord[1]]);
    coord[0] = projected[0];
    coord[1] = projected[1];
  });
  return cloned;
}


// =========================================================================
// 矩形 bbox: [minX, minY, maxX, maxY]
type BBox = [number, number, number, number];

// 矩形快速相交判定（不接触视为不相交）
export function bboxIntersect(b1: BBox, b2: BBox): boolean {
  return !(b1[2] < b2[0] || b1[0] > b2[2] || b1[3] < b2[1] || b1[1] > b2[3]);
}

// 计算几何在 EPSG:3857 下的 bbox（懒缓存到 feature 上）
export function getCachedBBox3857(feature: any): BBox {
  if (!feature._bbox3857) {
    const projected = projectGeometryTo3857(feature);
    const bbox = turf.bbox(projected); // [minX, minY, maxX, maxY]
    feature._bbox3857 = bbox;
    feature._proj3857 = projected;
  }
  return feature._bbox3857;
}

// 计算几何在 EPSG:3857 下的质心（懒缓存到 feature 上）
export function getCachedCentroid3857(feature: any): [number, number] {
  if (!feature._centroid3857) {
    const bbox = getCachedBBox3857(feature);
    // 用 bbox 中心近似质心（更快，社区面足够规则）
    feature._centroid3857 = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }
  return feature._centroid3857;
}

// 取已缓存的 3857 投影几何（必须先调用 getCachedBBox3857）
export function getCachedProj3857(feature: any): any {
  return feature._proj3857;
}

// =========================================================================
export function getPlanarPolygonArea3857(poly: any): number {
  if (!poly || !poly.geometry) return 0;
  const geomType = poly.geometry.type;
  if (geomType === "Polygon") {
    return getSingleRingArea3857(poly.geometry.coordinates[0]);
  } else if (geomType === "MultiPolygon") {
    let total = 0;
    for (const polygonCoords of poly.geometry.coordinates) {
      total += getSingleRingArea3857(polygonCoords[0]);
    }
    return total;
  }
  return 0;
}

export function getSingleRingArea3857(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

// =========================================================================
export function createPlanarBuffer3857(center3857: [number, number], radiusMeters: number, steps: number = 64): any {
  const [centerX, centerY] = center3857;
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i * 2 * Math.PI) / steps;
    const x = centerX + radiusMeters * Math.cos(theta);
    const y = centerY + radiusMeters * Math.sin(theta);
    ring.push([x, y]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return turf.polygon([ring]);
}
