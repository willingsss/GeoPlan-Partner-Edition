// =========================================================================
// 统计报表中心 (阶段三 任务 3.2)
// 交叉透视表 (行=行政区, 列=品牌) + 柱状图联动 + CSV 导出
// 作为管理页 "统计报表" Tab 内容
// =========================================================================
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { BarChart3, Download, Filter, FileSpreadsheet } from "lucide-react";
import { BRAND_CONFIG, BRANDS, DISTRICTS } from "../types";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";

interface ReportCenterProps {
  // 父组件传入 toast 通知函数 (可选)
  showToast?: (msg: string, type?: "info" | "success") => void;
}

export default function ReportCenter({ showToast }: ReportCenterProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    district: "all",
    brand: "all",
    chargeMode: "all",
    status: "all",
  });

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstRef = useRef<echarts.ECharts | null>(null);

  // ===== 拉取报表数据 =====
  const loadReport = () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => params.append(k, String(v)));
    fetch(`/api/v1/stats/report?${params.toString()}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); /* eslint-disable-next-line */ }, [filter]);

  // ===== 柱状图渲染 (行=行政区, 系列=品牌) =====
  useEffect(() => {
    if (!data || !chartRef.current) return;
    if (chartInstRef.current) chartInstRef.current.dispose();
    const chart = echarts.init(chartRef.current);
    const districts = data.districts || [];
    const brands = data.brands || [];
    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0, textStyle: { fontSize: 11, color: "var(--color-ink-3)" } },
      grid: { left: 50, right: 20, top: 40, bottom: 50 },
      xAxis: {
        type: "category",
        data: districts,
        axisLabel: { fontSize: 10, rotate: 30 },
        axisLine: { lineStyle: { color: "var(--color-line)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: "var(--color-muted)" } },
      },
      series: brands.map((b: string) => ({
        name: b,
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        data: districts.map((d: string) => {
          const row = data.pivot.find((r: any) => r.district === d);
          return row?.rows[b] || 0;
        }),
        itemStyle: { color: (BRAND_CONFIG as any)[b]?.color || "#00C896" },
      })),
    });
    chartInstRef.current = chart;
    return () => { chart.dispose(); chartInstRef.current = null; };
  }, [data]);

  // ===== 窗口缩放自适应 =====
  useEffect(() => {
    const handler = () => chartInstRef.current?.resize();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ===== 导出 CSV =====
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => params.append(k, String(v)));
    // 直接触发浏览器下载
    const url = `/api/v1/export/report-csv?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `geoplan-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast?.("CSV 报表已导出", "success");
  };

  const pivot = data?.pivot || [];
  const brands = data?.brands || [];

  return (
    <div className="space-y-4">
      {/* ===== 顶部: 筛选器 + 导出按钮 ===== */}
      <div
        className="rounded-lg p-4 flex items-center gap-3 flex-wrap"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
      >
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" style={{ color: "var(--color-ink-4)" }} />
          <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-2)" }}>筛选条件</span>
        </div>

        {/* 行政区筛选 */}
        <select
          value={filter.district}
          onChange={(e) => setFilter(prev => ({ ...prev, district: e.target.value }))}
          className="input-sys text-[12px] px-2 py-1.5"
        >
          <option value="all">全部行政区</option>
          {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* 品牌筛选 */}
        <select
          value={filter.brand}
          onChange={(e) => setFilter(prev => ({ ...prev, brand: e.target.value }))}
          className="input-sys text-[12px] px-2 py-1.5"
        >
          <option value="all">全部品牌</option>
          {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* 充电模式筛选 */}
        <select
          value={filter.chargeMode}
          onChange={(e) => setFilter(prev => ({ ...prev, chargeMode: e.target.value }))}
          className="input-sys text-[12px] px-2 py-1.5"
        >
          <option value="all">全部模式</option>
          <option value="fast">有快充</option>
          <option value="slow">有慢充</option>
        </select>

        {/* 状态筛选 */}
        <select
          value={filter.status}
          onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
          className="input-sys text-[12px] px-2 py-1.5"
        >
          <option value="all">全部状态</option>
          <option value="运营中">运营中</option>
          <option value="维护中">维护中</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* 汇总数字 */}
          {data && (
            <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--color-ink-4)" }}>
              <span>共 <span className="font-num font-semibold" style={{ color: "var(--color-ink-1)" }}>{data.total}</span> 站</span>
              <span>·</span>
              <span><span className="font-num font-semibold" style={{ color: "var(--color-ink-1)" }}>{data.totalPorts}</span> 桩</span>
            </div>
          )}
          <button
            onClick={handleExportCSV}
            disabled={!data || data.total === 0}
            className="btn-brand text-[12px] px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            导出 CSV
          </button>
        </div>
      </div>

      {/* ===== 主体: 左侧透视表 + 右侧柱状图 ===== */}
      <div className="grid grid-cols-5 gap-3">
        {/* 左侧: 交叉透视表 (3 列宽) */}
        <div
          className="col-span-3 rounded-lg overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)" }}
        >
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--color-muted)" }}
          >
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />
              <h3 className="text-[12.5px] font-semibold" style={{ color: "var(--color-ink-1)" }}>
                交叉透视表 <span className="text-[10px] font-normal" style={{ color: "var(--color-ink-4)" }}>(行=行政区 · 列=品牌)</span>
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="p-4"><Skeleton rows={8} /></div>
          ) : pivot.length === 0 ? (
            <EmptyState icon="FileSpreadsheet" title="暂无报表数据" desc="调整筛选条件后重试" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr style={{ background: "var(--color-subtle)" }}>
                    <th className="text-left px-3 py-2 font-semibold sticky left-0" style={{ color: "var(--color-ink-2)", background: "var(--color-subtle)" }}>行政区</th>
                    {brands.map(b => (
                      <th key={b} className="text-center px-2 py-2 font-medium" style={{ color: "var(--color-ink-2)" }}>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: (BRAND_CONFIG as any)[b]?.color || "#00C896" }} />
                          {b}
                        </span>
                      </th>
                    ))}
                    <th className="text-center px-2 py-2 font-semibold" style={{ color: "var(--color-ink-1)", background: "var(--color-subtle)" }}>合计</th>
                    <th className="text-center px-2 py-2 font-semibold" style={{ color: "var(--color-ink-1)", background: "var(--color-subtle)" }}>桩数</th>
                  </tr>
                </thead>
                <tbody>
                  {pivot.map((row: any) => (
                    <tr key={row.district} style={{ borderBottom: "1px solid var(--color-muted)" }}>
                      <td className="px-3 py-2 font-medium sticky left-0" style={{ color: "var(--color-ink-1)", background: "var(--color-surface)" }}>
                        {row.district}
                      </td>
                      {brands.map(b => (
                        <td key={b} className="text-center px-2 py-2 font-num" style={{ color: row.rows[b] > 0 ? "var(--color-ink-2)" : "var(--color-ink-5)" }}>
                          {row.rows[b] || 0}
                        </td>
                      ))}
                      <td className="text-center px-2 py-2 font-num font-semibold" style={{ color: "var(--color-brand-text)" }}>
                        {row.total}
                      </td>
                      <td className="text-center px-2 py-2 font-num" style={{ color: "var(--color-ink-3)" }}>
                        {row.ports}
                      </td>
                    </tr>
                  ))}
                  {/* 合计行 */}
                  <tr style={{ background: "var(--color-subtle)", borderTop: "2px solid var(--color-line)" }}>
                    <td className="px-3 py-2 font-semibold sticky left-0" style={{ color: "var(--color-ink-1)", background: "var(--color-subtle)" }}>合计</td>
                    {brands.map(b => {
                      const sum = pivot.reduce((s: number, r: any) => s + (r.rows[b] || 0), 0);
                      return <td key={b} className="text-center px-2 py-2 font-num font-semibold" style={{ color: "var(--color-ink-1)" }}>{sum}</td>;
                    })}
                    <td className="text-center px-2 py-2 font-num font-bold" style={{ color: "var(--color-brand-text)" }}>{data?.total || 0}</td>
                    <td className="text-center px-2 py-2 font-num font-bold" style={{ color: "var(--color-ink-1)" }}>{data?.totalPorts || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 右侧: 柱状图联动 (2 列宽) */}
        <div
          className="col-span-2 rounded-lg p-4 flex flex-col"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xs)", minHeight: 360 }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />
            <h3 className="text-[12.5px] font-semibold" style={{ color: "var(--color-ink-1)" }}>行政区 × 品牌 堆叠柱图</h3>
          </div>
          <div ref={chartRef} className="flex-1" />
        </div>
      </div>
    </div>
  );
}
