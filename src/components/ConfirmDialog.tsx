// ConfirmDialog.tsx
// 通用确认对话框 (替代浏览器原生 confirm, 风格统一)
import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmText = "确认", cancelText = "取消",
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(9,9,11,0.45)" }} onClick={onCancel}>
      <div className="w-[380px] rounded-2xl bento-tile"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,250,0.96) 100%)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "var(--shadow-elevated)",
        }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--color-muted)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: danger ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)" }}>
            <AlertTriangle className="w-4 h-4" style={{ color: danger ? "#EF4444" : "#10B981" }} />
          </div>
          <h3 className="text-[14px] font-semibold flex-1" style={{ color: "var(--color-ink-1)" }}>{title}</h3>
          <button onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 shrink-0"
            style={{ color: "var(--color-ink-4)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-ink-3)" }}>{message}</p>
        </div>
        <div className="px-5 pb-4 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{ background: "var(--color-subtle)", color: "var(--color-ink-3)", border: "1px solid var(--color-muted)" }}>
            {cancelText}
          </button>
          <button onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors"
            style={{ background: danger ? "#EF4444" : "#10B981" }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
