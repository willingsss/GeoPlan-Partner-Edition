import { useState } from "react";
import type { CSSProperties } from "react";
import type { Map as OlMap } from "ol";
import {
  MousePointer2, ZoomIn, ZoomOut, Ruler, Square, Crosshair,
  SquareDashedMousePointer, Shapes, Printer, Eraser,
  ChevronLeft, ChevronRight,
} from "lucide-react";

// =========================================================================
// 地图工具类型枚举 (导出供 App.tsx 使用)
// =========================================================================
export type MapTool =
  | "pan" | "zoom-in" | "zoom-out"
  | "measure-distance" | "measure-area" | "pick-coordinate"
  | "query-rectangle" | "query-polygon" | "print";

interface MapToolbarProps {
  map: OlMap | null;
  activeTool: MapTool | null;
  onToolChange: (tool: MapTool | null) => void;
  onClearMeasurements?: () => void;
}

// 工具按钮配置清单 (顺序即工具栏从上到下顺序)
const TOOL_LIST: { id: MapTool; icon: any; label: string; shortcut: string }[] = [
  { id: "pan", icon: MousePointer2, label: "平移", shortcut: "默认" },
  { id: "zoom-in", icon: ZoomIn, label: "放大", shortcut: "+" },
  { id: "zoom-out", icon: ZoomOut, label: "缩小", shortcut: "-" },
  { id: "measure-distance", icon: Ruler, label: "测量距离", shortcut: "M" },
  { id: "measure-area", icon: Square, label: "测量面积", shortcut: "A" },
  { id: "pick-coordinate", icon: Crosshair, label: "拾取坐标", shortcut: "C" },
  { id: "query-rectangle", icon: SquareDashedMousePointer, label: "框选查询", shortcut: "Q" },
  { id: "query-polygon", icon: Shapes, label: "多边形查询", shortcut: "G" },
  { id: "print", icon: Printer, label: "打印出图", shortcut: "P" },
];

// 容器样式 (玻璃拟态指挥甲板)
const containerStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,250,0.88) 100%)",
  backdropFilter: "blur(16px) saturate(1.4)",
  WebkitBackdropFilter: "blur(16px) saturate(1.4)",
  border: "1px solid rgba(255,255,255,0.3)",
  boxShadow: "var(--shadow-panel)",
};

// Tooltip 样式 (右侧弹出, 黑底白字, 12px)
const tooltipStyle: CSSProperties = {
  background: "linear-gradient(135deg, #18181B, #27272A)",
  color: "#fff",
  fontSize: 12,
  zIndex: 20,
  boxShadow: "var(--shadow-lg)",
  lineHeight: "1.4",
  border: "1px solid rgba(255,255,255,0.08)",
};

const tooltipClass =
  "absolute left-full ml-2.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0";

// 按钮基础类名
const btnClass =
  "w-9 h-9 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 group relative shrink-0";

export default function MapToolbar({ map, activeTool, onToolChange, onClearMeasurements }: MapToolbarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // 地图未就绪时不渲染
  if (!map) return null;

  // 折叠态: 仅显示展开按钮
  if (collapsed) {
    return (
      <div
        className="absolute left-3 top-3 z-10 rounded-lg animate-fade-in"
        style={{ ...containerStyle, width: 36 }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className={btnClass}
          style={{ color: "var(--color-ink-3)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <ChevronRight className="w-4 h-4" />
          <span className={tooltipClass} style={tooltipStyle}>展开工具栏</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute left-3 top-3 z-10 flex flex-col rounded-2xl animate-panel-enter py-1.5"
      style={{ ...containerStyle, width: 48 }}
    >
      {/* 折叠按钮 (顶部) */}
      <button
        onClick={() => setCollapsed(true)}
        className={btnClass}
        style={{ color: "var(--color-ink-3)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; }}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className={tooltipClass} style={tooltipStyle}>收起工具栏</span>
      </button>

      {/* 分隔线 */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.05)", margin: "3px 10px" }} />

      {/* 工具按钮组 */}
      {TOOL_LIST.map((tool) => {
        const Icon = tool.icon;
        // 平移按钮在无活动工具时高亮 (表示默认模式)
        const active = tool.id === "pan"
          ? (activeTool === null || activeTool === "pan")
          : activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolChange(active && tool.id !== "pan" ? null : tool.id)}
            className={btnClass}
            style={{
              background: active ? "linear-gradient(135deg, rgba(0,200,150,0.15), rgba(0,200,150,0.05))" : "transparent",
              color: active ? "var(--color-brand-text)" : "var(--color-ink-3)",
              boxShadow: active ? "0 0 8px rgba(0,200,150,0.15), inset 0 1px 0 rgba(255,255,255,0.2)" : "none",
              border: active ? "1px solid rgba(0,200,150,0.2)" : "1px solid transparent",
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "scale(1.08)"; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; } }}
          >
            <Icon className="w-4 h-4" />
            <span className={tooltipClass} style={tooltipStyle}>
              {tool.label}
              <span className="font-mono text-zinc-500 ml-1.5 text-[11px]">{tool.shortcut}</span>
            </span>
          </button>
        );
      })}

      {/* 分隔线 */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.05)", margin: "4px 10px 2px" }} />

      {/* 清除测量按钮 (底部) */}
      <button
        onClick={() => onClearMeasurements?.()}
        className={btnClass}
        style={{ color: "var(--color-ink-3)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239,68,68,0.08)";
          e.currentTarget.style.color = "var(--color-danger)";
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-ink-3)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Eraser className="w-4 h-4" />
        <span className={tooltipClass} style={tooltipStyle}>清除测量结果</span>
      </button>
    </div>
  );
}
