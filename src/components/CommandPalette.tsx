// =========================================================================
// 命令面板 (阶段四 任务 4.2)
// Ctrl+K 唤起居中搜索框, 模糊搜索命令清单, 键盘上下选择 + 回车执行
// =========================================================================
import { useEffect, useRef, useState, useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, X,
  Map as MapIcon, Radar, Target, Settings, Ruler, Square, Crosshair,
  SquareDashedMousePointer, Shapes, Printer, Eraser, LayoutDashboard,
  Calculator, TrendingUp, AlertTriangle, Moon,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: any;
  // 关键字 (用于搜索匹配)
  keywords?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  // 命令执行回调 (由 App.tsx 注入)
  onCommand: (cmd: Command) => void;
}

export default function CommandPalette({ open, onClose, onCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 命令清单 (与 App.tsx 实际能调用的功能保持一致)
  // 注意: 实际 action 由父组件通过 onCommand 回调执行, 这里只定义元数据
  const commands: Command[] = useMemo(() => [
    { id: "tab-map", label: "切换到地图展示", icon: MapIcon, keywords: "地图 map 1", action: () => onCommand({ id: "tab-map", label: "切换到地图展示", icon: MapIcon, action: () => {} }) },
    { id: "tab-coverage", label: "切换到覆盖分析", icon: Radar, keywords: "覆盖 analysis 2", action: () => onCommand({ id: "tab-coverage", label: "切换到覆盖分析", icon: Radar, action: () => {} }) },
    { id: "tab-site", label: "切换到选址决策", icon: Target, keywords: "选址 site 3", action: () => onCommand({ id: "tab-site", label: "切换到选址决策", icon: Target, action: () => {} }) },
    { id: "tab-admin", label: "切换到系统管理", icon: Settings, keywords: "管理 admin 4", action: () => onCommand({ id: "tab-admin", label: "切换到系统管理", icon: Settings, action: () => {} }) },
    { id: "tool-measure-distance", label: "测量距离", icon: Ruler, keywords: "测距 M distance", action: () => onCommand({ id: "tool-measure-distance", label: "测量距离", icon: Ruler, action: () => {} }) },
    { id: "tool-measure-area", label: "测量面积", icon: Square, keywords: "测面 A area", action: () => onCommand({ id: "tool-measure-area", label: "测量面积", icon: Square, action: () => {} }) },
    { id: "tool-pick-coordinate", label: "拾取坐标", icon: Crosshair, keywords: "坐标 C coordinate", action: () => onCommand({ id: "tool-pick-coordinate", label: "拾取坐标", icon: Crosshair, action: () => {} }) },
    { id: "tool-query-rectangle", label: "框选查询", icon: SquareDashedMousePointer, keywords: "框选 Q rectangle", action: () => onCommand({ id: "tool-query-rectangle", label: "框选查询", icon: SquareDashedMousePointer, action: () => {} }) },
    { id: "tool-query-polygon", label: "多边形查询", icon: Shapes, keywords: "多边形 G polygon", action: () => onCommand({ id: "tool-query-polygon", label: "多边形查询", icon: Shapes, action: () => {} }) },
    { id: "tool-print", label: "打印出图", icon: Printer, keywords: "打印 P print", action: () => onCommand({ id: "tool-print", label: "打印出图", icon: Printer, action: () => {} }) },
    { id: "clear-measurements", label: "清除测量结果", icon: Eraser, keywords: "清除 clear", action: () => onCommand({ id: "clear-measurements", label: "清除测量结果", icon: Eraser, action: () => {} }) },
    { id: "open-dashboard", label: "打开决策大屏", icon: LayoutDashboard, keywords: "大屏 dashboard", action: () => onCommand({ id: "open-dashboard", label: "打开决策大屏", icon: LayoutDashboard, action: () => {} }) },
    { id: "open-roi", label: "ROI 估算", icon: Calculator, keywords: "投资回报 roi", action: () => onCommand({ id: "open-roi", label: "ROI 估算", icon: Calculator, action: () => {} }) },
    { id: "open-competition", label: "竞争态势分析", icon: TrendingUp, keywords: "竞争 competition", action: () => onCommand({ id: "open-competition", label: "竞争态势分析", icon: TrendingUp, action: () => {} }) },
    { id: "open-gap", label: "缺口预测", icon: AlertTriangle, keywords: "缺口 gap 预测", action: () => onCommand({ id: "open-gap", label: "缺口预测", icon: AlertTriangle, action: () => {} }) },
    { id: "toggle-theme", label: "切换明暗主题", icon: Moon, keywords: "主题 theme dark", action: () => onCommand({ id: "toggle-theme", label: "切换明暗主题", icon: Moon, action: () => {} }) },
  ], [onCommand]);

  // 模糊搜索 (includes 匹配即可)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords || "").toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // 打开时聚焦输入框, 重置状态
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      // 延迟一帧等待 DOM 渲染
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 选中项跟随滚动
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // 过滤结果变化时, 重置选中项
  useEffect(() => {
    setSelectedIdx(0);
  }, [filtered]);

  // 键盘事件处理
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd) {
        cmd.action();
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-start justify-center pt-32"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[60vh] rounded-xl overflow-hidden animate-scale-in flex flex-col"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索框 */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--color-muted)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-ink-4)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索命令... (上下键选择, 回车执行)"
            className="flex-1 text-[14px] bg-transparent outline-none"
            style={{ color: "var(--color-ink-1)" }}
          />
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-zinc-100"
            style={{ color: "var(--color-ink-4)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 命令列表 */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: "var(--color-ink-4)" }}>
              未找到匹配的命令
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const active = idx === selectedIdx;
              return (
                <button
                  key={cmd.id}
                  data-idx={idx}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => { cmd.action(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{
                    background: active ? "var(--color-subtle)" : "transparent",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: active ? "var(--color-brand-subtle)" : "var(--color-subtle)",
                      border: `1px solid ${active ? "var(--color-brand-border)" : "var(--color-muted)"}`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: active ? "var(--color-brand-text)" : "var(--color-ink-3)" }} />
                  </div>
                  <span
                    className="flex-1 text-[13px] font-medium"
                    style={{ color: active ? "var(--color-ink-1)" : "var(--color-ink-2)" }}
                  >
                    {cmd.label}
                  </span>
                  {active && (
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-ink-5)" }}>
                      <CornerDownLeft className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* 底部提示 */}
        <div
          className="px-4 py-2 flex items-center justify-between text-[10.5px]"
          style={{ background: "var(--color-subtle)", borderTop: "1px solid var(--color-muted)", color: "var(--color-ink-4)" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-2.5 h-2.5" />
              <ArrowDown className="w-2.5 h-2.5" />
              选择
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-2.5 h-2.5" />
              执行
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>Esc</kbd>
              关闭
            </span>
          </div>
          <span>共 {filtered.length} 个命令</span>
        </div>
      </div>
    </div>
  );
}
