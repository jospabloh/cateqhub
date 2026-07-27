import { QRCodeSVG } from "qrcode.react";
import { CARD_W_MM, CARD_H_MM, QR_SIZE_MM, MARK_LEN_MM, MARK_GAP_MM, MARK_THICKNESS_MM } from "@/lib/badgeLayout";

const OUTER_MM = -(MARK_GAP_MM + MARK_LEN_MM);

// Marca de esquina estilo imprenta: dos segmentos cortos, sin tocar la
// tarjeta, a modo de guía de corte.
function CornerMark({ corner }) {
  const isLeft = corner === "tl" || corner === "bl";
  const isTop = corner === "tl" || corner === "tr";
  return (
    <>
      <div
        style={{
          position: "absolute",
          background: "#101820",
          width: `${MARK_LEN_MM}mm`,
          height: `${MARK_THICKNESS_MM}mm`,
          left: isLeft ? `${OUTER_MM}mm` : `calc(100% + ${MARK_GAP_MM}mm)`,
          top: isTop ? "0" : "auto",
          bottom: isTop ? "auto" : "0",
        }}
      />
      <div
        style={{
          position: "absolute",
          background: "#101820",
          width: `${MARK_THICKNESS_MM}mm`,
          height: `${MARK_LEN_MM}mm`,
          top: isTop ? `${OUTER_MM}mm` : `calc(100% + ${MARK_GAP_MM}mm)`,
          left: isLeft ? "0" : "auto",
          right: isLeft ? "auto" : "0",
        }}
      />
    </>
  );
}

// Gafete de impresión: SOLO el código QR, sin nombre, logo ni texto — la
// hoja/archivo exportado no debe llevar ningún dato del niño más allá de lo
// que ya va codificado dentro del propio QR.
export default function QRBadge({ token, size = 1 }) {
  return (
    <div
      className="relative bg-white"
      style={{ width: `${CARD_W_MM * size}mm`, height: `${CARD_H_MM * size}mm` }}
    >
      <CornerMark corner="tl" />
      <CornerMark corner="tr" />
      <CornerMark corner="bl" />
      <CornerMark corner="br" />
      <div className="w-full h-full flex items-center justify-center">
        {/* width/height (no "size", que qrcode.react renderiza como píxeles crudos) —
            así el QR se dimensiona con las mismas unidades mm que la tarjeta. */}
        <QRCodeSVG
          value={token}
          level="M"
          marginSize={2}
          fgColor="#101820"
          width={`${QR_SIZE_MM * size}mm`}
          height={`${QR_SIZE_MM * size}mm`}
        />
      </div>
    </div>
  );
}
