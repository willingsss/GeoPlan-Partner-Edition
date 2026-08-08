import { useState } from "react";
import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// =========================================================================
// 地图图例组件 (覆盖分析 Tab 左下角浮层)
// 支持折叠/展开, 支持分组图例项 (色块 + 标签 / 图标 + 标签 / 渐变条 + 标签)
// =========================================================================

export interface LegendItem {
  label: string;
  color: string;
  icon?: ReactNode;
}

export interface LegendGroup {
  title?: string;
  items: LegendItem[];
  /** 渐变条模式: 传入起止色与刻度标签, 渲染为渐变色阶 */
  gradient?: { from: string; to: string; labels: string[] };
}

interface MapLegendProps {
  items: LegendItem[];
  title: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

// 容器样式 (Bento 玻璃拟态指挥甲板)
const containerStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,250,0.88) 100%)",
  backdropFilter: "blur(16px) saturate(1.4)",
  WebkitBackdropFilter: "blur(16px) saturate(1.4)",
  border: "1px solid rgba(255,255,255,0.3)",
  boxShadow: "var(--shadow-panel)",
  borderRadius: 12,
};

export default function MapLegend({
  items,
  title,
  collapsible = true,
  defaultCollapsed = false,
}: MapLegendProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // 折叠态: 仅显示窄条标题栏 (垂直文字)
  if (collapsed && collapsible) {
    return (
      <div
      className="absolute left-3 bottom-3 z-10 rounded-xl animate-fade-in flex flex-col items-center justify-start cursor-pointer bento-tile"
      style={{ ...containerStyle, width: 36, padding: "10px 0" }}
      onClick={() => setCollapsed(false)}
      title="点击展开图例"
    >
      <ChevronRight className="w-3.5 h-3.5 mb-1.5" style={{ color: "var(--color-ink-4)" }} />
      <span
        className="text-[10px] font-semibold select-none"
        style={{
          color: "var(--color-ink-3)",
          writingMode: "vertical-rl",
          letterSpacing: 2,
        }}
      >
        {title}
      </span>
    </div>
    );
  }

  // 展开态: 标题栏 + 全部图例项
  return (
    <div
      className="absolute left-3 bottom-3 z-10 rounded-xl animate-panel-enter bento-tile"
      style={{ ...containerStyle, width: 180 }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
        onClick={() => collapsible && setCollapsed(true)}
      >
        <span className="text-[11px] font-semibold font-mono" style={{ color: "var(--color-ink-2)" }}>
          {title}
        </span>
        {collapsible && (
          <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--color-ink-5)" }} />
        )}
      </div>

      {/* 图例项列表 */}
      <div className="px-3 py-2.5 space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            {/* 色块或图标 */}
            {item.icon ? (
              <span className="flex items-center justify-center shrink-0" style={{ width: 14, height: 14 }}>
                {item.icon}
              </span>
            ) : (
              <span
                className="shrink-0 rounded"
                style={{
                  width: 14,
                  height: 14,
                  background: item.color,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />
            )}
            <span className="text-[11px] leading-tight" style={{ color: "var(--color-ink-3)" }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// 渐变色阶图例 (覆盖率分级: 极差/较差/一般/良好/优秀)
// 单独导出, 在 App.tsx 中作为 MapLegend items 的补充渲染
// =========================================================================
export function LegendGradient({
  colors,
  labels,
}: {
  colors: string[];
  labels: string[];
}) {
  const gradient = `linear-gradient(to right, ${colors.join(", ")})`;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="rounded-sm"
        style={{
          width: "100%",
          height: 10,
          background: gradient,
          border: "1px solid var(--color-line)",
        }}
      />
      <div className="flex justify-between">
        {labels.map((l, i) => (
          <span key={i} className="text-[9px]" style={{ color: "var(--color-ink-5)" }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
