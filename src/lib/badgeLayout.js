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
export const MARK_THICKNESS_MM = 0.15;
// Espacio que las marcas de esquina ocupan fuera del propio rectángulo de la
// tarjeta — hay que reservarlo como padding al recortar un gafete suelto
// (ver downloadBadge en ChildDetail) para no cortar las guías de corte.
export const BADGE_BLEED_MM = MARK_GAP_MM + MARK_LEN_MM;

export const QR_SIZE_MM = CARD_H_MM * 0.72;

export function paginateChildren(children, perPage = PER_PAGE) {
  const pages = [];
  for (let i = 0; i < children.length; i += perPage) {
    pages.push(children.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}
