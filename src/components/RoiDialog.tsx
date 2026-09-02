// RoiDialog.tsx
// 选址决策 - ROI 投资回报估算弹窗 (成本参数可调: 回收期/年收益/盈亏平衡)
import { useState, useEffect } from "react";
import { X, Calculator, TrendingUp, PiggyBank, Scale } from "lucide-react";

interface RoiDialogProps {
  open: boolean;
  onClose: () => void;
  initParams: { fastChargers: number; slowChargers: number; coveredPopulation: number };
}

export default function RoiDialog({ open, onClose, initParams }: RoiDialogProps) {
  // ===== 可调成本参数 =====
  const [fastCount, setFastCount] = useState(4);
  const [fastPrice, setFastPrice] = useState(6);          // 万元/台
  const [slowCount, setSlowCount] = useState(4);
  const [slowPrice, setSlowPrice] = useState(1.5);        // 万元/台
  const [constructCost, setConstructCost] = useState(20); // 建设+场地投入 (万元)
  const [rent, setRent] = useState(3);                    // 年场地租金 (万元)
  const [serviceFee, setServiceFee] = useState(0.6);      // 服务费 (元/度)
  const [elecCost, setElecCost] = useState(0.5);          // 购电成本 (元/度)
  const [fastDaily, setFastDaily] = useState(120);        // 快充单桩日均充电量 (度)
  const [slowDaily, setSlowDaily] = useState(25);         // 慢充单桩日均充电量 (度)
  const [maintainRate, setMaintainRate] = useState(5);    // 年运维费率 (%)

  // 打开时用评估参数初始化
  useEffect(() => {
    if (open) {
      setFastCount(initParams.fastChargers || 4);
      setSlowCount(initParams.slowChargers || 4);
    }
  }, [open, initParams]);

  if (!open) return null;

  // ===== 计算 =====
  const totalInvest = fastCount * fastPrice + slowCount * slowPrice + constructCost; // 万元
  const annualKwh = (fastCount * fastDaily + slowCount * slowDaily) * 365;           // 度/年
  const annualIncome = (annualKwh * serviceFee) / 10000;                             // 万元 (服务费收入)
  const annualElec = (annualKwh * elecCost) / 10000;                                 // 万元 (电费)
  const annualMaintain = (totalInvest * maintainRate) / 100;                         // 万元
  const annualNet = annualIncome - annualElec - annualMaintain - rent;               // 万元 (年净收益)
  const paybackYears = annualNet > 0 ? totalInvest / annualNet : null;               // 年
  // 盈亏平衡: 年净收益=0 时需要的年充电量 (度)
  const breakEvenKwh = annualNet <= 0
    ? ((annualMaintain + rent) * 10000) / (serviceFee - elecCost)
    : 0;
  const breakEvenRate = breakEvenKwh > 0 ? Math.min(100, (breakEvenKwh / annualKwh) * 100) : 0;
  const paybackStr = paybackYears !== null
    ? (paybackYears < 1 ? `${Math.round(paybackYears * 12)} 个月` : `${paybackYears.toFixed(1)} 年`)
    : "—";

  const numInput = (label: string, val: number, set: (v: number) => void, unit: string, step = 1) => (
    <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[10px]"
      style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
      <span className="text-zinc-500">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number" value={val} step={step} min={0}
          onChange={e => set(parseFloat(e.target.value) || 0)}
          className="input-sys w-14 h-5 text-[10px] px-1 text-right font-num text-zinc-700"
        />
        <span className="text-zinc-400 w-7">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(9,9,11,0.45)" }} onClick={onClose}>
      <div className="w-[720px] max-h-[88vh] overflow-y-auto bento-tile"
        style={{
          // 液态玻璃 (与全站悬浮浮窗统一)
          background: "linear-gradient(165deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.62) 100%)",
          backdropFilter: "blur(32px) saturate(1.8) brightness(1.05)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8) brightness(1.05)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow:
            "0 24px 64px -16px rgba(0,0,0,0.3), 0 4px 12px -4px rgba(0,0,0,0.12), inset 0 1.5px 1px -0.5px rgba(255,255,255,0.95), inset 0 -1.5px 1px -0.5px rgba(255,255,255,0.35)",
          borderRadius: 22,
        }}
        onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(165deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.5) 100%)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.8)",
            }}>
            <Calculator className="w-4 h-4" style={{ color: "#10B981" }} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink-1)" }}>ROI 投资回报估算</h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-ink-4)" }}>
              覆盖人口 {initParams.coveredPopulation.toLocaleString()} 人 · 参数可调实时计算
            </p>
          </div>
          <button onClick={onClose}
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 shrink-0"
            style={{ color: "var(--color-ink-4)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          {/* 左: 参数 */}
          <div>
            <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: "var(--color-ink-4)" }}>
              <PiggyBank className="w-3 h-3" /> 成本参数（可调）
            </p>
            <div className="space-y-1.5">
              {numInput("快充桩数量", fastCount, setFastCount, "台")}
              {numInput("快充桩单价", fastPrice, setFastPrice, "万/台", 0.5)}
              {numInput("慢充桩数量", slowCount, setSlowCount, "台")}
              {numInput("慢充桩单价", slowPrice, setSlowPrice, "万/台", 0.5)}
              {numInput("建设+场地投入", constructCost, setConstructCost, "万元", 1)}
              {numInput("年场地租金", rent, setRent, "万/年", 0.5)}
              <div className="pt-1 text-[9px]" style={{ color: "var(--color-ink-5)" }}>— 运营参数 —</div>
              {numInput("充电服务费", serviceFee, setServiceFee, "元/度", 0.05)}
              {numInput("购电成本", elecCost, setElecCost, "元/度", 0.05)}
              {numInput("快充日均充电量", fastDaily, setFastDaily, "度/桩", 5)}
              {numInput("慢充日均充电量", slowDaily, setSlowDaily, "度/桩", 5)}
              {numInput("年运维费率", maintainRate, setMaintainRate, "%", 0.5)}
            </div>
          </div>

          {/* 右: 结果 */}
          <div>
            <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: "var(--color-ink-4)" }}>
              <TrendingUp className="w-3 h-3" /> 估算结果
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderTop: "2px solid #10B981" }}>
                  <p className="text-[9px] text-zinc-500">总投资（一次性）</p>
                  <p className="text-[16px] font-bold font-num text-zinc-900 mt-0.5">{totalInvest.toFixed(1)} <span className="text-[9px] font-normal text-zinc-400">万元</span></p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderTop: "2px solid #F59E0B" }}>
                  <p className="text-[9px] text-zinc-500">年服务费收入</p>
                  <p className="text-[16px] font-bold font-num text-zinc-900 mt-0.5">{annualIncome.toFixed(1)} <span className="text-[9px] font-normal text-zinc-400">万元</span></p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)", borderTop: "2px solid #38BDF8" }}>
                  <p className="text-[9px] text-zinc-500">年净收益（扣成本）</p>
                  <p className="text-[16px] font-bold font-num mt-0.5" style={{ color: annualNet >= 0 ? "#059669" : "#EF4444" }}>
                    {annualNet.toFixed(1)} <span className="text-[9px] font-normal text-zinc-400">万元</span>
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)", borderTop: "2px solid #A855F7" }}>
                  <p className="text-[9px] text-zinc-500">投资回收期</p>
                  <p className="text-[16px] font-bold font-num mt-0.5" style={{ color: paybackYears !== null && paybackYears <= 5 ? "#059669" : "#EF4444" }}>
                    {paybackStr}
                  </p>
                </div>
              </div>
              {/* 盈亏平衡 */}
              <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}>
                <p className="text-[9px] flex items-center gap-1 text-zinc-500"><Scale className="w-2.5 h-2.5" /> 盈亏平衡分析</p>
                <div className="mt-1.5">
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-zinc-500">当前利用率（日均充电量 ÷ 理论满负荷）</span>
                    <span className="font-semibold font-num text-zinc-700">{annualKwh > 0 ? "基准" : "—"}</span>
                  </div>
                  {breakEvenKwh > 0 ? (
                    <>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(239,68,68,0.15)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, breakEvenRate)}%`, background: "#EF4444" }} />
                      </div>
                      <p className="text-[9px] mt-1 text-zinc-500">
                        需年充电量 <b className="font-num text-red-500">{(breakEvenKwh / 10000).toFixed(1)} 万度</b>
                        （利用率约 {breakEvenRate.toFixed(0)}%）才能盈亏平衡
                        {annualNet < 0 && <span className="text-red-500"> —— 当前参数下<span className="font-bold">亏损</span>，建议上调服务费或加大充电量</span>}
                      </p>
                    </>
                  ) : (
                    <p className="text-[9px] mt-0.5 text-emerald-600">✅ 当前参数下已实现盈利（年净收益为正）</p>
                  )}
                </div>
              </div>
              <p className="text-[9px] leading-relaxed" style={{ color: "var(--color-ink-5)" }}>
                说明：年净收益 = 服务费收入 − 购电成本 − 年运维费 − 场地租金；回收期 = 总投资 ÷ 年净收益（≤5 年视为可接受）。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
