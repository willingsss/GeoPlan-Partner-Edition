// AiAssistantPanel.tsx
// AI 智能助手 - 悬浮球 + 浮动对话面板 (拆分自 App.tsx)
// 纯展示组件: AI 状态/函数通过 props 注入, renderAiContent 本地渲染
import React, { useState } from "react";
import { Check, Copy, LocateFixed, MapPin, RotateCcw, Send, Sparkles, Square, Trash, X, Target } from "lucide-react";

// ===================================================================
// DeepSeek 鲸鱼图标 (单 path, 24x24, 品牌蓝 #4D6BFE)
// ===================================================================
function DeepSeekIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.5 5.5 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11 11 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428s-1.67.295-2.687.684a3 3 0 0 1-.465.137 9.6 9.6 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.2 4.2 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.7 4.7 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614m1-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.7 1.7 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.56.56 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452" />
    </svg>
  );
}
// ===================================================================
// AI 回复内容渲染（简易 Markdown 美化）— 自 App.tsx 迁移
// ===================================================================
// AI 回复内容渲染（简易 Markdown 美化）
// =========================================================================
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // 支持 **加粗** *斜体* `代码` [链接](url)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(<span key={k++}>{text.slice(lastIndex, m.index)}</span>);
    const raw = m[0];
    if (raw.startsWith("**")) parts.push(<strong key={k++} className="font-semibold text-slate-900">{raw.slice(2, -2)}</strong>);
    else if (raw.startsWith("`")) parts.push(<code key={k++} className="bg-slate-200 text-purple-700 px-0.5 rounded text-[13px] font-mono">{raw.slice(1, -1)}</code>);
    else if (raw.startsWith("[")) {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a key={k++} href={linkMatch[2]} target="_blank" rel="noreferrer"
            className="text-sky-600 underline decoration-dotted underline-offset-2 hover:text-sky-700">
            {linkMatch[1]}
          </a>
        );
      } else parts.push(<span key={k++}>{raw}</span>);
    }
    else parts.push(<em key={k++} className="italic text-slate-700">{raw.slice(1, -1)}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<span key={k++}>{text.slice(lastIndex)}</span>);
  return <>{parts}</>;
}

