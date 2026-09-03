import express from "express";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase, schemesDatabase } from "../db";
import { COVERAGE_RADIUS, getCoverageRadius } from "../config/coverageConfig";
import { buildCacheKey, getFromCache, setToCache } from "../lib/analysisCache";
import { toEPSG3857, projectGeometryTo3857, projectGeometryTo4326, getPlanarPolygonArea3857, createPlanarBuffer3857, getCachedBBox3857, getCachedCentroid3857, getCachedProj3857, bboxIntersect } from "../lib/geo";
import { requireAuth, requireRole } from "../middleware/auth";
import { fetchDistrictBoundary } from "../services/districtBoundary";
import type { BBox } from "../types";

// =========================================================================
// 等时圈几何读取 + 置信度解析
// 兼容两种存储格式: Feature(带 .geometry + .properties.reachedDirections) 或裸几何({type,coordinates})
// 置信度 = 星形法方向命中率 (reached/total)；旧格式(裸几何)降级为默认 0.7
// =========================================================================
const LEGACY_ISO_CONFIDENCE = 0.7;

// 等时圈置信度权重上限: 星形 16 方向连线仅为等时圈近似 (方向采样有限 + 路网数据有时效),
// 即使全部方向命中也不赋予 100% 权重, 保证缓冲区口径始终参与加权 (保底 25%),
// 使区间模式主值与纯等时圈模式可区分, 结果更保守且可解释
const ISO_CONF_WEIGHT_CAP = 0.75;

function parseIsochroneGeom(raw: any): { geom: any; confidence: number } | null {
  if (!raw) return null;
  const isFeature = raw.type === "Feature";
  const geom = isFeature ? raw.geometry : raw;
  if (!geom || !geom.type) return null;
  const props = isFeature ? raw.properties : null;
  const reached = Number(props?.reachedDirections);
  const total = Number(props?.totalDirections);
  const confidence = props && Number.isFinite(reached) && Number.isFinite(total) && total > 0
    ? Math.max(0, Math.min(1, reached / total))
    : LEGACY_ISO_CONFIDENCE;
  return { geom, confidence };
}

