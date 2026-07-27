import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CARD_W_MM,
  CARD_H_MM,
  QR_SIZE_MM,
  NAME_BAND_MM,
  NAME_FONT_MM,
  NAME_PADDING_MM,
  NAME_FONT_FAMILY,
  MARK_LEN_MM,
  MARK_GAP_MM,
  MARK_THICKNESS_MM,
  fitBadgeName,
} from "@/lib/badgeLayout";

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

// Gafete de impresión: el QR + el nombre del niño arriba, sin logo ni
// ningún otro dato — el resto de la información del niño no viaja en la
// tarjeta impresa/exportada, solo lo necesario para identificarla a simple
// vista y lo que ya va codificado dentro del propio QR.
export default function QRBadge({ token, name, size = 1 }) {
  // html2canvas (usado para exportar PNG) no soporta de forma confiable
  // "text-overflow: ellipsis", así que el nombre se ajusta de antemano
  // (mismo cálculo que el export SVG) en vez de depender de CSS truncate.
  const fitted = useMemo(
    () => (name ? fitBadgeName(name, { maxWidthMm: (CARD_W_MM - NAME_PADDING_MM * 2) * size, baseFontMm: NAME_FONT_MM * size }) : null),
    [name, size]
  );

  return (
    <div
      className="relative bg-white flex flex-col items-center"
      style={{ width: `${CARD_W_MM * size}mm`, height: `${CARD_H_MM * size}mm` }}
    >
      <CornerMark corner="tl" />
      <CornerMark corner="tr" />
      <CornerMark corner="bl" />
      <CornerMark corner="br" />
      {fitted && (
        <div
          className="w-full flex items-center justify-center px-1 shrink-0"
          style={{ height: `${NAME_BAND_MM * size}mm` }}
        >
          <p
            className="font-semibold text-center whitespace-nowrap"
            style={{ fontSize: `${fitted.fontSize}mm`, color: "#101820", fontFamily: NAME_FONT_FAMILY }}
          >
            {fitted.text}
          </p>
        </div>
      )}
      <div className="w-full flex-1 flex items-center justify-center">
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
