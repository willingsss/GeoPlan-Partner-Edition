import express from "express";
import * as turf from "@turf/turf";
import { chargingStations, communitiesDatabase, feedbackDatabase, dbPool, systemLogs } from "../db";
import { getPlanarPolygonArea3857, projectGeometryTo3857 } from "../lib/geo";
import { requireAuth, requireRole } from "../middleware/auth";

export default function registerDataRoutes(app: express.Express) {

app.get("/api/v1/stations", (req, res) => {
  const { brand, district } = req.query;
  let stations = [...chargingStations];
  if (brand && brand !== "全部") {
    stations = stations.filter(s => s.brand === brand);
  }
  if (district && district !== "全部") {
    stations = stations.filter(s => s.district === district);
  }
  // 转为 GeoJSON FeatureCollection (剔除等时圈几何字段避免响应过大, 仅保留状态/时间)
  const fc = {
    type: "FeatureCollection",
    features: stations.map(s => {
      // 解构剔除重型几何字段, 其余属性原样下发
      const { isochroneFastGeom, isochroneSlowGeom, ...rest } = s;
      return {
        type: "Feature",
        id: s.id,
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { ...rest },
      };
    }),
  };
  res.json({ success: true, data: fc });
});

// 获取所有住宅小区
app.get("/api/v1/communities", (req, res) => {
  const updatedFeatures = communitiesDatabase.features.map((f: any) => {
    const projected = projectGeometryTo3857(f);
    const area = getPlanarPolygonArea3857(projected);
    return { ...f, properties: { ...f.properties, area_gis: Math.round(area * 100) / 100 } };
  });
  res.json({ success: true, data: { type: "FeatureCollection", features: updatedFeatures } });
});

// 获取公众反馈数据
app.get("/api/v1/feedback", (req, res) => {
  const fc = {
    type: "FeatureCollection",
    features: feedbackDatabase.map(f => ({
      type: "Feature",
      id: f.id,
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: { ...f },
    })),
  };
  res.json({ success: true, data: fc });
});

// 违法违禁关键词列表 (命中则自动驳回)
const FORBIDDEN_KEYWORDS = [
  // 政治敏感
  "反动", "颠覆", "分裂", "独立", "政变", "暴动", "游行示威",
  // 暴力恐怖
  "恐怖", "爆炸", "袭击", "杀人", "砍人", "纵火", "投毒", "绑架",
  // 违法犯罪
  "贩毒", "吸毒", "赌博", "诈骗", "洗钱", "贿赂", "走私", "偷渡",
  "枪支", "弹药", "管制刀具", "假币", "传销",
  // 色情低俗
  "色情", "卖淫", "嫖娼", "裸聊", "一夜情", "约炮", "黄网",
  // 人身攻击/侮辱
  "傻逼", "操你", "草泥马", "去死", "滚蛋", "废物", "贱人", "婊子",
  // 其他
  "邪教", "传销", "黑客攻击", "翻墙", "VPN",
];

// 检测文本是否包含违禁词
function containsForbiddenKeyword(text: string): { hit: boolean; keyword?: string } {
  if (!text) return { hit: false };
  const lower = text.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { hit: true, keyword: kw };
    }
  }
  return { hit: false };
}

// 获取指定充电站的反馈列表 (用于站点悬浮窗展示)
app.get("/api/v1/feedback/by-station/:stationId", (req, res) => {
  const stationId = parseInt(req.params.stationId);
  const list = feedbackDatabase.filter(f => f.stationId === stationId);
  res.json({ success: true, data: list });
});

// 提交公众反馈 (自动审核: 命中违禁词自动驳回, 否则待审核)
app.post("/api/v1/feedback", async (req, res) => {
  const { type, lng, lat, description, rating, submitter, contact, stationId } = req.body;
  // 徐州经纬度红线校验
  if (lng < 116.36 || lng > 118.67 || lat < 33.72 || lat > 34.97) {
    return res.status(400).json({ success: false, message: "坐标超出徐州市范围，已被红线拦截" });
  }
  // 违禁词自动审核
  const check = containsForbiddenKeyword(description || "");
  const status = check.hit ? "rejected" : "pending";
  try {
    const lngNum = parseFloat(lng);
    const latVal = parseFloat(lat);
    const geomWkt = `POINT(${latVal} ${lngNum})`;
    const stationIdVal = stationId ? parseInt(stationId as any) : null;
    const [result] = await dbPool.query(
      `INSERT INTO t_feedback (type, description, rating, lng, lat, geom, submitter, contact, station_id, status) VALUES (?, ?, ?, ?, ?, ST_GeomFromText(?, 4326), ?, ?, ?, ?)`,
      [type || "demand", description || "", rating || null, lngNum, latVal, geomWkt, submitter || "匿名用户", contact || null, stationIdVal, status]
    );
    const newFeedback = {
      id: (result as any).insertId,
      type: type || "demand",
      description: description || "",
      rating: rating || null,
      lng: parseFloat(lng),
      lat: parseFloat(lat),
      stationId: stationIdVal ?? undefined,
      submitter: submitter || "匿名用户",
      contact: contact || null,
      status,
      create_time: new Date().toLocaleString("zh-CN"),
    };
    feedbackDatabase.push(newFeedback);
    const message = check.hit
      ? `反馈包含违禁词"${check.keyword}"，已被系统自动驳回`
      : "反馈提交成功，等待管理员审核";
    res.json({ success: true, data: newFeedback, message });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 审核反馈 (管理员专用)
app.post("/api/v1/feedback/:id/review", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body; // "approved" | "rejected"
  try {
    await dbPool.query("UPDATE t_feedback SET status=? WHERE id=?", [status, id]);
    const fb = feedbackDatabase.find(f => f.id === id);
    if (fb) fb.status = status;
    const cur = (req as any).currentUser;
    systemLogs.unshift({
      id: systemLogs.length + 1,
      user: cur.username,
      action: "审核反馈",
      create_time: new Date().toLocaleString("zh-CN"),
      detail: `反馈#${id} ${status === "approved" ? "审核通过" : "已驳回"}`,
    });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "审核反馈", `反馈#${id} ${status === "approved" ? "审核通过" : "已驳回"}`]); } catch (e) {}
    res.json({ success: true, data: fb || { id, status }, message: `反馈已${status === "approved" ? "通过" : "驳回"}` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// =========================================================================

}