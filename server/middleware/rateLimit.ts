// =========================================================================
// rateLimit: 简单内存滑动窗口限流（按 IP + Token 维度）
// 用于保护调用外部 API（DeepSeek/高德）的接口，避免被刷取消耗配额。
// =========================================================================
import express from "express";
import { getTokenFromRequest } from "../db";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 30;

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 优先按登录 token 限流，未登录则按 IP
    const token = getTokenFromRequest(req);
    const key = token ? `token:${token}` : `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;

    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    if (bucket.count > max) {
      return res.status(429).json({ success: false, message: "请求过于频繁，请稍后再试" });
    }
    next();
  };
}