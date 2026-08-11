import { useState } from "react";
import type { Map as OlMap } from "ol";
import { X, Printer, FileImage, FileText, Download, Loader2 } from "lucide-react";

// =========================================================================
// 地图打印出图对话框
// 支持 PNG (canvas.toDataURL) 和 PDF (window.print) 两种导出方式
// =========================================================================
interface PrintDialogProps {
  map: OlMap | null;
  onClose: () => void;
  // 兼容 App.tsx 中 showToast 的签名 (info | success)
  showToast: (msg: string, type?: "info" | "success") => void;
}

export default function PrintDialog({ map, onClose, showToast }: PrintDialogProps) {
  // 表单状态
  const [title, setTitle] = useState("GeoPlan 地图出图");
  const [showLegend, setShowLegend] = useState(true);
  const [showScale, setShowScale] = useState(true);
  const [showNorthArrow, setShowNorthArrow] = useState(true);
  const [format, setFormat] = useState<"png" | "pdf">("png");
  const [exporting, setExporting] = useState(false);

  // 执行导出
  const handleExport = async () => {
    if (!map) {
      showToast("地图未就绪", "info");
      return;
    }
    setExporting(true);
    try {
      if (format === "png") {
        // ===== PNG 导出: 直接从地图 canvas 生成图片并下载 =====
        const canvas = map.getViewport().querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) {
          showToast("未找到地图画布", "info");
          setExporting(false);
          return;
        }
        const dataURL = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = `${title || "GeoPlan 地图出图"}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("地图已导出为 PNG", "success");
      } else {
        // ===== PDF 导出: 触发浏览器打印对话框, 通过 CSS @media print 控制只打印地图 =====
        document.body.classList.add("printing-map");
        // 等待一帧让打印 CSS 生效
        await new Promise(r => setTimeout(r, 120));
        window.print();
        // 打印对话框关闭后移除标记 class
        setTimeout(() => {
          document.body.classList.remove("printing-map");
        }, 600);
        showToast("已打开打印对话框", "success");
      }
      onClose();
    } catch (e) {
      showToast("导出失败：" + (e as Error).message, "info");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-muted)" }}
        >
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4" style={{ color: "var(--color-brand-text)" }} />
            <h3 className="text-[14px] font-semibold text-zinc-900">地图打印出图</h3>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="px-5 py-4 space-y-4">
          {/* 图幅标题 */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">图幅标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入地图标题"
              className="input-sys w-full px-3 py-1.5 text-[13px]"
            />
          </div>

          {/* 出图元素开关 */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-2 block">出图元素</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[13px] cursor-pointer hover:bg-zinc-50 px-2 py-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className="accent-emerald-500 w-3.5 h-3.5"
                />
                <span className="text-zinc-700">图例</span>
              </label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer hover:bg-zinc-50 px-2 py-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={showScale}
                  onChange={(e) => setShowScale(e.target.checked)}
                  className="accent-emerald-500 w-3.5 h-3.5"
                />
                <span className="text-zinc-700">比例尺</span>
              </label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer hover:bg-zinc-50 px-2 py-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={showNorthArrow}
                  onChange={(e) => setShowNorthArrow(e.target.checked)}
                  className="accent-emerald-500 w-3.5 h-3.5"
                />
                <span className="text-zinc-700">北针</span>
              </label>
            </div>
          </div>

          {/* 导出格式 */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-2 block">导出格式</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-[13px] ${
                  format === "png"
                    ? "bg-emerald-50"
                    : "hover:bg-zinc-50"
                }`}
                style={{
                  border: `1px solid ${format === "png" ? "var(--color-brand-border)" : "var(--color-muted)"}`,
                }}
              >
                <input
                  type="radio"
                  name="print-format"
                  value="png"
                  checked={format === "png"}
                  onChange={() => setFormat("png")}
                  className="accent-emerald-500 w-3.5 h-3.5"
                />
                <FileImage className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-700">PNG 图片</span>
              </label>
              <label
                className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-[13px] ${
                  format === "pdf"
                    ? "bg-emerald-50"
                    : "hover:bg-zinc-50"
                }`}
                style={{
                  border: `1px solid ${format === "pdf" ? "var(--color-brand-border)" : "var(--color-muted)"}`,
                }}
              >
                <input
                  type="radio"
                  name="print-format"
                  value="pdf"
                  checked={format === "pdf"}
                  onChange={() => setFormat("pdf")}
                  className="accent-emerald-500 w-3.5 h-3.5"
                />
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-700">PDF 打印</span>
              </label>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed">
              {format === "png"
                ? "导出当前地图视图为 PNG 图片文件"
                : "通过浏览器打印对话框另存为 PDF"}
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          className="px-5 py-3.5 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--color-muted)", background: "var(--color-subtle)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-brand px-4 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1.5"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exporting ? "导出中..." : "导出"}
          </button>
        </div>
      </div>
    </div>
  );
}
