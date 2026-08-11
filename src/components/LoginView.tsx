import React from "react";
import { Zap, RefreshCw, LogOut, ShieldCheck } from "lucide-react";
import { DEMO_ACCOUNTS, ROLE_CONFIG } from "../types";

interface LoginViewProps {
  loginForm: { username: string; password: string };
  onLoginFormChange: (field: "username" | "password", value: string) => void;
  loginError: string;
  loginLoading: boolean;
  onLogin: () => void;
  onFillDemo: (username: string, password: string) => void;
}

/**
 * 登录页面（Linear 风深色）
 */
export default function LoginView({
  loginForm,
  onLoginFormChange,
  loginError,
  loginLoading,
  onLogin,
  onFillDemo,
}: LoginViewProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden no-select"
      style={{ background: "#09090B", fontFamily: "var(--font-sans)" }}
    >
      {/* 极简网格背景 - 替代陈词滥调的径向光晕 */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* 单一品牌色光斑 - 仅一处, 克制 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,200,150,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-[440px]">
        {/* Logo + 品牌标识 - 顶部对齐, 不居中 */}
        <div className="mb-8 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "#18181B",
              border: "1px solid #27272A",
            }}
          >
            <Zap className="w-5 h-5" style={{ color: "var(--color-brand)" }} />
          </div>
          <div className="flex-1">
            <h1 className="text-[19px] font-semibold text-white tracking-tight leading-none">
              GeoPlan
            </h1>
            <p className="text-[11px] text-zinc-500 mt-1">
              新能源充电设施规划与决策支持平台
            </p>
          </div>
        </div>

        {/* 登录卡片 - Linear 风: 极轻边框 + 极深阴影 */}
        <div
          className="bg-white rounded-xl p-7"
          style={{
            border: "1px solid #E4E4E7",
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 8px 32px -4px rgba(0,0,0,0.12), 0 16px 48px -8px rgba(0,0,0,0.08)",
          }}
        >
          {/* 卡片标题 + 状态指示 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[17px] font-semibold text-zinc-900 tracking-tight">
                登录账户
              </h2>
              <p className="text-[12px] text-zinc-500 mt-0.5">
                徐州新能源充电设施规划平台
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-status-pulse" />
              <span className="text-[10px] text-zinc-500">
                服务正常
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-zinc-600 font-medium block mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => onLoginFormChange("username", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onLogin()}
                placeholder="输入用户名"
                className="input-sys w-full text-sm px-3 py-2.5 text-zinc-900"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-600 font-medium block mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => onLoginFormChange("password", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onLogin()}
                placeholder="输入密码"
                className="input-sys w-full text-sm px-3 py-2.5 text-zinc-900"
              />
            </div>

            {loginError && (
              <div
                className="text-[12px] rounded-md px-3 py-2 flex items-start gap-2"
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#B91C1C",
                }}
              >
                <span className="text-red-500 mt-0.5">⚠</span>
                <span className="flex-1">{loginError}</span>
              </div>
            )}

            <button
              onClick={onLogin}
              disabled={loginLoading}
              className="btn-brand w-full py-2.5 rounded-md text-[13px] font-semibold flex items-center justify-center gap-2"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>验证中...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5 rotate-180" />
                  <span>登录系统</span>
                  <span className="text-[10px] opacity-60 ml-1 font-mono">↵</span>
                </>
              )}
            </button>
          </div>

          {/* 演示账号 */}
          <div className="mt-6 pt-5 border-t border-zinc-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-zinc-500">
                演示账号
              </p>
              <span className="text-[10px] text-zinc-400">点击填充</span>
            </div>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map(acc => {
                const cfg = ROLE_CONFIG[acc.role];
                return (
                  <button
                    key={acc.username}
                    onClick={() => onFillDemo(acc.username, acc.password)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all hover:bg-zinc-50"
                    style={{ border: "1px solid var(--color-muted)" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cfg.color }}
                    />
                    <span className="text-[12px] text-zinc-700 flex-1">{acc.username}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{acc.password}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: cfg.color + "1A", color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>安全连接</span>
          </span>
          <span>·</span>
          <span>空间数据库</span>
        </div>
      </div>
    </div>
  );
}
