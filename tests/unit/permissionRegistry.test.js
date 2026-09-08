// Corredor de pruebas unitarias de este repo. Node 20 en CI, así que `node
// --test` sin dependencias nuevas y sin transpilador — pero tampoco puede
// IMPORTAR las funciones de `base44/functions/`, que son TypeScript de Deno.
// Por eso este archivo importa el registro (JS plano) y LEE las funciones como
// texto: es el mismo patrón que acaciaco-site usa para que soporte.html y
// KNOWN_APPS no se separen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getRegistryDefaults } from '../../src/lib/permissionRegistry.js';

// El catálogo de permisos vive en TRES copias que tienen que coincidir:
// src/lib/permissionRegistry.js (el original, que consume PermissionContext) y
// el mapa DEFAULTS de estas dos funciones, que es el que de verdad decide qué
// puede hacer un catequista. Base44 aísla cada función —no pueden importar de
// src/ ni entre sí— así que la duplicación es inevitable; la deriva no.
//
// Hasta 2026-09-08 la única garantía era un comentario ("DEFAULTS debe
// reflejar exactamente src/lib/permissionRegistry.js"). Mission Control ya
// perdió esa misma apuesta con licenseCatalog: rumbo llevaba `view_only`
// desplegado desde el 2026-08-03 sin que el panel lo ofreciera, y radar no
// estaba en ninguno de los tres espejos. Se cerró con una prueba igual a ésta.
const MIRRORS = [
  'base44/functions/sync_catequist_permissions/entry.ts',
  'base44/functions/assign_parish_user/entry.ts',
];

// Extrae el literal `const DEFAULTS: Record<string, boolean> = { ... };` sin
// evaluar el archivo: es TypeScript de Deno y este proceso es Node.
function readDefaults(path) {
  const src = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const block = src.match(/const DEFAULTS:\s*Record<string,\s*boolean>\s*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(block, `${path}: no se encontró el literal DEFAULTS — ¿cambió su forma?`);
  const out = {};
  for (const line of block[1].split('\n')) {
    const kv = line.match(/^\s*'([^']+)':\s*(true|false)\s*,?\s*$/);
    if (kv) out[kv[1]] = kv[2] === 'true';
  }
  assert.ok(Object.keys(out).length > 0, `${path}: DEFAULTS quedó vacío al parsear`);
  return out;
}

// Permisos que HOY sólo se aplican en el cliente, con el motivo y lo que hace
// falta para cerrarlos. Detectado el 2026-09-08 por la primera corrida de esta
// misma prueba, que es exactamente para lo que sirve.
//
// `reportes:ver_todos_los_grupos` — se comprueba en Reports.jsx:40 y :175 con
// `can()`, y ahí se acaba. No tiene bandera `perm_*` en User, así que ninguna
// función lo puede leer. Reportes no pasa por una función de servicio: la
// página consulta Attendance/Child directo por el SDK, y la RLS de esas
// entidades acota por `parish_id`, no por `group_id`. Un catequista al que su
// parroquia le apagó este permiso puede pedir los datos de otro grupo desde
// devtools. NO cruza parroquias (eso sigue cerrado, ver módulo 14), pero
// derrota un permiso que un admin apagó a propósito.
//
// Cerrarlo son dos piezas, y ninguna cabe en un cambio de una línea:
//   1) `perm_reportes_ver_todos` en User.jsonc + computeFlags — necesita
//      `npm run deploy:entities`, que es destructivo y pide confirmación;
//   2) una decisión de diseño sobre el camino de LECTURA: o una función de
//      servicio que devuelva el reporte ya filtrado, o aceptar que este
//      permiso es comodidad de interfaz y decirlo en la pantalla de Permisos
//      en vez de presentarlo como un candado.
//
// El módulo 3 del estándar exige la re-comprobación en servidor para los
// caminos de ESCRITURA, y ésos sí están cubiertos (create_child, update_child,
// record_attendance, add_guardian leen sus perm_* y el license_status fresco).
// Éste es de lectura, que es el caso más débil — pero un candado que la UI
// dibuja y el backend no sostiene sigue siendo un candado que no cierra.
const UI_ONLY = ['reportes:ver_todos_los_grupos'];

const REGISTRY = getRegistryDefaults();

for (const path of MIRRORS) {
  test(`${path}: DEFAULTS coincide con permissionRegistry.js`, () => {
    assert.deepEqual(
      readDefaults(path),
      REGISTRY,
      `Agregaste o cambiaste un permiso en un lado y no en el otro. El original es ` +
      `src/lib/permissionRegistry.js; esta copia vive en ${path} porque las funciones ` +
      `de Base44 no pueden importar de src/.`,
    );
  });

  // Que las claves coincidan no basta: un permiso presente en ambos mapas pero
  // sin su bandera en computeFlags se guarda y NUNCA se aplica del lado del
  // servidor — el peor de los dos fallos, porque la UI dice que está activo y
  // el admin cree haberlo apagado.
  //
  // UI_ONLY es la lista, explícita, de los que hoy están en ese estado. No es
  // una excepción para tapar el hueco: es para que el hueco esté escrito y para
  // que agregar UNO NUEVO siga fallando. Se encoge, nunca se agranda.
  test(`${path}: computeFlags consume cada clave del registro`, () => {
    const src = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
    const body = src.match(/function computeFlags\([\s\S]*?\n\}/);
    assert.ok(body, `${path}: no se encontró computeFlags`);
    const missing = Object.keys(REGISTRY)
      .filter((k) => !body[0].includes(`'${k}'`))
      .filter((k) => !UI_ONLY.includes(k));
    assert.deepEqual(missing, [], `${path}: computeFlags no lee estas claves: ${missing.join(', ')}`);
  });
}

// Los dos espejos entre sí. Si los dos derivan del registro en la misma
// dirección, las pruebas de arriba fallan igual — pero este mensaje dice
// exactamente qué comparar cuando alguien edita solo una de las dos funciones.
test('los dos espejos coinciden entre sí', () => {
  assert.deepEqual(readDefaults(MIRRORS[0]), readDefaults(MIRRORS[1]));
});
