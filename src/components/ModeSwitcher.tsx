import React, { useState } from "react";
import { LayoutDashboard, Target, Trophy, ChevronDown } from "lucide-react";
import type { SubsystemTab } from "../types";

interface ModeSwitcherProps {
  visibleTabs: { id: SubsystemTab; label: string; icon: React.ComponentType<{ className?: string }> }[];
  activeTab: SubsystemTab;
  onTabChange: (tab: SubsystemTab) => void;
  onOpenDashboard: () => void;
  onOpenBlindSpotDashboard: () => void;
  onOpenSchemeDashboard: () => void;
  embedded?: boolean; // 嵌入模式: 不悬浮, 作为页面内静态导航条 (系统管理页使用)
}

/**
 * 模式导航 (NIO 充电地图风格)
 * - 默认: 顶部中央悬浮胶囊 (全屏地图 + 悬浮模式切换)
 * - embedded: 页面内嵌导航条 (系统管理等全屏页面使用)
 * - 中部: 功能模式 pill (地图查询 / 覆盖分析 / 选址决策 / 系统管理)
 * - 右侧: 数据大屏下拉 (决策大屏 / 盲区攻坚 / 选址决策大屏)
 */
export default function ModeSwitcher({
  visibleTabs,
  activeTab,
  onTabChange,
  onOpenDashboard,
  onOpenBlindSpotDashboard,
  onOpenSchemeDashboard,
  embedded = false,
}: ModeSwitcherProps) {
  const [dashOpen, setDashOpen] = useState(false);

  const dashboards = [
    { label: "决策大屏", icon: LayoutDashboard, color: "#10B981", onClick: onOpenDashboard },
    { label: "盲区攻坚大屏", icon: Target, color: "#F97316", onClick: onOpenBlindSpotDashboard },
    { label: "选址决策大屏", icon: Trophy, color: "#F59E0B", onClick: onOpenSchemeDashboard },
  ];

  return (
    <div className={embedded ? "w-full" : "absolute top-4 left-1/2 -translate-x-1/2 z-40 animate-panel-enter"}>
      <div
        className={
          embedded
            ? "flex flex-wrap items-center justify-center gap-1 px-3 py-1.5 w-full"
            : "nio-card flex flex-wrap items-center justify-center gap-1 px-1.5 py-1.5 max-w-[calc(100vw-32px)]"
        }
        style={
          embedded
            ? { background: "var(--color-surface)", borderBottom: "1px solid var(--color-muted)", borderRadius: 0 }
            : { borderRadius: 999 }
        }
      >
        {/* 模式 pill */}
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-all duration-200 ${
                active ? "text-white" : "text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.04]"
              }`}
              style={active ? { background: "var(--color-brand)", boxShadow: "0 2px 10px rgba(0,200,150,0.35)" } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}

        {/* 分隔线 */}
        <div className="w-px h-5 shrink-0 mx-0.5" style={{ background: "var(--color-muted)" }} />

        {/* 数据大屏下拉 */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDashOpen(prev => !prev)}
            className={`flex items-center gap-1 px-3 h-8 rounded-full text-[12px] font-medium transition-all duration-200 ${
              dashOpen ? "text-zinc-900 bg-black/[0.05]" : "text-zinc-500 hover:text-zinc-800 hover:bg-black/[0.04]"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">数据大屏</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${dashOpen ? "rotate-180" : ""}`} />
          </button>

          {dashOpen && (
            <>
              {/* 点击空白处关闭 */}
              <div className="fixed inset-0 z-40" onClick={() => setDashOpen(false)} />
              <div
                className="absolute top-full right-0 mt-2 z-50 py-1.5 min-w-[170px] animate-panel-enter nio-card"
              >
                {dashboards.map(d => {
                  const DIcon = d.icon;
                  return (
                    <button
                      key={d.label}
                      onClick={() => { setDashOpen(false); d.onClick(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors"
                    >
                      <DIcon className="w-3.5 h-3.5 shrink-0" style={{ color: d.color }} />
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
