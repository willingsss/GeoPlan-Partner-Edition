import express from "express";
import * as turf from "@turf/turf";
import { schemesDatabase, communitiesDatabase, dbPool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { fetchDistrictBoundary } from "../services/districtBoundary";

// 徐州行政区列表 (与覆盖分析一致)
const XUZHOU_DISTRICTS = ["鼓楼区", "云龙区", "贾汪区", "泉山区", "铜山区"];

// 兜底判定: 用本地社区面 (含 district 属性) 判定坐标所属行政区, 不依赖高德 API
function detectDistrictByCommunities(lng: number, lat: number): string | null {
  const pt = turf.point([lng, lat]);
  for (const comm of communitiesDatabase.features) {
    try {
      if (turf.booleanPointInPolygon(pt, turf.feature(comm.geometry))) {
        return comm.properties.district || null;
      }
    } catch { /* 跳过异常面 */ }
  }
  // 兜底: 距离最近社区的行政区
  let best: string | null = null;
  let bestDist = Infinity;
  for (const comm of communitiesDatabase.features) {
    try {
      const center = turf.center(turf.feature(comm.geometry));
      const dist = turf.distance(pt, center, { units: "meters" });
      if (dist < bestDist) { bestDist = dist; best = comm.properties.district || null; }
    } catch { /* skip */ }
  }
  return best;
}

// 判定坐标所属行政区 (高德真实边界优先, 配额超限时用社区面兜底)
async function detectDistrict(lng: number, lat: number): Promise<string | null> {
  const pt = turf.point([lng, lat]);
  for (const d of XUZHOU_DISTRICTS) {
    try {
      const boundary = await fetchDistrictBoundary(d);
      if (boundary) {
        const poly = { type: "Feature", properties: {}, geometry: boundary };
        if (turf.booleanPointInPolygon(pt, poly as any)) return d;
      }
    } catch (e: any) { console.error(`[schemes] ${d} 边界判定异常:`, e.message); }
  }
  // 高德不可用 (配额超限等) → 社区面兜底
  const fallback = detectDistrictByCommunities(lng, lat);
  if (fallback) console.error(`[schemes] 高德边界不可用, 社区面兜底判定: ${fallback}`);
  return fallback;
}

export default function registerSchemesRoutes(app: express.Express) {
app.post("/api/v1/schemes", requireAuth, requireRole("投资商", "管理员"), async (req, res) => {
  const { name, lng, lat, radius, brand, metrics } = req.body;
  const creator = (req as any).currentUser?.username || "";
  // 兼容前端下划线字段 (siteMetrics) 与驼峰字段 (历史调用): 下划线优先
  const coveredPopulation = metrics?.covered_population ?? metrics?.coveredPopulation ?? 0;
  const coveredCommunities = metrics?.covered_communities ?? metrics?.coveredCommunities ?? 0;
  const blindSpotReduction = metrics?.blind_spot_reduction ?? metrics?.blindSpotReduction ?? 0;
  const competitionScore = metrics?.competition_score ?? metrics?.competitionScore ?? 0;
  const socialBenefit = metrics?.social_benefit ?? metrics?.socialBenefit ?? 0;
  try {
    // 判定方案所属行政区 (高德真实边界)
    const district = await detectDistrict(parseFloat(lng), parseFloat(lat));
    // t_scheme.geom 为 NOT NULL POINT; 本环境 MySQL 的 ST_GeomFromText 校验视首坐标为纬度, 用 POINT(lat lng)
    const pointWkt = `POINT(${parseFloat(lat)} ${parseFloat(lng)})`;
    const [result]: any = await dbPool.query(
      `INSERT INTO t_scheme (name, lng, lat, geom, radius, brand, district, covered_population, covered_communities, blind_spot_reduction, competition_score, social_benefit, creator) VALUES (?, ?, ?, ST_GeomFromText(?, 4326), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name || "未命名方案", parseFloat(lng), parseFloat(lat), pointWkt, parseFloat(radius), brand || "国家电网", district, coveredPopulation, coveredCommunities, blindSpotReduction, competitionScore, socialBenefit, creator]
    );
    const scheme = {
      id: result.insertId,
      name: name || "未命名方案",
      lng: parseFloat(lng),
      lat: parseFloat(lat),
      radius: parseFloat(radius),
      brand: brand || "国家电网",
      district,
      covered_population: coveredPopulation,
      covered_communities: coveredCommunities,
      blind_spot_reduction: blindSpotReduction,
      competition_score: competitionScore,
      social_benefit: socialBenefit,
      creator,
      create_time: new Date().toLocaleString("zh-CN"),
    };
    schemesDatabase.push(scheme);
    res.json({ success: true, data: scheme, message: "方案保存成功" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 获取所有方案
app.get("/api/v1/schemes", (req, res) => {
  res.json({ success: true, data: schemesDatabase });
});

// 删除方案
app.delete("/api/v1/schemes/:id", requireAuth, requireRole("投资商", "管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await dbPool.query("DELETE FROM t_scheme WHERE id=?", [id]);
    const idx = schemesDatabase.findIndex(s => s.id === id);
    if (idx >= 0) schemesDatabase.splice(idx, 1);
    res.json({ success: true, message: "方案已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 重命名方案 (方案管理操作: 内联改名)
app.patch("/api/v1/schemes/:id", requireAuth, requireRole("投资商", "管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const name = String(req.body?.name || "").trim();
  if (!name) {
    res.status(400).json({ success: false, message: "方案名不能为空" });
    return;
  }
  try {
    await dbPool.query("UPDATE t_scheme SET name=? WHERE id=?", [name, id]);
    const scheme = schemesDatabase.find(s => s.id === id);
    if (scheme) scheme.name = name;
    res.json({ success: true, data: scheme || { id, name }, message: "方案已重命名" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});
}