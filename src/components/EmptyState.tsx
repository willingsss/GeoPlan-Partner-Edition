// =========================================================================
// 空状态组件 (阶段四 任务 4.3.4)
// 用图标 + 引导文案替换所有空列表, 提升用户体验
// =========================================================================
import type { ReactNode } from "react";
import { LucideIcon, Inbox, FileSpreadsheet, FolderOpen, Users, MessageSquare, MapPin, Database } from "lucide-react";

interface EmptyStateProps {
  // 图标名 (字符串, 避免传组件)
  icon?: "Inbox" | "FileSpreadsheet" | "FolderOpen" | "Users" | "MessageSquare" | "MapPin" | "Database";
  // 标题
  title?: string;
  // 描述
  desc?: string;
  // 可选: 自定义按钮区域
  action?: ReactNode;
  // 紧凑模式 (小尺寸)
  compact?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Inbox,
  FileSpreadsheet,
  FolderOpen,
  Users,
  MessageSquare,
  MapPin,
  Database,
};

export default function EmptyState({
  icon = "Inbox",
  title = "暂无数据",
  desc = "",
  action,
  compact = false,
}: EmptyStateProps) {
  const Icon = ICON_MAP[icon] || Inbox;
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-12"}`}>
      <div
        className={`${compact ? "w-10 h-10 mb-2" : "w-16 h-16 mb-3"} rounded-full flex items-center justify-center`}
        style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
      >
        <Icon className={`${compact ? "w-4 h-4" : "w-6 h-6"}`} style={{ color: "var(--color-ink-4)" }} />
      </div>
      <p className={`${compact ? "text-[12px]" : "text-[13px]"} font-medium`} style={{ color: "var(--color-ink-2)" }}>
        {title}
      </p>
      {desc && (
        <p className={`${compact ? "text-[10px] mt-1" : "text-[11px] mt-1.5"} max-w-xs`} style={{ color: "var(--color-ink-4)" }}>
          {desc}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
