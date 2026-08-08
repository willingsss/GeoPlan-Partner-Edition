import { useEffect, useRef, useState } from "react";
import { X, Loader2, Calculator } from "lucide-react";

// =========================================================================
// ROI 估算弹窗 (阶段二 任务 2.3)
// 显示建站成本/年收益/回收周期, 参数可调实时重算 (前端本地计算, 无需重复请求)
// =========================================================================
interface RoiDialogProps {
  open: boolean;
  onClose: () => void;
  // 初始参数 (来自当前选址)
  initFastChargers: number;
  initSlowChargers: number;
  coveredPopulation: number;
}

export default function RoiDialog({ open, onClose, initFastChargers, initSlowChargers, coveredPopulation }: RoiDialogProps) {
  // 可调参数 (默认值与后端公式一致)
  const [fastCount, setFastCount] = useState(initFastChargers || 4);
  const [slowCount, setSlowCount] = useState(initSlowChargers || 4);
  const [fastUnitCost, setFastUnitCost] = useState(80000);
  const [slowUnitCost, setSlowUnitCost] = useState(30000);
  const [landCost, setLandCost] = useState(200000);
  const [population, setPopulation] = useState(coveredPopulation || 0);
  const [demandRate, setDemandRate] = useState(0.05);
  const [unitPrice, setUnitPrice] = useState(1.5);
  const [conversionRate, setConversionRate] = useState(0.3);
  const [loading, setLoading] = useState(false);
  const [serverData, setServerData] = useState<any>(null);

  // 初次打开时调用一次后端接口获取基线数据
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/v1/analysis/roi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fastChargers: initFastChargers || 4,
        slowChargers: initSlowChargers || 4,
        coveredPopulation: coveredPopulation || 0,
      }),
    })
      .then(r => r.json())
      .then(j => { if (j.success) setServerData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, initFastChargers, initSlowChargers, coveredPopulation]);

  // 前端本地实时重算 (参数变化即重算)
  const fastCost = fastCount * fastUnitCost;
  const slowCost = slowCount * slowUnitCost;
  const totalCost = fastCost + slowCost + landCost;
  const annualRevenue = Math.round(population * demandRate * unitPrice * 365 * conversionRate);
  const paybackYears = annualRevenue > 0 ? Math.round((totalCost / annualRevenue) * 100) / 100 : -1;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-muted)" }}>
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4" style={{ color: "var(--color-brand-text)" }} />
            <h3 className="text-[14px] font-semibold text-zinc-900">投资回报 ROI 估算</h3>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            <span className="ml-2 text-[12px] text-zinc-500">计算中...</span>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 参数区 - 可调 */}
            <div>
              <p className="text-[11px] text-zinc-500 mb-2">参数调整 (实时重算)</p>
              <div className="grid grid-cols-2 gap-3">
                {/* 快充桩数 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">快充桩数</span>
                  <input type="number" min={0} max={50} value={fastCount}
                    onChange={(e) => setFastCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px]" />
                </label>
                {/* 慢充桩数 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">慢充桩数</span>
                  <input type="number" min={0} max={50} value={slowCount}
                    onChange={(e) => setSlowCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px]" />
                </label>
                {/* 快充单桩成本 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">快充单桩成本</span>
                  <input type="number" min={0} step={1000} value={fastUnitCost}
                    onChange={(e) => setFastUnitCost(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px] font-num" />
                  <span className="text-[10px] text-zinc-400">元</span>
                </label>
                {/* 慢充单桩成本 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">慢充单桩成本</span>
                  <input type="number" min={0} step={1000} value={slowUnitCost}
                    onChange={(e) => setSlowUnitCost(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px] font-num" />
                  <span className="text-[10px] text-zinc-400">元</span>
                </label>
                {/* 土地成本 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">土地成本</span>
                  <input type="number" min={0} step={10000} value={landCost}
                    onChange={(e) => setLandCost(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px] font-num" />
                  <span className="text-[10px] text-zinc-400">元</span>
                </label>
                {/* 覆盖人口 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">覆盖人口</span>
                  <input type="number" min={0} value={population}
                    onChange={(e) => setPopulation(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px] font-num" />
                  <span className="text-[10px] text-zinc-400">人</span>
                </label>
                {/* 需求率 (滑块) */}
                <label className="flex items-center gap-2 text-[12px] col-span-2">
                  <span className="text-zinc-600 w-20">需求率</span>
                  <input type="range" min={0.01} max={0.2} step={0.01} value={demandRate}
                    onChange={(e) => setDemandRate(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-500 h-1" />
                  <span className="text-[11px] text-emerald-600 font-num w-12 text-right">{(demandRate * 100).toFixed(0)}%</span>
                </label>
                {/* 客单价 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">客单价</span>
                  <input type="number" min={0} step={0.1} value={unitPrice}
                    onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="input-sys flex-1 px-2 py-1 text-[12px] font-num" />
                  <span className="text-[10px] text-zinc-400">元</span>
                </label>
                {/* 转化率 */}
                <label className="flex items-center gap-2 text-[12px]">
                  <span className="text-zinc-600 w-20">转化率</span>
                  <input type="range" min={0.05} max={0.8} step={0.05} value={conversionRate}
                    onChange={(e) => setConversionRate(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-500 h-1" />
                  <span className="text-[11px] text-emerald-600 font-num w-12 text-right">{(conversionRate * 100).toFixed(0)}%</span>
                </label>
              </div>
            </div>

            {/* 成本明细 */}
            <div className="rounded-lg p-3" style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
              <p className="text-[11px] text-zinc-500 mb-2">建站成本明细</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-zinc-500">快充</p>
                  <p className="text-[14px] font-bold text-emerald-600 font-num">¥{fastCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">慢充</p>
                  <p className="text-[14px] font-bold text-sky-500 font-num">¥{slowCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">土地</p>
                  <p className="text-[14px] font-bold text-amber-500 font-num">¥{landCost.toLocaleString()}</p>
                </div>
                <div style={{ borderLeft: "1px solid var(--color-muted)" }}>
                  <p className="text-[10px] text-zinc-500">合计</p>
                  <p className="text-[15px] font-bold text-zinc-900 font-num">¥{totalCost.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 年收益与回收周期 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "rgba(0,200,150,0.06)", border: "1px solid var(--color-brand-border)" }}>
                <p className="text-[11px] text-zinc-500 mb-1">预计年收益</p>
                <p className="text-[20px] font-bold text-emerald-600 font-num">¥{annualRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  = 人口{population.toLocaleString()} × 需求{(demandRate * 100).toFixed(0)}% × 单价{unitPrice}元 × 365天 × 转化{(conversionRate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="rounded-lg p-3" style={{
                background: paybackYears > 0 && paybackYears < 5 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.06)",
                border: `1px solid ${paybackYears > 0 && paybackYears < 5 ? "var(--color-brand-border)" : "rgba(239,68,68,0.3)"}`
              }}>
                <p className="text-[11px] text-zinc-500 mb-1">回收周期</p>
                {paybackYears > 0 ? (
                  <>
                    <p className="text-[20px] font-bold font-num" style={{ color: paybackYears < 5 ? "#10B981" : "#EF4444" }}>
                      {paybackYears} 年
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {paybackYears < 5 ? "投资回报良好" : paybackYears < 10 ? "回报周期偏长" : "建议优化规模或选址"}
                    </p>
                  </>
                ) : (
                  <p className="text-[14px] text-zinc-500">收益不足, 无法回收</p>
                )}
              </div>
            </div>

            {/* 后端基线数据 */}
            {serverData && (
              <div className="text-[10px] text-zinc-400 text-center">
                基线估算 (后端接口): 成本 ¥{serverData.cost.toLocaleString()} · 年收益 ¥{serverData.annualRevenue.toLocaleString()} · 回收 {serverData.paybackYears} 年
              </div>
            )}
          </div>
        )}

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
