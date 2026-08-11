// useAdminPanel.ts
// 系统管理子系统 - 全部状态 + 数据加载 + 等时圈预计算 (拆分自 App.tsx)
// 依赖注入: authFetch / showToast / asArray / normalizeStations / activeTab
import { useState, useEffect, useCallback } from "react";

export default function useAdminPanel(opts: {
  authFetch: (url: string, init?: any) => Promise<Response>;
  showToast: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
  asArray: (value: any) => any[];
  normalizeStations: (data: any) => any[];
  activeTab: string;
}) {
  const { authFetch, showToast, asArray, normalizeStations, activeTab } = opts;

  const [adminTab, setAdminTab] = useState<"overview" | "stations" | "users" | "feedback" | "schemes" | "logs" | "report" | "isochrone">("overview");
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [adminStations, setAdminStations] = useState<any[]>([]);
  const [adminFeedback, setAdminFeedback] = useState<any[]>([]);
  const [adminSchemes, setAdminSchemes] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminEditing, setAdminEditing] = useState<any>(null);
  const [adminLogFilter, setAdminLogFilter] = useState("all");
  // 等时圈预计算状态
  const [isochroneProgress, setIsochroneProgress] = useState<any>(null);
  const [isochronePolling, setIschronePolling] = useState(false);

  // 加载全部管理数据 (刷新按钮 + 各操作后)
  const loadAdminData = useCallback(() => {
    if (!authFetch) return;
    authFetch("/api/v1/users")
      .then(r => r.json())
      .then(j => setUsers(j.success ? asArray(j.data) : []))
      .catch(() => setUsers([]));
    authFetch("/api/v1/logs")
      .then(r => r.json())
      .then(j => setLogs(j.success ? asArray(j.data) : []))
      .catch(() => setLogs([]));
    authFetch("/api/v1/stations")
      .then(r => r.json())
      .then(j => setAdminStations(j.success ? normalizeStations(j.data) : []))
      .catch(() => setAdminStations([]));
    authFetch("/api/v1/feedback/all")
      .then(r => r.json())
      .then(j => setAdminFeedback(j.success ? asArray(j.data) : []))
      .catch(() => setAdminFeedback([]));
    authFetch("/api/v1/schemes")
      .then(r => r.json())
      .then(j => setAdminSchemes(j.success ? asArray(j.data) : []))
      .catch(() => setAdminSchemes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  // 进入 admin Tab 时加载一次
  useEffect(() => {
    if (activeTab === "admin") loadAdminData();
  }, [activeTab, loadAdminData]);

  // ===== 等时圈预计算 =====
  const fetchIsochroneProgress = useCallback(() => {
    authFetch("/api/v1/admin/isochrone-progress")
      .then(r => r.json())
      .then(j => { if (j.success) setIsochroneProgress(j.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  const triggerIsochronePrecompute = useCallback(async (force: boolean = false) => {
    try {
      const r = await authFetch("/api/v1/admin/precompute-isochrones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const j = await r.json();
      if (j.success) {
        showToast?.(j.message || `已触发 ${force ? "全量" : "增量"}预计算`, "success");
        setIschronePolling(true);
      } else {
        showToast?.(j.message || "触发失败", "warning");
      }
    } catch (e: any) {
      showToast?.("触发失败: " + e.message, "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  // 轮询进度: 进入 admin/isochrone Tab 或已有任务在跑时, 每 3 秒拉一次
  useEffect(() => {
    if (activeTab !== "admin" || adminTab !== "isochrone") return;
    fetchIsochroneProgress();
    const shouldPoll = isochronePolling || isochroneProgress?.running;
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      fetchIsochroneProgress();
      if (isochroneProgress && !isochroneProgress.running) {
        setIschronePolling(false);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeTab, adminTab, isochronePolling, isochroneProgress?.running, fetchIsochroneProgress]);

  return {
    adminTab, setAdminTab,
    users, setUsers,
    logs, setLogs,
    adminStations, setAdminStations,
    adminFeedback, setAdminFeedback,
    adminSchemes, setAdminSchemes,
    adminSearch, setAdminSearch,
    adminEditing, setAdminEditing,
    adminLogFilter, setAdminLogFilter,
    isochroneProgress, setIsochroneProgress,
    isochronePolling, setIschronePolling,
    loadAdminData,
    fetchIsochroneProgress,
    triggerIsochronePrecompute,
  };
}
