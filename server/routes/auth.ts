import express from "express";
import { dbPool, usersDatabase, systemLogs, sessions, generateToken, getTokenFromRequest } from "../db";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { hashPassword, isHashed, verifyPassword } from "../lib/password";

// 管理员不允许自助注册（系统仅保留唯一管理员账号）
const REGISTER_ROLES = ["新能源车主", "投资商"];

export default function registerAuthRoutes(app: express.Express) {

// 用户注册：名字 + 密码 + 角色（车主/投资商），写入 t_user 表（密码 scrypt 加盐哈希存储）
app.post("/api/v1/auth/register", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = req.body?.role;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "请输入用户名和密码" });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ success: false, message: "用户名长度需在 2-20 个字符之间" });
  }
  if (password.length < 6 || password.length > 64) {
    return res.status(400).json({ success: false, message: "密码长度需在 6-64 个字符之间" });
  }
  if (!REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: "请选择注册角色（新能源车主 / 投资商），管理员不支持注册" });
  }
  if (usersDatabase.some(u => u.username === username)) {
    return res.status(409).json({ success: false, message: "用户名已被注册，请更换用户名" });
  }
  const passwordHash = hashPassword(password);
  try {
    const [result]: any = await dbPool.query(
      `INSERT INTO t_user (username, password_hash, role, status) VALUES (?, ?, ?, '正常')`,
      [username, passwordHash, role]
    );
    const newUser = {
      id: result.insertId,
      username,
      password: passwordHash,
      role,
      status: "正常",
      create_time: new Date().toLocaleString("zh-CN"),
    };
    usersDatabase.push(newUser);
    systemLogs.unshift({
      id: systemLogs.length + 1,
      user: username,
      action: "注册账号",
      create_time: new Date().toLocaleString("zh-CN"),
      detail: `新用户注册 (${role})`,
    });
    try { await dbPool.query("INSERT INTO t_log (user, action, detail) VALUES (?, ?, ?)", [username, "注册账号", `新用户注册 (${role})`]); } catch (e) {}
    res.json({ success: true, message: "注册成功", data: { id: newUser.id, username, role } });
  } catch (e: any) {
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "用户名已被注册，请更换用户名" });
    }
    res.status(500).json({ success: false, message: "注册失败：" + (e.message || "数据库错误") });
  }
});

app.post("/api/v1/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "请输入用户名和密码" });
  }
  const user = usersDatabase.find(u => u.username === username);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ success: false, message: "用户名或密码错误" });
  }
  // 历史明文密码在首次登录成功后自动升级为哈希存储
  if (!isHashed(user.password)) {
    const upgraded = hashPassword(password);
    user.password = upgraded;
    dbPool.query("UPDATE t_user SET password_hash=? WHERE id=?", [upgraded, user.id]).catch(() => {});
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