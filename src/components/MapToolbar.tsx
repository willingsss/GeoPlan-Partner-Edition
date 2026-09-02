import type { CSSProperties } from "react";
import type { Map as OlMap } from "ol";
import {
  MousePointer2, ZoomIn, ZoomOut, Ruler, Square, Crosshair,
  SquareDashedMousePointer, Shapes, Printer, Eraser,
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

// 工具按钮配置清单 (顺序即工具栏顺序)
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

// Tooltip 样式 (下方弹出, 黑底白字, 12px)
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
  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0";

// 按钮基础类名 (横向紧凑版)
const btnClass =
  "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 group relative";

/**
 * 地图工具栏（横向紧凑版，内嵌于顶部横栏，避免遮挡地图）
 */
export default function MapToolbar({ map, activeTool, onToolChange, onClearMeasurements }: MapToolbarProps) {
  // 地图未就绪时不渲染
  if (!map) return null;

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1">
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
              boxShadow: active ? "0 0 6px rgba(0,200,150,0.15), inset 0 1px 0 rgba(255,255,255,0.2)" : "none",
              border: active ? "1px solid rgba(0,200,150,0.2)" : "1px solid transparent",
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "scale(1.08)"; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; } }}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className={tooltipClass} style={tooltipStyle}>
              {tool.label}
              <span className="font-mono text-zinc-500 ml-1.5 text-[11px]">{tool.shortcut}</span>
            </span>
          </button>
        );
      })}

      {/* 分隔线 */}
      <div style={{ width: 1, height: 16, background: "rgba(0,0,0,0.08)", margin: "0 4px" }} />

      {/* 清除测量按钮 */}
      <button
        onClick={() => onClearMeasurements?.()}
        className={btnClass}
        title="清除测量结果"
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
        <Eraser className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
