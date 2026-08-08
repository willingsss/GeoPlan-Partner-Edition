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

// WGS84 -> GCJ-02 坐标转换 (用于调用高德 API)
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
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
