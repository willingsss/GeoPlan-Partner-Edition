import express from "express";
import * as turf from "@turf/turf";
import { dbPool, chargingStations, communitiesDatabase, feedbackDatabase, schemesDatabase, systemLogs } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";


// =========================================================================
// 社区覆盖判定工具 (纯 JS, 避免 MySQL 4326 空间函数限制)
// 覆盖判定: 社区质心到最近运营站距离 <= 800m (快充服务半径)
// =========================================================================
function communityCoverageHelper() {
  // 站点点列表
  const stationPts = (chargingStations || [])
    .filter((s: any) => s.status === "运营中")
    .map((s: any) => [Number(s.lng), Number(s.lat)]);
  // haversine 距离 (米)
  const haversineM = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLng = ((b[0] - a[0]) * Math.PI) / 180;
    const la1 = (a[1] * Math.PI) / 180, la2 = (b[1] * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  // 社区质心 (Polygon: 外环平均; MultiPolygon: 第一面外环)
  const centroid = (geom: any): [number, number] => {
    let ring: any = null;
    if (geom?.type === "Polygon") ring = geom.coordinates?.[0];
    else if (geom?.type === "MultiPolygon") ring = geom.coordinates?.[0]?.[0];
    if (!ring || !ring.length) return [117.2, 34.26];
    let sx = 0, sy = 0;
    for (const p of ring) { sx += p[0]; sy += p[1]; }
    return [sx / ring.length, sy / ring.length];
  };
  // 每个社区最近站距离 (社区 id 在 feature 级 c.id)
  const distMap = new Map<number, number>();
  (communitiesDatabase?.features || []).forEach((c: any) => {
    const center = centroid(c.geometry);
    let min = 9999999;
    for (const p of stationPts) {
      const d = haversineM(center, p as [number, number]);
      if (d < min) min = d;
    }
    distMap.set(c.id ?? c.properties?.id, min);
  });
  const isBlind = (c: any) => (distMap.get(c.id ?? c.properties?.id) ?? 9999999) > 800;
  const nearestOf = (c: any) => Math.round((distMap.get(c.id ?? c.properties?.id) ?? 9999999) / 100) / 10;
  return { isBlind, nearestOf, distMap };
}

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

    // 覆盖率 = 已覆盖社区数 / 总社区数 (覆盖判定: 距最近运营站 <= 800m 快充服务半径)
    const covHelper = communityCoverageHelper();
    const totalCommunities = communitiesDatabase.features.length || 0;
    const coveredCommunities = communitiesDatabase.features.filter((c: any) => !covHelper.isBlind(c)).length;
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
// =========================================================================
// 盲区攻坚大屏 (决策大屏平级)
// =========================================================================
app.get("/api/v1/stats/blindspot-dashboard", async (req, res) => {
  try {
    // 覆盖判定: 距最近运营站 <= 800m (快充服务半径, 纯 JS haversine)
    const covHelper = communityCoverageHelper();
    const isBlind = (c: any) => covHelper.isBlind(c);

    const totalCommunities = communitiesDatabase.features.length || 0;
    const coveredCommunities = communitiesDatabase.features.filter((c: any) => !isBlind(c)).length;
    const blindSpotCommunities = totalCommunities - coveredCommunities;
    const coverageRate = totalCommunities > 0 ? Math.round((coveredCommunities / totalCommunities) * 1000) / 10 : 0;
    const blindPop = communitiesDatabase.features
      .filter((c: any) => isBlind(c))
      .reduce((s, c: any) => s + Number(c.properties.population_total || 0), 0);
    const totalPop = communitiesDatabase.features
      .reduce((s, c: any) => s + Number(c.properties.population_total || 0), 0);

    // Top10 盲区社区 (按人口降序, 带最近站距离)
    const topBlindSpots = communitiesDatabase.features
      .filter((c: any) => isBlind(c))
      .map((c: any) => ({
        id: c.properties.id,
        name: c.properties.name,
        district: c.properties.district,
        population: Number(c.properties.population_total || 0),
        nearestDistance: covHelper.nearestOf(c),
      }))
      .sort((a: any, b: any) => b.population - a.population)
      .slice(0, 10);

    // 各区盲区排行
    const districtBlindRank: Record<string, { district: string; total: number; blind: number; blindPop: number; rate: number }> = {};
    communitiesDatabase.features.forEach((c: any) => {
      const d = c.properties.district || "未知";
      if (!districtBlindRank[d]) districtBlindRank[d] = { district: d, total: 0, blind: 0, blindPop: 0, rate: 0 };
      districtBlindRank[d].total++;
      if (isBlind(c)) {
        districtBlindRank[d].blind++;
        districtBlindRank[d].blindPop += Number(c.properties.population_total || 0);
      }
    });
    const districtBlindList = Object.values(districtBlindRank)
      .map(r => ({ ...r, rate: r.total > 0 ? Math.round((r.blind / r.total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.blindPop - a.blindPop);

    // 盲区面 GeoJSON (距最近站 > 800m 的社区面, 地图红面显示)
    const blindAreas = {
      type: "FeatureCollection",
      features: communitiesDatabase.features
        .filter((c: any) => isBlind(c))
        .map((c: any) => ({
          type: "Feature",
          geometry: c.geometry,
          properties: {
            id: c.properties.id,
            name: c.properties.name,
            district: c.properties.district,
            population: Number(c.properties.population_total || 0),
            nearestDistance: covHelper.nearestOf(c),
          },
        })),
    };

    res.json({
      success: true,
      data: {
        kpi: {
          totalCommunities, coveredCommunities, blindSpotCommunities, coverageRate,
          blindPopulation: blindPop, totalPopulation: totalPop,
          blindPopRate: totalPop > 0 ? Math.round((blindPop / totalPop) * 1000) / 10 : 0,
          totalStations: chargingStations.length,
        },
        topBlindSpots,
        districtBlindList,
        blindAreas,
        // 全量站点 (地图绿点)
        allStations: chargingStations.map((s: any) => ({
          id: s.id, name: s.name, lng: s.lng, lat: s.lat,
        })),
        updateTime: new Date().toLocaleString("zh-CN", { hour12: false }),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================
// 选址决策大屏 (决策大屏平级)
// =========================================================================
app.get("/api/v1/stats/scheme-dashboard", async (req, res) => {
  try {
    const schemes = (schemesDatabase || []).filter((s: any) => s.id);

    // KPI
    const totalSchemes = schemes.length;
    const avgScore = totalSchemes > 0
      ? Math.round(schemes.reduce((sum, s: any) => sum + (s.scheme_score || 0), 0) / totalSchemes)
      : 0;
    const maxScore = totalSchemes > 0 ? Math.max(...schemes.map((s: any) => s.scheme_score || 0)) : 0;
    const totalCoveredPop = schemes.reduce((sum, s: any) => sum + (s.covered_population || 0), 0);

    // 方案排行 (按综合评分降序)
    const schemeRank = [...schemes]
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        score: s.scheme_score || 0,
        coveredPopulation: s.covered_population || 0,
        coveredCommunities: s.covered_communities || 0,
        blindReduction: s.blind_spot_reduction || 0,
        competition: s.competition_score || 0,
        socialBenefit: s.social_benefit || 0,
        radius: s.radius || 800,
        createTime: s.create_time || "",
      }))
      .sort((a, b) => b.score - a.score);

    // 各品牌方案数
    const brandMap: Record<string, number> = {};
    schemes.forEach((s: any) => { brandMap[s.brand] = (brandMap[s.brand] || 0) + 1; });
    const brandSchemeDist = Object.entries(brandMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 评分分布 (0-59 / 60-69 / 70-79 / 80-89 / 90-100)
    const scoreBins = [
      { label: "60以下", min: 0, max: 59, count: 0 },
      { label: "60-69", min: 60, max: 69, count: 0 },
      { label: "70-79", min: 70, max: 79, count: 0 },
      { label: "80-89", min: 80, max: 89, count: 0 },
      { label: "90以上", min: 90, max: 100, count: 0 },
    ];
    schemes.forEach((s: any) => {
      const sc = s.scheme_score || 0;
      const bin = scoreBins.find(b => sc >= b.min && sc <= b.max);
      if (bin) bin.count++;
    });

    // 方案位置 GeoJSON (点, 大屏地图显示)
    const schemePositions = {
      type: "FeatureCollection",
      features: schemes.map((s: any) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id, name: s.name, brand: s.brand,
          score: s.scheme_score || 0,
          coveredPopulation: s.covered_population || 0,
        },
      })),
    };

    res.json({
      success: true,
      data: {
        kpi: { totalSchemes, avgScore, maxScore, totalCoveredPop },
        schemeRank,
        brandSchemeDist,
        scoreBins,
        schemePositions,
        updateTime: new Date().toLocaleString("zh-CN", { hour12: false }),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});
}
