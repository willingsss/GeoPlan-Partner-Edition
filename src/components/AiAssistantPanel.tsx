// AiAssistantPanel.tsx
// AI 智能助手 - 悬浮球 + 浮动对话面板 (拆分自 App.tsx)
// 纯展示组件: AI 状态/函数通过 props 注入, renderAiContent 本地渲染
import React from "react";
import { Bot, Check, Copy, LocateFixed, MapPin, RotateCcw, Send, Sparkles, Square, Trash, X } from "lucide-react";
// ===================================================================
// AI 回复内容渲染（简易 Markdown 美化）— 自 App.tsx 迁移
// ===================================================================
// AI 回复内容渲染（简易 Markdown 美化）
// =========================================================================
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(<span key={k++}>{text.slice(lastIndex, m.index)}</span>);
    const raw = m[0];
    if (raw.startsWith("**")) parts.push(<strong key={k++} className="font-semibold text-slate-900">{raw.slice(2, -2)}</strong>);
    else if (raw.startsWith("`")) parts.push(<code key={k++} className="bg-slate-200 text-purple-700 px-0.5 rounded text-[9px] font-mono">{raw.slice(1, -1)}</code>);
    else parts.push(<em key={k++} className="italic text-slate-700">{raw.slice(1, -1)}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<span key={k++}>{text.slice(lastIndex)}</span>);
  return <>{parts}</>;
}

