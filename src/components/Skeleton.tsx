// =========================================================================
// 骨架屏组件 (阶段四 任务 4.3.3)
// 在数据加载时显示, 替代空白态. 提供 rows / card / table / list 四种模式
// =========================================================================
interface SkeletonProps {
  // 行模式: 渲染 N 行占位条
  rows?: number;
  // 卡片模式: 渲染 N 个卡片占位
  cards?: number;
  // 表格模式: 渲染 N 行 N 列表格
  tableRows?: number;
  tableCols?: number;
  // 高度 (默认 14px)
  rowHeight?: number;
  // 顶部圆角等
  rounded?: "sm" | "md" | "lg";
}

export default function Skeleton({
  rows = 5,
  cards = 0,
  tableRows = 0,
  tableCols = 0,
  rowHeight = 14,
  rounded = "sm",
}: SkeletonProps) {
  const radius = rounded === "sm" ? 3 : rounded === "md" ? 6 : 8;

  // 卡片模式
  if (cards > 0) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg p-4 space-y-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)" }}
          >
            <div className="skeleton-shimmer rounded" style={{ height: 12, width: "40%", borderRadius: radius }} />
            <div className="skeleton-shimmer rounded" style={{ height: 28, width: "60%", borderRadius: radius }} />
            <div className="skeleton-shimmer rounded" style={{ height: 10, width: "30%", borderRadius: radius }} />
          </div>
        ))}
      </div>
    );
  }

  // 表格模式
  if (tableRows > 0) {
    return (
      <div className="p-3 space-y-2">
        {/* 表头占位 */}
        <div className="flex gap-2">
          {Array.from({ length: tableCols || 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer flex-1" style={{ height: 18, borderRadius: radius }} />
          ))}
        </div>
        {/* 表行占位 */}
        {Array.from({ length: tableRows }).map((_, r) => (
          <div key={r} className="flex gap-2">
            {Array.from({ length: tableCols || 5 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer flex-1" style={{ height: rowHeight, borderRadius: radius }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // 行模式 (默认)
  return (
    <div className="space-y-2.5 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: rowHeight,
            width: `${[100, 92, 86, 95, 88, 78][i % 6]}%`,
            borderRadius: radius,
          }}
        />
      ))}
    </div>
  );
}
