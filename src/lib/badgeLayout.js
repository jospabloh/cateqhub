// Medidas del gafete QR y de la hoja de impresión, en milímetros.
// Tarjeta ~ tamaño credencial/tarjeta de presentación (8.5 x 5.5 cm).
// Hoja carta en horizontal: 3 columnas x 3 filas = 9 gafetes por hoja.
export const CARD_W_MM = 85;
export const CARD_H_MM = 55;
export const COLS = 3;
export const ROWS = 3;
export const PER_PAGE = COLS * ROWS;
export const GAP_MM = 4;
export const PAGE_W_MM = 279.4; // carta horizontal
export const PAGE_H_MM = 215.9;
export const MARGIN_X_MM = (PAGE_W_MM - (COLS * CARD_W_MM + (COLS - 1) * GAP_MM)) / 2;
export const MARGIN_Y_MM = (PAGE_H_MM - (ROWS * CARD_H_MM + (ROWS - 1) * GAP_MM)) / 2;

// Marca de esquina estilo imprenta (guía de corte) — compartida entre el
// render en pantalla/impresión (QRBadge) y la exportación SVG vectorial.
export const MARK_LEN_MM = 3;
export const MARK_GAP_MM = 1;
// 0.15mm (~0.43pt) resultaba demasiado delgado — casi invisible en algunos
// motores de renderizado/impresión — así que se sube a un grosor de línea
// más estándar para una guía de corte.
export const MARK_THICKNESS_MM = 0.3;
// Espacio que las marcas de esquina ocupan fuera del propio rectángulo de la
// tarjeta — hay que reservarlo como padding al recortar un gafete suelto
// (ver downloadBadge en ChildDetail) para no cortar las guías de corte.
export const BADGE_BLEED_MM = MARK_GAP_MM + MARK_LEN_MM;

// Franja reservada arriba del QR para el nombre del niño — a pedido del
// cliente, el gafete impreso/descargado sí debe mostrarlo (a diferencia del
// resto de la tarjeta, que sigue sin datos adicionales).
export const NAME_BAND_MM = 9;
export const NAME_FONT_MM = 3.4;
export const NAME_FONT_MIN_MM = 2.2;
export const NAME_PADDING_MM = 2;
// Fuente "segura" (no la web font "Inter" de la app) para medir/dibujar el
// nombre en contextos donde no se puede depender de que esté cargada: el
// SVG exportado (portátil, sin fuentes embebidas) y la medición con canvas
// que usa QRBadge para ajustar el tamaño antes incluso de montar el DOM.
export const NAME_FONT_FAMILY = "Arial, Helvetica, sans-serif";

export const QR_SIZE_MM = (CARD_H_MM - NAME_BAND_MM) * 0.86;

let measureCanvas;
function measureTextWidthMm(text, fontMm) {
  if (typeof document === "undefined" || !text) return 0;
  const canvas = measureCanvas || (measureCanvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  const probePx = 200; // medir a un tamaño grande y escalar, más preciso que medir directo en mm
  ctx.font = `700 ${probePx}px ${NAME_FONT_FAMILY}`;
  return (fontMm / probePx) * ctx.measureText(text).width;
}

// Encoge el nombre del niño hasta NAME_FONT_MIN_MM y, si aun así no cabe,
// lo trunca con "…" — así nunca se sale de la tarjeta ni invade la de al
// lado (SVG <text> no trunca ni ajusta tamaño solo, y html2canvas no
// soporta de forma confiable "text-overflow: ellipsis").
export function fitBadgeName(name, { maxWidthMm = CARD_W_MM - NAME_PADDING_MM * 2, baseFontMm = NAME_FONT_MM } = {}) {
  if (!name) return { text: "", fontSize: baseFontMm };
  let fontSize = baseFontMm;
  const baseWidth = measureTextWidthMm(name, fontSize);
  if (baseWidth === 0 || baseWidth <= maxWidthMm) return { text: name, fontSize };

  fontSize = Math.max(NAME_FONT_MIN_MM, fontSize * (maxWidthMm / baseWidth));
  if (measureTextWidthMm(name, fontSize) <= maxWidthMm) return { text: name, fontSize };

  let text = name;
  while (text.length > 1 && measureTextWidthMm(`${text}…`, fontSize) > maxWidthMm) {
    text = text.slice(0, -1);
  }
  return { text: text.length < name.length ? `${text}…` : text, fontSize };
}

export function paginateChildren(children, perPage = PER_PAGE) {
  const pages = [];
  for (let i = 0; i < children.length; i += perPage) {
    pages.push(children.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}
