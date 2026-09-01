// =========================================================================
// spatialIndex: 空间索引与社区质心缓存
// - 用 RBush(R-tree) 索引充电站/社区质心，替代全量 O(N*M) 扫描
// - 预计算并缓存社区质心，避免每次请求重复计算 turf.centroid
// - 以底层数组 length 作为“版本号”，增删引发长度变化时自动重建索引
// =========================================================================
import RBush from "rbush";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase } from "../db";
import type { ChargingStation } from "../types";

export interface StationIndexEntry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  station: ChargingStation;
}

export interface CommunityCentroid {
  feature: any;
  centroid: [number, number]; // [lng, lat]
  population: number;
}

export interface CommunityIndexEntry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  community: CommunityCentroid;
}

let stationTreeCache: { len: number; tree: RBush<StationIndexEntry> } | null = null;
let communityCache: { len: number; centroids: CommunityCentroid[]; tree: RBush<CommunityIndexEntry> } | null = null;

// 充电站空间索引（点）
export function getStationIndex(): RBush<StationIndexEntry> {
  const len = chargingStations.length;
  if (!stationTreeCache || stationTreeCache.len !== len) {
    const tree = new RBush<StationIndexEntry>();
    tree.load(
      chargingStations.map((s) => ({
        minX: s.lng,
        minY: s.lat,
        maxX: s.lng,
        maxY: s.lat,
        station: s,
      }))
    );
    stationTreeCache = { len, tree };
  }
  return stationTreeCache.tree;
}

// 社区质心缓存（feature 引用 + 预计算质心 + 人口）
export function getCommunityCentroids(): CommunityCentroid[] {
  const len = communitiesDatabase.features.length;
  if (!communityCache || communityCache.len !== len) {
    const centroids: CommunityCentroid[] = communitiesDatabase.features.map((f: any) => {
      const centroid = turf.centroid(f).geometry.coordinates as [number, number];
      return {
        feature: f,
        centroid,
        population: Number(f.properties?.population_total || 0),
      };
    });
    const tree = new RBush<CommunityIndexEntry>();
    tree.load(
      centroids.map((c) => ({
        minX: c.centroid[0],
        minY: c.centroid[1],
        maxX: c.centroid[0],
        maxY: c.centroid[1],
        community: c,
      }))
    );
    communityCache = { len, centroids, tree };
  }
  return communityCache.centroids;
}

// 以 (lng,lat) 为圆心查询 radiusMeters 半径内的充电站，按球面距离升序返回
export function queryStationsInRadius(
  lng: number,
  lat: number,
  radiusMeters: number,
  predicate?: (s: ChargingStation) => boolean
): (ChargingStation & { distanceKm: number })[] {
  const tree = getStationIndex();
  // 半径(m) → 度数包围盒（经度方向按 cos(lat) 收缩）
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const box = { minX: lng - dLng, minY: lat - dLat, maxX: lng + dLng, maxY: lat + dLat };

  const center = turf.point([lng, lat]);
  const result: (ChargingStation & { distanceKm: number })[] = [];
  for (const e of tree.search(box)) {
    if (predicate && !predicate(e.station)) continue;
    const dist = turf.distance(center, turf.point([e.station.lng, e.station.lat]), { units: "kilometers" });
    if (dist <= radiusMeters / 1000) {
      result.push({ ...e.station, distanceKm: Number(dist.toFixed(2)) });
    }
  }
  result.sort((a, b) => a.distanceKm - b.distanceKm);
  return result;
}

// 查询 (lng,lat) 最近的一个充电站（基于 R-tree 扩张搜索，避免全量遍历）
export function nearestStation(
  lng: number,
  lat: number,
  predicate?: (s: ChargingStation) => boolean
): ChargingStation | null {
  const tree = getStationIndex();
  let r = 0.001; // 初始 ~100m 量级的度数
  let best: ChargingStation | null = null;
  let bestDist = Infinity;
  const maxR = 1.5; // 覆盖整个城市级范围

  while (r <= maxR) {
    const box = { minX: lng - r, minY: lat - r, maxX: lng + r, maxY: lat + r };
    const cands = tree.search(box);
    for (const c of cands) {
      if (predicate && !predicate(c.station)) continue;
      const d = turf.distance(turf.point([lng, lat]), turf.point([c.station.lng, c.station.lat]), { units: "meters" });
      if (d < bestDist) {
        bestDist = d;
        best = c.station;
      }
    }
    if (best) {
      // 正方形外最近的可能点在其边中点（经度方向距离最小），一旦 best 不大于它即可安全停止
      const edgeDist = turf.distance(turf.point([lng, lat]), turf.point([lng + r, lat]), { units: "meters" });
      if (bestDist <= edgeDist) break;
    }
    r *= 2;
  }
  return best;
}