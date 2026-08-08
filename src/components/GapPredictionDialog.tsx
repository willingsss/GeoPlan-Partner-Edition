import { useEffect, useState } from "react";
import { X, Loader2, TrendingUp, TrendingDown } from "lucide-react";

// =========================================================================
// 充电桩缺口预测弹窗 (阶段二 任务 2.5)
// 列出 Top 10 缺口最大的行政区 (红色缺口大、绿色饱和)
// =========================================================================
interface GapPredictionDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function GapPredictionDialog({ open, onClose }: GapPredictionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/v1/analysis/gap-prediction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.data);
        else setError(j.message || "预测失败");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-muted)" }}>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "var(--color-brand-text)" }} />
            <h3 className="text-[14px] font-semibold text-zinc-900">充电桩缺口预测</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-16 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            <span className="ml-2 text-[12px] text-zinc-500">预测中...</span>
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-[12px] text-red-500">{error}</div>
        ) : data ? (
          <div className="px-5 py-4 max-h-[75vh] overflow-y-auto space-y-4">
            {/* 说明 */}
            <div className="rounded-lg p-2.5 text-[11px] text-zinc-600 leading-relaxed" style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
              <p>
                计算公式: <span className="font-num font-semibold">需求桩数 = 人口 × 0.05 (车辆渗透率) × 0.3 (日充电频次) / 30 (单桩日服务能力)</span>
              </p>
              <p className="mt-0.5">
                <span className="text-red-500">红色</span>: 缺口大 (需新建) · <span className="text-emerald-500">绿色</span>: 已饱和 (暂不新增)
              </p>
            </div>

            {/* Top 10 缺口最大行政区 */}
            <div>
              <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                Top 10 缺口最大的行政区
              </p>
              <div className="space-y-1.5">
                {data.topGap.map((d: any, idx: number) => {
                  // 颜色: 缺口越大越红, 饱和为绿
                  const isGap = d.gap > 0;
                  const intensity = isGap
                    ? Math.min(1, d.gap / (data.topGap[0]?.gap || 1))
                    : 0;
                  const bgColor = isGap
                    ? `rgba(239,68,68,${0.06 + intensity * 0.18})`
                    : "rgba(16,185,129,0.08)";
                  const borderColor = isGap
                    ? `rgba(239,68,68,${0.25 + intensity * 0.3})`
                    : "rgba(16,185,129,0.3)";
                  return (
                    <div
                      key={d.name}
                      className="rounded-lg p-2.5 flex items-center justify-between"
                      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-bold font-num w-6 text-center" style={{ color: isGap ? "#EF4444" : "#10B981" }}>
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-zinc-900">{d.name}</p>
                          <p className="text-[10px] text-zinc-500">
                            人口 {d.population.toLocaleString()} · 现有桩 {d.currentChargers} · 需求桩 {d.demandChargers}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-bold font-num" style={{ color: isGap ? "#EF4444" : "#10B981" }}>
                          {d.gap > 0 ? `+${d.gap}` : d.gap}
                        </p>
                        <p className="text-[10px] text-zinc-500">{isGap ? "缺口" : "饱和"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 全部行政区表格 */}
            {data.districts.length > 10 && (
              <details>
                <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-700">查看全部行政区 ({data.districts.length})</summary>
                <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-muted)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "var(--color-subtle)" }}>
                        <th className="text-left px-2 py-1.5 text-zinc-600 font-medium">行政区</th>
                        <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">人口</th>
                        <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">现有桩</th>
                        <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">需求桩</th>
                        <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">缺口</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.districts.map((d: any) => (
                        <tr key={d.name} style={{ borderTop: "1px solid var(--color-muted)" }}>
                          <td className="px-2 py-1.5 text-zinc-700">{d.name}</td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-700">{d.population.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-700">{d.currentChargers}</td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-700">{d.demandChargers}</td>
                          <td className="px-2 py-1.5 text-right font-num font-bold" style={{ color: d.gap > 0 ? "#EF4444" : "#10B981" }}>
                            {d.gap > 0 ? `+${d.gap}` : d.gap}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        ) : null}

        {/* 底部按钮 */}
        <div className="px-5 py-3.5 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--color-muted)", background: "var(--color-subtle)" }}>
          <button onClick={onClose} className="btn-brand px-4 py-1.5 rounded-md text-[13px] font-medium">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
