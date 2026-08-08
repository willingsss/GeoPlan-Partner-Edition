import { useEffect, useState } from "react";
import { Loader2, FileText } from "lucide-react";

// =========================================================================
// 方案报告打印组件 (阶段二 任务 2.6)
// 调用 /api/v1/export/scheme-pdf 获取方案数据, 组装打印 HTML, 调用 window.print()
// =========================================================================

interface SchemeReportData {
  scheme: {
    id: number;
    name: string;
    lng: number;
    lat: number;
    radius: number;
    brand: string;
    creator: string;
    create_time: string;
  };
  metrics: {
    coverageRate: number;
    coveredPopulation: number;
    coveredCommunities: number;
    competitionScore: number;
    roi: number;
    blindSpotReduction: number;
  };
  roi: {
    cost: number;
    costBreakdown: { fast: number; slow: number; land: number };
    annualRevenue: number;
    paybackYears: number;
  };
  nearbyStations: {
    id: number;
    name: string;
    brand: string;
    district: string;
    fastChargers: number;
    slowChargers: number;
    distance: number;
  }[];
  advice: string[];
  exportTime: string;
}

// 组装打印 HTML 并触发浏览器打印
export async function exportSchemeReport(schemeId: number): Promise<void> {
  const res = await fetch("/api/v1/export/scheme-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemeId }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || "导出失败");
  }
  const data: SchemeReportData = json.data;

  // 组装打印 HTML
  const html = buildReportHtml(data);

  // 在新窗口中打印 (避免污染当前页面)
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    // 弹窗被拦截, 降级到当前窗口打印
    printInCurrentWindow(html);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  // 等待资源加载后打印
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}

