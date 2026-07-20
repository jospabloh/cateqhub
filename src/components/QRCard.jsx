import { QRCodeCanvas } from "qrcode.react";
import { forwardRef } from "react";

const QRCard = forwardRef(function QRCard({ child, parish, group }, ref) {
  return (
    <div
      ref={ref}
      className="bg-white text-[#101820] rounded-xl p-6 w-full max-w-[320px] mx-auto border border-[#E4E7EB] shadow-sm print:shadow-none"
    >
      <div className="text-center mb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8A94A3] font-medium">Tarjeta de asistencia</p>
        {parish && <p className="text-sm font-medium text-[#101820]/70 mt-1">{parish.name}</p>}
      </div>

      <div className="flex justify-center my-4">
        <div className="p-3 rounded-lg border border-[#E4E7EB]">
          <QRCodeCanvas value={child.qr_token} size={200} level="M" includeMargin fgColor="#101820" />
        </div>
      </div>

      <div className="text-center">
        <p className="text-xl font-heading font-semibold leading-tight">{child.name}</p>
        {group && <p className="text-sm text-[#101820]/55 mt-1">Grupo: {group.name}</p>}
      </div>

      <div className="mt-4 pt-3 border-t border-[#E4E7EB]">
        <p className="text-[9px] text-center text-[#101820]/35 font-mono break-all">{child.qr_token}</p>
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
