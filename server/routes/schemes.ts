import express from "express";
import { schemesDatabase, dbPool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

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
    // t_scheme.geom 为 NOT NULL POINT; 本环境 MySQL 的 ST_GeomFromText 校验视首坐标为纬度, 用 POINT(lat lng)
    const pointWkt = `POINT(${parseFloat(lat)} ${parseFloat(lng)})`;
    const [result]: any = await dbPool.query(
      `INSERT INTO t_scheme (name, lng, lat, geom, radius, brand, covered_population, covered_communities, blind_spot_reduction, competition_score, social_benefit, creator) VALUES (?, ?, ?, ST_GeomFromText(?, 4326), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name || "未命名方案", parseFloat(lng), parseFloat(lat), pointWkt, parseFloat(radius), brand || "国家电网", coveredPopulation, coveredCommunities, blindSpotReduction, competitionScore, socialBenefit, creator]
    );
    const scheme = {
      id: result.insertId,
      name: name || "未命名方案",
      lng: parseFloat(lng),
      lat: parseFloat(lat),
      radius: parseFloat(radius),
      brand: brand || "国家电网",
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
}