function renderAiContent(text: string): React.ReactNode {
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
      const size = level === 1 ? "text-[11px]" : "text-[10px]";
      blocks.push(
        <div key={`h-${key++}`} className={`font-bold text-slate-800 ${size} mt-1.5 mb-0.5`}>
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
        <ul key={`ul-${key++}`} className="list-disc pl-3 space-y-0.5 my-1">
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
        <ol key={`ol-${key++}`} className="list-decimal pl-3 space-y-0.5 my-1">
          {items.map((item, idx) => <li key={idx}>{renderInline(item)}</li>)}
        </ol>
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

  return <div className="text-[10px] leading-relaxed text-slate-800">{blocks}</div>;
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
    userLocation, locateUser, visualizeGisAnalysis, flyToStationById,
  } = props;

  return (
    <>
      {/* ===== AI助手悬浮球 + 浮动面板 (Linear 风: 极简图标, 无渐变) ===== */}
      {/* 悬浮球 - 可拖动, 默认往上 20px (bottom: 44) */}
      <div
        className="fixed z-50 select-none"
        style={{ bottom: aiBallPos?.bottom ?? 44, right: aiBallPos?.right ?? 24, cursor: aiDragging ? "grabbing" : "grab" }}
        onMouseDown={(e) => {
          aiDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startBottom: aiBallPos?.bottom ?? 44,
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
          setAiPanelOpen(!aiPanelOpen);
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: aiPanelOpen ? "#18181B" : "var(--color-brand)",
            border: "1px solid " + (aiPanelOpen ? "#27272A" : "var(--color-brand-hover)"),
            boxShadow: aiPanelOpen
              ? "0 4px 16px rgba(0,0,0,0.15)"
              : "0 4px 16px rgba(0,200,150,0.25)",
            transform: aiBotBounce ? "scale(1.08)" : "scale(1)",
            transition: "transform var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)",
          }}
        >
          {aiPanelOpen ? (
            <X className="w-4 h-4 text-white" />
          ) : (
            <div className="relative">
              <Bot className="w-5 h-5 text-white" />
              {/* 状态指示点 */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-300 animate-status-pulse"
                style={{ border: "1.5px solid var(--color-brand)" }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 浮动AI面板 - Bento 3D 玻璃拟态 */}
      <div
        className="fixed z-50 w-[400px] max-w-[calc(100vw-48px)]"
        style={{
          bottom: (aiBallPos?.bottom ?? 44) + 60,
          right: aiBallPos?.right ?? 24,
          opacity: aiPanelOpen ? 1 : 0,
          transform: aiPanelOpen
            ? "perspective(1000px) rotateX(0deg) translateY(0) scale(1)"
            : "perspective(1000px) rotateX(4deg) translateY(12px) scale(0.96)",
          pointerEvents: aiPanelOpen ? "auto" : "none",
          transition: "opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out)",
          transformOrigin: "center bottom",
        }}
      >
        <div
          className="flex flex-col overflow-hidden bento-tile"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,250,0.9) 100%)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "var(--shadow-elevated)",
            borderRadius: 16,
            height: "min(560px, calc(100vh - 140px))",
          }}
        >
          {/* 面板头部 — 玻璃拟态 subtle */}
          <div
            className="shrink-0 px-3 py-2.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: "rgba(255,255,255,0.6)" }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
            >
              <Bot className="w-3.5 h-3.5 text-zinc-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[13px] font-semibold text-zinc-900">智能助手</h3>
                <span
                  className="text-[10px] px-1 py-0 rounded"
                  style={{
                    background: "rgba(0,200,150,0.08)",
                    color: "var(--color-brand-text)",
                    border: "1px solid rgba(0,200,150,0.2)",
                  }}
                >
                  在线
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">空间数据驱动 · 多轮对话</p>
            </div>
            <div className="flex items-center gap-1">
              {aiMessages.length > 0 && (
                <button onClick={clearAi}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-500 hover:text-red-500 transition-colors"
                  title="清空对话">
                  <Trash className="w-3 h-3" />
                </button>
              )}
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
                          : { background: "var(--color-subtle)", border: "1px solid var(--color-muted)", color: "var(--color-ink-1)", borderRadius: "var(--radius-md) var(--radius-md) 2px var(--radius-md)" }
                      }
                    >
                      {msg.role === "user"
                        ? msg.content
                        : (
                          <>
                            {msg.gisResult && (
                              <div className="mb-2">
                                {/* GIS 卡片 - Linear 风: 无渐变, 单色边框 + 大等宽数字 */}
                                <div
                                  className="rounded-md p-2.5 mb-1.5"
                                  style={{
                                    background: "var(--color-surface)",
                                    border: "1px solid var(--color-muted)",
                                    borderLeft: "2px solid var(--color-brand)",
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
                                        background: "rgba(0,200,150,0.08)",
                                        color: "var(--color-brand-text)",
                                      }}
                                    >
                                      空间分析
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    <div
                                      className="rounded px-1.5 py-1 text-center"
                                      style={{ background: "var(--color-subtle)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">{msg.gisResult.count}</p>
                                      <p className="text-[9px] text-zinc-500">充电站</p>
                                    </div>
                                    <div
                                      className="rounded px-1.5 py-1 text-center"
                                      style={{ background: "var(--color-subtle)" }}
                                    >
                                      <p className="text-[15px] font-bold text-zinc-900 font-num">
                                        {msg.gisResult.coveredPopulation >= 10000
                                          ? `${(msg.gisResult.coveredPopulation / 10000).toFixed(1)}万`
                                          : msg.gisResult.coveredPopulation.toLocaleString()}
                                      </p>
                                      <p className="text-[9px] text-zinc-500">覆盖人口</p>
                                    </div>
                                    <div
                                      className="rounded px-1.5 py-1 text-center"
                                      style={{ background: "var(--color-subtle)" }}
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
                                    className="w-full text-[11px] py-1 rounded flex items-center justify-center gap-1 transition-colors font-medium"
                                    style={{
                                      background: "var(--color-brand-subtle)",
                                      border: "1px solid var(--color-brand-border)",
                                      color: "var(--color-brand-text)",
                                    }}
                                  >
                                    <MapPin className="w-3 h-3" /> 在地图上查看
                                  </button>
                                </div>

                                {msg.gisResult.stations.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-zinc-500">点击可跳转至地图</p>
                                    {msg.gisResult.stations.map((station) => (
                                      <button
                                        key={station.id}
                                        onClick={() => flyToStationById(station.id)}
                                        className="w-full text-left p-1.5 rounded-md transition-all group"
                                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)" }}
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

          {/* 输入区域 - Linear 风: 紧凑, 黑底白字发送 */}
          <div
            className="shrink-0 px-3 py-2.5 bg-white"
            style={{ borderTop: "1px solid var(--color-muted)" }}
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
                className="input-sys flex-1 text-[12px] px-2.5 py-1.5 text-zinc-900 resize-none overflow-hidden min-h-[32px] max-h-[120px]"
              />
              <button onClick={aiStreaming ? stopAi : sendAiMessage}
                disabled={!aiStreaming && !aiInput.trim()}
                className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center transition-all ${
                  aiStreaming
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white disabled:bg-zinc-200 disabled:text-zinc-400"
                }`}>
                {aiStreaming ? <Square className="w-3 h-3" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