// 供 AiAnalysisBlock (深度评估/方案对比弹窗 AI 解读) 复用
export function renderAiContent(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (paras: string[]) => {
    if (!paras.length) return;
    const content = paras.map(s => s.trim()).join(" ").trim();
    if (content) blocks.push(<p key={`p-${key++}`} className="my-0.5">{renderInline(content)}</p>);
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // 代码块
    if (trimmed.startsWith("```")) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre key={`pre-${key++}`} className="bg-slate-800 text-slate-100 rounded p-1.5 overflow-x-auto text-[9px] my-1">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const size = level === 1 ? "text-[16px]" : "text-[14px]";
      blocks.push(
        <div key={`h-${key++}`} className={`font-bold text-slate-800 ${size} mt-2.5 mb-1`}>
          {renderInline(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // 无序列表
    if (/^[*-]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[*-]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[*-]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-4 space-y-1 my-1.5">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="list-decimal pl-4 space-y-1 my-1.5">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // 表格: | 分隔, 第二行 --- 分隔表头
    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().includes("|")) {
        const cells = lines[i].trim().split("|").slice(1, -1).map(c => c.trim());
        rows.push(cells);
        i++;
      }
      // 去掉分隔行 (|---|---|)
      const header = rows[0] || [];
      const bodyRows = rows.slice(1).filter(r => !r.every(c => /^[-:]+$/.test(c)));
      blocks.push(
        <table key={`tbl-${key++}`} className="w-full text-[12px] my-1 rounded overflow-hidden"
          style={{ borderCollapse: "collapse", border: "1px solid var(--color-muted)" }}>
          <thead>
            <tr style={{ background: "var(--color-subtle)" }}>
              {header.map((h, idx) => (
                <th key={idx} className="px-1.5 py-1 font-semibold text-left" style={{ color: "var(--color-ink-3)", borderBottom: "1px solid var(--color-muted)" }}>
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: ri < bodyRows.length - 1 ? "1px solid var(--color-subtle)" : "none" }}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-1.5 py-0.5" style={{ color: "var(--color-ink-3)" }}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // 普通段落（合并连续行）
    const paras: string[] = [raw];
    i++;
    while (i < lines.length && lines[i].trim() !== "") {
      paras.push(lines[i]);
      i++;
    }
    flushParagraph(paras);
  }

  return <div className="text-[14px] leading-relaxed text-slate-800">{blocks}</div>;
}

// =========================================================================
// 单方案综合评分: 归一化加权 (与 SiteResultPanel 一致, 弹窗复用)
// =========================================================================
function calcSchemeScore(m: any): { score: number; grade: string; gradeColor: string } {
  const pop = Math.min(Number(m.covered_population) / 20000, 1) * 30;      // 30%
  const comm = Math.min(Number(m.covered_communities) / 10, 1) * 15;       // 15%
  const comp = Math.min(Number(m.competition_score ?? 0) / 100, 1) * 20;   // 20%
  const benefit = Math.min(Number(m.social_benefit ?? 0) / 100, 1) * 20;   // 20%
  const blind = Math.min(Number(m.blind_spot_reduction ?? 0) / 100, 1) * 15; // 15%
  const score = Math.round(pop + comm + comp + benefit + blind);
  if (score >= 85) return { score, grade: "A·优", gradeColor: "#10B981" };
  if (score >= 70) return { score, grade: "B·良", gradeColor: "#38BDF8" };
  if (score >= 55) return { score, grade: "C·中", gradeColor: "#F59E0B" };
  return { score, grade: "D·待优化", gradeColor: "#F43F5E" };
}
interface AiAssistantPanelProps {
  aiPanelOpen: boolean;
  setAiPanelOpen: (v: boolean) => void;
  aiBallPos: { bottom: number; right: number } | null;
  setAiBallPos: (v: { bottom: number; right: number } | null) => void;
  aiDragging: boolean;
  setAiDragging: (v: boolean) => void;
  aiBotBounce: boolean;
  setAiBotBounce: (v: boolean) => void;
  aiDragRef: React.MutableRefObject<{ startX: number; startY: number; startBottom: number; startRight: number; moved: boolean }>;
  aiMessages: { role: "user" | "assistant"; content: string; gisResult?: any }[];
  aiStreaming: boolean;
  aiInput: string;
  setAiInput: (v: string) => void;
  copiedIndex: number | null;
  aiInputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  aiMessagesEndRef: React.MutableRefObject<HTMLDivElement | null>;
  sendAiMessage: () => void;
  stopAi: () => void;
  regenerateAi: () => void;
  clearAi: () => void;
  copyAi: (text: string, index: number) => void;
  sendAiText: (text: string) => void;
  // AI 推荐一键转选址方案: center/radius 为推荐选址位置
  onAiSaveScheme: (center: [number, number], radius: number) => void;
  userLocation: { lng: number; lat: number; accuracy?: number } | null;
  locateUser: () => void;
  visualizeGisAnalysis: (params: { stations: number[]; communities: number[]; center: [number, number]; radius: number }) => void;
  flyToStationById: (id: number) => void;
}

export default function AiAssistantPanel(props: AiAssistantPanelProps) {
  const {
    aiPanelOpen, setAiPanelOpen, aiBallPos, setAiBallPos, aiDragging, setAiDragging,
    aiBotBounce, setAiBotBounce, aiDragRef, aiMessages, aiStreaming,
    aiInput, setAiInput, copiedIndex, aiInputRef, aiMessagesEndRef,
    sendAiMessage, stopAi, regenerateAi, clearAi, copyAi,
    sendAiText,
    onAiSaveScheme,
    userLocation, locateUser, visualizeGisAnalysis, flyToStationById,
  } = props;
  // GIS 结果卡: 站点排序 (默认按距离, 可切名称)
  const [stationSort, setStationSort] = useState<"distance" | "name">("distance");

  return (
    <>
      {/* ===== AI助手悬浮球: 圆形液态玻璃 + DeepSeek 鲸鱼, 默认右侧居中, 打开后隐藏 ===== */}
      {!aiPanelOpen && (
      <div
        className="fixed z-50 select-none"
        style={{
          // 默认位置: 页面右侧垂直居中; 拖动后跟随 aiBallPos (右下角锚点)
          ...(aiBallPos
            ? { bottom: aiBallPos.bottom, right: aiBallPos.right }
            : { top: "50%", right: 24, transform: "translateY(-50%)" }),
          cursor: aiDragging ? "grabbing" : "grab",
        }}
        onMouseDown={(e) => {
          aiDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startBottom: aiBallPos?.bottom ?? Math.round(window.innerHeight / 2 - 24),
            startRight: aiBallPos?.right ?? 24,
            moved: false,
          };
          setAiDragging(false);
          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - aiDragRef.current.startX;
            const dy = ev.clientY - aiDragRef.current.startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
              aiDragRef.current.moved = true;
              setAiDragging(true);
              // 右下角锚点: 鼠标向右移 → right 减小; 鼠标向下移 → bottom 减小
              const newRight = Math.max(8, Math.min(window.innerWidth - 60, aiDragRef.current.startRight - dx));
              const newBottom = Math.max(8, Math.min(window.innerHeight - 60, aiDragRef.current.startBottom - dy));
              setAiBallPos({ bottom: newBottom, right: newRight });
            }
          };
          const onUp = () => {
            setAiDragging(false);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        onClick={() => {
          if (aiDragRef.current.moved) return;
          setAiBotBounce(true);
          setTimeout(() => setAiBotBounce(false), 400);
          setAiPanelOpen(true);
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
          style={{
            // 液态玻璃: 半透明白底 + 高饱和折射 + 镜面高光描边
            background: "linear-gradient(165deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.6) 100%)",
            backdropFilter: "blur(20px) saturate(1.8) brightness(1.06)",
            WebkitBackdropFilter: "blur(20px) saturate(1.8) brightness(1.06)",
            border: "1px solid rgba(255,255,255,0.65)",
            boxShadow:
              "0 8px 32px -6px rgba(0,0,0,0.22), 0 2px 8px -2px rgba(0,0,0,0.1), inset 0 1.5px 1px -0.5px rgba(255,255,255,0.95), inset 0 -1.5px 1px -0.5px rgba(255,255,255,0.35)",
            transform: aiBotBounce ? "scale(1.1)" : "scale(1)",
            transition: "transform var(--duration-fast) var(--ease-out)",
          }}
        >
          <div className="relative">
            {/* DeepSeek 鲸鱼图标 (品牌蓝) */}
            <DeepSeekIcon className="w-7 h-7" style={{ color: "#4D6BFE" }} />
            {/* 状态指示点 */}
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-status-pulse"
              style={{ border: "1.5px solid rgba(255,255,255,0.9)" }}
            />
          </div>
        </div>
      </div>
      )}

      {/* ===== 竖形 AI 对话框: 右侧居中悬浮, 液态玻璃 (降透明度), 打开时悬浮球隐藏 ===== */}
      <div
        className="fixed z-50"
        style={{
          top: "50%",
          right: 16,
          transform: aiPanelOpen ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(24px)",
          opacity: aiPanelOpen ? 1 : 0,
          pointerEvents: aiPanelOpen ? "auto" : "none",
          transition: "opacity var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out)",
        }}
      >
        <div
          className="flex flex-col overflow-hidden"
          style={{
            // 液态玻璃 (透明度降低, 更通透): 半透明白 + 高饱和折射 + 镜面高光
            background: "linear-gradient(165deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.32) 45%, rgba(255,255,255,0.44) 100%)",
            backdropFilter: "blur(32px) saturate(1.8) brightness(1.05)",
            WebkitBackdropFilter: "blur(32px) saturate(1.8) brightness(1.05)",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow:
              "0 16px 48px -12px rgba(0,0,0,0.28), 0 4px 12px -4px rgba(0,0,0,0.12), inset 0 1.5px 1px -0.5px rgba(255,255,255,0.9), inset 0 -1.5px 1px -0.5px rgba(255,255,255,0.3)",
            borderRadius: 22,
            width: "min(400px, calc(100vw - 32px))",
            height: "min(720px, calc(100vh - 32px))",
          }}
        >
          {/* 面板头部 — 液态玻璃, 含关闭按钮 (悬浮球已隐藏, 关闭入口在此) */}
          <div
            className="shrink-0 px-3.5 py-3 flex items-center gap-2.5"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(165deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.5) 100%)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.8)",
              }}
            >
              <DeepSeekIcon className="w-4.5 h-4.5" style={{ color: "#4D6BFE", width: 18, height: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-zinc-900">智能助手</h3>
                <span
                  className="text-[10px] px-1 py-0 rounded"
                  style={{
                    background: "rgba(77,107,254,0.08)",
                    color: "#4D6BFE",
                    border: "1px solid rgba(77,107,254,0.2)",
                  }}
                >
                  在线
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">DeepSeek · 空间数据驱动 · 多轮对话</p>
            </div>
            <div className="flex items-center gap-1">
              {aiMessages.length > 0 && (
                <button onClick={clearAi}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-500 transition-all"
                  style={{ background: "transparent", border: "1px solid transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  title="清空对话">
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setAiPanelOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-all"
                style={{ background: "transparent", border: "1px solid transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                title="收起对话 (悬浮球恢复显示)">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {aiMessages.length === 0 && (
              <div className="py-6">
                <div className="flex items-start gap-2.5 mb-4">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-zinc-800 font-medium">GeoPlan AI 助手</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      可分析充电站分布、识别盲区、规划选址、空间查询。试试以下问题：
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {[
                    "徐州市充电设施分布概况",
                    "如何识别充电盲区",
                    "推荐几个选址方案",
                    "充电站品牌各自特点",
                    ...(userLocation ? ["推荐离我最近的充电站"] : []),
                  ].map(q => (
                    <button key={q} onClick={() => { setAiInput(q); }}
                      className="block w-full text-[11.5px] text-left px-2.5 py-1.5 rounded-md text-zinc-700 transition-all hover:bg-zinc-50 group"
                      style={{ border: "1px solid var(--color-muted)" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 group-hover:text-zinc-700 transition-colors">→</span>
                        <span className="flex-1">{q}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {!userLocation && (
                  <button onClick={locateUser}
                    className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1 mx-auto transition-colors"
                    style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)", padding: "4px 10px", borderRadius: "var(--radius-sm)" }}>
                    <LocateFixed className="w-3 h-3" /> 启用位置服务
                  </button>
                )}
              </div>
            )}
            {aiMessages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && i === aiMessages.length - 1;
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[88%]">
                    <div
                      className={`px-2.5 py-2 text-[12px] leading-relaxed ${
                        msg.role === "user"
                          ? "text-white whitespace-pre-wrap rounded-br-sm"
                          : "rounded-bl-sm"
                      }`}
                      style={
                        msg.role === "user"
                          ? { background: "var(--color-brand)", borderRadius: "var(--radius-md) var(--radius-md) 2px var(--radius-md)" }
                          : { background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.6)", color: "var(--color-ink-1)", borderRadius: "var(--radius-md) var(--radius-md) 2px var(--radius-md)" }
                      }
                    >
                      {msg.role === "user"
                        ? msg.content
                        : (
                          <>
                            {msg.gisResult && (
                              <div className="mb-2">
                                {/* GIS 卡片 - 液态玻璃: 半透明白 + 高光描边, 与对话面板同质感 */}
                                <div
                                  className="rounded-xl p-2.5 mb-1.5"
                                  style={{
                                    background: "linear-gradient(165deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 100%)",
                                    border: "1px solid rgba(255,255,255,0.65)",
                                    boxShadow: "0 4px 16px -6px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
                                  }}
                                >
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Sparkles className="w-3 h-3 text-zinc-700" />
                                    <span className="text-[11px] font-semibold text-zinc-900">
                                      {(msg.gisResult.radius > 0 ? `${(msg.gisResult.radius / 1000).toFixed(1)}公里 缓冲区` : msg.gisResult.district || msg.gisResult.brand) + " 空间分析"}
                                    </span>
                                    <span
                                      className="text-[9px] px-1 py-0 rounded ml-auto"
                                      style={{
                                        background: "rgba(0,200,150,0.12)",
                                        color: "var(--color-brand-text)",
                                        border: "1px solid rgba(0,200,150,0.25)",
                                      }}
                                    >
                                      空间分析
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    <div
                                      className="rounded-lg px-1.5 py-1 text-center"
                                      style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">{msg.gisResult.count}</p>
                                      <p className="text-[9px] text-zinc-500">充电站</p>
                                    </div>
                                    <div
                                      className="rounded-lg px-1.5 py-1 text-center"
                                      style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">
                                        {msg.gisResult.coveredPopulation >= 10000
                                          ? `${(msg.gisResult.coveredPopulation / 10000).toFixed(1)}万`
                                          : msg.gisResult.coveredPopulation.toLocaleString()}
                                      </p>
                                      <p className="text-[9px] text-zinc-500">覆盖人口</p>
                                    </div>
                                    <div
                                      className="rounded-lg px-1.5 py-1 text-center"
                                      style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.55)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">{msg.gisResult.coveredCommunities}</p>
                                      <p className="text-[9px] text-zinc-500">覆盖社区</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => msg.gisResult && visualizeGisAnalysis({
                                      stations: msg.gisResult.stations.map(s => s.id),
                                      communities: [],
                                      center: msg.gisResult.center,
                                      radius: msg.gisResult.radius,
                                    })}
                                    className="flex-1 text-[11px] py-1 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium"
                                    style={{
                                      background: "rgba(0,200,150,0.14)",
                                      border: "1px solid rgba(0,200,150,0.3)",
                                      color: "var(--color-brand-text)",
                                    }}
                                  >
                                    <MapPin className="w-3 h-3" /> 在地图上查看
                                  </button>
                                  {/* AI 推荐一键转选址方案 */}
                                  {msg.gisResult.center && (
                                    <button
                                      onClick={() => onAiSaveScheme(msg.gisResult!.center, msg.gisResult!.radius || 800)}
                                      className="flex-1 mt-1.5 w-full text-[11px] py-1 rounded-lg flex items-center justify-center gap-1 transition-colors font-medium"
                                      style={{
                                        background: "rgba(168,85,247,0.12)",
                                        border: "1px solid rgba(168,85,247,0.3)",
                                        color: "#7C3AED",
                                      }}
                                    >
                                      <Target className="w-3 h-3" /> 保存为选址方案
                                    </button>
                                  )}
                                </div>

                                {msg.gisResult.stations.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] text-zinc-500">点击可跳转至地图</p>
                                      {/* 站点排序 */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setStationSort("distance")}
                                          className={`text-[9px] px-1 py-0 rounded transition-colors ${stationSort === "distance" ? "font-semibold" : "opacity-60"}`}
                                          style={{ color: stationSort === "distance" ? "var(--color-brand-text)" : "var(--color-ink-5)", background: stationSort === "distance" ? "var(--color-brand-subtle)" : "transparent" }}
                                        >
                                          按距离
                                        </button>
                                        <button
                                          onClick={() => setStationSort("name")}
                                          className={`text-[9px] px-1 py-0 rounded transition-colors ${stationSort === "name" ? "font-semibold" : "opacity-60"}`}
                                          style={{ color: stationSort === "name" ? "var(--color-brand-text)" : "var(--color-ink-5)", background: stationSort === "name" ? "var(--color-brand-subtle)" : "transparent" }}
                                        >
                                          按名称
                                        </button>
                                      </div>
                                    </div>
                                    {[...msg.gisResult.stations]
                                      .sort((a, b) => stationSort === "distance"
                                        ? (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)
                                        : a.name.localeCompare(b.name, "zh"))
                                      .map((station) => (
                                      <button
                                        key={station.id}
                                        onClick={() => flyToStationById(station.id)}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.7)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.45)"; }}
                                        className="w-full text-left p-1.5 rounded-lg transition-all group"
                                        style={{ background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5)" }}
                                      >
                                        <div className="flex items-start gap-1.5">
                                          <MapPin className="w-3 h-3 text-zinc-400 group-hover:text-zinc-900 shrink-0 mt-0.5 transition-colors" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-zinc-800 truncate group-hover:text-zinc-900 transition-colors">
                                              {station.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 mt-0.5">
                                              {station.distanceKm != null && (
                                                <span className="text-emerald-600 font-semibold">{station.distanceKm}公里</span>
                                              )}
                                              <span>{station.brand}</span>
                                              <span>· 快{station.fastChargers}/慢{station.slowChargers}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {msg.content
                              ? renderAiContent(msg.content)
                              : (
                                <div className="flex items-center gap-1.5 text-zinc-500">
                                  <span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse" />
                                  <span className="text-[11px]">思考中...</span>
                                </div>
                              )}
                          </>
                        )}
                    </div>
                    {msg.role === "assistant" && msg.content && (
                      <div className="flex items-center justify-end gap-0.5 mt-1">
                        <button onClick={() => copyAi(msg.content, i)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-100 transition-colors"
                          title={copiedIndex === i ? "已复制" : "复制内容"}>
                          {copiedIndex === i
                            ? <Check className="w-3 h-3 text-emerald-500" />
                            : <Copy className="w-3 h-3 text-zinc-400" />}
                        </button>
                        {isLastAssistant && !aiStreaming && (
                          <button onClick={regenerateAi}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-100 transition-colors"
                            title="重新生成">
                            <RotateCcw className="w-3 h-3 text-zinc-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={aiMessagesEndRef} />
          </div>

          {/* AI 站点详情已移至地图 Overlay */}

          {/* 快捷指令 - 一键触发常见问题 (透明, 融入玻璃) */}
          <div className="shrink-0 px-3 pt-2 pb-0 flex gap-1.5 flex-wrap"
            style={{ borderTop: aiMessages.length > 0 ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
            {["推荐附近站点", "分析盲区缺口", "选址建议", "站点评价", "全市充电分布", "推荐选址区域"].map(q => (
              <button key={q}
                onClick={() => sendAiText(q)}
                disabled={aiStreaming}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-40"
                style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand-text)", border: "1px solid var(--color-brand-border)" }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* 输入区域 - 透明融入玻璃, 黑底白字发送 */}
          <div
            className="shrink-0 px-3 py-2.5"
            style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex gap-1.5 items-end">
              <textarea
                ref={aiInputRef}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendAiMessage();
                  }
                }}
                placeholder="输入问题 · 回车发送 · Shift+回车换行"
                disabled={aiStreaming}
                rows={1}
                className="flex-1 text-[12px] px-2.5 py-1.5 text-zinc-900 resize-none overflow-hidden min-h-[32px] max-h-[120px] rounded-lg outline-none placeholder:text-zinc-400 transition-all"
                style={{
                  background: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(77,107,254,0.5)";
                  e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.05), 0 0 0 3px rgba(77,107,254,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
                  e.currentTarget.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.05)";
                }}
              />
              <button onClick={aiStreaming ? stopAi : sendAiMessage}
                disabled={!aiStreaming && !aiInput.trim()}
                className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-all ${
                  aiStreaming
                    ? "text-white"
                    : "text-white disabled:opacity-40"
                }`}
                style={aiStreaming
                  ? { background: "#EF4444", boxShadow: "0 2px 8px rgba(239,68,68,0.35)" }
                  : { background: "linear-gradient(180deg, #4D6BFE 0%, #3D5BF5 100%)", boxShadow: "0 2px 8px rgba(77,107,254,0.35), inset 0 1px 1px rgba(255,255,255,0.25)" }
                }>
                {aiStreaming ? <Square className="w-3 h-3" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
