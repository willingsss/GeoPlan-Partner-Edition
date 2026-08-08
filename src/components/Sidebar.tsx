import React from "react";
import { Zap, ChevronLeft, LayoutDashboard, LogOut } from "lucide-react";
import { ROLE_CONFIG, type SubsystemTab, type User } from "../types";

export interface SidebarTab {
  id: SubsystemTab;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

interface SidebarProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  visibleTabs: SidebarTab[];
  activeTab: SubsystemTab;
  onTabChange: (tab: SubsystemTab) => void;
  onOpenDashboard: () => void;
  currentUser: User;
  onLogout: () => void;
}

/**
 * 侧边栏（GIS 指挥甲板风格：3D 透视 + 沉浸式深色）
 */
export default function Sidebar({
  sidebarCollapsed,
  toggleSidebar,
  mobileSidebarOpen,
  visibleTabs,
  activeTab,
  onTabChange,
  onOpenDashboard,
  currentUser,
  onLogout,
}: SidebarProps) {
  return (
    <aside
      className={`${sidebarCollapsed ? "w-[56px]" : "w-[220px]"} shrink-0 flex flex-col relative overflow-hidden sidebar-scroll sidebar-auto-collapse mobile-sidebar-drawer ${mobileSidebarOpen ? "mobile-open" : ""} animate-panel-enter`}
      style={{
        background: "linear-gradient(180deg, #09090B 0%, #0E0E11 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width var(--duration-slow) var(--ease-spring)",
        perspective: "1200px",
        transformStyle: "preserve-3d",
      }}
    >
      {/* 顶部微光效果 */}
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,200,150,0.3), transparent)" }}
      />

      {/* Logo 区 - 指挥甲板风格: 3D 徽章 + 光晕 */}
      <div
        className="flex items-center shrink-0 relative"
        style={{
          height: 60,
          padding: sidebarCollapsed ? "0 8px" : "0 16px",
          justifyContent: sidebarCollapsed ? "center" : "flex-start",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          onClick={sidebarCollapsed ? toggleSidebar : undefined}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0 transition-all animate-glow-pulse"
          style={{
            background: "linear-gradient(135deg, #18181B, #1F1F23)",
            border: "1px solid rgba(0,200,150,0.25)",
            boxShadow: "0 0 12px rgba(0,200,150,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
          title={sidebarCollapsed ? "展开侧边栏" : "GeoPlan"}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08) rotateY(-5deg)";
            e.currentTarget.style.borderColor = "var(--color-brand)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1) rotateY(0deg)";
            e.currentTarget.style.borderColor = "rgba(0,200,150,0.25)";
          }}
        >
          <Zap className="w-4 h-4" style={{ color: "var(--color-brand)" }} />
        </div>
        {!sidebarCollapsed && (
          <div className="ml-3 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-mono)" }}>GeoPlan</span>
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(0,200,150,0.12)", color: "var(--color-brand)", border: "1px solid rgba(0,200,150,0.2)" }}>PRO</span>
            </div>
            <p className="text-[10px] text-zinc-600 truncate mt-0.5">
              新能源充电设施规划平台
            </p>
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="w-6 h-6 rounded flex items-center justify-center transition-all hover:bg-zinc-800/80 text-zinc-600 hover:text-zinc-300"
            title="收起侧边栏"
            style={{ border: "1px solid transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 导航菜单 - 指挥甲板: 3D hover + 磁吸效果 */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto sidebar-scroll">
        {!sidebarCollapsed && (
          <p className="text-[9px] text-zinc-700 px-2 mb-2 uppercase tracking-[0.15em] font-mono">
            功能导航
          </p>
        )}
        {visibleTabs.map((tab, idx) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={sidebarCollapsed ? tab.label : undefined}
              className={`group w-full flex items-center ${
                sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
              } py-2 rounded-lg text-[12.5px] font-medium transition-all duration-200 ${
                active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
              style={{
                background: active ? "linear-gradient(90deg, rgba(0,200,150,0.12), transparent)" : "transparent",
                borderLeft: active ? "2px solid var(--color-brand)" : "2px solid transparent",
                transform: active ? "translateX(2px)" : "translateX(0)",
                transition: "all var(--duration-normal) var(--ease-out)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.transform = "translateX(3px) scale(1.01)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateX(0) scale(1)";
                }
              }}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-all ${active ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400"}`}
                style={active ? { filter: "drop-shadow(0 0 4px rgba(0,200,150,0.4))" } : {}}
              />
              {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
            </button>
          );
        })}

        {/* 决策大屏入口 - 独立分组, 强调入口 */}
        {!sidebarCollapsed && (
          <p className="text-[9px] text-zinc-700 px-2 mb-2 mt-4 uppercase tracking-[0.15em] font-mono">数据大屏</p>
        )}
        <button
          onClick={onOpenDashboard}
          title={sidebarCollapsed ? "决策大屏" : undefined}
          className={`group w-full flex items-center ${
            sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
          } py-2 rounded-lg text-[12.5px] font-medium text-zinc-500 hover:text-zinc-300 transition-all`}
          style={{ marginTop: sidebarCollapsed ? 8 : 0 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0,200,150,0.06)";
            e.currentTarget.style.transform = "translateX(3px) scale(1.01)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.transform = "translateX(0) scale(1)";
          }}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0 text-emerald-500/70 group-hover:text-emerald-400 transition-colors" />
          {!sidebarCollapsed && <span className="truncate">决策大屏</span>}
        </button>
      </nav>

      {/* 底部: 数据库状态 + 用户信息 - 指挥甲板风格 */}
      <div className="shrink-0 p-2.5 border-t border-white/5 space-y-2">
        <div
          className={`flex items-center ${
            sidebarCollapsed ? "justify-center" : "gap-2 px-2"
          } text-[10px] text-zinc-600 py-1`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-status-pulse shrink-0" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.5)" }} />
          {!sidebarCollapsed && (
            <span className="font-mono">数据库已连接</span>
          )}
        </div>
        <div
          className={`flex items-center ${
            sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
          } py-2 rounded-lg hover:bg-white/[0.03] transition-all`}
          style={{ border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        >
          <div
            className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, " + ROLE_CONFIG[currentUser.role].color + "40, " + ROLE_CONFIG[currentUser.role].color + "20)", border: "1px solid " + ROLE_CONFIG[currentUser.role].color + "30" }}
          >
            {currentUser.username.charAt(0)}
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 leading-tight min-w-0">
                <p className="text-[12px] text-zinc-200 font-semibold truncate">{currentUser.username}</p>
                <p
                  className="text-[10px] truncate font-mono"
                  style={{ color: ROLE_CONFIG[currentUser.role].color }}
                >
                  {ROLE_CONFIG[currentUser.role].label}
                </p>
              </div>
              <button
                onClick={onLogout}
                title="退出登录"
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
