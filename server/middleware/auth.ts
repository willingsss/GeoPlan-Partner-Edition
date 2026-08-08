// 鉴权中间件：JWT/Token 校验 + 角色权限
import express from "express";
import { sessions, getTokenFromRequest } from "../db";

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: "未登录或会话已过期" });
  }
  const session = sessions.get(token)!;
  // 会话有效期 12 小时
  if (Date.now() - session.loginAt > 12 * 60 * 60 * 1000) {
    sessions.delete(token);
    return res.status(401).json({ success: false, message: "会话已过期，请重新登录" });
  }
  (req as any).currentUser = {
    id: session.userId,
    username: session.username,
    role: session.role,
  };
  next();
}

// 鉴权中间件：校验角色
export function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).currentUser;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: "权限不足，无法访问此功能" });
    }
    next();
  };
}
