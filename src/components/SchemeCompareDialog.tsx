import { useEffect, useRef, useState } from "react";
import { X, Loader2, GitCompare, Trophy } from "lucide-react";
import * as echarts from "echarts";

// =========================================================================
// 方案深度对比弹窗 (阶段二 任务 2.2)
// 左表: 6 维度数值 + 百分制归一化得分
// 右侧: 双方案叠加雷达图 (ECharts radar)
// 底部: 推荐方案建议
// =========================================================================
interface SchemeCompareDialogProps {
  open: boolean;
  onClose: () => void;
  schemeIds: number[]; // 长度为 2
}

export default function SchemeCompareDialog({ open, onClose, schemeIds }: SchemeCompareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const radarChartRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!open || schemeIds.length !== 2) return;
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/v1/analysis/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schemeIds }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.data);
        else setError(j.message || "对比失败");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, schemeIds]);

  // 渲染雷达图
  useEffect(() => {
    if (!data || !radarChartRef.current) return;
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }
    const chart = echarts.init(radarChartRef.current);
    chartRef.current = chart;
    const [s1, s2] = data.schemes;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {},
      legend: { data: [s1.name, s2.name], textStyle: { color: "#52525B" }, bottom: 0, fontSize: 11 },
      radar: {
        indicator: data.dimensions.map((d: any) => ({ name: d.label, max: 100 })),
        axisName: { color: "#52525B", fontSize: 11 },
        splitLine: { lineStyle: { color: "#E4E4E7" } },
        splitArea: { areaStyle: { color: ["#F4F4F5", "#FFFFFF"] } },
      },
      series: [{
        type: "radar",
        data: [
          { value: data.dimensions.map((d: any) => d.score1), name: s1.name, itemStyle: { color: "#00C896" }, areaStyle: { color: "rgba(0,200,150,0.2)" } },
          { value: data.dimensions.map((d: any) => d.score2), name: s2.name, itemStyle: { color: "#38BDF8" }, areaStyle: { color: "rgba(56,189,248,0.2)" } },
        ],
      }],
    });
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, [data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-muted)" }}>
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4" style={{ color: "var(--color-brand-text)" }} />
            <h3 className="text-[14px] font-semibold text-zinc-900">方案深度对比矩阵</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-16 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            <span className="ml-2 text-[12px] text-zinc-500">对比分析中...</span>
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-[12px] text-red-500">{error}</div>
        ) : data ? (
          <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
            {/* 顶部: 双方案标题 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {data.schemes.map((s: any, idx: number) => (
                <div key={s.id} className="rounded-lg p-3" style={{
                  background: idx === 0 ? "rgba(0,200,150,0.06)" : "rgba(56,189,248,0.06)",
                  border: `1px solid ${idx === 0 ? "var(--color-brand-border)" : "var(--color-accent-border)"}`,
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-zinc-500">方案 {idx === 0 ? "A" : "B"}</p>
                      <p className="text-[14px] font-semibold text-zinc-900">{s.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {s.brand} · 半径 {s.radius}米 · ({s.lng?.toFixed(4)}, {s.lat?.toFixed(4)})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500">综合得分</p>
                      <p className="text-[20px] font-bold font-num" style={{ color: idx === 0 ? "#00C896" : "#38BDF8" }}>
                        {s.totalScore}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 左表 + 右雷达图 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 左: 6 维度数值表 */}
              <div>
                <p className="text-[11px] text-zinc-500 mb-2">6 维度数值对比 (含百分制归一化)</p>
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-muted)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "var(--color-subtle)" }}>
                        <th className="text-left px-2 py-1.5 text-zinc-600 font-medium">维度</th>
                        <th className="text-right px-2 py-1.5 text-emerald-600 font-medium">方案 A</th>
                        <th className="text-right px-2 py-1.5 text-sky-500 font-medium">方案 B</th>
                        <th className="text-right px-2 py-1.5 text-zinc-500 font-medium">A 得分</th>
                        <th className="text-right px-2 py-1.5 text-zinc-500 font-medium">B 得分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dimensions.map((d: any) => (
                        <tr key={d.key} style={{ borderTop: "1px solid var(--color-muted)" }}>
                          <td className="px-2 py-1.5 text-zinc-700">{d.label}</td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-900">
                            {d.key === "coveredPopulation" || d.key === "roi" ? d.value1.toLocaleString() : d.value1}
                          </td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-900">
                            {d.key === "coveredPopulation" || d.key === "roi" ? d.value2.toLocaleString() : d.value2}
                          </td>
                          <td className="px-2 py-1.5 text-right font-num">
                            <span className="px-1.5 py-0.5 rounded" style={{
                              background: d.score1 > d.score2 ? "rgba(0,200,150,0.12)" : "transparent",
                              color: d.score1 > d.score2 ? "#00A078" : "#71717A",
                              fontWeight: d.score1 > d.score2 ? 600 : 400,
                            }}>{d.score1}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-num">
                            <span className="px-1.5 py-0.5 rounded" style={{
                              background: d.score2 > d.score1 ? "rgba(56,189,248,0.12)" : "transparent",
                              color: d.score2 > d.score1 ? "#0284C7" : "#71717A",
                              fontWeight: d.score2 > d.score1 ? 600 : 400,
                            }}>{d.score2}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1.5">归一化方法: (value - min) / (max - min) × 100</p>
              </div>

              {/* 右: 雷达图 */}
              <div>
                <p className="text-[11px] text-zinc-500 mb-2">双方案雷达叠加</p>
                <div ref={radarChartRef} className="w-full h-64" />
              </div>
            </div>

            {/* 底部: 推荐方案建议 */}
            <div className="mt-4 rounded-lg p-3" style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.25)",
            }}>
              <div className="flex items-start gap-2">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-zinc-900 mb-0.5">
                    推荐方案: {data.recommendation.name}
                  </p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">{data.recommendation.reason}</p>
                </div>
              </div>
            </div>
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
