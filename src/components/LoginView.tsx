import React, { useState } from "react";
import { Zap, RefreshCw, LogIn, ShieldCheck, UserPlus, Check } from "lucide-react";
import { DEMO_ACCOUNTS, ROLE_CONFIG, type UserRole } from "../types";

export interface RegisterFormValues {
  username: string;
  password: string;
  role: UserRole;
}

interface LoginViewProps {
  loginForm: { username: string; password: string };
  onLoginFormChange: (field: "username" | "password", value: string) => void;
  loginError: string;
  loginLoading: boolean;
  onLogin: () => void;
  onFillDemo: (username: string, password: string) => void;
  onRegister: (form: RegisterFormValues) => Promise<{ success: boolean; message?: string }>;
}

/**
 * 背景视频路径（可配置）：优先读取 VITE_LOGIN_BG_VIDEO 环境变量，缺省用 public/videos 下的默认视频。
 * vite 会将 public/ 下的文件原样暴露到站点根路径，因此用绝对路径 "/videos/ev-charge-200682.mp4" 访问。
 */
const LOGIN_BG_VIDEO: string = (import.meta.env.VITE_LOGIN_BG_VIDEO as string | undefined) || "/videos/ev-charge-200682.mp4";

/** 顶部导航：项目 / 关于 / GitHub（GitHub 即“联系我们”，两个仓库直链） */
interface NavItemSimple {
  key: string;
  label: string;
}

const NAV_ITEMS: NavItemSimple[] = [
  { key: "about", label: "关于" },
  { key: "contact", label: "联系我们" },
];

/** 关于面板内容（点击“关于”时展示，真实、朴实） */
const ABOUT_CONTENT: { title: string; body: string[] } = {
  title: "关于本项目",
  body: [
    "GeoPlan 是一个基于 WebGIS 的新能源充电设施规划与决策支持平台，面向徐州市，整合充电站与住宅小区空间数据，提供地图展示、充电覆盖分析、商业选址决策、公众反馈、系统管理与 AI 辅助决策等功能。",
  ],
};

/**
 * 登录/注册页面（大疆/卓驭风格：全屏视频背景 + 浅色科技感蒙层 + 右侧卡片）
 * - 主色 #1B2A4A: 标题 / 登录按钮 / logo 闪电
 * - 辅助色 #5A7BA0: 输入框图标 / 占位文字
 * - 点缀色 #D9A843: 描边 / 装饰细线
 * - 左侧: 品牌主标题区（logo + 大字标语 + 副标题）
 * - 右侧: 登录/注册卡片（白色实底 + 轻玻璃感）
 */
