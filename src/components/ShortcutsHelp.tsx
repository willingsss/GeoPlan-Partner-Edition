// =========================================================================
// 快捷键帮助弹窗 (阶段四 任务 4.1.2)
// 显示所有快捷键绑定, 通过 Ctrl+/ 或 Ctrl+? 唤起
// =========================================================================
import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  desc: string;
  group: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // Tab 切换
  { keys: ["1"], desc: "切换到 地图展示", group: "Tab 切换" },
  { keys: ["2"], desc: "切换到 覆盖分析", group: "Tab 切换" },
  { keys: ["3"], desc: "切换到 选址决策", group: "Tab 切换" },
  { keys: ["4"], desc: "切换到 系统管理", group: "Tab 切换" },
  // 地图工具
  { keys: ["M"], desc: "测距工具", group: "地图工具" },
  { keys: ["A"], desc: "测面工具", group: "地图工具" },
  { keys: ["C"], desc: "拾取坐标", group: "地图工具" },
  { keys: ["Q"], desc: "框选查询", group: "地图工具" },
  { keys: ["G"], desc: "多边形查询", group: "地图工具" },
  { keys: ["P"], desc: "打印出图", group: "地图工具" },
  // 全局命令
  { keys: ["Ctrl", "K"], desc: "打开命令面板", group: "全局命令" },
  { keys: ["Ctrl", "/"], desc: "显示快捷键帮助", group: "全局命令" },
  { keys: ["Esc"], desc: "关闭当前弹窗", group: "全局命令" },
];

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // 按组分类
  const groups = Array.from(new Set(SHORTCUTS.map(s => s.group)));

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-[560px] max-h-[80vh] overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-muted)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
            >
              <Keyboard className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink-1)" }}>键盘快捷键</h3>
              <p className="text-[10.5px]" style={{ color: "var(--color-ink-4)" }}>提升操作效率</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-zinc-100"
            style={{ color: "var(--color-ink-4)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 快捷键列表 */}
        <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-5 max-h-[60vh] overflow-y-auto">
          {groups.map(group => (
            <div key={group}>
              <h4 className="text-[10.5px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-ink-4)" }}>
                {group}
              </h4>
              <div className="space-y-2">
                {SHORTCUTS.filter(s => s.group === group).map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: "var(--color-ink-2)" }}>{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && <span className="text-[10px]" style={{ color: "var(--color-ink-5)" }}>+</span>}
                          <kbd
                            className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-semibold"
                            style={{
                              background: "var(--color-subtle)",
                              border: "1px solid var(--color-line)",
                              color: "var(--color-ink-2)",
                              boxShadow: "0 1px 0 var(--color-line)",
                              minWidth: 22,
                              textAlign: "center",
                              display: "inline-block",
                            }}
                          >
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div
          className="px-5 py-2.5 text-[10.5px] flex items-center gap-2"
          style={{ background: "var(--color-subtle)", borderTop: "1px solid var(--color-muted)", color: "var(--color-ink-4)" }}
        >
          <span>💡</span>
          <span>输入框聚焦时不响应快捷键. 按 <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>Esc</kbd> 关闭弹窗</span>
        </div>
      </div>
    </div>
  );
}
