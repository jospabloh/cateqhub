#!/usr/bin/env node
// Post-build sanity check: catches a "successful" build that actually produced
// a broken or empty bundle (bad plugin config, silent failure, etc.).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const MIN_JS_BYTES = 10_000;
const MIN_CSS_BYTES = 2_000;

const fail = (message) => {
  console.error(`✖ Verificación de build fallida: ${message}`);
  process.exit(1);
};

if (!existsSync(DIST)) fail(`no existe el directorio "${DIST}". ¿Corrió "vite build"?`);

const indexPath = join(DIST, "index.html");
if (!existsSync(indexPath)) fail(`falta "${indexPath}".`);

const indexHtml = readFileSync(indexPath, "utf8");
if (!/<div id="root">/.test(indexHtml)) fail(`"${indexPath}" no contiene el contenedor #root esperado.`);
if (!/<script[^>]+src="[^"]+\.js"/.test(indexHtml)) fail(`"${indexPath}" no referencia ningún bundle .js.`);

const assetsDir = join(DIST, "assets");
if (!existsSync(assetsDir)) fail(`falta el directorio "${assetsDir}".`);

const assetFiles = readdirSync(assetsDir);
const jsFiles = assetFiles.filter((f) => f.endsWith(".js"));
const cssFiles = assetFiles.filter((f) => f.endsWith(".css"));

if (jsFiles.length === 0) fail(`no se encontró ningún archivo .js en "${assetsDir}".`);
if (cssFiles.length === 0) fail(`no se encontró ningún archivo .css en "${assetsDir}".`);

const totalJsBytes = jsFiles.reduce((sum, f) => sum + statSync(join(assetsDir, f)).size, 0);
const totalCssBytes = cssFiles.reduce((sum, f) => sum + statSync(join(assetsDir, f)).size, 0);

if (totalJsBytes < MIN_JS_BYTES) {
  fail(`el bundle JS pesa solo ${totalJsBytes} bytes (mínimo esperado ${MIN_JS_BYTES}) — probablemente el build está roto o vacío.`);
}
if (totalCssBytes < MIN_CSS_BYTES) {
  fail(`el bundle CSS pesa solo ${totalCssBytes} bytes (mínimo esperado ${MIN_CSS_BYTES}) — probablemente los estilos de Tailwind no se generaron.`);
}

console.log(`✓ Build verificado: ${indexPath}, ${jsFiles.length} archivo(s) JS (${totalJsBytes} bytes), ${cssFiles.length} archivo(s) CSS (${totalCssBytes} bytes).`);
