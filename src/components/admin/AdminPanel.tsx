// AdminPanel.tsx
// 系统管理子系统 - 容器组件 (Tab 导航 + 数据概览/站点/用户/反馈/方案/日志/等时圈)
// 拆分自 App.tsx; 状态封装在 useAdminPanel hook, 展示组件纯 props 化
import {
  Settings, RefreshCw, Zap, User as UserIcon, MessageSquare, Target, Database,
  FileText, Activity, CheckCircle2, Clock, AlertCircle, RotateCcw, Plus, Edit, Search, ShieldCheck, Trash2, BarChart3,
} from "lucide-react";
import { BRAND_CONFIG, BRANDS, ROLE_CONFIG, UserRole } from "../../types";
import useAdminPanel from "../../hooks/useAdminPanel";
import StationEditModal from "./StationEditModal";
import ReportCenter from "../ReportCenter";

interface AdminPanelProps {
  authFetch: (url: string, init?: any) => Promise<Response>;
  showToast: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
  asArray: (value: any) => any[];
  normalizeStations: (data: any) => any[];
  activeTab: string;
}

export default function AdminPanel({ authFetch, showToast, asArray, normalizeStations, activeTab }: AdminPanelProps) {
  const {
    adminTab, setAdminTab,
    users, logs,
    adminStations, adminFeedback, adminSchemes,
    adminSearch, setAdminSearch,
    adminEditing, setAdminEditing,
    adminLogFilter, setAdminLogFilter,
    isochroneProgress, isochronePolling,
    loadAdminData, fetchIsochroneProgress, triggerIsochronePrecompute,
  } = useAdminPanel({ authFetch, showToast, asArray, normalizeStations, activeTab });

  const safeText = (value: any) => String(value ?? "");

  return (
    <>
          {activeTab === "admin" && (
              <div
                className="absolute inset-0 z-30 flex flex-col overflow-hidden"
                style={{ background: "var(--color-canvas)" }}
              >
                {/* 管理界面标题栏 - Linear 风: 紧凑, 单色边框 */}
                <div
                  className="px-5 py-3 flex items-center justify-between shrink-0"
                  style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-muted)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                    >
                      <Settings className="w-4 h-4" style={{ color: "var(--color-ink-2)" }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-ink-1)" }}>系统管理控制台</h3>
                      <span
                        className="text-[10px] px-1.5 py-0 rounded"
                        style={{
                          background: "var(--color-grape-subtle)",
                          color: "var(--color-grape)",
                          border: "1px solid var(--color-grape-border)",
                        }}
                      >
                        管理员
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={loadAdminData}
                    className="btn-brand text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> 刷新
                  </button>
                </div>

                {/* 分类 Tab 栏 - Linear 风: 下划线指示器, 等宽标签 */}
                <div
                  className="px-5 flex gap-0 shrink-0"
                  style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-muted)" }}
                >
                  {([
                    { key: "overview", label: "概览", icon: BarChart3 },
                    { key: "stations", label: "充电站", icon: Zap },
                    { key: "users", label: "用户", icon: UserIcon },
                    { key: "feedback", label: "反馈", icon: MessageSquare },
                    { key: "schemes", label: "方案", icon: Target },
                    { key: "logs", label: "日志", icon: Database },
                    { key: "report", label: "统计报表", icon: FileText },
                    { key: "isochrone", label: "等时圈", icon: Activity },
                  ] as const).map(t => {
                    const Icon = t.icon;
                    const isActive = adminTab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setAdminTab(t.key)}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors relative"
                        style={{
                          color: isActive ? "var(--color-ink-1)" : "var(--color-ink-4)",
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: isActive ? "var(--color-brand)" : "var(--color-ink-5)" }} />
                        {t.label}
                        {isActive && (
                          <span
                            className="absolute left-0 right-0 -bottom-px"
                            style={{ height: 2, background: "var(--color-brand)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 管理内容区 - Linear 风: 紧凑 padding */}
                <div className="flex-1 overflow-auto p-5">

                  {/* ===== 数据概览 - 卡片网格优先 ===== */}
                  {adminTab === "overview" && (
                    <div className="space-y-4 animate-fade-in">
                      {/* 统计卡片 - 大数字 + 图标芯片 + 趋势色 */}
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          { label: "充电站总数", value: adminStations.length, color: "var(--color-brand)", icon: Zap, sub: "活跃站点" },
                          { label: "注册用户", value: users.length, color: "var(--color-accent)", icon: UserIcon, sub: "全角色" },
                          { label: "反馈数据", value: adminFeedback.length, color: "var(--color-warning)", icon: MessageSquare, sub: "评价+需求" },
                          { label: "选址方案", value: adminSchemes.length, color: "var(--color-grape)", icon: Target, sub: "已保存" },
                          { label: "系统日志", value: logs.length, color: "var(--color-danger)", icon: Database, sub: "操作记录" },
                        ].map(s => {
                          const Icon = s.icon;
                          return (
                            <div
                              key={s.label}
                              className="rounded-lg p-3.5 transition-shadow hover:shadow-md"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-medium" style={{ color: "var(--color-ink-4)" }}>{s.label}</span>
                                <div
                                  className="w-7 h-7 rounded-md flex items-center justify-center"
                                  style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                                >
                                  <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                </div>
                              </div>
                              <p className="text-[28px] font-bold font-num leading-none" style={{ color: "var(--color-ink-1)" }}>{s.value}</p>
                              <p className="text-[10px] mt-1.5 font-mono" style={{ color: "var(--color-ink-5)" }}>{s.sub}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* 充电站品牌分布 + 行政区分布 - 卡片网格 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>充电站品牌分布</h4>
                            <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>{adminStations.length} 总数</span>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(
                              adminStations.reduce((acc: any, s: any) => {
                                acc[s.brand] = (acc[s.brand] || 0) + 1;
                                return acc;
                              }, {})
                            ).sort((a: any, b: any) => b[1] - a[1]).map(([brand, count]: any) => {
                              const pct = adminStations.length ? (count / adminStations.length) * 100 : 0;
                              return (
                                <div key={brand} className="flex items-center gap-2.5">
                                  <span className="text-[11px] w-20 truncate" style={{ color: "var(--color-ink-3)" }}>{brand}</span>
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, background: BRAND_CONFIG[brand]?.color || "var(--color-ink-5)" }} />
                                  </div>
                                  <span className="text-[11px] font-num font-semibold w-6 text-right" style={{ color: "var(--color-ink-2)" }}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="rounded-lg p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>行政区充电站分布</h4>
                            <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>按数量排序</span>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(
                              adminStations.reduce((acc: any, s: any) => {
                                acc[s.district] = (acc[s.district] || 0) + 1;
                                return acc;
                              }, {})
                            ).sort((a: any, b: any) => b[1] - a[1]).map(([district, count]: any) => {
                              const pct = adminStations.length ? (count / adminStations.length) * 100 : 0;
                              return (
                                <div key={district} className="flex items-center gap-2.5">
                                  <span className="text-[11px] w-16 truncate" style={{ color: "var(--color-ink-3)" }}>{district}</span>
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, background: "var(--color-accent)" }} />
                                  </div>
                                  <span className="text-[11px] font-num font-semibold w-6 text-right" style={{ color: "var(--color-ink-2)" }}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 最近系统日志 - 时间线卡片 */}
                      <div className="rounded-lg p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>最近系统操作</h4>
                          <button onClick={() => setAdminTab("logs")} className="text-[11px] font-medium hover:underline" style={{ color: "var(--color-brand-text)" }}>
                            查看全部 →
                          </button>
                        </div>
                        <div className="space-y-0 max-h-56 overflow-y-auto">
                          {logs.slice(0, 8).map((l, idx) => (
                            <div
                              key={l.id}
                              className="flex items-center gap-3 text-[11px] py-2"
                              style={{ borderBottom: idx < Math.min(logs.length, 8) - 1 ? "1px solid var(--color-subtle)" : "none" }}
                            >
                              <span className="font-num w-32 shrink-0" style={{ color: "var(--color-ink-5)" }}>{l.create_time}</span>
                              <span
                                className="px-1.5 py-0 rounded font-medium w-16 text-center shrink-0 font-mono text-[10px]"
                                style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)" }}
                              >
                                {l.action}
                              </span>
                              <span className="flex-1 truncate" style={{ color: "var(--color-ink-3)" }}>{l.detail}</span>
                              <span className="shrink-0" style={{ color: "var(--color-ink-5)" }}>— {l.user}</span>
                            </div>
                          ))}
                          {logs.length === 0 && (
                            <div className="py-8 text-center">
                              <Database className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                              <p className="text-[11px]" style={{ color: "var(--color-ink-5)" }}>暂无日志记录</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===== 充电站管理 - 卡片堆叠 ===== */}
                  {adminTab === "stations" && (
                    <div className="animate-fade-in">
                      {/* 工具栏 */}
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>充电站</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>
                            {adminStations.filter((s: any) => {
                              if (!adminSearch) return true;
                              const q = adminSearch.toLowerCase();
                              return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                            }).length} / {adminStations.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-ink-5)" }} />
                            <input
                              type="text"
                              placeholder="搜索名称/品牌/区域..."
                              value={adminSearch}
                              onChange={(e) => setAdminSearch(e.target.value)}
                              className="input-sys text-xs pl-8 pr-3 py-1.5 w-56"
                            />
                          </div>
                          <button
                            onClick={() => setAdminEditing({})}
                            className="btn-brand text-xs px-3 py-1.5 rounded-md flex items-center gap-1 font-medium"
                          >
                            <span className="text-sm leading-none">+</span> 新增
                          </button>
                        </div>
                      </div>

                      {/* 卡片网格 */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {adminStations.filter((s: any) => {
                          if (!adminSearch) return true;
                          const q = adminSearch.toLowerCase();
                          return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                        }).map((s: any) => {
                          const isActive = s.status === "运营中";
                          return (
                            <div
                              key={s.id}
                              className="rounded-lg p-3 transition-shadow hover:shadow-md group"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              {/* 顶部: 名称 + 状态 */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--color-ink-5)" }}>#{s.id}</span>
                                    {isActive && <span className="w-1.5 h-1.5 rounded-full animate-status-pulse" style={{ background: "var(--color-success)" }} />}
                                  </div>
                                  <h5 className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{s.name}</h5>
                                </div>
                                <span
                                  className="text-[10px] px-1.5 py-0 rounded font-medium shrink-0 font-mono"
                                  style={{
                                    background: isActive ? "var(--color-brand-subtle)" : "rgba(245,158,11,0.08)",
                                    color: isActive ? "var(--color-brand-text)" : "var(--color-warning)",
                                    border: "1px solid " + (isActive ? "var(--color-brand-border)" : "rgba(245,158,11,0.25)"),
                                  }}
                                >
                                  {s.status}
                                </span>
                              </div>
                              {/* 中部: 品牌 + 行政区 */}
                              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                <span
                                  className="text-[10px] px-1.5 py-0 rounded font-medium"
                                  style={{ background: (BRAND_CONFIG[s.brand]?.color || "#909399") + "15", color: BRAND_CONFIG[s.brand]?.color || "#909399" }}
                                >
                                  {s.brand}
                                </span>
                                <span className="text-[10px]" style={{ color: "var(--color-ink-4)" }}>· {s.district}</span>
                              </div>
                              {/* 底部: 充电桩数 + 坐标 */}
                              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                                <div className="flex items-center gap-3 text-[11px]">
                                  <span className="flex items-center gap-1">
                                    <Zap className="w-3 h-3" style={{ color: "var(--color-brand)" }} />
                                    <span className="font-num font-semibold" style={{ color: "var(--color-ink-2)" }}>{s.fastChargers}</span>
                                    <span style={{ color: "var(--color-ink-5)" }}>快</span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full inline-block" style={{ border: "1.5px solid var(--color-accent)" }} />
                                    <span className="font-num font-semibold" style={{ color: "var(--color-ink-2)" }}>{s.slowChargers}</span>
                                    <span style={{ color: "var(--color-ink-5)" }}>慢</span>
                                  </span>
                                </div>
                                <span className="text-[9px] font-num" style={{ color: "var(--color-ink-5)" }}>
                                  {Number(s.lng).toFixed(4)}, {Number(s.lat).toFixed(4)}
                                </span>
                              </div>
                              {/* 操作按钮 - hover 显示 */}
                              <div className="flex gap-1 mt-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                                <button
                                  onClick={() => setAdminEditing(s)}
                                  className="flex-1 text-[11px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-1"
                                  style={{ background: "var(--color-subtle)", color: "var(--color-ink-3)" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-brand-subtle)"; e.currentTarget.style.color = "var(--color-brand-text)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-3)"; }}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`确定删除充电站「${s.name}」?`)) return;
                                    const r = await authFetch(`/api/v1/stations/${s.id}`, { method: "DELETE" });
                                    const j = await r.json();
                                    if (j.success) { loadAdminData(); alert("已删除"); }
                                    else alert(j.message);
                                  }}
                                  className="flex-1 text-[11px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-1"
                                  style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "var(--color-danger)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {adminStations.filter((s: any) => {
                          if (!adminSearch) return true;
                          const q = adminSearch.toLowerCase();
                          return safeText(s.name).toLowerCase().includes(q) || safeText(s.brand).toLowerCase().includes(q) || safeText(s.district).includes(adminSearch);
                        }).length === 0 && (
                          <div className="col-span-full py-12 text-center">
                            <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>未找到匹配的充电站</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 用户管理 - 卡片网格 ===== */}
                  {adminTab === "users" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>用户</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{users.length}</span>
                        </div>
                        <button
                          onClick={() => setAdminEditing({ _type: "user" })}
                          className="btn-brand text-xs px-3 py-1.5 rounded-md flex items-center gap-1 font-medium"
                        >
                          <span className="text-sm leading-none">+</span> 新增用户
                        </button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {users.map(u => {
                          const isNormal = u.status === "正常";
                          const roleColor = ROLE_CONFIG[u.role as UserRole]?.color || "var(--color-ink-5)";
                          const isAdmin = u.username === "admin";
                          return (
                            <div
                              key={u.id}
                              className="rounded-lg p-3 transition-shadow hover:shadow-md group"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              <div className="flex items-start gap-2.5 mb-2.5">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold font-mono"
                                  style={{ background: roleColor + "15", color: roleColor, border: "1px solid " + roleColor + "30" }}
                                >
                                  {u.username.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <h5 className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{u.username}</h5>
                                    {isAdmin && <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: "var(--color-grape)" }} />}
                                  </div>
                                  <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>#{u.id}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                <span
                                  className="text-[10px] px-1.5 py-0 rounded font-medium"
                                  style={{ background: roleColor + "15", color: roleColor }}
                                >
                                  {ROLE_CONFIG[u.role as UserRole]?.label || u.role}
                                </span>
                                <span className="flex items-center gap-1 text-[10px]" style={{ color: isNormal ? "var(--color-success)" : "var(--color-danger)" }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isNormal ? "var(--color-success)" : "var(--color-danger)" }} />
                                  {u.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--color-subtle)" }}>
                                <span className="text-[10px] font-num" style={{ color: "var(--color-ink-5)" }}>{u.create_time}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setAdminEditing({ ...u, _type: "user" })}
                                    className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                                    style={{ background: "var(--color-subtle)", color: "var(--color-ink-3)" }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-brand-subtle)"; e.currentTarget.style.color = "var(--color-brand-text)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-3)"; }}
                                  >
                                    编辑
                                  </button>
                                  {!isAdmin && (
                                    <button
                                      onClick={async () => {
                                        if (!confirm(`确定删除用户「${u.username}」?`)) return;
                                        const r = await authFetch(`/api/v1/users/${u.id}`, { method: "DELETE" });
                                        const j = await r.json();
                                        if (j.success) { loadAdminData(); alert("已删除"); }
                                        else alert(j.message);
                                      }}
                                      className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                                      style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "var(--color-danger)"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-4)"; }}
                                    >
                                      删除
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ===== 反馈管理 - 卡片列表 ===== */}
                  {adminTab === "feedback" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>反馈</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{adminFeedback.length}</span>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm("确定清空所有违禁驳回的反馈?")) return;
                            const r = await authFetch("/api/v1/feedback/rejected/clear", { method: "DELETE" });
                            const j = await r.json();
                            if (j.success) { loadAdminData(); alert(j.message); }
                            else alert(j.message);
                          }}
                          className="text-xs px-3 py-1.5 rounded-md flex items-center gap-1 font-medium transition-colors"
                          style={{ background: "rgba(239,68,68,0.06)", color: "var(--color-danger)", border: "1px solid rgba(239,68,68,0.2)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                        >
                          <Trash2 className="w-3 h-3" /> 清空违禁
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {adminFeedback.map(f => {
                          const isApproved = f.status === "approved";
                          const isEvaluation = f.type === "evaluation";
                          return (
                            <div
                              key={f.id}
                              className="rounded-lg p-3 group transition-shadow hover:shadow-md"
                              style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="shrink-0 flex flex-col items-center gap-1">
                                  <div
                                    className="w-7 h-7 rounded-md flex items-center justify-center"
                                    style={{ background: isEvaluation ? "var(--color-accent-subtle)" : "rgba(245,158,11,0.08)", border: "1px solid " + (isEvaluation ? "var(--color-accent-border)" : "rgba(245,158,11,0.2)") }}
                                  >
                                    {isEvaluation ? <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} /> : <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--color-warning)" }} />}
                                  </div>
                                  <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>#{f.id}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span
                                      className="text-[10px] px-1.5 py-0 rounded font-medium font-mono"
                                      style={{
                                        background: isEvaluation ? "var(--color-accent-subtle)" : "rgba(245,158,11,0.08)",
                                        color: isEvaluation ? "var(--color-accent)" : "var(--color-warning)",
                                      }}
                                    >
                                      {isEvaluation ? "评价" : "需求"}
                                    </span>
                                    {f.rating > 0 && (
                                      <span className="text-[10px]" style={{ color: "var(--color-warning)" }}>{"★".repeat(Math.min(f.rating, 5))}</span>
                                    )}
                                    <span
                                      className="text-[10px] px-1.5 py-0 rounded font-medium ml-auto"
                                      style={{
                                        background: isApproved ? "var(--color-brand-subtle)" : "rgba(239,68,68,0.08)",
                                        color: isApproved ? "var(--color-brand-text)" : "var(--color-danger)",
                                      }}
                                    >
                                      {isApproved ? "已通过" : "违禁驳回"}
                                    </span>
                                  </div>
                                  <p className="text-[12px] mb-1.5 leading-relaxed" style={{ color: "var(--color-ink-2)" }}>{f.description}</p>
                                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--color-ink-5)" }}>
                                    <div className="flex items-center gap-2">
                                      <span style={{ color: "var(--color-ink-4)" }}>{f.submitter}</span>
                                      <span>·</span>
                                      <span className="font-num">{f.create_time}</span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (!confirm("确定删除该反馈?")) return;
                                        const r = await authFetch(`/api/v1/feedback/${f.id}`, { method: "DELETE" });
                                        const j = await r.json();
                                        if (j.success) { loadAdminData(); alert("已删除"); }
                                        else alert(j.message);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded font-medium"
                                      style={{ background: "rgba(239,68,68,0.06)", color: "var(--color-danger)" }}
                                    >
                                      删除
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {adminFeedback.length === 0 && (
                          <div className="py-12 text-center">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>暂无反馈数据</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 方案管理 - 卡片网格 ===== */}
                  {adminTab === "schemes" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>选址方案</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{adminSchemes.length}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                        {adminSchemes.map(s => (
                          <div
                            key={s.id}
                            className="rounded-lg p-3 transition-shadow hover:shadow-md group"
                            style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>#{s.id}</span>
                                </div>
                                <h5 className="text-[13px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{s.name}</h5>
                              </div>
                              <span
                                className="text-[10px] px-1.5 py-0 rounded font-medium shrink-0"
                                style={{ background: (BRAND_CONFIG[s.brand]?.color || "#909399") + "15", color: BRAND_CONFIG[s.brand]?.color || "#909399" }}
                              >
                                {s.brand}
                              </span>
                            </div>
                            {/* 指标网格 */}
                            <div className="grid grid-cols-2 gap-2 mb-2.5 py-2" style={{ borderTop: "1px solid var(--color-subtle)", borderBottom: "1px solid var(--color-subtle)" }}>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>覆盖人口</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-ink-1)" }}>{s.covered_population}</p>
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>覆盖社区</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-ink-1)" }}>{s.covered_communities}</p>
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>盲区消除</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-success)" }}>{s.blind_spot_reduction}%</p>
                              </div>
                              <div>
                                <p className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>竞争避让</p>
                                <p className="text-[14px] font-bold font-num" style={{ color: "var(--color-accent)" }}>{s.competition_score}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-num" style={{ color: "var(--color-ink-5)" }}>{s.create_time}</span>
                              <button
                                onClick={async () => {
                                  if (!confirm(`确定删除方案「${s.name}」?`)) return;
                                  const r = await authFetch(`/api/v1/schemes/${s.id}`, { method: "DELETE" });
                                  const j = await r.json();
                                  if (j.success) { loadAdminData(); alert("已删除"); }
                                  else alert(j.message);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{ background: "rgba(239,68,68,0.06)", color: "var(--color-danger)" }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))}
                        {adminSchemes.length === 0 && (
                          <div className="col-span-full py-12 text-center">
                            <Target className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>暂无选址方案</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 系统日志 - 时间线列表 ===== */}
                  {adminTab === "logs" && (
                    <div className="animate-fade-in">
                      <div
                        className="rounded-lg px-4 py-3 mb-3 flex items-center justify-between"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>系统日志</h4>
                          <span className="text-[11px] font-num px-1.5 py-0 rounded" style={{ background: "var(--color-subtle)", color: "var(--color-ink-4)" }}>{logs.length}</span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {["all", "登录系统", "新增", "修改", "删除", "查询", "选址", "反馈"].map(f => {
                            const isActive = adminLogFilter === f;
                            return (
                              <button
                                key={f}
                                onClick={() => setAdminLogFilter(f)}
                                className="text-[11px] px-2.5 py-1 rounded font-medium transition-colors"
                                style={{
                                  background: isActive ? "var(--color-brand)" : "var(--color-subtle)",
                                  color: isActive ? "#fff" : "var(--color-ink-4)",
                                  border: "1px solid " + (isActive ? "var(--color-brand)" : "var(--color-muted)"),
                                }}
                              >
                                {f === "all" ? "全部" : f}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div
                        className="rounded-lg overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        {logs.filter(l => adminLogFilter === "all" || safeText(l.action).includes(adminLogFilter) || safeText(l.detail).includes(adminLogFilter)).map((l, idx, arr) => (
                          <div
                            key={l.id}
                            className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-subtle)]"
                            style={{ borderBottom: idx < arr.length - 1 ? "1px solid var(--color-subtle)" : "none" }}
                          >
                            {/* 时间线节点 */}
                            <div className="shrink-0 flex flex-col items-center pt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-brand)" }} />
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-3">
                              <span className="text-[10px] font-num shrink-0 w-32" style={{ color: "var(--color-ink-5)" }}>{l.create_time}</span>
                              <span
                                className="text-[10px] px-1.5 py-0 rounded font-medium shrink-0 font-mono"
                                style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)" }}
                              >
                                {l.action}
                              </span>
                              <span className="text-[11px] truncate flex-1" style={{ color: "var(--color-ink-3)" }}>{l.detail}</span>
                              <span className="text-[10px] shrink-0" style={{ color: "var(--color-ink-5)" }}>— {l.user}</span>
                            </div>
                          </div>
                        ))}
                        {logs.filter(l => adminLogFilter === "all" || safeText(l.action).includes(adminLogFilter) || safeText(l.detail).includes(adminLogFilter)).length === 0 && (
                          <div className="py-12 text-center">
                            <Database className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-6)" }} />
                            <p className="text-[12px]" style={{ color: "var(--color-ink-5)" }}>暂无日志</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ===== 统计报表中心 (阶段三 任务 3.2.2) - 交叉透视表 + 柱状图 + CSV 导出 ===== */}
                  {adminTab === "report" && (
                    <div className="animate-fade-in">
                      <ReportCenter showToast={showToast} />
                    </div>
                  )}

                  {/* ===== 阶段五 等时圈: 预计算进度监控卡片 ===== */}
                  {adminTab === "isochrone" && (
                    <div className="animate-fade-in space-y-4">
                      {/* 说明卡 */}
                      <div
                        className="rounded-lg p-4"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)" }}
                          >
                            <Activity className="w-4 h-4" style={{ color: "#7c3aed" }} />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>路网等时圈服务区</h4>
                            <p className="text-[11px] mt-1" style={{ color: "var(--color-ink-4)" }}>
                              基于真实路网计算每座充电站的可达范围多边形：快充驾车 10 分钟、慢充步行 15 分钟。
                              数据来自高德路径规划 API，并发 2 路，预计 3-5 分钟跑完全部站点。
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                GB/T 51313-2018
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                15 分钟生活圈
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                高德路径 API
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 状态总览卡 - 4 格 */}
                      <div className="grid grid-cols-4 gap-3">
                        {(() => {
                          const stats = isochroneProgress?.stats;
                          const total = stats?.total ?? adminStations.length;
                          const ok = stats?.ok ?? 0;
                          const partial = stats?.partial ?? 0;
                          const pending = stats?.pending ?? 0;
                          const failed = stats?.failed ?? 0;
                          return [
                            { label: "已计算完成", value: ok, color: "#10B981", icon: CheckCircle2, sub: "快慢充均成功" },
                            { label: "部分成功", value: partial, color: "#F59E0B", icon: Clock, sub: "仅一种模式" },
                            { label: "待计算", value: pending, color: "#6B7280", icon: Clock, sub: "未触发或排队中" },
                            { label: "计算失败", value: failed, color: "#EF4444", icon: AlertCircle, sub: "需重算或检查" },
                          ].map(s => {
                            const Icon = s.icon;
                            const pct = total > 0 ? (s.value / total) * 100 : 0;
                            return (
                              <div
                                key={s.label}
                                className="rounded-lg p-3.5"
                                style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-medium" style={{ color: "var(--color-ink-4)" }}>{s.label}</span>
                                  <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                </div>
                                <p className="text-[24px] font-bold font-num leading-none" style={{ color: s.color }}>{s.value}</p>
                                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                                  <div className="h-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                                </div>
                                <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--color-ink-5)" }}>{pct.toFixed(1)}% · {s.sub}</p>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* 进度卡 */}
                      <div
                        className="rounded-lg p-4"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>预计算进度</h4>
                          <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>
                            {isochroneProgress ? (
                              isochroneProgress.running
                                ? `运行中 · ${isochroneProgress.done}/${isochroneProgress.total}`
                                : isochroneProgress.finishedAt
                                  ? `已完成 · 用时 ${((isochroneProgress.finishedAt - (isochroneProgress.startedAt || 0)) / 1000).toFixed(1)}s`
                                  : "空闲"
                            ) : "加载中..."}
                          </span>
                        </div>

                        {/* 进度条 */}
                        {isochroneProgress && isochroneProgress.total > 0 && (
                          <div className="mb-3">
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-subtle)" }}>
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${(isochroneProgress.done / isochroneProgress.total) * 100}%`,
                                  background: isochroneProgress.running ? "linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)" : "#10B981"
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[10px] font-mono" style={{ color: "var(--color-ink-5)" }}>
                              <span>成功 {isochroneProgress.ok ?? 0}</span>
                              <span>部分 {isochroneProgress.skipped ?? 0}</span>
                              <span>失败 {isochroneProgress.failed ?? 0}</span>
                              <span>{((isochroneProgress.done / isochroneProgress.total) * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        )}

                        {/* 错误信息 */}
                        {isochroneProgress?.lastError && (
                          <div
                            className="mb-3 px-2.5 py-1.5 rounded text-[11px] flex items-start gap-1.5"
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="break-all">{isochroneProgress.lastError}</span>
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => triggerIsochronePrecompute(false)}
                            disabled={isochroneProgress?.running}
                            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-all ${
                              isochroneProgress?.running
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                : "btn-brand"
                            }`}
                          >
                            {isochroneProgress?.running
                              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 运行中</>
                              : <><Activity className="w-3.5 h-3.5" /> 增量预计算</>}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("全量重算将覆盖所有现有等时圈数据，确认继续？")) {
                                triggerIsochronePrecompute(true);
                              }
                            }}
                            disabled={isochroneProgress?.running}
                            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-all ${
                              isochroneProgress?.running
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                            }`}
                            title="重新计算所有站点（包括已完成的），耗时长"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> 全量重算
                          </button>
                          <button
                            onClick={fetchIsochroneProgress}
                            className="text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> 刷新进度
                          </button>
                        </div>
                      </div>

                      {/* 站点状态列表 - 仅显示失败和待计算 */}
                      {adminStations.length > 0 && (
                        <div
                          className="rounded-lg p-4"
                          style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[13px] font-semibold" style={{ color: "var(--color-ink-1)" }}>站点状态明细</h4>
                            <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>仅展示待计算 / 失败</span>
                          </div>
                          <div className="max-h-72 overflow-y-auto space-y-1">
                            {adminStations
                              .filter((s: any) => {
                                const st = s.isochroneStatus || "pending";
                                return st === "pending" || st === "failed";
                              })
                              .slice(0, 50)
                              .map((s: any) => {
                                const st = s.isochroneStatus || "pending";
                                const color = st === "failed" ? "#EF4444" : "#F59E0B";
                                const Icon = st === "failed" ? AlertCircle : Clock;
                                return (
                                  <div
                                    key={s.id}
                                    className="flex items-center gap-2 text-[11px] py-1.5 px-2 rounded"
                                    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                                  >
                                    <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                                    <span className="font-mono w-8 shrink-0" style={{ color: "var(--color-ink-5)" }}>#{s.id}</span>
                                    <span className="flex-1 truncate" style={{ color: "var(--color-ink-2)" }}>{s.name}</span>
                                    <span className="shrink-0 text-[10px]" style={{ color: "var(--color-ink-4)" }}>{s.district}</span>
                                    <span
                                      className="px-1.5 py-0 rounded text-[10px] font-medium shrink-0"
                                      style={{ background: `${color}1a`, color, border: `1px solid ${color}40` }}
                                    >
                                      {st === "failed" ? "失败" : "待计算"}
                                    </span>
                                  </div>
                                );
                              })}
                            {adminStations.filter((s: any) => {
                              const st = s.isochroneStatus || "pending";
                              return st === "pending" || st === "failed";
                            }).length === 0 && (
                              <div className="py-6 text-center">
                                <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: "#10B981" }} />
                                <p className="text-[11px]" style={{ color: "var(--color-ink-4)" }}>所有站点已计算完成</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* 编辑/新增模态框 */}
                {adminEditing !== null && (
                  <StationEditModal
                    data={adminEditing}
                    onClose={() => setAdminEditing(null)}
                    onSave={async (formData) => {
                      try {
                        if (formData._type === "user") {
                          // 用户保存
                          const isEdit = formData.id;
                          const r = await authFetch(isEdit ? `/api/v1/users/${formData.id}` : "/api/v1/users", {
                            method: isEdit ? "PUT" : "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username: formData.username, password: formData.password, role: formData.role, status: formData.status }),
                          });
                          const j = await r.json();
                          if (j.success) { loadAdminData(); setAdminEditing(null); alert(j.message); }
                          else alert(j.message);
                        } else {
                          // 充电站保存
                          const isEdit = formData.id;
                          const r = await authFetch(isEdit ? `/api/v1/stations/${formData.id}` : "/api/v1/stations", {
                            method: isEdit ? "PUT" : "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: formData.name, brand: formData.brand, lng: formData.lng, lat: formData.lat,
                              fast_chargers: parseInt(formData.fast_chargers) || 0, slow_chargers: parseInt(formData.slow_chargers) || 0,
                              address: formData.address, district: formData.district, status: formData.status, operator: formData.operator,
                            }),
                          });
                          const j = await r.json();
                          if (j.success) { loadAdminData(); setAdminEditing(null); alert(j.message); }
                          else alert(j.message);
                        }
                      } catch (e: any) {
                        alert("保存失败: " + e.message);
                      }
                    }}
                  />
                )}
              </div>
          )}
    </>
  );
}