export default function LoginView({
  loginForm,
  onLoginFormChange,
  loginError,
  loginLoading,
  onLogin,
  onFillDemo,
  onRegister,
}: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    role: null as UserRole | null,
  });
  const [registerError, setRegisterError] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [showAbout, setShowAbout] = useState(false);
  const [hoveredContact, setHoveredContact] = useState(false);
  

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setRegisterError("");
    setRegisterSuccess("");
  };

  const handleRegisterSubmit = async () => {
    setRegisterError("");
    const { username, password, confirmPassword, role } = registerForm;
    if (!username.trim()) return setRegisterError("请输入用户名");
    if (username.trim().length < 2) return setRegisterError("用户名至少 2 个字符");
    if (!password) return setRegisterError("请输入密码");
    if (password.length < 6) return setRegisterError("密码长度至少 6 位");
    if (password !== confirmPassword) return setRegisterError("两次输入的密码不一致");
    if (!role) return setRegisterError("请选择注册角色");
    setRegisterLoading(true);
    try {
      const result = await onRegister({ username: username.trim(), password, role });
      if (result.success) {
        // 注册成功：切回登录态并预填账号（App 层已自动登录）
        setRegisterSuccess(`注册成功，账号「${username.trim()}」已创建`);
        setRegisterForm({ username: "", password: "", confirmPassword: "", role: null });
        switchMode("login");
        onLoginFormChange("username", username.trim());
        onLoginFormChange("password", password);
      } else {
        setRegisterError(result.message || "注册失败，请稍后重试");
      }
    } catch {
      setRegisterError("网络错误，请检查服务是否启动");
    }
    setRegisterLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid rgba(90,123,160,0.22)",
    boxShadow: "inset 0 1px 2px rgba(27,42,74,0.05)",
    color: "#1B2A4A",
  };
  const inputClass =
    "w-full text-sm px-3 py-2.5 rounded-xl outline-none transition-all placeholder:text-[#7A8A9A]";

  const renderField = (
    label: string,
    placeholder: string,
    type: string,
    value: string,
    onChange: (v: string) => void,
    onEnter?: () => void,
  ) => (
    <div>
      <label className="text-[11px] font-medium block mb-1.5" style={{ color: "#5A7BA0" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        className={inputClass}
        style={inputStyle}
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
  );

  return (
    <div
      className="relative min-h-screen flex overflow-hidden no-select"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* ===== 1. 全屏循环视频背景 ===== */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={LOGIN_BG_VIDEO}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* ===== 2. 浅色科技感蒙层: 左侧偏白保证品牌文字可读，右侧渐透明让视频透出 ===== */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(112deg, rgba(255,255,255,0.95) 0%, rgba(246,250,255,0.86) 30%, rgba(230,243,253,0.62) 62%, rgba(210,232,248,0.28) 100%)",
        }}
      />
      {/* 细网格: 保留地图/科技感 */}
      <div
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(27,42,74,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(27,42,74,0.10) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      {/* 顶部科技蓝光带 + 左上蓝色光斑 */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, rgba(27,42,74,0.45) 0%, rgba(90,123,160,0.15) 55%, transparent 100%)" }}
      />
      <div
        className="absolute -top-48 -left-48 w-[760px] h-[760px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(90,123,160,0.10) 0%, transparent 60%)" }}
      />

      {/* ===== 顶部导航: 关于 / 联系我们（联系我们为下拉·含两个 GitHub 链接） ===== */}
      <nav className="absolute inset-x-0 top-0 z-20 pointer-events-none">
        <div className="flex items-center justify-center w-full max-w-[1440px] mx-auto px-6 md:px-14 pt-5">
          <div className="flex items-center gap-2">
            {NAV_ITEMS.map((item) => {
              if (item.key === "contact") {
                return (
                  <div
                    key={item.key}
                    className="relative flex flex-col items-center"
                    onMouseEnter={() => setHoveredContact(true)}
                    onMouseLeave={() => setHoveredContact(false)}
                  >
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="pointer-events-auto flex items-center gap-1 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200"
                      style={{
                        color: hoveredContact ? "#1B2A4A" : "#3A4C6E",
                        background: hoveredContact ? "rgba(255,255,255,0.7)" : "transparent",
                      }}
                    >
                      {item.label}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        style={{ transform: hoveredContact ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </a>
                    {/* 下拉: 两个 GitHub 链接 */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full z-30"
                      style={{ opacity: hoveredContact ? 1 : 0, transform: `translateX(-50%) translateY(${hoveredContact ? 0 : -6}px)`, transition: "opacity 0.18s ease, transform 0.18s ease", pointerEvents: hoveredContact ? "auto" : "none", visibility: hoveredContact ? "visible" : "hidden" }}
                    >
                      <div className="h-[10px] w-full" />
                      <div
                        className="pointer-events-auto w-[190px] rounded-[14px] py-1.5"
                        style={{
                          background: "rgba(255,255,255,0.94)",
                          backdropFilter: "blur(16px) saturate(1.4)",
                          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
                          border: "1px solid rgba(90,123,160,0.18)",
                          boxShadow: "0 16px 40px -12px rgba(27,42,74,0.18), 0 2px 8px rgba(27,42,74,0.06)",
                        }}
                      >
                        <a
                          href="https://github.com/Hiloway"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 text-[13px] font-medium transition-colors duration-150"
                          style={{ color: "#1B2A4A" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#EAF2F8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          GitHub · Hiloway
                        </a>
                        <a
                          href="https://github.com/willingsss"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 text-[13px] font-medium transition-colors duration-150"
                          style={{ color: "#1B2A4A" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#EAF2F8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          GitHub · willingsss
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <a
                  key={item.key}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.key === "about") setShowAbout(true);
                  }}
                  className="pointer-events-auto px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200"
                  style={{ color: "#3A4C6E" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#1B2A4A")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#3A4C6E")}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ===== 3. 主体: 左品牌区 + 右登录卡片 ===== */}
      <div className="relative z-10 flex-1 flex items-center w-full max-w-[1440px] mx-auto px-6 md:px-14">

        {/* 左侧: 品牌主标题区（小屏隐藏，卡片自带精简品牌行） */}
        <div className="hidden md:block flex-1 pr-16 pt-20 pb-24">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #24365C 0%, #1B2A4A 100%)",
                border: "1px solid rgba(27,42,74,0.5)",
                boxShadow: "0 12px 28px -10px rgba(27,42,74,0.45), inset 0 1px 1px rgba(255,255,255,0.18)",
              }}
            >
              <Zap className="w-6 h-6" style={{ color: "#fff" }} fill="#fff" />
            </div>
            <div className="leading-none">
              <h1 className="text-[30px] font-bold tracking-tight" style={{ color: "#1B2A4A" }}>GeoPlan</h1>
              <p className="text-[13px] mt-[6px] tracking-wide" style={{ color: "#5A7BA0" }}>充电设施智能规划平台</p>
            </div>
          </div>

          <h2
            className="text-[52px] leading-[1.18] font-bold tracking-tight mt-20"
            style={{ color: "#1B2A4A", textShadow: "0 2px 24px rgba(255,255,255,0.6)" }}
          >
            驱动绿色出行
            <br />
            规划充电未来
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed max-w-[460px]" style={{ color: "#3A4C6E" }}>
            基于 WebGIS 的新能源充电设施规划与决策支持平台
          </p>
        </div>

        {/* 右侧: 登录/注册卡片 */}
        <div className="w-full md:w-[420px] shrink-0 md:mx-6 my-8 md:my-0 max-w-[420px] mx-auto md:mx-6">
          <div
            className="rounded-[24px] p-7 animate-panel-enter"
            style={{
              background: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.94) 100%)",
              backdropFilter: "blur(22px) saturate(1.35)",
              WebkitBackdropFilter: "blur(22px) saturate(1.35)",
              border: "1px solid rgba(255,255,255,0.95)",
              boxShadow:
                "0 32px 76px -22px rgba(27,42,74,0.22), 0 4px 18px -6px rgba(27,42,74,0.10), inset 0 1px 1px rgba(255,255,255,1)",
            }}
          >
            {/* 卡片内精简品牌行（小屏可见） */}
            <div className="mb-6 flex items-center gap-2.5 md:hidden">
              <div
                className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #24365C 0%, #1B2A4A 100%)" }}
              >
                <Zap className="w-4 h-4" style={{ color: "#fff" }} fill="#fff" />
              </div>
              <div className="leading-none">
                <h3 className="text-[18px] font-bold tracking-tight" style={{ color: "#1B2A4A" }}>GeoPlan</h3>
                <p className="text-[10.5px] mt-[4px] tracking-wide" style={{ color: "#7A8A9A" }}>充电设施智能规划平台</p>
              </div>
            </div>

            {/* ===== 登录 / 注册 切换 (分段控制器) ===== */}
            <div
              className="flex p-1 rounded-xl mb-5"
              style={{ background: "#EAF2F8", border: "1px solid rgba(90,123,160,0.16)" }}
            >
              {([
                { key: "login" as const, label: "登录" },
                { key: "register" as const, label: "注册" },
              ]).map(tab => {
                const active = mode === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => switchMode(tab.key)}
                    className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                    style={
                      active
                        ? {
                            background: "#FFFFFF",
                            color: "#1B2A4A",
                            boxShadow: "0 2px 8px rgba(27,42,74,0.10), inset 0 1px 1px rgba(255,255,255,0.9)",
                          }
                        : { background: "transparent", color: "#7A8A9A" }
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* 卡片标题 + 状态指示 (金色装饰细线) */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: "#1B2A4A" }}>
                  {mode === "login" ? "登录账户" : "注册新账户"}
                </h2>
                <p className="text-[12px] mt-0.5" style={{ color: "#7A8A9A" }}>
                  {mode === "login" ? "徐州新能源充电设施规划平台" : "选择角色创建账号，注册后自动登录"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-status-pulse" style={{ background: "#D9A843" }} />
                <span className="text-[10px]" style={{ color: "#7A8A9A" }}>服务正常</span>
              </div>
            </div>
            {/* 金色装饰细线 */}
            <div className="h-px mb-6" style={{ background: "linear-gradient(90deg, #D9A843 0%, rgba(217,168,67,0.15) 60%, transparent 100%)" }} />

            {mode === "login" ? (
              <div className="space-y-4">
                {/* 注册成功提示 (绿色) */}
                {registerSuccess && !loginError && (
                  <div
                    className="text-[12px] rounded-xl px-3 py-2 flex items-start gap-2"
                    style={{
                      background: "rgba(0,200,150,0.08)",
                      border: "1px solid rgba(0,200,150,0.35)",
                      color: "#0B7A5C",
                    }}
                  >
                    <span className="mt-0.5">✓</span>
                    <span className="flex-1">{registerSuccess}</span>
                  </div>
                )}

                {renderField("用户名", "输入用户名", "text", loginForm.username,
                  (v) => onLoginFormChange("username", v), onLogin)}
                {renderField("密码", "输入密码", "password", loginForm.password,
                  (v) => onLoginFormChange("password", v), onLogin)}

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
            ) : (
              <div className="space-y-4">
                {/* ===== 注册表单: 用户名 + 密码 + 确认密码 + 角色选择 ===== */}
                {renderField("用户名", "2-20 个字符", "text", registerForm.username,
                  (v) => setRegisterForm(p => ({ ...p, username: v })), handleRegisterSubmit)}
                {renderField("密码", "至少 6 位密码", "password", registerForm.password,
                  (v) => setRegisterForm(p => ({ ...p, password: v })), handleRegisterSubmit)}
                {renderField("确认密码", "再次输入密码", "password", registerForm.confirmPassword,
                  (v) => setRegisterForm(p => ({ ...p, confirmPassword: v })), handleRegisterSubmit)}

                {/* 角色选择: 两种可注册角色（管理员为系统内置唯一账号，不支持注册） */}
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "#5A7BA0" }}>注册角色</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(ROLE_CONFIG) as UserRole[]).filter(r => r !== "管理员").map(role => {
                      const cfg = ROLE_CONFIG[role];
                      const selected = registerForm.role === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setRegisterForm(p => ({ ...p, role }))}
                          className="relative flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all"
                          style={{
                            background: selected ? cfg.color + "14" : "#FFFFFF",
                            border: `1px solid ${selected ? cfg.color + "99" : "rgba(90,123,160,0.16)"}`,
                            boxShadow: selected ? `0 0 0 3px ${cfg.color}1F` : "inset 0 1px 2px rgba(27,42,74,0.04)",
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}80` }}
                            />
                            <span className="text-[11px] font-semibold" style={{ color: selected ? "#1B2A4A" : "#5A7BA0" }}>
                              {role}
                            </span>
                          </span>
                          {selected && (
                            <span
                              className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                              style={{ background: cfg.color }}
                            >
                              <Check className="w-2 h-2" style={{ color: "#fff" }} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* 已选角色的权限说明 */}
                  <p className="text-[10.5px] mt-1.5 leading-relaxed" style={{ color: "#7A8A9A" }}>
                    {registerForm.role ? ROLE_CONFIG[registerForm.role].desc : "请选择注册角色，不同角色拥有不同功能权限"}
                  </p>
                </div>

                {registerError && (
                  <div
                    className="text-[12px] rounded-xl px-3 py-2 flex items-start gap-2"
                    style={{
                      background: "rgba(217,168,67,0.10)",
                      border: "1px solid rgba(217,168,67,0.4)",
                      color: "#8A6A1F",
                    }}
                  >
                    <span className="mt-0.5">⚠</span>
                    <span className="flex-1">{registerError}</span>
                  </div>
                )}

                {/* 注册按钮: 主色深蓝 */}
                <button
                  onClick={handleRegisterSubmit}
                  disabled={registerLoading}
                  className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{
                    background: "linear-gradient(180deg, #24365C 0%, #1B2A4A 55%, #16223C 100%)",
                    color: "#fff",
                    border: "1px solid rgba(27,42,74,0.8)",
                    boxShadow: "0 8px 24px -6px rgba(27,42,74,0.45), inset 0 1px 1px rgba(255,255,255,0.18)",
                  }}
                >
                  {registerLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>创建中...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>注册并登录</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center" style={{ color: "#7A8A9A" }}>
                  已有账号？
                  <button
                    onClick={() => switchMode("login")}
                    className="ml-1 font-medium"
                    style={{ color: "#1B2A4A", textDecoration: "underline", textDecorationColor: "rgba(27,42,74,0.4)" }}
                  >
                    返回登录
                  </button>
                </p>
              </div>
            )}

            {/* 演示账号: 白色内嵌列表 (仅登录模式) */}
            {mode === "login" && (
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
            )}
          </div>

          {/* 卡片下方底部信息（小屏时品牌区隐藏，这里提供说明行） */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] md:hidden" style={{ color: "#7A8A9A" }}>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" style={{ color: "#D9A843" }} />
              <span>安全连接</span>
            </span>
            <span>·</span>
            <span>空间数据库</span>
          </div>
        </div>
      </div>
    {/* ===== 帮助中心内容浮层 ===== */}
      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(27,42,74,0.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowAbout(false)}
        >
          <div
            className="w-full max-w-[540px] rounded-[22px] p-7 animate-panel-enter"
            style={{
              background: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.96) 100%)",
              border: "1px solid rgba(90,123,160,0.18)",
              boxShadow: "0 32px 76px -22px rgba(27,42,74,0.30), 0 4px 18px -6px rgba(27,42,74,0.12)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-bold tracking-tight" style={{ color: "#1B2A4A" }}>
                {ABOUT_CONTENT.title}
              </h3>
              <button
                onClick={() => setShowAbout(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors"
                style={{ background: "#EAF2F8", color: "#5A7BA0", border: "1px solid rgba(90,123,160,0.14)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#D6E6F2"; e.currentTarget.style.color = "#1B2A4A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#EAF2F8"; e.currentTarget.style.color = "#5A7BA0"; }}
              >
                ✕
              </button>
            </div>
            <div className="h-px mb-4" style={{ background: "linear-gradient(90deg, #D9A843 0%, rgba(217,168,67,0.15) 60%, transparent 100%)" }} />
            <div className="space-y-3">
              {ABOUT_CONTENT.body.map((line, k) => (
                <p key={k} className="text-[13px] leading-relaxed" style={{ color: "#3A4C6E" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}