export default function registerAnalysisRoutes(app: express.Express) {
app.post("/api/v1/analysis/coverage", async (req, res) => {
  try {
    const { chargeMode, radius, district, serviceAreaMode } = req.body; // "fast" | "slow"

    // LRU 缓存: 相同参数 60 秒内直接返回, 避免重复几何求交计算
    const cacheKey = buildCacheKey({ chargeMode, radius, district, serviceAreaMode });
    const cached = getFromCache(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached, _fromCache: true });
      return;
    }
    // serviceAreaMode: "buffer"（默认，圆形缓冲区）/ "isochrone"（路网等时圈）/ "hybrid"（混合，缺失回退缓冲区）
    const saMode: "buffer" | "isochrone" | "hybrid" = ["buffer", "isochrone", "hybrid"].includes(serviceAreaMode)
      ? serviceAreaMode
      : "buffer";
    // 快充: 驾车补电半径 1000m
    // 慢充: 目的地覆盖半径 400m (驻地/办公地慢充桩覆盖社区范围)
    // 等时圈场景: 快充驾车10分钟 / 慢充步行15分钟 (在 amapIsochrone.ts 中独立配置, 与本缓冲区半径解耦)
    // 优先使用传入的自定义 radius，未传时回退到 chargeMode 推导
    const serviceRadius = (typeof radius === "number" && radius > 0)
      ? radius
      : getCoverageRadius(chargeMode);
    // 覆盖分析纳入所有有效坐标的充电站 (含维护中, 因为规划分析需考虑全部基础设施)
    // 仅排除蔚来换电 (换电站与充电站服务模式不同) 和坐标无效的站点
    const activeStations = chargingStations.filter(s => s.brand !== "蔚来换电" && s.lng > 0 && s.lat > 0);

    // 行政区过滤：若指定 district（非空且非 "all"），仅分析该区社区
    const districtFilter = typeof district === "string" && district && district !== "all" ? district : null;
    const targetCommunities = districtFilter
      ? communitiesDatabase.features.filter((comm: any) => comm.properties.district === districtFilter)
      : communitiesDatabase.features;
    // 行政区过滤也作用于站点: 仅生成所选行政区内站点的服务区
    const filteredStations = districtFilter
      ? activeStations.filter(s => s.district === districtFilter)
      : activeStations;

    // 为每个运营中的充电站生成服务区
    // 三种模式：
    //   buffer    — 圆形缓冲区（默认）
    //   isochrone — 路网等时圈，缺失不计入
    //   hybrid    — 双指标区间模式：每站同时保留缓冲区与等时圈两种几何，
    //               社区覆盖率输出「悲观~乐观」区间 + 置信度加权主值（见下方社区循环）
    const isFast = chargeMode !== "slow";
    const serviceRadiusSq = serviceRadius * serviceRadius;
    const serviceAreas: any[] = [];
    let isochroneCoverageCount = 0;
    let fallbackCount = 0;
    let confidenceSum = 0; // 等时圈站置信度之和（求平均用）

    for (const station of filteredStations) {
      const center3857 = toEPSG3857([station.lng, station.lat]);
      // 缓冲区几何（hybrid 模式下总是生成，作为区间的一个分量）
      const bufferGeom = createPlanarBuffer3857(center3857, serviceRadius);
      const bufferBbox: BBox = [
        center3857[0] - serviceRadius, center3857[1] - serviceRadius,
        center3857[0] + serviceRadius, center3857[1] + serviceRadius,
      ];

      // 尝试取等时圈几何
      const isochroneRaw = isFast ? station.isochroneFastGeom : station.isochroneSlowGeom;
      const parsedIso = (saMode === "isochrone" || saMode === "hybrid") ? parseIsochroneGeom(isochroneRaw) : null;

      if (parsedIso) {
        // 等时圈几何是 WGS84，需投影到 3857 以便后续叠置
        const isochroneProj = projectGeometryTo3857(parsedIso.geom);
        const isochroneBbox = turf.bbox(isochroneProj);
        const isochroneCenter: [number, number] = [
          (isochroneBbox[0] + isochroneBbox[2]) / 2,
          (isochroneBbox[1] + isochroneBbox[3]) / 2,
        ];
        serviceAreas.push({
          station,
          buffer: turf.feature(isochroneProj), // 主几何: 等时圈（渲染/重叠分析用）, 与缓冲区模式格式一致 (turf.intersect 需要)
          center: isochroneCenter,
          bbox: isochroneBbox as BBox,
          source: "isochrone",
          // hybrid 双几何分量
          bufGeom: saMode === "hybrid" ? bufferGeom : undefined,
          bufBbox: bufferBbox,
          isoGeom: saMode === "hybrid" ? isochroneProj : undefined,
          isoBbox: isochroneBbox as BBox,
          isoConfidence: parsedIso.confidence,
        });
        isochroneCoverageCount++;
        confidenceSum += parsedIso.confidence;
      } else if (saMode === "isochrone") {
        // 严格等时圈模式：缺失则跳过该站点
        continue;
      } else {
        serviceAreas.push({
          station,
          buffer: bufferGeom,
          center: center3857,
          bbox: bufferBbox,
          source: "buffer",
          // hybrid 双几何分量: 无等时圈数据, 该站仅贡献缓冲区分量
          bufGeom: saMode === "hybrid" ? bufferGeom : undefined,
          bufBbox: bufferBbox,
          isoGeom: undefined,
          isoBbox: undefined,
          isoConfidence: 0,
        });
        if (saMode === "hybrid") fallbackCount++;
      }
    }
    const avgConfidence = isochroneCoverageCount > 0
      ? Math.round((confidenceSum / isochroneCoverageCount) * 1000) / 10
      : 0;

    // 服务区重叠分析：双层循环求交，识别冗余覆盖区域
    // 性能优化：用质心距离预筛（两圆心距 > 2r 必不相交）+ bbox 快速判定
    const overlapFeatures: any[] = [];
    let totalOverlapArea = 0;
    for (let i = 0; i < serviceAreas.length; i++) {
      const sa1 = serviceAreas[i];
      for (let j = i + 1; j < serviceAreas.length; j++) {
        const sa2 = serviceAreas[j];
        // 快速判定：质心距离 > 2r 必不相交
        const dx = sa1.center[0] - sa2.center[0];
        const dy = sa1.center[1] - sa2.center[1];
        if (dx * dx + dy * dy > 4 * serviceRadiusSq) continue;
        // 快速判定：bbox 不相交
        if (!bboxIntersect(sa1.bbox, sa2.bbox)) continue;

        let intersection: any = null;
        try {
          intersection = turf.intersect(turf.featureCollection([sa1.buffer, sa2.buffer]));
        } catch { intersection = null; }
        if (intersection) {
          const overlapArea = getPlanarPolygonArea3857(intersection);
          if (overlapArea > 0) {
            // 累加重叠面积（含多重重叠，作为冗余度近似指标）
            totalOverlapArea += overlapArea;
            overlapFeatures.push(turf.feature(
              projectGeometryTo4326(intersection.geometry),
              {
                stations: [sa1.station.name, sa2.station.name],
                area: Math.round(overlapArea),
              }
            ));
          }
        }
      }
    }
    // 服务区总面积（EPSG:3857 平面面积之和）
    const totalServiceArea = serviceAreas.reduce((sum, s) => sum + getPlanarPolygonArea3857(s.buffer), 0);
    // 冗余度 = Σ重叠面积 / Σ服务区面积 × 100，保留 1 位小数；总面积为 0 时记 0
    const redundancyScore = totalServiceArea > 0
      ? Math.round((totalOverlapArea / totalServiceArea) * 1000) / 10
      : 0;
    const overlapAreas = { type: "FeatureCollection", features: overlapFeatures };

    // 分析每个社区的覆盖情况
    // 性能优化：① 懒缓存社区的 3857 投影/bbox/质心（多次分析复用）
    //         ② bbox 快速判定 + 质心距离预筛，跳过远距离服务区
    //         ③ 覆盖率 ≥0.95 时早退（视为基本完全覆盖）
    //         ④ O6: 异步分块计算, 每块间让出事件循环, 避免单请求阻塞服务器其他请求
    const communityResults: any[] = [];
    const blindSpotFeatures: any[] = [];
    let totalCoveredPop = 0;
    let totalPopulation = 0;
    let coveredCount = 0;
    let blindSpotCount = 0;
    // hybrid 双指标口径累计: 逐社区混合比例/双口径上下界之和 (汇总层改为"覆盖程度均值"而非阈值计数,
    // 使缓冲区 25% + 等时圈 75% 的占比混合真正传导到最终数字, 与等时圈模式可区分)
    let hybridRatioSum = 0;
    let minRatioSum = 0;
    let maxRatioSum = 0;

    // 把社区循环改为分块异步执行: 每 BATCH 个社区让出一次事件循环, 允许其他 HTTP 请求并发处理
    const COMMUNITY_BATCH = 200;
    const processCommunity = (comm: any) => {
      const commBbox = getCachedBBox3857(comm);
      const commProj = getCachedProj3857(comm);
      const commCentroid = getCachedCentroid3857(comm);
      const commArea = getPlanarPolygonArea3857(commProj);
      const pop = comm.properties.population_total;
      totalPopulation += pop;
      // hybrid 模式下求交辅助: 对指定几何求交并返回覆盖率 (异常返回 0)
      // 注意: 入参可能是 Feature(缓冲区) 或裸几何(等时圈投影), 需归一化为 Feature 才能进 featureCollection
      const intersectRatio = (geom: any): number => {
        try {
          const feat = geom?.type === "Feature" ? geom : turf.feature(geom);
          const intersection = turf.intersect(turf.featureCollection([commProj, feat]));
          if (!intersection) return 0;
          return getPlanarPolygonArea3857(intersection) / commArea;
        } catch { return 0; }
      };

      // 社区外接圆半径近似（bbox 对角线一半），用于质心距离预筛
      const commHalfDiag = Math.hypot(
        (commBbox[2] - commBbox[0]) / 2,
        (commBbox[3] - commBbox[1]) / 2
      );
      const maxSearchDist = serviceRadius + commHalfDiag;
      const maxSearchDistSq = maxSearchDist * maxSearchDist;

      if (saMode === "hybrid") {
        // ------------------------------------------------------------------
        // hybrid 双指标区间模式：
        //   ratioBuf = max(社区 ∩ 缓冲区)   —— 直线距离理想化口径（乐观分量）
        //   ratioIso = max(社区 ∩ 等时圈)   —— 真实路网可达口径（现实分量）
        //   主值     = isoConf × ratioIso + (1 − isoConf) × ratioBuf（置信度加权）
        //   区间     = [min, max]，宽度本身即数据不确定性的可行动信号
        // ------------------------------------------------------------------
        let maxRatioBuf = 0, bufStation: string | null = null;
        let maxRatioIso = 0, isoStation: string | null = null, isoConfBest = 0;

        for (const sa of serviceAreas) {
          // 缓冲区分量: bbox + 质心距离预筛
          if (bboxIntersect(commBbox, sa.bufBbox)) {
            const dx = (sa.bufBbox[0] + sa.bufBbox[2]) / 2 - commCentroid[0];
            const dy = (sa.bufBbox[1] + sa.bufBbox[3]) / 2 - commCentroid[1];
            if (dx * dx + dy * dy <= maxSearchDistSq) {
              const ratio = intersectRatio(sa.bufGeom);
              if (ratio > maxRatioBuf) {
                maxRatioBuf = ratio;
                bufStation = sa.station.name;
              }
            }
          }
          // 等时圈分量: bbox 预筛（等时圈非圆形, 质心距离预筛不适用）
          if (sa.isoGeom && bboxIntersect(commBbox, sa.isoBbox)) {
            const ratio = intersectRatio(sa.isoGeom);
            if (ratio > maxRatioIso) {
              maxRatioIso = ratio;
              isoStation = sa.station.name;
              isoConfBest = sa.isoConfidence;
            }
          }
          // 早退: 两种口径均已基本完全覆盖
          if (maxRatioBuf >= 0.95 && maxRatioIso >= 0.95) break;
        }

        // 社区级置信度: 取得等时圈最大覆盖率的站的方向命中率, 并施加权重上限 (星形近似不赋予满权重);
        // 无等时圈数据时为 0（主值退化为缓冲区口径）
        const isoConf = maxRatioIso > 0 ? Math.min(isoConfBest, ISO_CONF_WEIGHT_CAP) : 0;
        const hybridRatio = isoConf * maxRatioIso + (1 - isoConf) * maxRatioBuf;
        const coveragePercent = Math.round(hybridRatio * 1000) / 10;
        const bufPercent = Math.round(maxRatioBuf * 1000) / 10;
        const isoPercent = Math.round(maxRatioIso * 1000) / 10;
        const pessimistic = Math.round(Math.min(maxRatioBuf, maxRatioIso) * 1000) / 10;
        const optimistic = Math.round(Math.max(maxRatioBuf, maxRatioIso) * 1000) / 10;
        const isBlindSpot = hybridRatio < 0.1;

        // 双口径覆盖程度累计 (汇总层按比例均值聚合, 而非阈值计数)
        hybridRatioSum += hybridRatio;
        minRatioSum += Math.min(maxRatioBuf, maxRatioIso);
        maxRatioSum += Math.max(maxRatioBuf, maxRatioIso);

        let level: string;
        if (coveragePercent < 10) level = "极差";
        else if (coveragePercent < 30) level = "较差";
        else if (coveragePercent < 60) level = "一般";
        else if (coveragePercent < 90) level = "良好";
        else level = "优秀";

        if (isBlindSpot) {
          blindSpotCount++;
          blindSpotFeatures.push({
            type: "Feature",
            id: comm.id,
            geometry: comm.geometry,
            properties: {
              ...comm.properties,
              coverage_ratio: coveragePercent,
              is_blind_spot: true,
            },
          });
        } else {
          coveredCount++;
          totalCoveredPop += Math.round(pop * hybridRatio);
        }

        communityResults.push({
          id: comm.id,
          name: comm.properties.name,
          district: comm.properties.district,
          population: pop,
          coverageRatio: coveragePercent,
          level,
          isBlindSpot,
          // 主覆盖站: 双口径中覆盖率较大者对应的站
          coveredBy: maxRatioIso >= maxRatioBuf ? isoStation : bufStation,
          // 双指标区间输出 (仅 hybrid 模式)
          coverageBuf: bufPercent,
          coverageIso: isoPercent,
          pessimistic,
          optimistic,
          confidence: Math.round(isoConf * 1000) / 10,
        });
        return;
      }

      // 单一口径模式 (buffer / isochrone): 保持原有逻辑
      let maxCoverageRatio = 0;
      let coveredByStation: string | null = null;

      for (const sa of serviceAreas) {
        // 快速判定1：bbox 不相交则跳过
        if (!bboxIntersect(commBbox, sa.bbox)) continue;
        // 快速判定2：质心距离 > (serviceRadius + commHalfDiag) 则跳过
        const dx = sa.center[0] - commCentroid[0];
        const dy = sa.center[1] - commCentroid[1];
        if (dx * dx + dy * dy > maxSearchDistSq) continue;

        // 精确求交
        let intersection: any = null;
        try {
          intersection = turf.intersect(turf.featureCollection([commProj, sa.buffer]));
        } catch { intersection = null; }

        if (intersection) {
          const intersectArea = getPlanarPolygonArea3857(intersection);
          const ratio = intersectArea / commArea;
          if (ratio > maxCoverageRatio) {
            maxCoverageRatio = ratio;
            coveredByStation = sa.station.name;
          }
          // 早退：已找到 ≥95% 覆盖，无需继续（视为基本完全覆盖）
          if (maxCoverageRatio >= 0.95) break;
        }
      }

      const coveragePercent = Math.round(maxCoverageRatio * 1000) / 10;
      const isBlindSpot = maxCoverageRatio < 0.1; // 覆盖率<10%视为盲区

      // 根据覆盖率百分比计算分级（极差/较差/一般/良好/优秀）
      let level: string;
      if (coveragePercent < 10) level = "极差";
      else if (coveragePercent < 30) level = "较差";
      else if (coveragePercent < 60) level = "一般";
      else if (coveragePercent < 90) level = "良好";
      else level = "优秀";

      if (isBlindSpot) {
        blindSpotCount++;
        blindSpotFeatures.push({
          type: "Feature",
          id: comm.id,
          geometry: comm.geometry,
          properties: {
            ...comm.properties,
            coverage_ratio: coveragePercent,
            is_blind_spot: true,
          },
        });
      } else {
        coveredCount++;
        totalCoveredPop += Math.round(pop * maxCoverageRatio);
      }

      communityResults.push({
        id: comm.id,
        name: comm.properties.name,
        district: comm.properties.district,
        population: pop,
        coverageRatio: coveragePercent,
        level,
        isBlindSpot,
        coveredBy: coveredByStation,
      });
    };

    // 分块执行: 用 setImmediate 让出事件循环, 不阻塞服务器其他请求
    for (let i = 0; i < targetCommunities.length; i += COMMUNITY_BATCH) {
      const end = Math.min(i + COMMUNITY_BATCH, targetCommunities.length);
      for (let j = i; j < end; j++) {
        processCommunity(targetCommunities[j]);
      }
      // 每块结束后让出事件循环, 允许其他请求处理 (类似 await Promise.resolve())
      if (i + COMMUNITY_BATCH < targetCommunities.length) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
    }

    // 按行政区统计
    const districtStats: any = {};
    communityResults.forEach(c => {
      if (!districtStats[c.district]) {
        districtStats[c.district] = { district: c.district, total: 0, covered: 0, blindSpot: 0, population: 0, blindSpotPop: 0 };
      }
      districtStats[c.district].total++;
      districtStats[c.district].population += c.population;
      if (c.isBlindSpot) {
        districtStats[c.district].blindSpot++;
        districtStats[c.district].blindSpotPop += c.population;
      } else {
        districtStats[c.district].covered++;
      }
    });

    // 生成服务区 GeoJSON (附带 source 字段: isochrone / buffer, 供前端差异化渲染)
    // hybrid 双指标模式: 等时圈站的缓冲区分量也作为显示图层输出 (绿色圆),
    // 与紫色等时圈双层叠加, 直观呈现「真实路网可达 vs 直线距离理想化」两口径的差异;
    // 仅用于显示, 不进入上方重叠/冗余分析 (该分析只用每站主几何)
    const serviceAreaFeatures: any[] = [];
    for (const { station, buffer, source, bufGeom } of serviceAreas) {
      // buffer 可能是 Feature(turf.polygon) 或裸几何(projectGeometryTo3857 返回), 统一取几何
      const rawGeom = buffer?.geometry ?? buffer;
      const wgs84Geom = projectGeometryTo4326(rawGeom);
      serviceAreaFeatures.push(turf.feature(wgs84Geom, {
        stationId: station.id,
        stationName: station.name,
        brand: station.brand,
        radius: serviceRadius,
        source: source || "buffer",
        mode: saMode,
      }));
      if (saMode === "hybrid" && source === "isochrone" && bufGeom) {
        serviceAreaFeatures.push(turf.feature(projectGeometryTo4326(bufGeom.geometry ?? bufGeom), {
          stationId: station.id,
          stationName: station.name,
          brand: station.brand,
          radius: serviceRadius,
          source: "buffer",
          mode: saMode,
          component: "buf-estimate", // 标记为区间模式的缓冲区估算分量 (仅供前端提示)
        }));
      }
    }

    // 盲区聚类：基于质心距离的贪心聚合（质心距离≤1500米归入同一聚类）
    const blindSpotClustersRaw: any[] = [];
    blindSpotFeatures.forEach((feature: any) => {
      const centroid = turf.centroid(feature);
      const [lng, lat] = centroid.geometry.coordinates;
      const pop = Number(feature.properties?.population_total || 0);

      // 贪心寻找质心距离≤1500米的已有聚类
      let targetCluster: any = null;
      for (const cluster of blindSpotClustersRaw) {
        const d = turf.distance(centroid, turf.point(cluster._center), { units: "meters" });
        if (d <= 1500) {
          targetCluster = cluster;
          break;
        }
      }

      if (targetCluster) {
        targetCluster._lngSum += lng;
        targetCluster._latSum += lat;
        targetCluster.communityCount += 1;
        targetCluster.population += pop;
        targetCluster._center = [
          targetCluster._lngSum / targetCluster.communityCount,
          targetCluster._latSum / targetCluster.communityCount,
        ];
      } else {
        blindSpotClustersRaw.push({
          _lngSum: lng,
          _latSum: lat,
          _center: [lng, lat],
          communityCount: 1,
          population: pop,
        });
      }
    });

    // 行政区可视化边界: 优先高德官方行政区划边界 (真实边界), 失败回退社区 union 近似轮廓
    let districtBoundary: any = null;
    if (districtFilter) {
      try {
        districtBoundary = await fetchDistrictBoundary(districtFilter);
      } catch { districtBoundary = null; }
      if (!districtBoundary && targetCommunities.length > 0) {
        try {
          const commGeoms = targetCommunities.map((comm: any) => turf.feature(comm.geometry));
          let merged: any = turf.union(turf.featureCollection(commGeoms));
          if (merged) {
            merged = turf.buffer(merged, 0.4, { units: "kilometers" });
            merged = turf.simplify(merged, { tolerance: 0.001, highQuality: true });
            districtBoundary = merged.geometry ?? merged;
          }
        } catch { districtBoundary = null; }
      }
    }

    // 按 population 降序排序并格式化输出（center 保留6位小数）
    const blindSpotClusters = blindSpotClustersRaw
      .sort((a, b) => b.population - a.population)
      .map((c, idx) => ({
        clusterId: idx + 1,
        center: [
          Number((c._lngSum / c.communityCount).toFixed(6)),
          Number((c._latSum / c.communityCount).toFixed(6)),
        ],
        communityCount: c.communityCount,
        population: c.population,
      }));

    // 充电站覆盖效率统计：按 stationId 聚合各站覆盖的社区与人口
    const stationByName = new Map(filteredStations.map(s => [s.name, s]));
    const stationById = new Map(filteredStations.map(s => [s.id, s]));
    const stationEfficiencyMap = new Map<string, {
      stationId: number;
      stationName: string;
      brand: string;
      fastChargers: number;
      slowChargers: number;
      coveredCommunities: number;
      coveredPopulation: number;
      coverageRatioSum: number;
    }>();
    communityResults.forEach(c => {
      if (c.coveredBy === null) return;
      // 从 activeStations 中按 name 匹配对应的充电站对象
      const station = stationByName.get(c.coveredBy);
      if (!station) return;
      const key = String(station.id);
      let entry = stationEfficiencyMap.get(key);
      if (!entry) {
        entry = {
          stationId: station.id,
          stationName: station.name,
          brand: station.brand,
          fastChargers: station.fastChargers,
          slowChargers: station.slowChargers,
          coveredCommunities: 0,
          coveredPopulation: 0,
          coverageRatioSum: 0,
        };
        stationEfficiencyMap.set(key, entry);
      }
      entry.coveredCommunities += 1;
      entry.coveredPopulation += c.population;
      entry.coverageRatioSum += c.coverageRatio;
    });

    // 计算 loadIndex（负荷指数，复用 /api/v1/analysis/heatmap 算法）
    // loadIndex = (快充×2 + 慢充×1) × (1 + 覆盖人口/10000) / (1 + 竞品距离衰减)
    const stationEfficiency: any[] = Array.from(stationEfficiencyMap.values()).map((e: any) => {
      const station = stationById.get(e.stationId);
      if (!station) return null;
      const stationPt = turf.point([station.lng, station.lat]);
      // 竞品距离衰减：找最近的其他品牌充电站，距离 km，衰减 = 1 / (1 + distance)
      let minCompetitorDist = Infinity;
      chargingStations.forEach(other => {
        if (other.id === station.id || other.brand === station.brand) return;
        const d = turf.distance(stationPt, turf.point([other.lng, other.lat]), { units: "kilometers" });
        if (d < minCompetitorDist) minCompetitorDist = d;
      });
      // 简化实现：找不到竞品时衰减记 0
      const competitorDecay = minCompetitorDist === Infinity ? 0 : 1 / (1 + minCompetitorDist);
      const base = e.fastChargers * 2 + e.slowChargers * 1;
      const loadIndex = Math.round((base * (1 + e.coveredPopulation / 10000) / (1 + competitorDecay)) * 100) / 100;
      return {
        stationId: e.stationId,
        stationName: e.stationName,
        brand: e.brand,
        fastChargers: e.fastChargers,
        slowChargers: e.slowChargers,
        coveredCommunities: e.coveredCommunities,
        coveredPopulation: e.coveredPopulation,
        avgCoverageRatio: e.coveredCommunities > 0 ? Math.round((e.coverageRatioSum / e.coveredCommunities) * 10) / 10 : 0,
        loadIndex,
      };
    }).filter((x: any) => x !== null)
      .sort((a: any, b: any) => b.coveredPopulation - a.coveredPopulation);

    // 覆盖率分级统计：按 level 分组，顺序为 极差/较差/一般/良好/优秀
    const levelOrder = ["极差", "较差", "一般", "良好", "优秀"];
    const coverageLevels = levelOrder.map(level => {
      const items = communityResults.filter(c => c.level === level);
      return {
        level,
        count: items.length,
        population: items.reduce((s: number, c: any) => s + c.population, 0),
      };
    });

    const data = {
      chargeMode,
      serviceRadius,
      district: districtFilter || "all",
      serviceAreas: { type: "FeatureCollection", features: serviceAreaFeatures },
      overlapAreas,
      redundancyScore,
      blindSpots: { type: "FeatureCollection", features: blindSpotFeatures },
      blindSpotClusters,
      communityResults: communityResults.sort((a, b) => a.coverageRatio - b.coverageRatio),
      coverageLevels,
      districtStats: Object.values(districtStats),
      stationEfficiency,
      summary: {
        totalCommunities: communityResults.length,
        coveredCommunities: coveredCount,
        blindSpotCommunities: blindSpotCount,
        // hybrid 模式: 覆盖率 = 逐社区混合覆盖程度的均值 (缓冲区25%+等时圈75%占比混合传导到汇总),
        //              而非"过10%阈值社区数占比"—— 避免与等时圈模式计数完全相同;
        // 单一口径模式: 保持阈值计数口径 (口径差异见 modeComparison 对比卡说明)
        coverageRate: saMode === "hybrid" && communityResults.length > 0
          ? Math.round((hybridRatioSum / communityResults.length) * 1000) / 10
          : (communityResults.length > 0 ? Math.round((coveredCount / communityResults.length) * 1000) / 10 : 0),
        // hybrid 双指标区间: 逐社区双口径下界/上界的均值, 主值必落于区间内
        coverageRateInterval: saMode === "hybrid" && communityResults.length > 0 ? [
          Math.round((minRatioSum / communityResults.length) * 1000) / 10,
          Math.round((maxRatioSum / communityResults.length) * 1000) / 10,
        ] : null,
        populationCoverageRate: totalPopulation > 0 ? Math.round((totalCoveredPop / totalPopulation) * 1000) / 10 : 0,
        totalPopulation,
        blindSpotPopulation: communityResults.filter(c => c.isBlindSpot).reduce((s, c) => s + c.population, 0),
        totalStations: filteredStations.length,
        redundancyScore,
      },
      // 服务区模式信息
      districtBoundary,
      serviceAreaMode: saMode,
      isochroneCoverage: {
        covered: isochroneCoverageCount,
        total: filteredStations.length,
        fallback: fallbackCount,
        ratio: filteredStations.length > 0
          ? Math.round((isochroneCoverageCount / filteredStations.length) * 1000) / 10
          : 0,
        // 等时圈站平均置信度 (星形法方向命中率均值, 0-100; 旧格式数据按 70 计)
        avgConfidence: avgConfidence,
      },
    };

    // 写入 LRU 缓存 (60 秒内复用)
    setToCache(cacheKey, data);

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("覆盖分析错误:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 虚拟站点选址评估 (拖拽实时计算)
app.post("/api/v1/analysis/evaluate-site", requireAuth, requireRole("投资商", "管理员"), (req, res) => {
  try {
    const { lng, lat, radius, chargeMode, coverageBlindSpots } = req.body;
    const radiusMeters = parseFloat(radius) || getCoverageRadius(chargeMode);
    const center3857 = toEPSG3857([parseFloat(lng), parseFloat(lat)]);
    const bufferPoly = createPlanarBuffer3857(center3857, radiusMeters);
    const bufferArea = getPlanarPolygonArea3857(bufferPoly);

    // 判定选址缓冲区是否落入覆盖盲区（盲区几何为 WGS84，需将缓冲区投影至4326后再判定相交）
    let inBlindSpot = false;
    // 缓冲区范围内的盲区面 (供对比弹窗地图展示, 只显示范围内盲区)
    const blindSpotsInBuffer: any[] = [];
    if (Array.isArray(coverageBlindSpots) && coverageBlindSpots.length > 0) {
      const bufferPolyWgs84 = turf.feature(projectGeometryTo4326(bufferPoly.geometry));
      for (const blindGeom of coverageBlindSpots) {
        let intersects = false;
        try {
          intersects = !!turf.intersect(turf.featureCollection([bufferPolyWgs84, turf.feature(blindGeom)]));
        } catch {
          intersects = false;
        }
        if (intersects) {
          inBlindSpot = true;
          blindSpotsInBuffer.push(turf.feature(blindGeom));
        }
      }
    }

    // 计算覆盖的社区
    const coveredCommunities: any[] = [];
    let coveredPopulation = 0;
    const intersectionFeatures: any[] = [];

    communitiesDatabase.features.forEach((comm: any) => {
      const commProj = projectGeometryTo3857(comm);
      const commArea = getPlanarPolygonArea3857(commProj);

      let intersection: any = null;
      try {
        intersection = turf.intersect(turf.featureCollection([commProj, bufferPoly]));
      } catch { intersection = null; }

      if (intersection) {
        const intersectArea = getPlanarPolygonArea3857(intersection);
        if (intersectArea > 1) {
          const ratio = intersectArea / commArea;
          const affectedPop = Math.round(comm.properties.population_total * ratio);
          coveredPopulation += affectedPop;

          const wgs84Geom = projectGeometryTo4326(intersection.geometry);
          intersectionFeatures.push(turf.feature(wgs84Geom, {
            community_name: comm.properties.name,
            coverage_ratio: Math.round(ratio * 1000) / 10,
            affected_pop: affectedPop,
          }));

          coveredCommunities.push({
            id: comm.id,
            name: comm.properties.name,
            district: comm.properties.district,
            population: comm.properties.population_total,
            coverageRatio: Math.round(ratio * 1000) / 10,
            affectedPopulation: affectedPop,
          });
        }
      }
    });

    // 竞争环境分析：周边1km内现有充电站
    const nearbyStations = chargingStations.filter(s => {
      const dist = turf.distance(turf.point([parseFloat(lng), parseFloat(lat)]), turf.point([s.lng, s.lat]), { units: "meters" });
      return dist < 1500;
    });

    // 计算竞争避让度 (周边站越少，分数越高)
    const competitionScore = Math.max(0, Math.round(100 - nearbyStations.length * 12));

    // 盲区消除率 (覆盖社区数 / 总社区数)
    const totalCommunities = communitiesDatabase.features.length;
    const blindSpotReduction = totalCommunities > 0
      ? Math.round((coveredCommunities.length / totalCommunities) * 1000) / 10
      : 0;

    // 社会效益评分
    const socialBenefit = Math.min(100, Math.round((coveredPopulation / 200) ));

    const bufferWgs84 = turf.feature(projectGeometryTo4326(bufferPoly.geometry), {
      radius: radiusMeters,
      area_sqm: Math.round(bufferArea),
    });

    res.json({
      success: true,
      data: {
        point: { lng: parseFloat(lng), lat: parseFloat(lat) },
        radius: radiusMeters,
        bufferGeometry: bufferWgs84,
        in_blind_spot: inBlindSpot,
        blindSpotsInBuffer: { type: "FeatureCollection", features: blindSpotsInBuffer },
        intersections: { type: "FeatureCollection", features: intersectionFeatures },
        covered_communities: coveredCommunities,
        covered_population: coveredPopulation,
        nearbyStations: nearbyStations.map(s => ({ name: s.name, brand: s.brand, distance: Math.round(turf.distance(turf.point([parseFloat(lng), parseFloat(lat)]), turf.point([s.lng, s.lat]), { units: "meters" })) })),
        metrics: {
          covered_population: coveredPopulation,
          covered_communities: coveredCommunities.length,
          blind_spot_reduction: blindSpotReduction,
          competition_score: competitionScore,
          social_benefit: socialBenefit,
          nearby_station_count: nearbyStations.length,
        },
      },
    });
  } catch (error: any) {
    console.error("选址评估错误:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存选址方案
// =========================================================================
// 10.7 充电站负荷热度分析 (阶段二 任务 2.1)
// 计算: 负荷指数 = (fastChargers * 2 + slowChargers * 1) * (1 + 周边人口因子) / (1 + 竞品距离衰减)
// =========================================================================
function getLoadLevel(load: number): "低" | "中" | "高" | "超载" {
  if (load < 5) return "低";
  if (load < 15) return "中";
  if (load < 30) return "高";
  return "超载";
}

app.post("/api/v1/analysis/heatmap", (req, res) => {
  try {
    const { district } = req.body || {};
    const districtFilter = typeof district === "string" && district && district !== "all" ? district : null;
    const targetStations = districtFilter
      ? chargingStations.filter(s => s.district === districtFilter)
      : chargingStations;

    // 预计算所有社区质心 (WGS84), 用于缓冲区内人口统计
    const communityCentroids = communitiesDatabase.features.map((comm: any) => ({
      comm,
      centroid: turf.centroid(comm),
      pop: Number(comm.properties?.population_total || 0),
    }));

    const stations = targetStations.map(station => {
      const stationPt = turf.point([station.lng, station.lat]);
      // 周边人口因子: 800m 缓冲区内社区人口总和 / 10000
      const buffer800 = turf.circle(stationPt, 0.8, { units: "kilometers" });
      let nearbyPop = 0;
      communityCentroids.forEach(({ centroid, pop }) => {
        if (turf.booleanPointInPolygon(centroid, buffer800)) {
          nearbyPop += pop;
        }
      });
      const populationFactor = nearbyPop / 10000;

      // 竞品距离衰减: 找最近的其他品牌充电站, 距离 km
      let minCompetitorDist = Infinity;
      chargingStations.forEach(other => {
        if (other.id === station.id || other.brand === station.brand) return;
        const d = turf.distance(stationPt, turf.point([other.lng, other.lat]), { units: "kilometers" });
        if (d < minCompetitorDist) minCompetitorDist = d;
      });
      const competitorDecay = minCompetitorDist === Infinity ? 0 : 1 / (1 + minCompetitorDist);

      const base = (station.fastChargers * 2 + station.slowChargers * 1);
      const load = Math.round((base * (1 + populationFactor) / (1 + competitorDecay)) * 100) / 100;

      return {
        id: station.id,
        lng: station.lng,
        lat: station.lat,
        name: station.name,
        brand: station.brand,
        district: station.district,
        fastChargers: station.fastChargers,
        slowChargers: station.slowChargers,
        load,
        level: getLoadLevel(load),
      };
    });

    res.json({
      success: true,
      data: {
        district: districtFilter || "all",
        stations,
      },
    });
  } catch (error: any) {
    console.error("负荷热力分析错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.8 投资回报 ROI 估算 (阶段二 任务 2.3)
// 建站成本 = fastChargers * 80000 + slowChargers * 30000 + 土地成本 200000
// 年收益 = coveredPopulation * 0.05 * 1.5 * 365 * 0.3
// 回收周期 = 建站成本 / 年收益
// =========================================================================
app.post("/api/v1/analysis/roi", (req, res) => {
  try {
    const { fastChargers, slowChargers, coveredPopulation } = req.body || {};
    const fast = parseInt(fastChargers) || 0;
    const slow = parseInt(slowChargers) || 0;
    const pop = parseInt(coveredPopulation) || 0;

    const fastCost = fast * 80000;
    const slowCost = slow * 30000;
    const landCost = 200000;
    const cost = fastCost + slowCost + landCost;

    const demandRate = 0.05;        // 需求率 (车辆渗透)
    const unitPrice = 1.5;          // 客单价 (元)
    const conversionRate = 0.3;     // 转化率
    const annualRevenue = Math.round(pop * demandRate * unitPrice * 365 * conversionRate);

    const paybackYears = annualRevenue > 0 ? Math.round((cost / annualRevenue) * 100) / 100 : -1;

    res.json({
      success: true,
      data: {
        cost,
        costBreakdown: { fast: fastCost, slow: slowCost, land: landCost },
        annualRevenue,
        revenueBreakdown: {
          population: pop,
          demandRate,
          unitPrice,
          conversionRate,
        },
        paybackYears,
      },
    });
  } catch (error: any) {
    console.error("ROI 估算错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.9 多方案深度对比矩阵 (阶段二 任务 2.2)
// 输入: { schemeIds: [id1, id2] } 返回 6 维度评分 + 归一化得分
// =========================================================================
function computeSchemeMetrics(scheme: any): {
  coverageRate: number;
  coveredPopulation: number;
  coveredCommunities: number;
  competitionScore: number;
  roi: number;
  blindSpotReduction: number;
} {
  // 重新基于站点位置计算覆盖率: 站点半径内覆盖社区数 / 总社区数
  const stationPt = turf.point([Number(scheme.lng), Number(scheme.lat)]);
  const radius = Number(scheme.radius) || 800;
  const buffer = turf.circle(stationPt, radius / 1000, { units: "kilometers" });

  let coveredCommunities = 0;
  let coveredPopulation = 0;
  const totalCommunities = communitiesDatabase.features.length || 1;

  communitiesDatabase.features.forEach((comm: any) => {
    const centroid = turf.centroid(comm);
    if (turf.booleanPointInPolygon(centroid, buffer)) {
      coveredCommunities++;
      coveredPopulation += Number(comm.properties?.population_total || 0);
    }
  });

  const coverageRate = Math.round((coveredCommunities / totalCommunities) * 1000) / 10;

  // 竞争避让度: 周边 1.5km 内其他品牌站数衰减
  let nearbyCount = 0;
  chargingStations.forEach(s => {
    if (s.brand === scheme.brand) return;
    const d = turf.distance(stationPt, turf.point([s.lng, s.lat]), { units: "meters" });
    if (d < 1500) nearbyCount++;
  });
  const competitionScore = Math.max(0, Math.round(100 - nearbyCount * 12));

  // ROI 估算 (按方案覆盖人口估算)
  const fast = 4;  // 默认假设 4 快充 (无字段时)
  const slow = 4;  // 默认假设 4 慢充
  const cost = fast * 80000 + slow * 30000 + 200000;
  const annualRevenue = coveredPopulation * 0.05 * 1.5 * 365 * 0.3;
  const roi = annualRevenue > 0 ? Math.round((annualRevenue / cost) * 100) / 100 : 0;

  return {
    coverageRate,
    coveredPopulation,
    coveredCommunities,
    competitionScore,
    roi,
    blindSpotReduction: Number(scheme.blind_spot_reduction) || 0,
  };
}

app.post("/api/v1/analysis/compare", (req, res) => {
  try {
    const { schemeIds } = req.body || {};
    if (!Array.isArray(schemeIds) || schemeIds.length !== 2) {
      return res.status(400).json({ success: false, message: "请选择两个方案进行对比" });
    }
    const s1 = schemesDatabase.find(s => s.id === Number(schemeIds[0]));
    const s2 = schemesDatabase.find(s => s.id === Number(schemeIds[1]));
    if (!s1 || !s2) {
      return res.status(404).json({ success: false, message: "方案不存在" });
    }

    const m1 = computeSchemeMetrics(s1);
    const m2 = computeSchemeMetrics(s2);

    // 6 维度: 覆盖率/覆盖人口/覆盖社区/竞争避让/ROI/盲区消除
    const dimensions = [
      { key: "coverageRate",      label: "覆盖率",     value1: m1.coverageRate,        value2: m2.coverageRate },
      { key: "coveredPopulation", label: "覆盖人口",   value1: m1.coveredPopulation,   value2: m2.coveredPopulation },
      { key: "coveredCommunities",label: "覆盖社区",   value1: m1.coveredCommunities,  value2: m2.coveredCommunities },
      { key: "competitionScore",  label: "竞争避让",   value1: m1.competitionScore,    value2: m2.competitionScore },
      { key: "roi",               label: "ROI",        value1: m1.roi,                 value2: m2.roi },
      { key: "blindSpotReduction",label: "盲区消除",   value1: m1.blindSpotReduction,  value2: m2.blindSpotReduction },
    ];

    // 百分制归一化 (max-min 归一化到 0-100)
    const dimensionsWithScore = dimensions.map(d => {
      const max = Math.max(d.value1, d.value2);
      const min = Math.min(d.value1, d.value2);
      const range = max - min;
      const score1 = range === 0 ? 50 : Math.round(((d.value1 - min) / range) * 100);
      const score2 = range === 0 ? 50 : Math.round(((d.value2 - min) / range) * 100);
      return { ...d, score1, score2 };
    });

    // 综合得分 (6 维度百分制平均)
    const totalScore1 = dimensionsWithScore.reduce((sum, d) => sum + d.score1, 0) / 6;
    const totalScore2 = dimensionsWithScore.reduce((sum, d) => sum + d.score2, 0) / 6;

    // 推荐方案
    const recommendId = totalScore1 >= totalScore2 ? s1.id : s2.id;
    const recommendName = totalScore1 >= totalScore2 ? s1.name : s2.name;
    const winnerScore = Math.max(totalScore1, totalScore2);
    const loserScore = Math.min(totalScore1, totalScore2);
    const reason = `综合得分 ${winnerScore.toFixed(1)} vs ${loserScore.toFixed(1)}，"${recommendName}" 在 6 维度归一化对比中整体领先，建议优先采纳。`;

    res.json({
      success: true,
      data: {
        schemes: [
          { id: s1.id, name: s1.name, lng: s1.lng, lat: s1.lat, radius: s1.radius, brand: s1.brand, metrics: m1, totalScore: Math.round(totalScore1 * 10) / 10 },
          { id: s2.id, name: s2.name, lng: s2.lng, lat: s2.lat, radius: s2.radius, brand: s2.brand, metrics: m2, totalScore: Math.round(totalScore2 * 10) / 10 },
        ],
        dimensions: dimensionsWithScore,
        recommendation: { id: recommendId, name: recommendName, reason },
      },
    });
  } catch (error: any) {
    console.error("方案对比错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.10 区域竞争态势分析 (阶段二 任务 2.4)
// 返回: 品牌市占率 / 各行政区品牌分布 / 饱和度 / 空白市场
// =========================================================================
app.post("/api/v1/analysis/competition", (req, res) => {
  try {
    // 1. 品牌市占率
    const brandCount: Record<string, number> = {};
    chargingStations.forEach(s => {
      brandCount[s.brand] = (brandCount[s.brand] || 0) + 1;
    });
    const total = chargingStations.length || 1;
    const brandShare = Object.entries(brandCount)
      .map(([brand, count]) => ({ brand, count, percentage: Math.round((count / total) * 1000) / 10 }))
      .sort((a, b) => b.count - a.count);

    // 2. 各行政区品牌分布
    const districtMap: Record<string, Record<string, number>> = {};
    chargingStations.forEach(s => {
      if (!districtMap[s.district]) districtMap[s.district] = {};
      districtMap[s.district][s.brand] = (districtMap[s.district][s.brand] || 0) + 1;
    });
    const districtDistribution = Object.entries(districtMap).map(([district, brands]) => ({
      district,
      brands,
    }));

    // 3. 饱和度: 各行政区充电站密度 (座/km²) - 用社区总面积近似
    const districtArea: Record<string, number> = {};
    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties?.district;
      if (!d) return;
      // 用 turf 计算多边形面积 (平方公里)
      try {
        const areaKm2 = turf.area(c) / 1_000_000;
        districtArea[d] = (districtArea[d] || 0) + (areaKm2 > 0 ? areaKm2 : 0);
      } catch {}
    });
    const stationByDistrict: Record<string, number> = {};
    chargingStations.forEach(s => {
      stationByDistrict[s.district] = (stationByDistrict[s.district] || 0) + 1;
    });
    const allDistricts = new Set([...Object.keys(districtArea), ...Object.keys(stationByDistrict)]);
    const saturation = Array.from(allDistricts).map(d => {
      const area = districtArea[d] || 0;
      const count = stationByDistrict[d] || 0;
      return {
        district: d,
        stationsPerKm2: area > 0 ? Math.round((count / area) * 100) / 100 : 0,
        stationCount: count,
        areaKm2: Math.round(area * 100) / 100,
      };
    }).sort((a, b) => b.stationsPerKm2 - a.stationsPerKm2);

    // 4. 空白市场: 复用覆盖分析的盲区聚类逻辑
    // 找出所有"无充电站覆盖"的社区, 贪心聚类
    const operatingStations = chargingStations.filter(s => s.status === "运营中");
    const blindSpotFeatures: any[] = [];
    communitiesDatabase.features.forEach((comm: any) => {
      const centroid = turf.centroid(comm);
      let minDist = Infinity;
      operatingStations.forEach(s => {
        const d = turf.distance(centroid, turf.point([s.lng, s.lat]), { units: "meters" });
        if (d < minDist) minDist = d;
      });
      // 1.5km 内无充电站视为空白市场
      if (minDist > 1500) {
        blindSpotFeatures.push(comm);
      }
    });

    // 贪心聚类 (质心距离 ≤ 1500m)
    const clusters: any[] = [];
    blindSpotFeatures.forEach((feature: any) => {
      const centroid = turf.centroid(feature);
      const [lng, lat] = centroid.geometry.coordinates;
      let target: any = null;
      for (const c of clusters) {
        const d = turf.distance(centroid, turf.point(c._center), { units: "meters" });
        if (d <= 1500) { target = c; break; }
      }
      if (target) {
        target._lngSum += lng;
        target._latSum += lat;
        target.communityCount += 1;
        target._center = [target._lngSum / target.communityCount, target._latSum / target.communityCount];
      } else {
        clusters.push({
          _lngSum: lng, _latSum: lat, _center: [lng, lat], communityCount: 1,
        });
      }
    });

    const blankMarkets = clusters
      .sort((a, b) => b.communityCount - a.communityCount)
      .slice(0, 10)
      .map((c, idx) => ({
        clusterId: idx + 1,
        center: [
          Number(c._center[0].toFixed(6)),
          Number(c._center[1].toFixed(6)),
        ] as [number, number],
        communityCount: c.communityCount,
      }));

    res.json({
      success: true,
      data: {
        brandShare,
        districtDistribution,
        saturation,
        blankMarkets,
      },
    });
  } catch (error: any) {
    console.error("竞争态势分析错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================
// 10.11 充电桩缺口预测 (阶段二 任务 2.5)
// 需求桩数 = 人口 * 0.05 (车辆渗透率) * 0.3 (日充电频次) / 30 (单桩日服务能力)
// 现有桩数 = 该区所有充电站的 fastChargers + slowChargers 总和
// =========================================================================
app.post("/api/v1/analysis/gap-prediction", (req, res) => {
  try {
    // 按行政区统计人口与现有桩数
    const districtPop: Record<string, number> = {};
    const districtChargers: Record<string, number> = {};

    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties?.district;
      if (!d) return;
      districtPop[d] = (districtPop[d] || 0) + Number(c.properties?.population_total || 0);
    });
    chargingStations.forEach(s => {
      districtChargers[s.district] = (districtChargers[s.district] || 0) + s.fastChargers + s.slowChargers;
    });

    const allDistricts = new Set([...Object.keys(districtPop), ...Object.keys(districtChargers)]);
    const districts = Array.from(allDistricts).map(name => {
      const population = districtPop[name] || 0;
      const currentChargers = districtChargers[name] || 0;
      const demandChargers = Math.round((population * 0.05 * 0.3) / 30);
      const gap = demandChargers - currentChargers;
      return { name, population, currentChargers, demandChargers, gap };
    }).sort((a, b) => b.gap - a.gap);

    // Top 10 缺口最大
    const topGap = districts.slice(0, 10);

    res.json({
      success: true,
      data: {
        districts,
        topGap,
      },
    });
  } catch (error: any) {
    console.error("缺口预测错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
}