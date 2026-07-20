import { QRCodeCanvas } from "qrcode.react";
import { forwardRef } from "react";

const QRCard = forwardRef(function QRCard({ child, parish, group }, ref) {
  return (
    <div ref={ref} className="bg-white text-slate-900 rounded-2xl p-6 w-full max-w-[320px] mx-auto border-2 border-slate-200 print:border-0">
      <div className="text-center mb-3">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">CatequesisQR</p>
        {parish && <p className="text-sm font-medium text-slate-600">{parish.name}</p>}
      </div>
      <div className="flex justify-center my-4">
        <QRCodeCanvas value={child.qr_token} size={220} level="M" includeMargin />
      </div>
      <div className="text-center">
        <p className="text-lg font-bold leading-tight">{child.name}</p>
        {group && <p className="text-sm text-slate-500 mt-0.5">Grupo: {group.name}</p>}
      </div>
      <p className="text-[10px] text-center text-slate-300 mt-4 break-all">{child.qr_token}</p>
    </div>
  );
});

export default QRCard;

export function downloadQRCard(child) {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `qr-${child.name.replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}