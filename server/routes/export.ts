// GeoPlan 方案报告导出路由
import express from "express";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase, schemesDatabase } from "../db";

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

export default function registerExportRoutes(app: express.Express) {

// =========================================================================
// 10.12 方案报告 PDF 导出 (阶段二 任务 2.6)
// 后端只返回方案完整数据, 前端组装打印 HTML 后调用 window.print()
// =========================================================================
app.post("/api/v1/export/scheme-pdf", (req, res) => {
  try {
    const { schemeId } = req.body || {};
    if (!schemeId) {
      return res.status(400).json({ success: false, message: "缺少 schemeId 参数" });
    }
    const scheme = schemesDatabase.find(s => s.id === Number(schemeId));
    if (!scheme) {
      return res.status(404).json({ success: false, message: "方案不存在" });
    }

    // 重新计算指标
    const metrics = computeSchemeMetrics(scheme);

    // ROI 估算
    const fast = 4, slow = 4; // 默认假设 4 快充 + 4 慢充
    const cost = fast * 80000 + slow * 30000 + 200000;
    const annualRevenue = Math.round(metrics.coveredPopulation * 0.05 * 1.5 * 365 * 0.3);
    const paybackYears = annualRevenue > 0 ? Math.round((cost / annualRevenue) * 100) / 100 : -1;

    // 周边站点列表 (1.5km 内)
    const stationPt = turf.point([Number(scheme.lng), Number(scheme.lat)]);
    const nearbyStations = chargingStations
      .map(s => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        district: s.district,
        fastChargers: s.fastChargers,
        slowChargers: s.slowChargers,
        distance: Math.round(turf.distance(stationPt, turf.point([s.lng, s.lat]), { units: "meters" })),
      }))
      .filter(s => s.distance < 3000)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    // AI 建议 (基于指标的简易建议)
    const advice: string[] = [];
    if (metrics.coverageRate < 10) advice.push("覆盖率偏低, 建议适当扩大服务半径或调整选址位置");
    if (metrics.competitionScore > 70) advice.push("竞争避让度较高, 周边竞品较少, 市场空间充足");
    else advice.push("周边竞争较激烈, 建议差异化定位 (如主打快充或夜间慢充)");
    if (paybackYears > 0 && paybackYears < 5) advice.push(`回收周期约 ${paybackYears} 年, 投资回报良好`);
    else if (paybackYears >= 5) advice.push(`回收周期约 ${paybackYears} 年, 建议优化规模或选址`);
    advice.push("建议持续关注公众反馈与实际利用率, 动态调整运营策略");

    res.json({
      success: true,
      data: {
        scheme: {
          id: scheme.id,
          name: scheme.name,
          lng: scheme.lng,
          lat: scheme.lat,
          radius: scheme.radius,
          brand: scheme.brand,
          creator: scheme.creator,
          create_time: scheme.create_time,
        },
        metrics,
        roi: {
          cost,
          costBreakdown: { fast: fast * 80000, slow: slow * 30000, land: 200000 },
          annualRevenue,
          paybackYears,
        },
        nearbyStations,
        advice,
        exportTime: new Date().toLocaleString("zh-CN"),
      },
    });
  } catch (error: any) {
    console.error("方案报告导出错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================================

}