// Módulo 22 del estándar: ninguna función decide una escritura con los campos
// server-authoritative que trae `auth.me()`, porque esa vista está cacheada y
// puede discrepar de lo persistido.
//
// El arreglo es un bloque de cuatro líneas al principio de cada función, y
// Base44 obliga a duplicarlo: cada función es un aislado de Deno y no puede
// importar de otra ni de src/. O sea, la misma forma que ya nos mordió con el
// catálogo de permisos — 14 copias que un día alguien edita en una sola.
//
// Esta prueba lo impide en las dos direcciones: que una copia se separe, y que
// una función NUEVA se escriba con el patrón viejo y nadie lo note en review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const FN_DIR = new URL('../../base44/functions/', import.meta.url);

// El bloque, tal cual tiene que aparecer. Si cambia, cambia AQUÍ y en las 14 —
// que es precisamente lo que esta prueba obliga a hacer junto.
const FRESH_READ = `    const session = await base44.auth.me();
    if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
    const stored = await base44.asServiceRole.entities.User.filter({ id: session.id }).catch(() => null);
    const me = stored?.[0];
    if (!me) return Response.json({ error: 'No se pudo verificar tu cuenta, intenta de nuevo' }, { status: 500 });`;

const entries = readdirSync(FN_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .map((name) => ({ name, src: readFileSync(new URL(`${name}/entry.ts`, FN_DIR), 'utf8') }));

test('hay funciones que revisar (la prueba no pasa por estar vacía)', () => {
  assert.ok(entries.length >= 14, `sólo se encontraron ${entries.length} funciones`);
});

for (const { name, src } of entries) {
  const usesSession = src.includes('auth.me()');

  // Las funciones sin usuario. No es una lista para ir creciendo: cada una
  // entra por una puerta que NO es una sesión, y por eso no tiene nada que
  // releer. acaciaControl es el puente de Mission Control (HMAC);
  // purge_stale_sessions es el reaper del módulo 20 (guardia de CRON_SECRET,
  // que falla cerrado). Una función nueva que no llame a auth.me() falla aquí
  // hasta que alguien decida a propósito en cuál de los dos casos cae.
  const NO_SESSION = ['acaciaControl', 'purge_stale_sessions'];
  if (!usesSession) {
    test(`${name}: no usa auth.me(), así que no le aplica`, () => {
      assert.ok(NO_SESSION.includes(name),
        `${name} no llama a auth.me(). Si es una función nueva de usuario, le falta el bloque del módulo 22; ` +
        'si de verdad no tiene sesión (puente HMAC, cron), añádela a NO_SESSION a propósito.');
    });
    continue;
  }

  test(`${name}: relee al llamante con rol de servicio (módulo 22)`, () => {
    assert.ok(src.includes(FRESH_READ),
      `${name} no lleva el bloque del módulo 22 tal cual, o lo lleva modificado. ` +
      'Los campos server-authoritative (parish_id, parish_role, role, perm_*) se leen del ' +
      'registro ALMACENADO, no de la vista cacheada de la sesión.');
  });

  test(`${name}: no vuelve al patrón viejo`, () => {
    assert.ok(!src.includes('const me = await base44.auth.me();'),
      `${name} volvió a asignar \`me\` directo de auth.me(). Ese es el patrón que el módulo 22 quita.`);
  });
}
