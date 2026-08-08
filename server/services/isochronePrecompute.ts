// =========================================================================
// 等时圈批量预计算服务
// =========================================================================
// 功能：
//   - 扫描 isochrone_status='pending' 的充电站
//   - 并发 5 个调用高德 API 生成快充/慢充等时圈
//   - 写回数据库，更新状态
//   - 服务器启动时异步执行，不阻塞主服务
// =========================================================================

import { getIsochrone, mapLimit, checkAmapAvailable, IsochroneMode } from "./amapIsochrone";
import * as turf from "@turf/turf";

interface PrecomputeProgress {
  total: number;
  done: number;
  ok: number;
  failed: number;
  skipped: number;
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  lastError: string | null;
}

let currentProgress: PrecomputeProgress = {
  total: 0, done: 0, ok: 0, failed: 0, skipped: 0,
  running: false, startedAt: null, finishedAt: null, lastError: null,
};

export function getPrecomputeProgress(): PrecomputeProgress {
  return { ...currentProgress };
}

// 写单个站的等时圈到数据库
// 注意：直接存 JSON 字符串到 JSON 字段（不用 ST_GeomFromGeoJSON，因为后者返回 binary 字符集与 JSON 字段不兼容）
async function saveStationIsochrone(
  dbPool: any,
  stationId: number,
  mode: IsochroneMode,
  geom: any
): Promise<void> {
  const col = mode === "fast" ? "isochrone_fast_geom" : "isochrone_slow_geom";
  const timeCol = mode === "fast" ? "isochrone_fast_updated" : "isochrone_slow_updated";
  await dbPool.query(
    `UPDATE t_charging_station SET ${col} = ?, ${timeCol} = NOW() WHERE id = ?`,
    [JSON.stringify(geom.geometry), stationId]
  );
}

// 更新站点状态
async function updateStationStatus(
  dbPool: any,
  stationId: number,
  status: "ok" | "partial" | "failed"
): Promise<void> {
  await dbPool.query(
    `UPDATE t_charging_station SET isochrone_status = ? WHERE id = ?`,
    [status, stationId]
  );
}

// 计算单个站的快充+慢充等时圈
async function computeStationIsochrones(
  dbPool: any,
  station: { id: number; lng: number; lat: number; fastChargers: number; slowChargers: number },
  memoryStation?: { isochroneFastGeom?: any; isochroneSlowGeom?: any; isochroneStatus?: string; isochroneFastUpdated?: string; isochroneSlowUpdated?: string }
): Promise<{ fast: boolean; slow: boolean; fastError?: string; slowError?: string }> {
  const result = { fast: false, slow: false, fastError: undefined as string | undefined, slowError: undefined as string | undefined };

  // 快充：仅有快充桩的站才计算（避免蔚来换电站等无快充场景）
  if (station.fastChargers > 0) {
    try {
      const fast = await getIsochrone(station.lng, station.lat, "fast");
      await saveStationIsochrone(dbPool, station.id, "fast", fast.geom);
      if (memoryStation) {
        memoryStation.isochroneFastGeom = fast.geom;
        memoryStation.isochroneFastUpdated = new Date().toISOString();
      }
      result.fast = true;
    } catch (e: any) {
      result.fastError = e?.message || String(e);
    }
  } else {
    result.fast = true;
  }

  // 慢充：仅有慢充桩的站才计算
  if (station.slowChargers > 0) {
    try {
      const slow = await getIsochrone(station.lng, station.lat, "slow");
      await saveStationIsochrone(dbPool, station.id, "slow", slow.geom);
      if (memoryStation) {
        memoryStation.isochroneSlowGeom = slow.geom;
        memoryStation.isochroneSlowUpdated = new Date().toISOString();
      }
      result.slow = true;
    } catch (e: any) {
      result.slowError = e?.message || String(e);
    }
  } else {
    result.slow = true;
  }

  // 更新状态
  const status: "ok" | "partial" | "failed" =
    result.fast && result.slow ? "ok" :
    result.fast || result.slow ? "partial" : "failed";
  await updateStationStatus(dbPool, station.id, status);
  if (memoryStation) memoryStation.isochroneStatus = status;

  // 失败时记录详细错误到日志（前 3 个失败站点，避免日志爆炸）
  if (!result.fast || !result.slow) {
    const err = result.fastError || result.slowError;
    if (err && currentProgress.failed < 3) {
      console.error(`[等时圈] 站点 #${station.id} (${station.lng},${station.lat}) 失败: ${err}`);
    }
  }
  return result;
}

// =========================================================================
// 主入口：批量预计算
// =========================================================================
export async function precomputeAllIsochrones(
  dbPool: any,
  stations: Array<{ id: number; lng: number; lat: number; fastChargers: number; slowChargers: number }>,
  options?: { force?: boolean; memoryStations?: any[] }
): Promise<PrecomputeProgress> {
  if (currentProgress.running) {
    return currentProgress;
  }

  const memoryMap = new Map<number, any>();
  if (options?.memoryStations) {
    for (const s of options.memoryStations) memoryMap.set(s.id, s);
  }

  // 过滤需要计算的站点
  const targets = options?.force
    ? stations
    : stations.filter(s => s.lng > 0 && s.lat > 0);

  currentProgress = {
    total: targets.length,
    done: 0, ok: 0, failed: 0, skipped: 0,
    running: true, startedAt: Date.now(), finishedAt: null, lastError: null,
  };

  console.log(`[等时圈] 开始预计算 ${targets.length} 座充电站（并发 2）...`);

  // 检查高德 API 可用性
  const available = await checkAmapAvailable();
  if (!available) {
    currentProgress.running = false;
    currentProgress.finishedAt = Date.now();
    currentProgress.lastError = "高德 API 不可用，请检查 VITE_AMAP_KEY";
    console.warn(`[等时圈] ${currentProgress.lastError}`);
    return currentProgress;
  }

  await mapLimit(targets, 2, async (station) => {
    const memStation = memoryMap.get(station.id);
    const result = await computeStationIsochrones(dbPool, station, memStation);
    if (result.fast && result.slow) currentProgress.ok++;
    else if (result.fast || result.slow) currentProgress.skipped++;
    else currentProgress.failed++;
  }, (done, total, lastError) => {
    currentProgress.done = done;
    if (lastError) currentProgress.lastError = lastError;
    if (done % 10 === 0 || done === total) {
      console.log(`[等时圈] 进度: ${done}/${total}（成功 ${currentProgress.ok}, 部分 ${currentProgress.skipped}, 失败 ${currentProgress.failed}）`);
    }
  });

  currentProgress.running = false;
  currentProgress.finishedAt = Date.now();
  const elapsed = ((currentProgress.finishedAt - (currentProgress.startedAt || 0)) / 1000).toFixed(1);
  console.log(`[等时圈] 预计算完成: ${elapsed}s, 成功 ${currentProgress.ok}, 部分 ${currentProgress.skipped}, 失败 ${currentProgress.failed}`);
  return currentProgress;
}

// =========================================================================
// 异步触发（不阻塞调用方）
// =========================================================================
export function precomputeAsync(dbPool: any, stations: any[], options?: { force?: boolean; memoryStations?: any[] }): void {
  precomputeAllIsochrones(dbPool, stations, options).catch(err => {
    console.error(`[等时圈] 预计算异常:`, err.message);
    currentProgress.running = false;
    currentProgress.lastError = err.message;
  });
}
