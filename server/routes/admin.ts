import express from "express";
import { chargingStations, feedbackDatabase, usersDatabase, systemLogs, dbPool, loadFeedbackFromDB, loadLogsFromDB } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import type { ChargingStation } from "../types";
import { precomputeAsync, getPrecomputeProgress } from "../services/isochronePrecompute";

export default function registerAdminRoutes(app: express.Express) {
app.get("/api/v1/admin/isochrone-progress", (req, res) => {
  const progress = getPrecomputeProgress();
  const totalStations = chargingStations.length;
  const okCount = chargingStations.filter(s => s.isochroneStatus === "ok").length;
  const partialCount = chargingStations.filter(s => s.isochroneStatus === "partial").length;
  const pendingCount = chargingStations.filter(s => s.isochroneStatus === "pending").length;
  const failedCount = chargingStations.filter(s => s.isochroneStatus === "failed").length;
  res.json({
    success: true,
    data: {
      ...progress,
      stats: {
        total: totalStations,
        ok: okCount,
        partial: partialCount,
        pending: pendingCount,
        failed: failedCount,
      },
    },
  });
});

// 手动触发预计算（仅对 pending/failed 站点）
app.post("/api/v1/admin/precompute-isochrones", async (req, res) => {
  const progress = getPrecomputeProgress();
  if (progress.running) {
    return res.status(409).json({
      success: false,
      message: "已有预计算任务在执行中",
      data: progress,
    });
  }
  const { force } = req.body || {};
  const targets = (force
    ? chargingStations
    : chargingStations.filter(s => s.isochroneStatus === "pending" || s.isochroneStatus === "failed")
  ).map(s => ({ id: s.id, lng: s.lng, lat: s.lat, fastChargers: s.fastChargers, slowChargers: s.slowChargers }));

  if (targets.length === 0) {
    return res.json({ success: true, message: "无待计算站点", data: getPrecomputeProgress() });
  }
  precomputeAsync(dbPool, targets, { force, memoryStations: chargingStations });
  res.json({
    success: true,
    message: `已触发 ${targets.length} 座站点的等时圈预计算`,
    data: getPrecomputeProgress(),
  });
});

// 充电覆盖分析：识别盲区
app.get("/api/v1/users", requireAuth, requireRole("管理员"), (req, res) => {
  res.json({ success: true, data: usersDatabase.map(u => ({ ...u, password: "******" })) });
});

// 新增用户 (管理员专用)
app.post("/api/v1/users", requireAuth, requireRole("管理员"), async (req, res) => {
  const { username, password, role, status } = req.body;
  if (!username || !password || !role) return res.status(400).json({ success: false, message: "参数不完整" });
  if (usersDatabase.find(u => u.username === username)) return res.status(400).json({ success: false, message: "用户名已存在" });
  try {
    const [result]: any = await dbPool.query(
      `INSERT INTO t_user (username, password_hash, role, status) VALUES (?, ?, ?, ?)`,
      [username, password, role, status || "正常"]
    );
    const newUser = {
      id: result.insertId, username, password, role, status: status || "正常",
      create_time: new Date().toLocaleString("zh-CN"),
    };
    usersDatabase.push(newUser);
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "新增用户", create_time: new Date().toLocaleString("zh-CN"), detail: `新增用户 ${username} (${role})` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "新增用户", `新增用户 ${username} (${role})`]); } catch (e) {}
    res.json({ success: true, data: { ...newUser, password: "******" }, message: "用户创建成功" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 修改用户 (管理员专用)
app.put("/api/v1/users/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const u = usersDatabase.find(u => u.id === id);
  if (!u) return res.status(404).json({ success: false, message: "用户不存在" });
  const { username, password, role, status } = req.body;
  try {
    const updates: string[] = [];
    const params: any[] = [];
    if (username) { updates.push("username=?"); params.push(username); }
    if (password) { updates.push("password_hash=?"); params.push(password); }
    if (role) { updates.push("role=?"); params.push(role); }
    if (status) { updates.push("status=?"); params.push(status); }
    if (updates.length > 0) {
      params.push(id);
      await dbPool.query(`UPDATE t_user SET ${updates.join(",")} WHERE id=?`, params);
    }
    if (username) u.username = username;
    if (password) u.password = password;
    if (role) u.role = role;
    if (status) u.status = status;
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "修改用户", create_time: new Date().toLocaleString("zh-CN"), detail: `修改用户 ${u.username}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "修改用户", `修改用户 ${u.username}`]); } catch (e) {}
    res.json({ success: true, data: { ...u, password: "******" }, message: "用户信息已更新" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 删除用户 (管理员专用)
app.delete("/api/v1/users/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const idx = usersDatabase.findIndex(u => u.id === id);
  if (idx < 0) return res.status(404).json({ success: false, message: "用户不存在" });
  if (usersDatabase[idx].username === "admin") return res.status(400).json({ success: false, message: "不能删除超级管理员" });
  try {
    await dbPool.query("DELETE FROM t_user WHERE id=?", [id]);
    const removed = usersDatabase.splice(idx, 1)[0];
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "删除用户", create_time: new Date().toLocaleString("zh-CN"), detail: `删除用户 ${removed.username}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "删除用户", `删除用户 ${removed.username}`]); } catch (e) {}
    res.json({ success: true, message: "用户已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 系统日志接口 (管理员专用, 从 MySQL 读取最新100条)
app.get("/api/v1/logs", requireAuth, requireRole("管理员"), async (req, res) => {
  try {
    const logs = await loadLogsFromDB();
    res.json({ success: true, data: logs });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ===== 充电站管理接口 (管理员专用) =====
// 新增充电站
app.post("/api/v1/stations", requireAuth, requireRole("管理员"), async (req, res) => {
  const { name, brand, lng, lat, fast_chargers, slow_chargers, address, district, status } = req.body;
  if (!name || !brand || !lng || !lat) return res.status(400).json({ success: false, message: "参数不完整" });
  try {
    const lngNum = parseFloat(lng);
    const latVal = parseFloat(lat);
    const geomWkt = `POINT(${latVal} ${lngNum})`;
    const [result]: any = await dbPool.query(
      `INSERT INTO t_charging_station (name, brand, lng, lat, geom, fast_chargers, slow_chargers, address, district, status, update_time)
       VALUES (?, ?, ?, ?, ST_GeomFromText(?, 4326), ?, ?, ?, ?, ?, CURDATE())`,
      [name, brand, lngNum, latVal, geomWkt, fast_chargers || 0, slow_chargers || 0, address || "", district || "", status || "运营中"]
    );
    const newStation: ChargingStation = {
      id: result.insertId, name, brand, lng: parseFloat(lng), lat: parseFloat(lat),
      fastChargers: fast_chargers || 0, slowChargers: slow_chargers || 0,
      address: address || "", district: district || "", status: status || "运营中",
      operator: "", updateTime: new Date().toISOString().split("T")[0],
    };
    chargingStations.push(newStation);
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "新增充电站", create_time: new Date().toLocaleString("zh-CN"), detail: `新增 ${name} (${brand})` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "新增充电站", `新增 ${name} (${brand})`]); } catch (e) {}
    res.json({ success: true, data: newStation, message: "充电站创建成功" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 修改充电站
app.put("/api/v1/stations/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, brand, lng, lat, fast_chargers, slow_chargers, address, district, status } = req.body;
  try {
    const lngNum = parseFloat(lng);
    const latVal = parseFloat(lat);
    const geomWkt = `POINT(${latVal} ${lngNum})`;
    await dbPool.query(
      `UPDATE t_charging_station SET name=?, brand=?, lng=?, lat=?, geom=ST_GeomFromText(?, 4326), fast_chargers=?, slow_chargers=?, address=?, district=?, status=?, update_time=CURDATE() WHERE id=?`,
      [name, brand, lngNum, latVal, geomWkt, fast_chargers, slow_chargers, address, district, status, id]
    );
    const s = chargingStations.find(s => s.id === id);
    if (s) {
      Object.assign(s, { name, brand, lng: parseFloat(lng), lat: parseFloat(lat), fastChargers: fast_chargers, slowChargers: slow_chargers, address, district, status, updateTime: new Date().toISOString().split("T")[0] });
    }
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "修改充电站", create_time: new Date().toLocaleString("zh-CN"), detail: `修改 ${name}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "修改充电站", `修改 ${name}`]); } catch (e) {}
    res.json({ success: true, message: "充电站信息已更新" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 删除充电站
app.delete("/api/v1/stations/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await dbPool.query("DELETE FROM t_charging_station WHERE id=?", [id]);
    const idx = chargingStations.findIndex(s => s.id === id);
    const removed = idx >= 0 ? chargingStations.splice(idx, 1)[0] : null;
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "删除充电站", create_time: new Date().toLocaleString("zh-CN"), detail: `删除 ${removed?.name || id}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "删除充电站", `删除 ${removed?.name || id}`]); } catch (e) {}
    res.json({ success: true, message: "充电站已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ===== 反馈管理接口 (管理员专用) =====
// 获取全部反馈列表
app.get("/api/v1/feedback/all", requireAuth, requireRole("管理员"), (req, res) => {
  res.json({ success: true, data: feedbackDatabase });
});

// 删除反馈
app.delete("/api/v1/feedback/:id", requireAuth, requireRole("管理员"), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await dbPool.query("DELETE FROM t_feedback WHERE id=?", [id]);
    const idx = feedbackDatabase.findIndex(f => f.id === id);
    if (idx >= 0) feedbackDatabase.splice(idx, 1);
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "删除反馈", create_time: new Date().toLocaleString("zh-CN"), detail: `删除反馈#${id}` });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "删除反馈", `删除反馈#${id}`]); } catch (e) {}
    res.json({ success: true, message: "反馈已删除" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 清空违禁反馈
app.delete("/api/v1/feedback/rejected/clear", requireAuth, requireRole("管理员"), async (req, res) => {
  try {
    await dbPool.query("DELETE FROM t_feedback WHERE status='rejected'");
    feedbackDatabase.splice(0, feedbackDatabase.length, ...(await loadFeedbackFromDB()));
    const cur = (req as any).currentUser;
    systemLogs.unshift({ id: systemLogs.length + 1, user: cur.username, action: "清空违禁反馈", create_time: new Date().toLocaleString("zh-CN"), detail: "清空所有违禁反馈" });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [cur.username, "清空违禁反馈", "清空所有违禁反馈"]); } catch (e) {}
    res.json({ success: true, message: "已清空所有违禁反馈" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});
}