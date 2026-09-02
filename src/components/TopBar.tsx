import React from "react";
import { Sun, Moon, Keyboard, Search, LocateFixed, LogOut, Zap } from "lucide-react";

interface TopBarProps {
  darkTheme: boolean;
  toggleTheme: () => void;
  onOpenShortcutsHelp: () => void;
  onOpenCommandPalette: () => void;
  locating: boolean;
  onLocate: () => void;
  // 精简模式 (普通用户/车主): 显示 GeoPlan 标题卡片 (无模式导航)
  compact?: boolean;
  // 嵌入模式: 不悬浮, 作为页面内静态按钮组 (系统管理页导航条右侧使用)
  embedded?: boolean;
  onLogout?: () => void;
  username?: string;
}

/**
 * 控制按钮组
 * - 默认: 右上角悬浮玻璃按钮组 (定位/主题/快捷键/命令面板/用户头像)
 * - 精简模式(车主): 左上角 GeoPlan 标题卡 + 同组按钮
 * - 嵌入模式: 页面内静态按钮组 (无玻璃卡壳)
 */
export default function TopBar({
  darkTheme,
  toggleTheme,
  onOpenShortcutsHelp,
  onOpenCommandPalette,
  locating,
  onLocate,
  compact = false,
  embedded = false,
  onLogout,
  username,
}: TopBarProps) {
  // 统一风格的圆形图标按钮
  const iconBtn = (key: string, title: string, Icon: any, onClick?: () => void, disabled = false) => (
    <button
      key={key}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="nio-icon-btn disabled:opacity-50"
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <header
      className={
        embedded
          ? "flex items-center"
          : compact
            ? "absolute top-4 left-4 z-40 animate-panel-enter"
            : "absolute top-4 right-4 z-40 animate-panel-enter"
      }
    >
      <div
        className={
          embedded
            ? "flex items-center gap-1"
            : "nio-card flex items-center gap-1 px-2 py-1.5"
        }
        style={embedded ? undefined : { borderRadius: 999 }}
      >
        {/* 精简模式(车主): 显示平台标识 */}
        {compact && (
          <div className="flex items-center gap-2 pl-1 pr-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #EAF2F8 0%, #D6E6F2 100%)",
                border: "1px solid rgba(90,123,160,0.3)",
              }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: "#1B2A4A" }} fill="#1B2A4A" />
            </div>
            <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: "#1B2A4A" }}>GeoPlan 充电地图</span>
          </div>
        )}

        {/* 普通模式: 用户头像 + 用户名 */}
        {!compact && username && (
          <div className="flex items-center gap-2 pl-1 pr-2" title={username}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #00C896, #009A6F)" }}
            >
              {username.charAt(0)}
            </div>
            <span className="text-[12px] font-medium text-zinc-800 whitespace-nowrap hidden sm:inline">{username}</span>
          </div>
        )}

        {iconBtn("locate", "定位我的位置", LocateFixed, onLocate, locating)}
        {iconBtn("theme", darkTheme ? "切换到亮色主题" : "切换到暗色主题", darkTheme ? Sun : Moon, toggleTheme)}
        {!compact && iconBtn("shortcuts", "快捷键帮助 (Ctrl+/)", Keyboard, onOpenShortcutsHelp)}
        {!compact && iconBtn("palette", "命令面板 (Ctrl+K)", Search, onOpenCommandPalette)}
        {onLogout && iconBtn("logout", "退出登录", LogOut, onLogout)}
      </div>
    </header>
  );
}
