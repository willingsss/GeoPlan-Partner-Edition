// AiAnalysisPanel.tsx
// AI 决策浮动窗口 - 复用于单方案深度评估弹窗 / 方案对比弹窗
// 弹窗内渲染入口按钮, 点击后通过 portal 在 body 上弹出独立浮动窗口 (App 侧将主弹窗左移让位)
// 独立流式对话 (SSE): 不污染主 AI 助手会话; 支持预设追问 + 用户自由输入提问
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Send, Sparkles, Square, X } from "lucide-react";
import { renderAiContent } from "./AiAssistantPanel";

export interface AiPresetQuestion {
  label: string;    // chip 展示文案
  question: string; // 点击后实际发送的问题
}

interface AiAnalysisPanelProps {
  title: string;                 // 浮动窗口标题, 如 "AI 深度解读"
  buttonText: string;            // 弹窗内入口按钮文案
  startQuestion: string;         // 窗口打开时自动发起的分析问题 (完整发给 AI, 不在气泡中显示)
  startLabel: string;            // 首个问题的气泡短标签, 如 "方案深度解读"
  context: string;               // 注入的方案指标上下文
  presets?: AiPresetQuestion[];  // 输出完成后展示的预设追问
  onOpenChange?: (open: boolean) => void; // App 侧据此平移主弹窗
  anchorRef?: React.MutableRefObject<HTMLElement | null>; // 主弹窗卡片锚点: 有空间时窗口贴合其右侧
}

// display: 用户气泡展示文案 (发送给 AI 的是 content, 气泡里只显示精简标签, 避免长提示词刷屏)
type PanelMessage = { role: "user" | "assistant"; content: string; display?: string };

const HISTORY_LIMIT = 8; // 与主 AI 助手保持一致

