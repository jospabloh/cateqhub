// Módulo 6 del estándar: la versión y el changelog los genera un paso de
// release deliberado, nunca el build de rutina. Esta prueba fija los
// invariantes que ese paso tiene que dejar ciertos, y que hasta 2026-09-08
// dependían de que alguien se acordara — el comentario de appConfig.js decía
// literalmente "Mantener package.json sincronizado con APP_VERSION", que es
// una promesa, no una garantía.
//
// Los DOS changelog son distintos a propósito y no se funden: CHANGELOG.md es
// la prosa técnica larga y appConfig.js el resumen que ve el usuario en
// "Acerca de". Lo que sí tiene que ser cierto es que hablen de las MISMAS
// versiones — dos registros del mismo hecho que se separan son la forma de
// deriva que este repo ya conoce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION, RELEASE_DATE, CHANGELOG } from '../../src/lib/appConfig.js';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const mdSrc = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');

// Encabezados `## 1.9.10 — 2026-09-07` (guion largo, como los usa el archivo).
const mdEntries = [...mdSrc.matchAll(/^## (\d+\.\d+\.\d+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/gm)]
  .map(([, version, date]) => ({ version, date }));

test('package.json y APP_VERSION dicen la misma versión', () => {
  assert.equal(pkg.version, APP_VERSION,
    'package.json y src/lib/appConfig.js se separaron. La pantalla "Acerca de" muestra APP_VERSION, ' +
    'así que un desajuste le enseña al usuario una versión que no es la que corre.');
});

test('la entrada más reciente del changelog es la versión vigente', () => {
  assert.equal(CHANGELOG[0]?.version, APP_VERSION,
    'CHANGELOG[0] no es APP_VERSION: o se subió la versión sin escribir su entrada, o se escribió una entrada sin subir la versión.');
  assert.equal(CHANGELOG[0]?.date, RELEASE_DATE, 'La fecha de CHANGELOG[0] no coincide con RELEASE_DATE.');
});

test('ninguna entrada del changelog en la app queda vacía', () => {
  // El gate del módulo 21 es "la entrada de la versión actual no está vacía".
  for (const entry of CHANGELOG) {
    assert.ok(Array.isArray(entry.changes) && entry.changes.length > 0,
      `La versión ${entry.version} no tiene cambios listados.`);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `Fecha con formato raro en ${entry.version}.`);
  }
});

test('las versiones van en orden descendente', () => {
  const cmp = (a, b) => {
    const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.ok(cmp(CHANGELOG[i - 1].version, CHANGELOG[i].version) > 0,
      `${CHANGELOG[i - 1].version} no es posterior a ${CHANGELOG[i].version}: la lista no está ordenada.`);
  }
});

test('CHANGELOG.md cubre cada versión que la app muestra, con la misma fecha', () => {
  const byVersion = new Map(mdEntries.map((e) => [e.version, e.date]));
  const missing = CHANGELOG.filter((e) => !byVersion.has(e.version)).map((e) => e.version);
  assert.deepEqual(missing, [],
    `Estas versiones están en appConfig.js y no en CHANGELOG.md: ${missing.join(', ')}. ` +
    'Los dos archivos no tienen que decir lo mismo —uno es prosa técnica y el otro el resumen del usuario— ' +
    'pero sí tienen que hablar de las mismas versiones.');

  const mismatched = CHANGELOG
    .filter((e) => byVersion.get(e.version) !== e.date)
    .map((e) => `${e.version} (app: ${e.date}, md: ${byVersion.get(e.version)})`);
  assert.deepEqual(mismatched, [], `Fechas que no coinciden entre los dos changelog: ${mismatched.join('; ')}`);
});
