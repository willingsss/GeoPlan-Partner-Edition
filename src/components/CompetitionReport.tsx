import { useEffect, useRef, useState } from "react";
import { X, Loader2, BarChart3, MapPin } from "lucide-react";
import * as echarts from "echarts";

// =========================================================================
// 区域竞争态势报告弹窗 (阶段二 任务 2.4)
// 含: 品牌市占率饼图 / 各行政区品牌分布堆叠柱状图 / 饱和度列表 / 空白市场列表
// =========================================================================
interface CompetitionReportProps {
  open: boolean;
  onClose: () => void;
  onSelectBlankMarket?: (lng: number, lat: number) => void; // 跳转选址
}

export default function CompetitionReport({ open, onClose, onSelectBlankMarket }: CompetitionReportProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setData(null);
    fetch("/api/v1/analysis/competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.data);
        else setError(j.message || "分析失败");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  // 品牌市占率饼图
  useEffect(() => {
    if (!data || !pieChartRef.current) return;
    const chart = echarts.init(pieChartRef.current);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "item", formatter: "{b}: {c}座 ({d}%)" },
      legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 10, color: "#52525B" } },
      series: [{
        type: "pie",
        radius: ["35%", "65%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" } },
        data: data.brandShare.map((b: any) => ({
          name: b.brand,
          value: b.count,
          percentage: b.percentage,
        })),
      }],
    });
    return () => chart.dispose();
  }, [data]);

  // 各行政区品牌分布堆叠柱状图
  useEffect(() => {
    if (!data || !barChartRef.current) return;
    // 收集所有品牌列表
    const allBrands = Array.from(new Set(data.districtDistribution.flatMap((d: any) => Object.keys(d.brands))));
    const districts = data.districtDistribution.map((d: any) => d.district);
    const chart = echarts.init(barChartRef.current);
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 10, color: "#52525B" } },
      grid: { left: 50, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: "category",
        data: districts,
        axisLabel: { fontSize: 10, color: "#52525B", interval: 0, rotate: 30 },
      },
      yAxis: { type: "value", axisLabel: { fontSize: 10, color: "#52525B" } },
      series: allBrands.map((brand: string) => ({
        name: brand,
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        data: data.districtDistribution.map((d: any) => d.brands[brand] || 0),
      })),
    });
    return () => chart.dispose();
  }, [data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden animate-scale-in"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-muted)" }}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: "var(--color-brand-text)" }} />
            <h3 className="text-[14px] font-semibold text-zinc-900">区域竞争态势分析报告</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-16 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            <span className="ml-2 text-[12px] text-zinc-500">分析中...</span>
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-[12px] text-red-500">{error}</div>
        ) : data ? (
          <div className="px-5 py-4 max-h-[75vh] overflow-y-auto space-y-4">
            {/* 上半: 饼图 + 柱状图 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-3" style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
                <p className="text-[11px] text-zinc-500 mb-1">品牌市占率</p>
                <div ref={pieChartRef} className="w-full h-56" />
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
                <p className="text-[11px] text-zinc-500 mb-1">各行政区品牌分布 (堆叠)</p>
                <div ref={barChartRef} className="w-full h-56" />
              </div>
            </div>

            {/* 饱和度列表 */}
            <div>
              <p className="text-[11px] text-zinc-500 mb-2">行政区充电站饱和度 (座/km²)</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-muted)" }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: "var(--color-subtle)" }}>
                      <th className="text-left px-2 py-1.5 text-zinc-600 font-medium">行政区</th>
                      <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">充电站数</th>
                      <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">面积 (km²)</th>
                      <th className="text-right px-2 py-1.5 text-zinc-600 font-medium">饱和度</th>
                      <th className="text-left px-2 py-1.5 text-zinc-600 font-medium">态势</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.saturation.map((s: any) => {
                      const level = s.stationsPerKm2 >= 5 ? "高饱和" : s.stationsPerKm2 >= 2 ? "中等" : "宽松";
                      const color = s.stationsPerKm2 >= 5 ? "#EF4444" : s.stationsPerKm2 >= 2 ? "#F59E0B" : "#10B981";
                      return (
                        <tr key={s.district} style={{ borderTop: "1px solid var(--color-muted)" }}>
                          <td className="px-2 py-1.5 text-zinc-700">{s.district}</td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-900">{s.stationCount}</td>
                          <td className="px-2 py-1.5 text-right font-num text-zinc-700">{s.areaKm2}</td>
                          <td className="px-2 py-1.5 text-right font-num font-bold" style={{ color }}>{s.stationsPerKm2}</td>
                          <td className="px-2 py-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: color + "20", color }}>{level}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 空白市场列表 */}
            <div>
              <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-500" />
                空白市场 (1.5km 内无充电站的社区聚类, Top 10)
              </p>
              {data.blankMarkets.length === 0 ? (
                <div className="text-[11px] text-zinc-400 px-2 py-3 text-center rounded-lg" style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
                  暂无空白市场
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {data.blankMarkets.map((m: any) => (
                    <div key={m.clusterId} className="rounded-lg p-2 flex items-center justify-between" style={{
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.25)",
                    }}>
                      <div>
                        <p className="text-[11px] font-semibold text-amber-700">#{m.clusterId} 空白市场</p>
                        <p className="text-[10px] text-zinc-600">{m.communityCount} 个社区聚类</p>
                        <p className="text-[9px] text-zinc-400 font-mono">({m.center[0].toFixed(4)}, {m.center[1].toFixed(4)})</p>
                      </div>
                      {onSelectBlankMarket && (
                        <button
                          onClick={() => {
                            onSelectBlankMarket(m.center[0], m.center[1]);
                            onClose();
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-2 py-1 rounded transition-colors shrink-0"
                        >
                          在此选址
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