export default function AiAnalysisPanel({ title, buttonText, startQuestion, startLabel, context, presets = [], onOpenChange, anchorRef }: AiAnalysisPanelProps) {
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [input, setInput] = useState("");
  // 贴合模式定位 (基于主弹窗锚点); null = 屏幕右侧独立悬浮回退模式
  const [dockPos, setDockPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 计算贴合位置: 主弹窗右侧 + 12px 间距; 屏幕空间不足时回退独立悬浮
  const updateDockPos = () => {
    const anchor = anchorRef?.current;
    if (!anchor) { setDockPos(null); return; }
    const rect = anchor.getBoundingClientRect();
    const WIN_W = 380, GAP = 12;
    if (rect.right + GAP + WIN_W <= window.innerWidth - 12) {
      setDockPos({
        left: rect.right + GAP,
        top: rect.top,
        height: Math.min(rect.height, window.innerHeight * 0.88),
      });
    } else {
      setDockPos(null);
    }
  };
  useEffect(() => {
    if (!open) return;
    updateDockPos();
    window.addEventListener("resize", updateDockPos);
    return () => window.removeEventListener("resize", updateDockPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 流式输出时滚动到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streaming]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  };

  // ===== SSE 流式请求 (与 useAiAssistant.doAiChat 同协议, 独立会话) =====
  const chat = async (baseMessages: PanelMessage[], userText: string) => {
    setStreaming(true);
    setMessages([...baseMessages, { role: "assistant", content: "" }]);
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const history = baseMessages.slice(-HISTORY_LIMIT).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, context, history }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated.length - 1;
                updated[last] = { ...updated[last], content: updated[last].content + data.content };
                return updated;
              });
            }
          } catch { /* 忽略非 JSON 行 */ }
        }
      }
    } catch (e: any) {
      const isStop = stoppedRef.current;
      const msg = isStop
        ? ""
        : e?.name === "AbortError"
          ? "⚠️ 请求超时，AI 服务响应较慢，请稍后再试。"
          : `⚠️ AI 服务暂时不可用，请稍后重试。(${e?.message || "连接异常"})`;
      stoppedRef.current = false;
      if (msg) {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated.length - 1;
          if (last >= 0 && updated[last].role === "assistant" && !updated[last].content) {
            updated[last] = { ...updated[last], content: msg };
          } else {
            updated.push({ role: "assistant", content: msg });
          }
          return updated;
        });
      } else {
        // 手动停止: 移除空的占位消息
        setMessages(prev => {
          const updated = [...prev];
          const last = updated.length - 1;
          if (last >= 0 && updated[last].role === "assistant" && !updated[last].content) updated.pop();
          return updated;
        });
      }
    }
    setStreaming(false);
    abortRef.current = null;
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  // 打开窗口时自动发起首个分析问题 (气泡只显示 startLabel 短标签)
  useEffect(() => {
    if (open && messages.length === 0) {
      chat([{ role: "user", content: startQuestion, display: startLabel }], startQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const askPreset = (p: AiPresetQuestion) => {
    if (streaming) return;
    chat([...messages, { role: "user", content: p.question, display: p.label }], p.question);
  };

  const sendInput = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    chat([...messages, { role: "user", content: text }], text);
  };

  const regenerate = () => {
    if (streaming || !messages.length) return;
    const lastUserIdx = messages
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter(i => i >= 0)
      .pop();
    if (lastUserIdx === undefined) return;
    chat(messages.slice(0, lastUserIdx + 1), messages[lastUserIdx].content);
  };

  const stop = () => {
    if (abortRef.current) {
      stoppedRef.current = true;
      abortRef.current.abort();
    }
  };

  return (
    <>
      {/* 弹窗内入口按钮 */}
      <button onClick={() => handleOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg transition-all hover:brightness-95"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.05))", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.3)" }}>
        <Sparkles className="w-3.5 h-3.5" /> {buttonText}
      </button>

      {/* 独立浮动窗口 (portal 到 body; 有空间时贴合主弹窗右侧, 否则屏幕右侧悬浮) */}
      {open && createPortal(
        <div
          className="fixed z-[80] w-[380px] flex flex-col rounded-2xl overflow-hidden"
          style={dockPos
            ? {
                left: dockPos.left,
                top: dockPos.top,
                height: dockPos.height,
                background: "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(250,250,250,0.97) 100%)",
                border: "1px solid rgba(139,92,246,0.25)",
                boxShadow: "var(--shadow-elevated)",
              }
            : {
                right: 20,
                top: "50%",
                transform: "translateY(-50%)",
                maxHeight: "78vh",
                background: "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(250,250,250,0.97) 100%)",
                border: "1px solid rgba(139,92,246,0.25)",
                boxShadow: "var(--shadow-elevated)",
              }}
          onClick={e => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="px-4 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid rgba(139,92,246,0.15)", background: "rgba(139,92,246,0.05)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(139,92,246,0.12)" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#8B5CF6" }} />
            </div>
            <p className="text-[14px] font-semibold truncate" style={{ color: "var(--color-ink-1)" }}>{title}</p>
            {streaming ? (
              <button onClick={stop} title="停止生成"
                className="ml-auto shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
                style={{ color: "var(--color-ink-4)" }}>
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={regenerate} title="重新生成"
                className="ml-auto shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
                style={{ color: "var(--color-ink-4)" }}>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => handleOpen(false)} title="关闭"
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
              style={{ color: "var(--color-ink-4)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 对话区: 用户问题(右侧气泡) + AI 流式回答 */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2 min-h-[180px]">
            {messages.map((m, i) => (
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <span className="text-[14px] leading-relaxed px-2.5 py-1.5 rounded-xl rounded-tr-sm max-w-[85%] text-right"
                    style={{ background: "rgba(139,92,246,0.12)", color: "#7C3AED" }}>
                    {m.display ?? m.content}
                  </span>
                </div>
              ) : (
                <div key={i} className="rounded-xl rounded-tl-sm px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.85)", border: "1px solid var(--color-muted)" }}>
                  {m.content
                    ? renderAiContent(m.content)
                    : (
                      <div className="flex items-center gap-1 py-1">
                        {[0, 1, 2].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ background: "#8B5CF6", animationDelay: `${d * 0.15}s` }} />
                        ))}
                        <span className="text-[14px] ml-1" style={{ color: "var(--color-ink-4)" }}>AI 正在分析…</span>
                      </div>
                    )}
                </div>
              )
            ))}
            <div ref={endRef} />
          </div>

          {/* 预设追问 chips (非流式时展示) */}
          {presets.length > 0 && !streaming && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2 shrink-0">
              {presets.map(p => (
                <button key={p.label} onClick={() => askPreset(p)}
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full transition-all hover:brightness-95"
                  style={{ background: "rgba(139,92,246,0.08)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.25)" }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* 自由输入栏: 用户可针对方案自己提问 */}
          <div className="px-3 py-2.5 flex items-end gap-2 shrink-0" style={{ borderTop: "1px solid rgba(139,92,246,0.15)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); resizeInput(); }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendInput();
                }
              }}
              rows={1}
              placeholder={streaming ? "AI 正在回答…" : "针对该方案提问，Enter 发送"}
              disabled={streaming}
              className="flex-1 resize-none rounded-xl px-2.5 py-1.5 text-[14px] leading-relaxed outline-none transition-colors"
              style={{
                border: "1px solid var(--color-muted)",
                background: streaming ? "var(--color-subtle)" : "#fff",
                color: "var(--color-ink-1)",
                maxHeight: 100,
              }}
            />
            <button onClick={sendInput} disabled={streaming || !input.trim()}
              title="发送"
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)", color: "#fff" }}>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
