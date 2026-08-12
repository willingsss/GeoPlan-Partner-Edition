import React from "react";
import { Menu, ChevronRight, MapPin, Sun, Moon, Keyboard, Search, LocateFixed, LogOut } from "lucide-react";
import type { SubsystemTab } from "../types";
import MapToolbar, { type MapTool } from "./MapToolbar";
import type { Map as OlMap } from "ol";

interface TopBarProps {
  activeTab: SubsystemTab;
  visibleTabs: { id: SubsystemTab; label: string; icon: any }[];
  toggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  darkTheme: boolean;
  toggleTheme: () => void;
  onOpenShortcutsHelp: () => void;
  onOpenCommandPalette: () => void;
  locating: boolean;
  onLocate: () => void;
  map: OlMap | null;
  activeTool: MapTool | null;
  onToolChange: (tool: MapTool | null) => void;
  onClearMeasurements: () => void;
  // 精简模式 (普通用户/车主): 隐藏菜单/面包屑/状态标签/地图工具栏
  compact?: boolean;
  // 退出登录 (精简模式需要, 原退出按钮在侧边栏底部)
  onLogout?: () => void;
  username?: string;
}

/**
 * 头部（GIS 指挥甲板：玻璃拟态 + 精致信息架构）
 */
export default function TopBar({
  activeTab,
  visibleTabs,
  toggleSidebar,
  onToggleMobileSidebar,
  darkTheme,
  toggleTheme,
  onOpenShortcutsHelp,
  onOpenCommandPalette,
  locating,
  onLocate,
  map,
  activeTool,
  onToolChange,
  onClearMeasurements,
  compact = false,
  onLogout,
  username,
}: TopBarProps) {
  return (
    <header
      className="h-[52px] shrink-0 flex items-center justify-between px-4 z-30"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,250,0.82) 100%)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* 精简模式: 显示平台名, 隐藏菜单/面包屑/状态标签/工具栏 */}
        {compact ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold" style={{ background: "var(--color-brand)" }}>G</span>
            <span className="text-zinc-900 font-semibold">GeoPlan 充电地图</span>
          </div>
        ) : (
          <>
        <button
          onClick={() => {
            toggleSidebar();
            onToggleMobileSidebar();
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80 transition-all"
          title="切换侧边栏"
          style={{ border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        >
          <Menu className="w-3.5 h-3.5" />
        </button>
        {/* 面包屑 - 等宽标签风格 */}
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-zinc-400 font-mono text-[11px]">GEO</span>
          <ChevronRight className="w-3 h-3 text-zinc-300" />
          <span className="text-zinc-900 font-semibold">
            {visibleTabs.find(t => t.id === activeTab)?.label || "GeoPlan"}
          </span>
        </div>
        {/* 子系统状态标签 - 发光效果 */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-md ml-1 font-mono"
          style={{
            background: "linear-gradient(135deg, rgba(0,200,150,0.1), rgba(0,200,150,0.04))",
            color: "var(--color-brand-text)",
            border: "1px solid rgba(0,200,150,0.2)",
            boxShadow: "0 0 8px rgba(0,200,150,0.08)",
          }}
        >
          {activeTab === "map" && "BROWSE"}
          {activeTab === "coverage" && "ANALYZE"}
          {activeTab === "site" && "DECIDE"}
          {activeTab === "admin" && "ADMIN"}
        </span>

        {/* 地图工具栏 (内嵌横栏, 避免遮挡地图) */}
        {activeTab !== "admin" && (
          <MapToolbar
            map={map}
            activeTool={activeTool}
            onToolChange={onToolChange}
            onClearMeasurements={onClearMeasurements}
          />
        )}
          </>
        )}
      </div>

      {/* 右侧: 区域信息 + 时间 + 主题切换 + 快捷键帮助 */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
          <MapPin className="w-3 h-3 text-zinc-400" />
          <span className="font-mono">34.26°N 117.18°E</span>
        </span>
        <span className="text-zinc-300">·</span>
        <span className="font-mono">{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
        <span className="text-zinc-300">·</span>
        {/* 定位按钮 */}
        <button
          onClick={onLocate}
          disabled={locating}
          title="定位我的位置"
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100/80 text-zinc-500 hover:text-zinc-900 transition-all disabled:opacity-50"
          style={{ border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        >
          <LocateFixed className={`w-3.5 h-3.5 ${locating ? "animate-spin" : ""}`} />
        </button>
        {/* 主题切换按钮 */}
        <button
          onClick={toggleTheme}
          title={darkTheme ? "切换到亮色主题" : "切换到暗色主题"}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100/80 text-zinc-500 hover:text-zinc-900 transition-all"
          style={{ border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        >
          {darkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        {/* 快捷键帮助按钮 (精简模式隐藏) */}
        {!compact && (
        <button
          onClick={onOpenShortcutsHelp}
          title="快捷键帮助 (Ctrl+/)"
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100/80 text-zinc-500 hover:text-zinc-900 transition-all"
          style={{ border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>
        )}
        {/* 命令面板按钮 (精简模式隐藏) */}
        {!compact && (
        <button
          onClick={onOpenCommandPalette}
          title="命令面板 (Ctrl+K)"
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100/80 text-zinc-500 hover:text-zinc-900 transition-all"
          style={{ border: "1px solid transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
        >
          <Search className="w-3.5 h-3.5" />
        </button>
        )}
        {/* 用户信息 + 退出登录 (精简模式必需, 原退出在侧边栏底部) */}
        {compact && (
          <>
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-brand)" }} />
              <span className="text-[11px] text-zinc-600 font-medium">{username}</span>
            </span>
            <button
              onClick={onLogout}
              title="退出登录"
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-zinc-500 hover:text-red-500 transition-all"
              style={{ border: "1px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
