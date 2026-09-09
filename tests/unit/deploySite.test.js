// Módulo 11 del estándar: disciplina de deploy. Esta prueba fija UNA cosa que
// el 2026-09-09 costó una corrida de smoke roja y una hora de diagnóstico.
//
// `npx base44 site deploy` PREGUNTA si construir antes de subir. Mientras
// `scripts/base44-deploy.mjs` no pasara `--build`, esa pregunta se contestaba a
// mano en cada deploy, y una respuesta distraída sube el `dist/` que hubiera en
// disco: el de otra rama, el de antes del arreglo, el que sea. El síntoma es el
// peor posible — el repo dice una cosa, el sitio servido dice otra, y el smoke
// falla señalando un defecto que en `main` ya estaba arreglado.
//
// Es la misma forma que este repo lleva documentada desde el módulo 11
// ("mergear no deploya nada, y hay que verificar por CONTENIDO, no por hash"),
// sólo que un paso más adentro: no basta con acordarse de deployar, hay que
// deployar lo que de verdad está en el árbol.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../scripts/base44-deploy.mjs', import.meta.url), 'utf8');

test('deploy:site construye siempre antes de subir', () => {
  const step = src.match(/\['site', 'deploy'[^\]]*\]/);
  assert.ok(step, 'no se encontró el paso `site deploy` en scripts/base44-deploy.mjs');
  assert.match(step[0], /'--build'/,
    'El paso `site deploy` perdió `--build`. Sin esa bandera el CLI pregunta si construir, ' +
    'y basta contestar que no una vez para desplegar un dist/ viejo: el sitio servido deja de ' +
    'corresponder al commit que se cree desplegado, y el smoke falla por un defecto ya arreglado.');
});

test('deploy:site no desactiva el build por el otro lado', () => {
  assert.doesNotMatch(src, /'--no-build'/,
    '`--no-build` deja el deploy a merced del dist/ que hubiera en disco. Si de verdad hace falta ' +
    'subir sin construir, hazlo a mano y a propósito, no desde el script que todos corren.');
});
