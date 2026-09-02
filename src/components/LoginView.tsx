import React from "react";
import { Zap, RefreshCw, LogIn, ShieldCheck } from "lucide-react";
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
 * 登录页面（冰蓝液态玻璃配色）
 * - 主色 #1B2A4A: 标题 / 登录按钮 / logo 闪电
 * - 辅助色 #5A7BA0: 输入框图标 / 占位文字
 * - 点缀色 #D9A843: 描边 / 装饰细线
 * - 背景 #EAF2F8 → #D6E6F2: 冰蓝渐变
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
      style={{
        background: "linear-gradient(160deg, #EAF2F8 0%, #E0ECF5 50%, #D6E6F2 100%)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ===== 背景: 冰蓝氛围 (地理网格 + 光斑 + 站点灯光) ===== */}
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(90,123,160,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(90,123,160,0.14) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* 顶部金色装饰细线 + 蓝色光斑 */}
      <div
        className="absolute -top-40 -left-40 w-[720px] h-[720px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(90,123,160,0.16) 0%, transparent 60%)" }}
      />
      <div
        className="absolute -bottom-48 -right-32 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(217,168,67,0.10) 0%, transparent 60%)" }}
      />
      {/* 模拟充电站的散点灯光 (辅助蓝) */}
      {[
        { top: "18%", left: "12%", d: "0s" }, { top: "30%", left: "78%", d: "1.2s" },
        { top: "66%", left: "8%", d: "2.1s" }, { top: "80%", left: "82%", d: "0.6s" },
        { top: "12%", left: "58%", d: "1.8s" }, { top: "58%", left: "90%", d: "2.6s" },
        { top: "84%", left: "34%", d: "0.9s" }, { top: "24%", left: "36%", d: "3.2s" },
      ].map((p, i) => (
        <span
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full pointer-events-none animate-status-pulse"
          style={{ top: p.top, left: p.left, background: "rgba(90,123,160,0.45)", animationDelay: p.d }}
        />
      ))}

      <div className="relative w-full max-w-[420px]">
        {/* ===== 品牌 logo 标题 (浅蓝底 + 黑色闪电) ===== */}
        <div className="mb-7 flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #EAF2F8 0%, #D6E6F2 100%)",
              border: "1px solid rgba(90,123,160,0.28)",
              boxShadow: "0 2px 8px rgba(27,42,74,0.10), inset 0 1px 1px rgba(255,255,255,0.8)",
            }}
          >
            <Zap className="w-5 h-5" style={{ color: "#1B2A4A" }} fill="#1B2A4A" />
          </div>
          <div className="leading-none">
            <h1 className="text-[19px] font-bold tracking-tight" style={{ color: "#1B2A4A" }}>GeoPlan</h1>
            <p className="text-[11px] mt-[5px] tracking-wide" style={{ color: "#7A8A9A" }}>充电设施智能规划平台</p>
          </div>
        </div>

        {/* ===== 登录卡: 白色卡片 (液态玻璃高光 + 金色描边点缀) ===== */}
        <div
          className="rounded-[22px] p-7 animate-panel-enter"
          style={{
            background: "linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.92) 100%)",
            backdropFilter: "blur(24px) saturate(1.5)",
            WebkitBackdropFilter: "blur(24px) saturate(1.5)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow:
              "0 24px 64px -16px rgba(27,42,74,0.18), 0 4px 16px -4px rgba(27,42,74,0.08), inset 0 1.5px 1px -0.5px rgba(255,255,255,1)",
          }}
        >
          {/* 卡片标题 + 状态指示 (金色装饰细线) */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: "#1B2A4A" }}>登录账户</h2>
              <p className="text-[12px] mt-0.5" style={{ color: "#7A8A9A" }}>徐州新能源充电设施规划平台</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-status-pulse" style={{ background: "#D9A843" }} />
              <span className="text-[10px]" style={{ color: "#7A8A9A" }}>服务正常</span>
            </div>
          </div>
          {/* 金色装饰细线 */}
          <div className="h-px mb-6" style={{ background: "linear-gradient(90deg, #D9A843 0%, rgba(217,168,67,0.15) 60%, transparent 100%)" }} />

          <div className="space-y-4">
            {/* 输入框: 白色卡片内嵌, 辅助蓝图标 */}
            {([
              { field: "username" as const, label: "用户名", placeholder: "输入用户名", type: "text" },
              { field: "password" as const, label: "密码", placeholder: "输入密码", type: "password" },
            ]).map(f => (
              <div key={f.field}>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "#5A7BA0" }}>{f.label}</label>
                <input
                  type={f.type}
                  value={loginForm[f.field]}
                  onChange={(e) => onLoginFormChange(f.field, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onLogin()}
                  placeholder={f.placeholder}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-[#7A8A9A]"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(90,123,160,0.22)",
                    boxShadow: "inset 0 1px 2px rgba(27,42,74,0.05)",
                    color: "#1B2A4A",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#5A7BA0";
                    e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(27,42,74,0.05), 0 0 0 3px rgba(90,123,160,0.12)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(90,123,160,0.22)";
                    e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(27,42,74,0.05)";
                  }}
                />
              </div>
            ))}

            {loginError && (
              <div
                className="text-[12px] rounded-xl px-3 py-2 flex items-start gap-2"
                style={{
                  background: "rgba(217,168,67,0.10)",
                  border: "1px solid rgba(217,168,67,0.4)",
                  color: "#8A6A1F",
                }}
              >
                <span className="mt-0.5">⚠</span>
                <span className="flex-1">{loginError}</span>
              </div>
            )}

            {/* 登录按钮: 主色深蓝 */}
            <button
              onClick={onLogin}
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(180deg, #24365C 0%, #1B2A4A 55%, #16223C 100%)",
                color: "#fff",
                border: "1px solid rgba(27,42,74,0.8)",
                boxShadow: "0 8px 24px -6px rgba(27,42,74,0.45), inset 0 1px 1px rgba(255,255,255,0.18)",
              }}
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>验证中...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>登录系统</span>
                  <span className="text-[10px] opacity-60 ml-1 font-mono">↵</span>
                </>
              )}
            </button>
          </div>

          {/* 演示账号: 白色内嵌列表 */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(90,123,160,0.14)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px]" style={{ color: "#7A8A9A" }}>演示账号</p>
              <span className="text-[10px]" style={{ color: "#7A8A9A" }}>点击填充</span>
            </div>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map(acc => {
                const cfg = ROLE_CONFIG[acc.role];
                return (
                  <button
                    key={acc.username}
                    onClick={() => onFillDemo(acc.username, acc.password)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(90,123,160,0.16)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#EAF2F8";
                      e.currentTarget.style.borderColor = "rgba(90,123,160,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#FFFFFF";
                      e.currentTarget.style.borderColor = "rgba(90,123,160,0.16)";
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}80` }}
                    />
                    <span className="text-[12px] flex-1" style={{ color: "#1B2A4A" }}>{acc.username}</span>
                    <span className="text-[10px] font-mono" style={{ color: "#7A8A9A" }}>{acc.password}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}44` }}
                    >
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px]" style={{ color: "#7A8A9A" }}>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" style={{ color: "#D9A843" }} />
            <span>安全连接</span>
          </span>
          <span>·</span>
          <span>空间数据库</span>
        </div>
      </div>
    </div>
  );
}
