import { QRCodeCanvas } from "qrcode.react";
import { forwardRef } from "react";

const QRCard = forwardRef(function QRCard({ child, parish, group }, ref) {
  return (
    <div
      ref={ref}
      className="relative bg-[#FBF6E9] text-[#16323A] rounded-[1.25rem] p-6 w-full max-w-[320px] mx-auto border-2 border-[#B8872F]/40 shadow-sm print:shadow-none print:border-[#B8872F]"
    >
      <div className="absolute inset-2 rounded-2xl border border-dashed border-[#B8872F]/35 pointer-events-none" />

      <div className="relative text-center mb-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#B8872F] font-mono font-medium">Catequesis · Tarjeta de asistencia</p>
        {parish && <p className="text-sm font-medium text-[#16323A]/70 mt-1">{parish.name}</p>}
      </div>

      <div className="relative flex justify-center my-4">
        <div className="p-3 rounded-xl bg-white ring-1 ring-[#B8872F]/40">
          <QRCodeCanvas value={child.qr_token} size={200} level="M" includeMargin fgColor="#16323A" />
        </div>
      </div>

      <div className="relative text-center">
        <p className="text-xl font-heading font-semibold leading-tight">{child.name}</p>
        {group && <p className="text-sm text-[#16323A]/60 mt-1">Grupo: {group.name}</p>}
      </div>

      <div className="relative mt-4 pt-3 border-t border-dashed border-[#B8872F]/35">
        <p className="text-[9px] text-center text-[#16323A]/35 font-mono break-all">{child.qr_token}</p>
      </div>
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
