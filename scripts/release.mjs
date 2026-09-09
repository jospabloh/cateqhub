#!/usr/bin/env node
// Módulo 6 del estándar: la versión y el changelog los genera un paso de
// release DELIBERADO, nunca el build de rutina.
//
// Hasta 2026-09-08 este repo no tenía ese paso: APP_VERSION, RELEASE_DATE, la
// entrada de CHANGELOG y `package.json.version` se editaban a mano en cuatro
// sitios, y la única garantía era un comentario ("Mantener package.json
// sincronizado con APP_VERSION"). Costó una versión entera: la 1.8.0 —el cambio
// de planes y precios— quedó en el changelog que ve el usuario dentro de la app
// y nunca se escribió en CHANGELOG.md. Nadie lo notó en dos meses.
//
//   node scripts/release.mjs 1.9.11 --nota "Texto del cambio" [--nota "otro"]
//   node scripts/release.mjs 1.9.11 --nota "…" --fecha 2026-09-10
//
// Escribe los cuatro sitios de una vez y en el mismo orden siempre. No hace
// commit ni tag: eso se queda en manos de quien publica. `npm run test:unit`
// vuelve a comprobar los invariantes después, que es la red de verdad.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const version = args[0];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail('Uso: node scripts/release.mjs <version x.y.z> --nota "…" [--nota "…"] [--fecha AAAA-MM-DD]');
}

const notes = [];
let date = new Date().toISOString().slice(0, 10);
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--nota') { notes.push(args[++i] ?? ''); continue; }
  if (args[i] === '--fecha') { date = args[++i] ?? date; continue; }
  fail(`Argumento no reconocido: ${args[i]}`);
}
if (notes.length === 0 || notes.some((n) => !n.trim())) {
  fail('Hace falta al menos una --nota, y ninguna puede ir vacía. Una versión sin entrada de changelog es justo lo que este script existe para impedir.');
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`Fecha con formato raro: ${date} (se espera AAAA-MM-DD)`);

// ── package.json ──────────────────────────────────────────────────────────
const pkgPath = join(ROOT, 'package.json');
const pkgSrc = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgSrc);
if (pkg.version === version) fail(`package.json ya está en ${version}. ¿Se te olvidó subir el número?`);
// Reemplazo textual, no JSON.stringify: reescribir el archivo entero cambiaría
// el formato de 60 dependencias y ensuciaría el diff del release.
writeFileSync(pkgPath, pkgSrc.replace(`"version": "${pkg.version}"`, `"version": "${version}"`));

// ── src/lib/appConfig.js ──────────────────────────────────────────────────
const cfgPath = join(ROOT, 'src/lib/appConfig.js');
let cfg = readFileSync(cfgPath, 'utf8');
if (cfg.includes(`version: "${version}"`)) fail(`appConfig.js ya tiene una entrada para ${version}.`);
cfg = cfg
  .replace(/export const APP_VERSION = "[^"]+";/, `export const APP_VERSION = "${version}";`)
  .replace(/export const RELEASE_DATE = "[^"]+";/, `export const RELEASE_DATE = "${date}";`)
  .replace('export const CHANGELOG = [\n', 'export const CHANGELOG = [\n' +
    `  {\n    version: "${version}",\n    date: "${date}",\n    changes: [\n` +
    notes.map((n) => `      ${JSON.stringify(n)},\n`).join('') +
    '    ],\n  },\n');
writeFileSync(cfgPath, cfg);

// ── CHANGELOG.md ──────────────────────────────────────────────────────────
const mdPath = join(ROOT, 'CHANGELOG.md');
const md = readFileSync(mdPath, 'utf8');
if (md.includes(`## ${version} —`)) fail(`CHANGELOG.md ya tiene una entrada para ${version}.`);
const firstHeading = md.search(/^## \d+\.\d+\.\d+ —/m);
if (firstHeading === -1) fail('No se encontró ningún encabezado de versión en CHANGELOG.md.');
const entry = `## ${version} — ${date}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n`;
writeFileSync(mdPath, md.slice(0, firstHeading) + entry + md.slice(firstHeading));

console.log(`\n✓ ${version} (${date}) escrita en package.json, appConfig.js y CHANGELOG.md.`);
console.log('  Revisa el diff, corre `npm run test:unit` y publica cuando estés conforme.\n');
