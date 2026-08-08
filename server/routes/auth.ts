import express from "express";
import { dbPool, usersDatabase, systemLogs, sessions, generateToken, getTokenFromRequest } from "../db";
import { requireAuth } from "../middleware/auth";

export default function registerAuthRoutes(app: express.Express) {

app.post("/api/v1/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "请输入用户名和密码" });
  }
  const user = usersDatabase.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, message: "用户名或密码错误" });
  }
  if (user.status !== "正常") {
    return res.status(403).json({ success: false, message: "账号已被禁用，请联系管理员" });
  }
  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    loginAt: Date.now(),
  });
  // 记录登录日志
  systemLogs.unshift({
    id: systemLogs.length + 1,
    user: user.username,
    action: "登录系统",
    create_time: new Date().toLocaleString("zh-CN"),
    detail: `${user.role}登录系统`,
  });
  try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [user.username, "登录系统", `${user.role}登录系统`]); } catch (e) {}
  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, status: user.status, create_time: user.create_time },
  });
});

app.post("/api/v1/auth/logout", (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) sessions.delete(token);
  res.json({ success: true, message: "已退出登录" });
});

app.get("/api/v1/auth/current", requireAuth, (req, res) => {
  const cur = (req as any).currentUser;
  const user = usersDatabase.find(u => u.id === cur.userId);
  if (!user) return res.status(404).json({ success: false, message: "用户不存在" });
  res.json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role, status: user.status, create_time: user.create_time },
  });
});

// 获取所有充电站

}