import express from "express";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase, systemLogs } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export default function registerStatsRoutes(app: express.Express) {
app.get("/api/v1/stats/regions", (req, res) => {
  const districtStats: any = {};
  chargingStations.forEach(s => {
    if (!districtStats[s.district]) {
      districtStats[s.district] = { district: s.district, stations: 0, fastChargers: 0, slowChargers: 0, brands: new Set() };
    }
    districtStats[s.district].stations++;
    districtStats[s.district].fastChargers += s.fastChargers;
    districtStats[s.district].slowChargers += s.slowChargers;
    districtStats[s.district].brands.add(s.brand);
  });

  communitiesDatabase.features.forEach((c: any) => {
    const d = c.properties.district;
    if (!d || d === "未知" || d === "未知区") return;  // 跳过无效行政区
    if (!districtStats[d]) districtStats[d] = { district: d, stations: 0, fastChargers: 0, slowChargers: 0, brands: new Set() };
    if (!districtStats[d].communities) districtStats[d].communities = 0;
    if (!districtStats[d].population) districtStats[d].population = 0;
    districtStats[d].communities++;
    districtStats[d].population += c.properties.population_total;
  });

  // 过滤掉无效行政区 (null / 空字符串 / "未知"), 避免下拉框出现 "未知" 选项
  const result = Object.values(districtStats)
    .filter((s: any) => s.district && s.district !== "未知" && s.district !== "未知区" && s.district.trim() !== "")
    .map((s: any) => ({
    ...s,
    brands: s.brands.size,
    brandList: Array.from(s.brands),
  }));

  res.json({ success: true, data: result });
});

// =========================================================================
// 10.13 决策大屏聚合接口 (阶段三 任务 3.1)
// 返回所有 KPI 与图表数据, 供前端 Dashboard.tsx 一次拉取
// =========================================================================
app.get("/api/v1/stats/dashboard", async (req, res) => {
  try {
    // ----- KPI 指标 -----
    const totalStations = chargingStations.length;
    const totalFast = chargingStations.reduce((s, x) => s + (x.fastChargers || 0), 0);
    const totalSlow = chargingStations.reduce((s, x) => s + (x.slowChargers || 0), 0);
    const totalPorts = totalFast + totalSlow;

    // 覆盖率 = 已覆盖社区数 / 总社区数
    const totalCommunities = communitiesDatabase.features.length || 0;
    const coveredCommunities = communitiesDatabase.features.filter((c: any) => c.properties.coverageRatio > 0).length;
    const blindSpotCommunities = totalCommunities - coveredCommunities;
    const coverageRate = totalCommunities > 0 ? Math.round((coveredCommunities / totalCommunities) * 1000) / 10 : 0;

    // 今日新增反馈 (按日期字符串匹配)
    const todayStr = new Date().toLocaleDateString("zh-CN");
    const todayFeedback = feedbackDatabase.filter(f => {
      const t = f.create_time || "";
      return t.includes(todayStr) || t.includes(new Date().toISOString().slice(0, 10));
    }).length;

    // ----- 品牌市占率 -----
    const brandMap: Record<string, number> = {};
    chargingStations.forEach(s => {
      brandMap[s.brand] = (brandMap[s.brand] || 0) + 1;
    });
    const brandShare = Object.entries(brandMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ----- 行政区分布 -----
    const districtMap: Record<string, { stations: number; ports: number; communities: number; population: number }> = {};
    chargingStations.forEach(s => {
      if (!districtMap[s.district]) districtMap[s.district] = { stations: 0, ports: 0, communities: 0, population: 0 };
      districtMap[s.district].stations++;
      districtMap[s.district].ports += (s.fastChargers || 0) + (s.slowChargers || 0);
    });
    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties.district;
      if (!districtMap[d]) districtMap[d] = { stations: 0, ports: 0, communities: 0, population: 0 };
      districtMap[d].communities++;
      districtMap[d].population += Number(c.properties.population_total || 0);
    });
    const districtDist = Object.entries(districtMap).map(([district, v]) => ({ district, ...v }));

    // ----- 增长趋势 (近 12 个月, 按方案 create_time 与站点 update_time 简易聚合) -----
    const months: { month: string; stations: number; schemes: number; feedback: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const st = chargingStations.filter(s => (s.updateTime || "").startsWith(key)).length;
      const sc = schemesDatabase.filter(s => (s.create_time || "").includes(key) || (s.create_time || "").includes(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`)).length;
      const fb = feedbackDatabase.filter(f => (f.create_time || "").includes(key) || (f.create_time || "").includes(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`)).length;
      months.push({ month: key, stations: st, schemes: sc, feedback: fb });
    }

    // ----- Top5 盲区社区 (按人口降序) -----
    const topBlindSpots = communitiesDatabase.features
      .filter((c: any) => !c.properties.coverageRatio || c.properties.coverageRatio === 0)
      .map((c: any) => ({
        id: c.properties.id,
        name: c.properties.name,
        district: c.properties.district,
        population: Number(c.properties.population_total || 0),
      }))
      .sort((a, b) => b.population - a.population)
      .slice(0, 5);

    // ----- 滚动条: 实时反馈 + 日志 -----
    const feedItems = feedbackDatabase
      .slice(-20)
      .reverse()
      .map(f => ({
        type: f.type === "evaluation" ? "评价" : "需求",
        content: (f.description || "").slice(0, 60),
        submitter: f.submitter || "匿名",
        time: f.create_time || "",
      }));
    const logItems = systemLogs.slice(0, 10).map(l => ({
      type: "日志",
      content: `${l.action} - ${l.detail || ""}`.slice(0, 60),
      submitter: l.user,
      time: l.create_time || "",
    }));
    const ticker = [...feedItems, ...logItems];

    // ----- 站点 GeoJSON (供大屏地图渲染) -----
    const stationsFC = {
      type: "FeatureCollection",
      features: chargingStations.map(s => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { id: s.id, name: s.name, brand: s.brand, district: s.district, fast: s.fastChargers, slow: s.slowChargers },
      })),
    };

    // 尝试更新数据库中的实时统计 (失败则忽略)
    res.json({
      success: true,
      data: {
        kpi: {
          totalStations,
          totalPorts,
          totalFast,
          totalSlow,
          coverageRate,
          blindSpotCommunities,
          todayFeedback,
          totalCommunities,
          totalPopulation: communitiesDatabase.features.reduce((s: number, c: any) => s + Number(c.properties.population_total || 0), 0),
        },
        brandShare,
        districtDist,
        growthTrend: months,
        topBlindSpots,
        ticker,
        stations: stationsFC,
        updateTime: new Date().toLocaleString("zh-CN"),
      },
    });
  } catch (e: any) {
    console.error("大屏聚合接口错误:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 10.14 多维统计报表接口 (阶段三 任务 3.2)
// 支持 query 参数 district / brand / chargeMode / status, 返回交叉透视数据
// =========================================================================
app.get("/api/v1/stats/report", (req, res) => {
  try {
    const { district, brand, chargeMode, status } = req.query;
    // 1. 过滤充电站
    let filtered = chargingStations.slice();
    if (district && district !== "all") filtered = filtered.filter(s => s.district === district);
    if (brand && brand !== "all") filtered = filtered.filter(s => s.brand === brand);
    if (status && status !== "all") filtered = filtered.filter(s => s.status === status);
    if (chargeMode && chargeMode !== "all") {
      if (chargeMode === "fast") filtered = filtered.filter(s => s.fastChargers > 0);
      else if (chargeMode === "slow") filtered = filtered.filter(s => s.slowChargers > 0);
    }

    // 2. 交叉透视: 行=行政区, 列=品牌, 值=充电站数 / 充电桩数
    const districtsSet = Array.from(new Set(filtered.map(s => s.district)));
    const brandsSet = Array.from(new Set(filtered.map(s => s.brand)));
    const pivot: { district: string; rows: Record<string, number>; total: number; ports: number }[] = [];
    districtsSet.forEach(d => {
      const rows: Record<string, number> = {};
      let total = 0, ports = 0;
      brandsSet.forEach(b => {
        const count = filtered.filter(s => s.district === d && s.brand === b).length;
        rows[b] = count;
        total += count;
      });
      ports = filtered.filter(s => s.district === d).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0);
      pivot.push({ district: d, rows, total, ports });
    });
    pivot.sort((a, b) => b.total - a.total);

    // 3. 品牌汇总
    const brandSummary = brandsSet.map(b => ({
      brand: b,
      stations: filtered.filter(s => s.brand === b).length,
      ports: filtered.filter(s => s.brand === b).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
    })).sort((a, b) => b.stations - a.stations);

    // 4. 行政区汇总
    const districtSummary = districtsSet.map(d => ({
      district: d,
      stations: filtered.filter(s => s.district === d).length,
      ports: filtered.filter(s => s.district === d).reduce((sum, s) => sum + s.fastChargers + s.slowChargers, 0),
      brands: new Set(filtered.filter(s => s.district === d).map(s => s.brand)).size,
    })).sort((a, b) => b.stations - a.stations);

    res.json({
      success: true,
      data: {
        total: filtered.length,
        totalPorts: filtered.reduce((s, x) => s + x.fastChargers + x.slowChargers, 0),
        brands: brandsSet,
        districts: districtsSet,
        pivot,
        brandSummary,
        districtSummary,
        filter: { district: district || "all", brand: brand || "all", chargeMode: chargeMode || "all", status: status || "all" },
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});
}