# Impresión de gafetes QR — diseño

## Problema

El QR de cada niño (`child.qr_token`, un UUID) ya cumple lo que pide el
cliente a nivel de **contenido**: no lleva más que el token, y ese token solo
sirve para el propósito definido (`Scan.jsx` lo resuelve contra
`Child.qr_token` para registrar asistencia). No hay nada que cambiar ahí.

Lo que no cumple el requisito es la **salida impresa/descargada**:
`QRCard` (usado en `ChildDetail.jsx`) dibuja el QR junto con logo, nombre de
la parroquia, nombre del niño, grupo y el token en texto plano — toda esa
información viaja físicamente en el gafete. Además no existe ninguna forma de
imprimir varios gafetes a la vez: hoy solo se puede descargar/imprimir un QR
por niño, de uno en uno, sin tamaño de tarjeta ni guías de corte.

## Alcance

- El gafete **impreso o exportado** (PNG, SVG, PDF, o impresión física) debe
  contener **únicamente el código QR**, sin nombre, logo ni texto — solo el
  cuadro QR y sus guías de corte. Se muestra un aviso en la UI aclarando esto
  antes de imprimir/exportar.
- La vista en pantalla (antes de imprimir) sí puede seguir mostrando el
  nombre del niño para que el administrador identifique a quién pertenece
  cada QR mientras selecciona — ese texto nunca llega al archivo/impresión.
- Nueva función: desde **Niños** (`/ninos`), selección múltiple (individual o
  "seleccionar todos" sobre la lista filtrada) → botón "Imprimir gafetes" →
  hoja de impresión con varios QR tamaño gafete y guías de corte, exportable
  como PNG, SVG o PDF, o enviable a impresora.
- `ChildDetail.jsx` (`/ninos/:id`) reutiliza el mismo componente de gafete
  para sus botones existentes "Descargar PNG" e "Imprimir" (antes generaban
  el `QRCard` completo con nombre/logo/token) — ahora generan una hoja de 1
  sola tarjeta, igual de "solo QR + guías de corte".
- `QRCard` (con nombre/logo/token) se conserva tal cual para la vista previa
  en pantalla — no se toca su diseño ni su uso en pantalla.

## Tamaño y layout de la hoja

- Tarjeta: **85 mm × 55 mm** (el 8.5 × 5.5 cm pedido, equivalente al tamaño
  ISO de una tarjeta de crédito/presentación).
- Hoja carta en **horizontal** (279.4 mm × 215.9 mm). En vertical, 3 tarjetas
  de 85 mm de ancho ya no caben (255 mm > 215.9 mm de ancho de una carta
  vertical); en horizontal sí caben 3 columnas × 3 filas = **9 tarjetas por
  hoja** con márgenes cómodos (~8 mm laterales, ~21 mm superior/inferior, 4 mm
  de separación entre tarjetas) — dentro del rango de "9 o 10" que pidió el
  cliente, y sin sacrificar el tamaño de tarjeta pedido.
- Selecciones de más de 9 niños generan varias hojas (páginas) automáticas;
  la vista previa pagina con controles "Página X de N".
- Guías de corte: **marcas de esquina estilo imprenta** (crop marks) — 2
  segmentos cortos por esquina de cada tarjeta, no un borde punteado continuo.

## Componentes nuevos

- `src/components/QRBadge.jsx` — celda de gafete: SOLO el QR
  (`QRCodeSVG` de `qrcode.react`), sin texto ni logo, dimensionada en mm.
- `src/components/BadgeSheet.jsx` — arma N páginas (grid 3×3 en mm, hoja
  carta horizontal) a partir de una lista de niños; cada página es un
  `<div>` con clase de impresión (`page-break-after` en `@media print`) que
  contiene 9 `QRBadge` + marcas de esquina. Expone refs por página para que
  la exportación pueda capturarlas.
- `src/lib/badgeExport.js` — helpers `exportBadgeSheetPNG`,
  `exportBadgeSheetSVG` (arma un único SVG vectorial con
  `renderToStaticMarkup(<QRCodeSVG .../>)` de `react-dom/server`, sin
  depender del DOM montado) y `exportBadgeSheetPDF` (una imagen por página
  vía `html2canvas` + `jspdf`, ambas ya son dependencias del proyecto).
- Página `src/pages/BadgePrint.jsx` en la ruta `/ninos/gafetes` — recibe los
  niños seleccionados (via `location.state`, con fallback a recarga por id si
  el usuario refresca), muestra el aviso de "solo QR", el preview paginado y
  los botones Descargar PNG / Descargar SVG / Descargar PDF / Imprimir.
  - PNG y SVG exportan solo la página visible actual.
  - PDF exporta todas las páginas de la selección en un solo archivo.

## Cambios en páginas existentes

- `src/pages/Children.jsx`: modo de selección con checkboxes por tarjeta,
  "Seleccionar todos" (sobre el listado ya filtrado por búsqueda/grupo), y
  una barra de acción con el conteo y el botón "Imprimir gafetes" que navega
  a `/ninos/gafetes` pasando los niños elegidos.
- `src/pages/ChildDetail.jsx`: los botones "Descargar PNG" / "Imprimir" pasan
  a operar sobre un `BadgeSheet` de una sola tarjeta (mismo componente que la
  hoja múltiple) en vez de `downloadQRCard`/`QRCard`. El `QRCard` visible en
  pantalla no cambia.
- `src/components/Layout.jsx`: se agrega `print:hidden` al sidebar, la barra
  superior móvil y la barra inferior móvil — hoy no lo tienen, así que
  `window.print()` imprimiría también el menú de navegación alrededor de la
  hoja de gafetes. Es una corrección necesaria para que "Imprimir" produzca
  solo la hoja de gafetes.

## Fuera de alcance

- No se agregan tamaños de tarjeta configurables ni orientación alternativa
  — un solo tamaño fijo (85×55 mm) resuelve el pedido.
- No se agrega exportación PNG/SVG multi-archivo para selecciones de más de
  una página — PDF cubre ese caso.
- No se modifica el contenido del QR (`qr_token`) ni el flujo de escaneo.
