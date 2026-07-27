import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  CARD_W_MM,
  CARD_H_MM,
  COLS,
  GAP_MM,
  PAGE_W_MM,
  PAGE_H_MM,
  MARGIN_X_MM,
  MARGIN_Y_MM,
  MARK_LEN_MM,
  MARK_GAP_MM,
  MARK_THICKNESS_MM,
  QR_SIZE_MM,
  NAME_BAND_MM,
  NAME_PADDING_MM,
  NAME_FONT_FAMILY,
  fitBadgeName,
} from "@/lib/badgeLayout";

// Resolución de captura para PNG/PDF — suficiente para imprimir a tamaño real sin verse pixelado.
const RASTER_SCALE = 3;

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

export async function exportBadgeSheetPNG(pageEl, filename) {
  const canvas = await html2canvas(pageEl, { scale: RASTER_SCALE, backgroundColor: "#ffffff" });
  downloadDataUrl(canvas.toDataURL("image/png"), filename);
}

// Todas las páginas de la selección van en un solo PDF, aunque en pantalla
// solo se esté viendo una — a diferencia de PNG/SVG, que solo exportan la
// página visible.
export async function exportBadgeSheetPDF(pageEls, filename) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [PAGE_W_MM, PAGE_H_MM] });
  let first = true;
  for (const el of pageEls) {
    if (!el) continue;
    const canvas = await html2canvas(el, { scale: RASTER_SCALE, backgroundColor: "#ffffff" });
    if (!first) doc.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");
    first = false;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W_MM, PAGE_H_MM);
  }
  doc.save(filename);
}

function cornerMarksSVG(w, h) {
  const outer = -(MARK_GAP_MM + MARK_LEN_MM);
  const corners = [
    { hx: outer, hy: 0, vx: 0, vy: outer }, // arriba-izquierda
    { hx: w + MARK_GAP_MM, hy: 0, vx: w - MARK_THICKNESS_MM, vy: outer }, // arriba-derecha
    { hx: outer, hy: h - MARK_THICKNESS_MM, vx: 0, vy: h + MARK_GAP_MM }, // abajo-izquierda
    { hx: w + MARK_GAP_MM, hy: h - MARK_THICKNESS_MM, vx: w - MARK_THICKNESS_MM, vy: h + MARK_GAP_MM }, // abajo-derecha
  ];
  return corners
    .map(
      (c) =>
        `<rect x="${c.hx}" y="${c.hy}" width="${MARK_LEN_MM}" height="${MARK_THICKNESS_MM}" fill="#101820" />` +
        `<rect x="${c.vx}" y="${c.vy}" width="${MARK_THICKNESS_MM}" height="${MARK_LEN_MM}" fill="#101820" />`
    )
    .join("");
}

function escapeXml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Arma la hoja como un único SVG vectorial (sin depender del DOM montado) —
// cada gafete es el nombre del niño + el QR + sus marcas de corte, nada más.
export function buildBadgeSheetSVG(pageChildren) {
  const qrAreaH = CARD_H_MM - NAME_BAND_MM;
  const qrOffsetX = (CARD_W_MM - QR_SIZE_MM) / 2;
  const qrOffsetY = NAME_BAND_MM + (qrAreaH - QR_SIZE_MM) / 2;
  const cards = pageChildren
    .map((child, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN_X_MM + col * (CARD_W_MM + GAP_MM);
      const y = MARGIN_Y_MM + row * (CARD_H_MM + GAP_MM);
      const qrMarkup = renderToStaticMarkup(
        createElement(QRCodeSVG, { value: child.qr_token, size: QR_SIZE_MM, level: "M", marginSize: 2, fgColor: "#101820" })
      );
      let nameText = "";
      if (child.name) {
        const { text, fontSize } = fitBadgeName(child.name, { maxWidthMm: CARD_W_MM - NAME_PADDING_MM * 2 });
        nameText =
          `<text x="${CARD_W_MM / 2}" y="${NAME_BAND_MM / 2}" text-anchor="middle" dominant-baseline="central" ` +
          `font-family="${NAME_FONT_FAMILY}" font-weight="700" font-size="${fontSize}" fill="#101820">` +
          `${escapeXml(text)}</text>`;
      }
      return (
        `<g transform="translate(${x},${y})">` +
        cornerMarksSVG(CARD_W_MM, CARD_H_MM) +
        nameText +
        `<g transform="translate(${qrOffsetX},${qrOffsetY})">${qrMarkup}</g>` +
        `</g>`
      );
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W_MM}mm" height="${PAGE_H_MM}mm" viewBox="0 0 ${PAGE_W_MM} ${PAGE_H_MM}">` +
    `<rect width="${PAGE_W_MM}" height="${PAGE_H_MM}" fill="#ffffff" />` +
    cards +
    `</svg>`
  );
}

export function exportBadgeSheetSVG(pageChildren, filename) {
  const svgString = buildBadgeSheetSVG(pageChildren);
  downloadBlob(new Blob([svgString], { type: "image/svg+xml" }), filename);
}