// 在当前窗口打印 (弹窗被拦截时的降级方案)
function printInCurrentWindow(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.background = "#fff";
  document.body.appendChild(container);
  document.body.classList.add("printing-scheme-report");
  // 隐藏其他元素
  const style = document.createElement("style");
  style.id = "scheme-print-style";
  style.textContent = `
    body.printing-scheme-report > *:not(div[style*="-9999px"]) { display: none !important; }
    body.printing-scheme-report > div[style*="-9999px"] { display: block !important; position: static !important; left: 0 !important; width: 100% !important; }
    @media print {
      body.printing-scheme-report > *:not(div[style*="-9999px"]) { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.removeChild(container);
      document.body.classList.remove("printing-scheme-report");
      document.head.removeChild(style);
    }, 600);
  }, 400);
}

// 组装报告 HTML
function buildReportHtml(data: SchemeReportData): string {
  const { scheme, metrics, roi, nearbyStations, advice, exportTime } = data;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>选址方案报告 - ${escapeHtml(scheme.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #18181B; margin: 0; padding: 40px; background: #fff; }
    h1 { font-size: 26px; color: #00A078; border-bottom: 3px solid #00C896; padding-bottom: 10px; margin: 0 0 8px; }
    h2 { font-size: 16px; color: #18181B; margin: 24px 0 10px; padding: 6px 10px; background: #ECFDF5; border-left: 4px solid #00C896; }
    .cover { text-align: center; padding: 30px 0 20px; border-bottom: 2px dashed #D4D4D8; margin-bottom: 20px; }
    .cover h1 { font-size: 32px; border: none; padding: 0; margin: 0 0 12px; }
    .cover .meta { color: #71717A; font-size: 12px; margin-top: 8px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; font-size: 13px; margin: 8px 0; }
    .info-grid div { padding: 4px 0; border-bottom: 1px dashed #E4E4E7; }
    .info-grid .label { color: #71717A; display: inline-block; min-width: 80px; }
    .info-grid .value { color: #18181B; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
    th { background: #F4F4F5; color: #52525B; font-weight: 600; padding: 8px; text-align: left; border: 1px solid #D4D4D8; }
    td { padding: 6px 8px; border: 1px solid #D4D4D8; color: #18181B; }
    td.num { font-family: Consolas, monospace; text-align: right; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; }
    .metric-card { padding: 10px; border: 1px solid #E4E4E7; border-radius: 6px; background: #FAFAFA; }
    .metric-card .name { font-size: 11px; color: #71717A; }
    .metric-card .value { font-size: 20px; font-weight: 700; color: #00A078; font-family: Consolas, monospace; margin-top: 4px; }
    .advice { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 12px; margin: 10px 0; }
    .advice ul { margin: 6px 0 0; padding-left: 20px; font-size: 12px; color: #52525B; }
    .advice li { margin: 4px 0; line-height: 1.6; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #E4E4E7; text-align: center; font-size: 11px; color: #A1A1AA; }
    .brand-tag { display: inline-block; padding: 2px 8px; background: #ECFDF5; color: #00A078; border-radius: 3px; font-size: 12px; font-weight: 600; }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <!-- 封面 -->
  <div class="cover">
    <h1>${escapeHtml(scheme.name)}</h1>
    <p style="font-size: 14px; color: #52525B; margin: 6px 0;">GeoPlan 充电设施规划平台 · 选址方案报告</p>
    <div class="meta">
      报告生成时间: ${escapeHtml(exportTime)} · 创建人: ${escapeHtml(scheme.creator || "未知")} · 方案编号 #${scheme.id}
    </div>
  </div>

  <!-- 选址依据 -->
  <h2>一、选址依据</h2>
  <div class="info-grid">
    <div><span class="label">方案名称:</span> <span class="value">${escapeHtml(scheme.name)}</span></div>
    <div><span class="label">拟建品牌:</span> <span class="value"><span class="brand-tag">${escapeHtml(scheme.brand)}</span></span></div>
    <div><span class="label">经度 (WGS84):</span> <span class="value">${scheme.lng.toFixed(6)}</span></div>
    <div><span class="label">纬度 (WGS84):</span> <span class="value">${scheme.lat.toFixed(6)}</span></div>
    <div><span class="label">服务半径:</span> <span class="value">${scheme.radius} 米</span></div>
    <div><span class="label">创建时间:</span> <span class="value">${escapeHtml(scheme.create_time || "")}</span></div>
  </div>

  <!-- 核心指标表 -->
  <h2>二、核心指标</h2>
  <div class="metrics-grid">
    <div class="metric-card"><div class="name">覆盖率</div><div class="value">${metrics.coverageRate}%</div></div>
    <div class="metric-card"><div class="name">覆盖人口</div><div class="value">${metrics.coveredPopulation.toLocaleString()}</div></div>
    <div class="metric-card"><div class="name">覆盖社区</div><div class="value">${metrics.coveredCommunities}</div></div>
    <div class="metric-card"><div class="name">竞争避让度</div><div class="value">${metrics.competitionScore}</div></div>
    <div class="metric-card"><div class="name">盲区消除率</div><div class="value">${metrics.blindSpotReduction}%</div></div>
    <div class="metric-card"><div class="name">ROI 指数</div><div class="value">${metrics.roi}</div></div>
  </div>

  <!-- ROI 估算 -->
  <h2>三、投资回报 ROI 估算</h2>
  <table>
    <thead>
      <tr><th>项目</th><th style="text-align:right">金额 (元)</th><th>说明</th></tr>
    </thead>
    <tbody>
      <tr><td>快充桩成本</td><td class="num">${roi.costBreakdown.fast.toLocaleString()}</td><td>4 桩 × 80,000 元/桩</td></tr>
      <tr><td>慢充桩成本</td><td class="num">${roi.costBreakdown.slow.toLocaleString()}</td><td>4 桩 × 30,000 元/桩</td></tr>
      <tr><td>土地成本</td><td class="num">${roi.costBreakdown.land.toLocaleString()}</td><td>场地租赁/购置</td></tr>
      <tr style="background:#ECFDF5;font-weight:600"><td>建站总成本</td><td class="num">${roi.cost.toLocaleString()}</td><td>—</td></tr>
      <tr><td>预计年收益</td><td class="num">${roi.annualRevenue.toLocaleString()}</td><td>人口 × 5% × 1.5元 × 365天 × 30%</td></tr>
      <tr style="background:#FEF2F2;font-weight:600"><td>回收周期</td><td class="num">${roi.paybackYears} 年</td><td>${roi.paybackYears < 5 ? "回报良好" : roi.paybackYears < 10 ? "周期偏长" : "建议优化"}</td></tr>
    </tbody>
  </table>

  <!-- 周边充电站列表 -->
  <h2>四、周边充电站 (3km 内, Top ${nearbyStations.length})</h2>
  ${nearbyStations.length === 0
    ? `<p style="font-size:12px;color:#71717A;text-align:center;padding:12px;">周边 3km 范围内暂无其他充电站</p>`
    : `<table>
    <thead>
      <tr><th>站点名称</th><th>品牌</th><th>行政区</th><th style="text-align:right">快充</th><th style="text-align:right">慢充</th><th style="text-align:right">距离 (米)</th></tr>
    </thead>
    <tbody>
      ${nearbyStations.map(s => `
        <tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.brand)}</td>
          <td>${escapeHtml(s.district)}</td>
          <td class="num">${s.fastChargers}</td>
          <td class="num">${s.slowChargers}</td>
          <td class="num">${s.distance}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`}

  <!-- AI 建议 -->
  <h2>五、智能决策建议</h2>
  <div class="advice">
    <ul>
      ${advice.map(a => `<li>${escapeHtml(a)}</li>`).join("")}
    </ul>
  </div>

  <div class="footer">
    本报告由 GeoPlan 充电设施规划平台自动生成 · 仅供投资决策参考 · ${escapeHtml(exportTime)}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =========================================================================
// 简单的导出按钮组件 (供方案列表项使用)
// =========================================================================
interface SchemeReportButtonProps {
  schemeId: number;
  schemeName: string;
  onNotify?: (msg: string, type?: "info" | "success") => void;
}

export function SchemeReportButton({ schemeId, schemeName, onNotify }: SchemeReportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleClick = async () => {
    setExporting(true);
    try {
      await exportSchemeReport(schemeId);
      onNotify?.(`已生成方案报告: ${schemeName}`, "success");
    } catch (e: any) {
      onNotify?.(`导出失败: ${e.message}`, "info");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={exporting}
      className="h-6 px-2 rounded text-[10px] font-medium flex items-center gap-1 transition-colors"
      style={{
        background: exporting ? "var(--color-muted)" : "rgba(0,200,150,0.08)",
        color: exporting ? "var(--color-ink-5)" : "var(--color-brand-text)",
        border: `1px solid ${exporting ? "var(--color-muted)" : "var(--color-brand-border)"}`,
      }}
      title="导出方案报告 (PDF)"
    >
      {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
      {exporting ? "导出中" : "导出报告"}
    </button>
  );
}
