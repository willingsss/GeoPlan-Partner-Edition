// useAiAssistant.ts
// AI 智能助手 - 对话状态 + SSE 流式对话 (拆分自 App.tsx)
// 多轮上下文: 只传最近 8 条历史, 避免上下文过长
import { useState, useRef, useEffect } from "react";

export interface AiGisStation {
  id: number;
  name: string;
  brand: string;
  lng: number;
  lat: number;
  address: string;
  district: string;
  fastChargers: number;
  slowChargers: number;
  distanceKm?: number;
}

export interface AiGisResult {
  type: string;
  radius: number;
  center: [number, number];
  count: number;
  coveredPopulation: number;
  coveredCommunities: number;
  district?: string;
  brand?: string;
  stations: AiGisStation[];
}

interface UseAiAssistantOptions {
  userLocation: { lng: number; lat: number; accuracy?: number } | null;
  // 当前登录账号 ID: 历史记录按账号隔离, 未登录时不读写
  userId?: number | null;
  // GIS 结果到达回调 (App 侧负责地图可视化)
  onGisResult?: (result: any) => void;
}

const HISTORY_LIMIT = 8; // 多轮上下文: 最近 8 条
// 会话持久化: 按账号隔离, 每个账号各自独立的历史记录
const aiStorageKey = (userId?: number | null) =>
  userId != null ? `geoplan_ai_messages_${userId}` : null;

const loadAiMessages = (key: string | null) => {
  if (!key) return [];
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch { /* 忽略损坏数据 */ }
  return [];
};

// 解析后端错误响应, 返回给用户可读的提示 (401 = 登录失效而非服务故障)
export async function aiErrorMessage(res: Response): Promise<string> {
  if (res.status === 401) return "登录已失效，请重新登录后再使用 AI 功能。";
  try {
    const json = await res.json();
    if (json?.message) return `AI 请求失败: ${json.message}`;
  } catch { /* 响应体非 JSON */ }
  return `AI 请求失败 (HTTP ${res.status})`;
}

