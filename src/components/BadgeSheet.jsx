import QRBadge from "@/components/QRBadge";
import {
  CARD_W_MM,
  CARD_H_MM,
  COLS,
  ROWS,
  GAP_MM,
  PAGE_W_MM,
  PAGE_H_MM,
  MARGIN_X_MM,
  MARGIN_Y_MM,
} from "@/lib/badgeLayout";

// Cada página vive siempre en el DOM (necesario para que la exportación a
// PDF pueda capturar todas las páginas y para que la impresión del
// navegador saque todas las hojas), pero en pantalla solo la página activa
// queda en el flujo normal — el resto se posiciona fuera de la vista para
// no afectar el layout ni ser visible al usuario.
const PRINT_CSS = `
@page { size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm; margin: 0; }
@media print {
  /* Todo lo que sigue visible en esta pantalla durante la impresión es la
     hoja de gafetes — cualquier margen heredado (p.ej. de utilidades
     "space-y-*", que siguen contando a los hermanos print:hidden porque
     esos usan display:none por clase, no el atributo html "hidden") empuja
     la hoja más allá del alto de página y genera una hoja extra en blanco. */
  body * { margin: 0 !important; }
  .badge-page { position: static !important; left: auto !important; }
  .badge-page { page-break-after: always; break-after: page; }
  .badge-page:last-child { page-break-after: auto; break-after: auto; }
}
`;

export default function BadgeSheet({ pages, activePage = 0, pageRefs }) {
  return (
    <div className="badge-sheet-root">
      <style>{PRINT_CSS}</style>
      {pages.map((pageChildren, i) => (
        <div
          key={i}
          ref={(el) => {
            if (pageRefs) pageRefs.current[i] = el;
          }}
          className="badge-page bg-white"
          style={{
            width: `${PAGE_W_MM}mm`,
            height: `${PAGE_H_MM}mm`,
            padding: `${MARGIN_Y_MM}mm ${MARGIN_X_MM}mm`,
            position: i === activePage ? "static" : "absolute",
            left: i === activePage ? "auto" : "-9999px",
            top: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${CARD_W_MM}mm)`,
              gridTemplateRows: `repeat(${ROWS}, ${CARD_H_MM}mm)`,
              gap: `${GAP_MM}mm`,
            }}
          >
            {pageChildren.map((child) => (
              <QRBadge key={child.id} token={child.qr_token} name={child.name} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
