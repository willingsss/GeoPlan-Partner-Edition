// StationEditModal.tsx
// 系统管理 - 站点/用户 新增与编辑模态框 (拆分自 App.tsx)
import { useState } from "react";
import { X, Zap, User as UserIcon } from "lucide-react";
import { BRANDS } from "../../types";

export default function StationEditModal({ data, onClose, onSave }: {
  data: any;
  onClose: () => void;
  onSave: (formData: any) => Promise<void>;
}) {
  if (!data) return null;
  const isUser = data._type === "user";
  const isEdit = !!data.id;
  const [form, setForm] = useState<any>({
    ...data,
    name: data.name || "",
    brand: data.brand || "国家电网",
    lng: data.lng || "",
    lat: data.lat || "",
    fast_chargers: data.fastChargers ?? "",
    slow_chargers: data.slowChargers ?? "",
    address: data.address || "",
    district: data.district || "泉山区",
    status: data.status || "运营中",
    operator: data.operator || "",
    username: data.username || "",
    password: data.password && data.password !== "******" ? data.password : "",
    role: data.role || "新能源车主",
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(9,9,11,0.4)" }}
      onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-md overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}>
        {/* 头部 - Linear 风: 无渐变, 紧凑 */}
        <div
          className="px-5 py-3 flex justify-between items-center"
          style={{ borderBottom: "1px solid var(--color-muted)", background: "var(--color-surface)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "var(--color-subtle)", border: "1px solid var(--color-muted)" }}
            >
              {isUser ? <UserIcon className="w-3.5 h-3.5" style={{ color: "var(--color-ink-3)" }} /> : <Zap className="w-3.5 h-3.5" style={{ color: "var(--color-brand)" }} />}
            </div>
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--color-ink-1)" }}>
              {isUser ? (isEdit ? "编辑用户" : "新增用户") : (isEdit ? "编辑充电站" : "新增充电站")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ color: "var(--color-ink-5)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-subtle)"; e.currentTarget.style.color = "var(--color-ink-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-5)"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {isUser ? (
            <>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>用户名</label>
                <input type="text" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>密码 {isEdit && "(留空不改)"}</label>
                <input type="text" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? "******" : "请输入密码"}
                  className="input-sys w-full text-sm px-3 py-2 font-mono" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>角色</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                  <option value="新能源车主">新能源车主</option>
                  <option value="投资商">充电设施投资商</option>
                  <option value="管理员">系统管理员</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                  <option value="正常">正常</option>
                  <option value="禁用">禁用</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>站点名称</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>品牌</label>
                  <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>行政区</label>
                  <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                    {["鼓楼区", "云龙区", "贾汪区", "泉山区", "铜山区"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>经度 (GCJ02)</label>
                  <input type="number" step="0.000001" value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>纬度 (GCJ02)</label>
                  <input type="number" step="0.000001" value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>快充桩数</label>
                  <input type="number" value={form.fast_chargers}
                    onChange={(e) => setForm({ ...form, fast_chargers: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>慢充桩数</label>
                  <input type="number" value={form.slow_chargers}
                    onChange={(e) => setForm({ ...form, slow_chargers: e.target.value })}
                    className="input-sys w-full text-sm px-3 py-2 font-num" style={{ color: "var(--color-ink-1)" }} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>详细地址</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--color-ink-4)" }}>运营状态</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-sys w-full text-sm px-3 py-2" style={{ color: "var(--color-ink-1)" }}>
                  <option value="运营中">运营中</option>
                  <option value="建设中">建设中</option>
                  <option value="停运">停运</option>
                </select>
              </div>
            </>
          )}
        </div>
        {/* 底部操作 - Linear 风: 单色, 无渐变 */}
        <div
          className="px-5 py-3 flex justify-end gap-2"
          style={{ borderTop: "1px solid var(--color-muted)", background: "var(--color-subtle)" }}
        >
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-md font-medium transition-colors"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", color: "var(--color-ink-3)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface)"; }}
          >
            取消
          </button>
          <button
            onClick={() => onSave(form)}
            className="btn-brand text-xs px-4 py-2 rounded-md font-medium"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

