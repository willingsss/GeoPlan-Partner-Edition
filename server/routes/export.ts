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
// =========================================================================
// 10.13 多维统计报表 CSV 导出 (阶段三 任务 3.2)
// query 参数 district / brand / chargeMode / status 与 /stats/report 完全一致
// 输出 UTF-8 BOM CSV, 分 4 个块: 概览 / 品牌汇总 / 行政区汇总 / 透视矩阵
// =========================================================================
app.get("/api/v1/export/report-csv", (req, res) => {
  try {
    const { district, brand, chargeMode, status } = req.query;
    // 1. 过滤充电站 (同 /api/v1/stats/report 的过滤逻辑)
    let filtered = chargingStations.slice();
    if (district && district !== "all") filtered = filtered.filter(s => s.district === (district as string));
    if (brand && brand !== "all") filtered = filtered.filter(s => s.brand === (brand as string));
    if (status && status !== "all") filtered = filtered.filter(s => s.status === (status as string));
    if (chargeMode && chargeMode !== "all") {
      if (chargeMode === "fast") filtered = filtered.filter(s => s.fastChargers > 0);
      else if (chargeMode === "slow") filtered = filtered.filter(s => s.slowChargers > 0);
    }

    const totalStations = filtered.length;
    const totalPorts = filtered.reduce((s, x) => s + x.fastChargers + x.slowChargers, 0);
    const totalFastPorts = filtered.reduce((s, x) => s + x.fastChargers, 0);
    const totalSlowPorts = filtered.reduce((s, x) => s + x.slowChargers, 0);
    const districts = Array.from(new Set(filtered.map(s => s.district)));
    const brands = Array.from(new Set(filtered.map(s => s.brand)));
    const exportTime = new Date().toLocaleString("zh-CN");

    // CSV 辅助: 转义含逗号/引号/换行的单元格
    const esc = (val: any): string => {
      if (val === null || val === undefined) return "";
      const s = String(val);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines: string[] = [];

    // ===== 区块 1: 导出概览 =====
    lines.push("GeoPlan 充电站多维统计报表导出");
    lines.push(`导出时间,${esc(exportTime)}`);
    lines.push("");
    lines.push("一、概览指标");
    lines.push("充电站总数,充电桩总数(含快充+慢充),快充桩数,慢充桩数,行政区数,品牌数");
    lines.push([totalStations, totalPorts, totalFastPorts, totalSlowPorts, districts.length, brands.length].map(esc).join(","));
    lines.push("");
    lines.push("过滤条件");
    lines.push("行政区,品牌,充电模式,运营状态");
    lines.push([district || "all", brand || "all", chargeMode || "all", status || "all"].map(esc).join(","));
    lines.push("");

    // ===== 区块 2: 品牌汇总 =====
    const brandSummary = brands.map(b => ({
      brand: b,
      stations: filtered.filter(s => s.brand === b).length,
      ports: filtered.filter(s => s.brand === b).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
      fast: filtered.filter(s => s.brand === b).reduce((sum, s) => sum + s.fastChargers, 0),
      slow: filtered.filter(s => s.brand === b).reduce((sum, s) => sum + s.slowChargers, 0),
      districtCount: new Set(filtered.filter(s => s.brand === b).map(s => s.district)).size,
    })).sort((a, b) => b.stations - a.stations);

    lines.push("二、品牌汇总（按充电站数降序）");
    lines.push("品牌,充电站数,充电桩总数,快充桩数,慢充桩数,覆盖行政区数");
    brandSummary.forEach(r => {
      lines.push([r.brand, r.stations, r.ports, r.fast, r.slow, r.districtCount].map(esc).join(","));
    });
    lines.push("合计," + [
      totalStations, totalPorts, totalFastPorts, totalSlowPorts, new Set(filtered.map(s => s.district)).size
    ].map(esc).join(","));
    lines.push("");

    // ===== 区块 3: 行政区汇总 =====
    const districtSummary = districts.map(d => {
      const items = filtered.filter(s => s.district === d);
      return {
        district: d,
        stations: items.length,
        ports: items.reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
        fast: items.reduce((sum, s) => sum + s.fastChargers, 0),
        slow: items.reduce((sum, s) => sum + s.slowChargers, 0),
        brands: new Set(items.map(s => s.brand)).size,
      };
    }).sort((a, b) => b.stations - a.stations);

    lines.push("三、行政区汇总（按充电站数降序）");
    lines.push("行政区,充电站数,充电桩总数,快充桩数,慢充桩数,入驻品牌数");
    districtSummary.forEach(r => {
      lines.push([r.district, r.stations, r.ports, r.fast, r.slow, r.brands].map(esc).join(","));
    });
    lines.push("合计," + [
      totalStations, totalPorts, totalFastPorts, totalSlowPorts, new Set(filtered.map(s => s.brand)).size
    ].map(esc).join(","));
    lines.push("");

    // ===== 区块 4: 交叉透视矩阵 (行=行政区, 列=品牌) =====
    lines.push("四、交叉透视矩阵（行政区 × 品牌充电站数）");
    const header = ["行政区", ...brands, "合计", "充电桩总数"];
    lines.push(header.map(esc).join(","));
    districts
      .map(d => ({
        district: d,
        rows: brands.reduce<Record<string, number>>((acc, b) => {
          acc[b] = filtered.filter(s => s.district === d && s.brand === b).length;
          return acc;
        }, {}),
        total: filtered.filter(s => s.district === d).length,
        ports: filtered.filter(s => s.district === d).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .forEach(row => {
        const line = [
          row.district,
          ...brands.map(b => row.rows[b] || 0),
          row.total,
          row.ports,
        ];
        lines.push(line.map(esc).join(","));
      });
    // 透视底行合计
    const pivotFooter = ["合计", ...brands.map(b => filtered.filter(s => s.brand === b).length), totalStations, totalPorts];
    lines.push(pivotFooter.map(esc).join(","));
    lines.push("");
    lines.push(`—— GeoPlan 基于 WebGIS 的新能源充电设施规划与决策支持平台 导出结束 ——`);

    const csv = "\uFEFF" + lines.join("\r\n");
    const filename = `geoplan-stats-report-${new Date().toISOString().slice(0, 10)}-${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", Buffer.byteLength(csv, "utf8"));
    res.send(csv);
  } catch (error: any) {
    console.error("报表 CSV 导出错误:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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