export default function useAiAssistant({ userLocation, userId, onGisResult }: UseAiAssistantOptions) {
  const aiAbortRef = useRef<AbortController | null>(null);
  const gisResultRef = useRef<{ stations: number[]; communities: number[]; center?: [number, number]; radius?: number } | null>(null);
  // 会话持久化: 刷新后恢复历史对话 (key 按账号隔离)
  const storageKey = aiStorageKey(userId);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string; gisResult?: AiGisResult }[]>(() => loadAiMessages(storageKey));
  // 登录 / 切换账号 / 登出时: 加载该账号自己的历史, 未登录则清空
  useEffect(() => {
    if (aiAbortRef.current) {
      aiStoppedRef.current = true; // 静默中断进行中的流, 避免超时提示写入新账号记录
      aiAbortRef.current.abort();
    }
    setAiMessages(loadAiMessages(storageKey));
    gisResultRef.current = null;
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      // 只保留最近 30 条, 避免 localStorage 膨胀
      localStorage.setItem(storageKey, JSON.stringify(aiMessages.slice(-30)));
    } catch { /* 超出配额时忽略 */ }
  }, [aiMessages, storageKey]);
  const [aiInput, setAiInput] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiDragging, setAiDragging] = useState(false);
  const [aiBotBounce, setAiBotBounce] = useState(false);
  const [aiBallPos, setAiBallPos] = useState<{ bottom: number; right: number } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const aiDragRef = useRef<{ startX: number; startY: number; startBottom: number; startRight: number; moved: boolean }>({ startX: 0, startY: 0, startBottom: 0, startRight: 0, moved: false });
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement | null>(null);
  const aiStoppedRef = useRef(false);

  // ===== 滚动/输入框自适应 =====
  const scrollAiToBottom = () => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };
  const resizeAiInput = () => {
    const el = aiInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  useEffect(() => { resizeAiInput(); }, [aiInput]);
  useEffect(() => { scrollAiToBottom(); }, [aiMessages, aiStreaming]);

  // ===== SSE 流式对话 =====
  const doAiChat = async (baseMessages: { role: "user" | "assistant"; content: string }[], userText: string) => {
    setAiStreaming(true);
    setAiMessages([...baseMessages, { role: "assistant", content: "" }]);
    try {
      const context = userLocation
        ? `用户当前位置 (WGS84): 经度 ${userLocation.lng.toFixed(6)}, 纬度 ${userLocation.lat.toFixed(6)}`
        : undefined;
      const controller = new AbortController();
      aiAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      // 多轮上下文优化: 只传最近 HISTORY_LIMIT 条
      const history = baseMessages.slice(-HISTORY_LIMIT).map(m => ({ role: m.role, content: m.content }));
      // 后端 /ai/chat 挂了 requireAuth, 必须携带登录 token
      const token = localStorage.getItem("geoplan_token");
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userText,
          context,
          history,
          userLocation: userLocation ? { lng: userLocation.lng, lat: userLocation.lat } : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok || !res.body) throw new Error(await aiErrorMessage(res));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.gisResult) {
                setAiMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], gisResult: data.gisResult };
                  return updated;
                });
                gisResultRef.current = {
                  stations: data.gisResult.stations.map((s: any) => s.id),
                  communities: [],
                  center: data.gisResult.center,
                  radius: data.gisResult.radius,
                };
                onGisResult?.(data.gisResult);
              }
              if (data.content) {
                setAiMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    role: "assistant",
                    content: updated[updated.length - 1].content + data.content,
                  };
                  return updated;
                });
              }
            } catch { /* 忽略非 JSON 行 */ }
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        if (aiStoppedRef.current) {
          aiStoppedRef.current = false;
          setAiStreaming(false);
          return;
        }
        setAiMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "⚠️ 请求超时，AI 服务响应较慢，请稍后再试。" };
          return updated;
        });
      } else {
        console.error(e);
        setAiMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "⚠️ " + (e?.message || "AI 服务暂时不可用，请稍后重试。") };
          return updated;
        });
      }
    }
    setAiStreaming(false);
    aiAbortRef.current = null;
  };

  const sendAiMessage = async () => {
    const text = aiInput.trim();
    if (!text || aiStreaming) return;
    setAiInput("");
    if (aiInputRef.current) aiInputRef.current.style.height = "auto";
    const baseMessages = [...aiMessages, { role: "user" as const, content: text }];
    await doAiChat(baseMessages, text);
  };

  // 快捷指令: 以预设文本直接发送 (不清空输入框)
  const sendAiText = async (text: string) => {
    if (!text.trim() || aiStreaming) return;
    const baseMessages = [...aiMessages, { role: "user" as const, content: text.trim() }];
    await doAiChat(baseMessages, text.trim());
  };

  const stopAi = () => {
    if (aiAbortRef.current) {
      aiStoppedRef.current = true;
      aiAbortRef.current.abort();
    }
  };

  const regenerateAi = async () => {
    if (aiStreaming) return;
    const lastUserIndex = aiMessages
      .map((m, i) => (m.role === "user" ? i : -1))
      .filter(i => i >= 0)
      .pop();
    if (lastUserIndex === undefined) return;
    const text = aiMessages[lastUserIndex].content;
    const baseMessages = aiMessages.slice(0, lastUserIndex + 1);
    await doAiChat(baseMessages, text);
  };

  const clearAi = () => {
    setAiMessages([]);
    setAiInput("");
    if (aiInputRef.current) aiInputRef.current.style.height = "auto";
    gisResultRef.current = null;
  };

  const copyAi = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch { /* ignore */ }
  };

  return {
    aiMessages, setAiMessages,
    aiInput, setAiInput,
    aiStreaming, setAiStreaming,
    aiPanelOpen, setAiPanelOpen,
    aiDragging, setAiDragging,
    aiBotBounce, setAiBotBounce,
    aiBallPos, setAiBallPos,
    copiedIndex, setCopiedIndex,
    aiDragRef, aiAbortRef, aiMessagesEndRef, aiInputRef, aiStoppedRef,
    gisResultRef,
    sendAiMessage, sendAiText, stopAi, regenerateAi, clearAi, copyAi,
  };
}
