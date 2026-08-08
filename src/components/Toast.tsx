// =========================================================================
// Toast 全局组件 + useToast Hook (阶段四 任务 4.3.1 / 4.3.2)
// 用 Context 在 App 顶层提供, 所有写操作可调用 showToast 显示反馈
// 支持 info / success / warning / error 四种类型, 3 秒自动消失
// =========================================================================
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { CheckCircle2, Info, AlertCircle, XCircle, X } from "lucide-react";

type ToastType = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (msg: string, type?: ToastType) => void;
  hideToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// 消费 Hook: 任意子组件调用 const { showToast } = useToast();
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // 在 Provider 未包裹时降级为 noop, 避免崩溃
    return {
      showToast: (msg: string, _type?: ToastType) => {
        console.log("[Toast]", msg);
      },
      hideToast: (_id: number) => {},
    };
  }
  return ctx;
}

const TYPE_CONFIG: Record<ToastType, { color: string; bg: string; border: string; Icon: typeof Info }> = {
  info:    { color: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.35)", Icon: Info },
  success: { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.35)", Icon: CheckCircle2 },
  warning: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", Icon: AlertCircle },
  error:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)", Icon: XCircle },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());

  const hideToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++idCounter.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    // 3 秒后自动消失
    const timer = window.setTimeout(() => hideToast(id), 3000);
    timers.current.set(id, timer);
  }, [hideToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {/* Toast 容器: 固定在右上角, 垂直堆叠 */}
      <div className="fixed top-3 right-3 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const cfg = TYPE_CONFIG[t.type];
          const Icon = cfg.Icon;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg animate-slide-up min-w-[240px] max-w-md"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${cfg.border}`,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
              </div>
              <span className="text-[12.5px] flex-1" style={{ color: "var(--color-ink-1)" }}>
                {t.msg}
              </span>
              <button
                onClick={() => hideToast(t.id)}
                className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
