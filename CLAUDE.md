# CateqHub — Project Notes

Catechesis/parish management SaaS (Base44 backend + Vite/React front-end), multi-tenant
via `parish_id`. See `CHANGELOG.md` for the full prose history of every fix and
audit this app has had — it's the primary "what happened and why" record for
this repo; this file adds context for working with the code, not a duplicate log.

## Critical: Parish RLS cross-tenant delete/update bug (fixed and deployed 2026-08-18)

Found while investigating a portfolio-standard module 7 (danger zone) audit
item. `Parish.jsonc`'s `delete` rule had a branch —
`{"user_condition": {"data.parish_role": "admin"}}` — with **no entity-side
match to the caller's own parish**. Any authenticated `parish_role: admin`
user (admin of **any** parish) could delete **any other** parish via a
direct SDK call, bypassing the UI entirely. `update` had the identical
defect (edit, not delete, of another parish); `create` too, though with no
practical consequence since real parish creation always goes through
`create_parish` (service role).

**Fixed and deployed immediately to the live Base44 schema** (via the
Base44 MCP, not just committed to the repo — see every other app's CLAUDE.md
in this portfolio for why a repo `.jsonc` change alone never touches
production):
- `delete`: now `$and`s the tenant match (`"id": "{{user.data.parish_id}}"`)
  with the role check, inside the existing `$or` with the platform-owner
  branch.
- `update`: dropped the unscoped `data.parish_role: admin` branch entirely —
  it was redundant, not just dangerous: the existing `"id": "{{user.data.
  parish_id}}"` branch already grants full update access to any member
  (admin or not) of one's own parish, so removing the unscoped branch
  removes zero legitimate access.
- `create`: narrowed to `role: admin` only (platform owner / service role,
  which already covers `create_parish`'s `asServiceRole` write).

**Why the existing validator didn't catch it:** `scripts/validate-entity-rls.mjs`
(added 1.9.6) checks for missing `data.` prefixes and missing service-role
branches — both syntax-adjacent defects. This bug was **syntactically
valid** (Base44 only requires `user_condition` to be the sole key of its own
rule object) and only wrong semantically: a tenant-scoped custom role
(`data.parish_role`) checked with no accompanying tenant match. Added a new
check to `scripts/lib/entity-rls-rules.mjs`
(`checkCrossTenantRoleBranches`) that flags exactly this shape — any bare
`{"user_condition": {"data.<field>": ...}}` branch not wrapped in an `$and`
with an entity-side match — plus a syntax-level companion check for the
`{"id": ..., "user_condition": ...}` sibling-key form, which Base44's own
deploy-time validator rejects outright (confirmed by a failed deploy attempt
during this fix — the correct form is explicit `$and`, not sibling keys in
one object, even though other entities in this portfolio use the sibling
form and haven't hit this — worth checking elsewhere if you're touching RLS
and see that shape). Re-ran against all 10 entities post-fix: clean, no
other instance of either defect in this repo.

See `CHANGELOG.md`'s 1.9.7 entry for the user-facing summary and the two
module-7 additions (remove-user in `Users.jsx`, data export + delete-request
danger zone in `Parishes.jsx`) that shipped in the same pass.

**Correction to a portfolio-standard audit claim (2026-08-18):** the audit
that surfaced the bug above also claimed module 4 (RLS) was incomplete
because "`validate-rls.mjs` doesn't run in CI, only manual review" — that
claim was stale/wrong even at the time it was written.
`.github/workflows/ci.yml`'s `build-and-test` job has run `npm run
validate:rls` as a **blocking** step (with an explicit comment calling it
"exactly the class of silent cross-tenant leak... this check exists to
catch before it ships") on every push/PR since 1.9.6 — before this bug was
even found. It's a real gate, not aspirational: this fix's own
`checkCrossTenantRoleBranches` addition got its first live enforcement
through that same CI job. Module 4 has no remaining gap: the validator
exists, is wired into CI, runs clean against all 10 entities, and now also
catches the specific defect class this section documents.
## Dark theme (module 10, added 2026-08-19)

`tailwind.config.js` already had `darkMode: ["class"]` and `src/index.css`
already had a full, hand-tuned `.dark` palette (including the custom
`--gold`/`--stamp`/`--moss` brand tokens mirrored for dark) — the missing
piece was anything that actually applies the `.dark` class. Unlike
`jospabloh/puntos` (which needed a ~500-token bulk slate/gray inversion
across 37 files), this codebase already used semantic tokens
(`text-foreground`, `bg-card`, etc. — 167 usages) almost everywhere, so the
scope here was much smaller:

- **`src/lib/ThemeContext.jsx`** (new) — `ThemeProvider`/`useTheme`,
  `STORAGE_KEY = 'cq-theme'`. Resolution order: stored preference →
  `prefers-color-scheme` → light.
- **`index.html`** — inline pre-mount `<script>` reading the same
  `localStorage` key + `prefers-color-scheme`, applying `.dark` before
  React mounts (no flash of wrong theme). Kept manually in sync with
  `ThemeContext.jsx`'s own resolution logic — both carry a comment pointing
  at the other.
- **`src/App.jsx`** — wrapped the whole provider tree in `<ThemeProvider>`.
- **`src/components/Layout.jsx`** — new `ThemeToggle` component (Sun/Moon
  icon button, optional `showLabel`), wired into both the desktop sidebar
  footer (icon + label, next to "Cerrar sesión") and the mobile top bar
  (icon-only).
- **Three pre-existing hardcoded-light spots** (`ChildDetail.jsx`,
  `Premium.jsx`, `LicenseBanner.jsx`) that used `bg-amber-50`/
  `text-amber-800`/`border-amber-200` with no `dark:` variant — each got the
  matching `dark:` classes (`dark:bg-amber-950/30`, `dark:text-amber-300`,
  `dark:border-amber-800`).
- The 6 pre-existing `bg-white` occurrences (`ChildDetail.jsx`, `Logo.jsx`,
  `BadgePrint.jsx`, `BadgeSheet.jsx`, `QRBadge.jsx`, `QRCard.jsx`) were
  checked and left as-is — all are QR-badge/print contexts (`print:bg-white`
  or an actual physical badge background), not themed UI surfaces.

No bulk inversion script was needed for this repo given how few hardcoded
tokens existed; each spot above was fixed by hand.

**Verified:** `npm run lint`, `npm run build`, `npm run validate:rls` all
pass. Visually verified with Playwright (Chromium) against a local dev
server — `/login` and `/register`, both light and dark — text contrast,
form field borders, and button states all render correctly in both themes.
**Not verified:** any authenticated page (Dashboard, Scan, Children,
Reports, etc.) — not reachable without live Base44 auth in this
environment. Risk is bounded: those pages already use the same semantic
tokens the `.dark` palette in `index.css` was hand-tuned for, and the same
call was made (and held up) for `jospabloh/puntos`'s equivalent gap.

## Deploy: el id de la app vive en el repo (módulo 11, 2026-08-21)

El 2026-08-21, un `git pull` fallido dejó la terminal parada en `flowfin` y los
seis comandos siguientes desplegaron **el backend de FlowFin** en puntos, radar,
stockflow y ctrlhq: la CLI toma el origen del **directorio actual** y el destino
de `--app-id`, y nada comprueba que coincidan. En radar el `entities push` llegó
a completarse y borró el modelo de datos entero. Detalle en
`jospabloh/acacia-app-standard` → `docs/incidents.md`.

Por eso este repo ya no se deploya a mano:

```bash
npm run deploy            # funciones — lee el appId de base44.app.json
npm run deploy:site       # frontend — mergear a main NO lo hace por ti
npm run deploy:entities   # schema — DESTRUCTIVO, pide escribir "CateqHub"
npm run functions:audit   # quién llama a cada endpoint
```

**Mergear a `main` no deploya el sitio.** Se creyó lo contrario durante meses.
En flowfin se comprobó al revés: un fix se mergeó a `main` y, horas después, el
árbol que el app realmente servía seguía siendo el de antes del fix — mergear no
propaga nada (detalle en el CLAUDE.md de flowfin). El
frontend se deploya a mano con `npm run deploy:site`, igual que las funciones.
Y comprueba el resultado por **contenido**, no por hashes: el checkpoint del app
puede reportar un `git_commit_hash` igual al HEAD de `main` mientras el árbol que
de verdad se sirve está atrasado.

`scripts/base44-deploy.mjs` **rechaza** un `--app-id` por argumento, así que el
directorio y la app destino no pueden desalinearse. `deploy:entities` imprime la
lista de entidades y el nombre de la app antes de pedir confirmación — ver
"36 entidades de FlowFin" mientras crees estar desplegando otra app es la señal
de alto que faltaba.

`npm run validate:functions` (dentro de `npm run lint`) falla si los endpoints
pasan de `maxFunctions` en `base44.app.json` — hoy **40**, con
Base44 cortando en 50. El margen importa: por encima del tope el deploy falla a
media aplicación y la CLI **no** llega a su fase de poda, así que las funciones
viejas siguen ocupando los slots que harían falta para arreglarlo.

**Antes de consolidar o borrar cualquier función, corre `npm run functions:audit`.**
Una función sin llamadores en el repo casi nunca está muerta: el llamador vive
fuera, donde grep no ve — un entity hook de Base44, un cron del panel, un
`tool_config` de un agente, la URL de un webhook. El audit marca esas como
`REVISAR EN PANEL` en vez de adivinar; confírmalas contra
`npx base44 functions list` (anota `(N automation)`) antes de tocarlas.

## Selector de tema: claro / oscuro / dispositivo (módulo 12, 2026-08-21)

El tema se elige desde **un solo control**: un círculo pequeño anclado a una
esquina de la pantalla que muestra el modo vigente y, al pulsarlo, crece de lado
en una pista de tres ranuras (Claro · Oscuro · Sistema) con un indicador que se
desliza a la elegida. Tres estados, tres posiciones físicas — que es justo lo
que un botón sol/luna de dos estados no puede expresar en cuanto "seguir al
dispositivo" entra en la lista.

Lo que se guarda es la **preferencia** (`light` | `dark` | `system`), nunca el
color resuelto: con `system` la app sigue a `prefers-color-scheme` en vivo, sin
recargar. `index.html` trae un script pre-montaje que resuelve y aplica el tema
antes de que monte React, así que el primer frame ya sale del color correcto;
ese script y el proveedor comparten clave y valores, y cada uno lleva un
comentario apuntando al otro.

`src/components/ThemeSwitcher.jsx` es **idéntico byte a byte en todas las apps
del portafolio**. La fuente canónica vive en `jospabloh/acacia-app-standard` →
`shared/theme/`: cámbialo allí y cópialo, no lo edites aquí. Lo único propio de
esta app es `src/lib/useThemeMode.js` (de dónde sale el estado) y las variables
`--theme-switcher-bottom/right` en `src/index.css` (dónde se coloca).

`src/lib/ThemeContext.jsx` pasó de dos modos a tres y ahora escucha
`matchMedia` en vivo. Se quitaron el `ThemeToggle` local de `Layout.jsx` (barra
lateral y cabecera móvil). El control sube por encima de la barra inferior en
móvil.

## `npm run test:smoke` — comprueba el sitio DESPLEGADO (2026-08-22)

`tests/smoke/smoke.spec.js` es la suite compartida del portafolio, idéntica byte
a byte en todos los repos; la fuente canónica está en
`jospabloh/acacia-app-standard` → `shared/smoke/`. Lo propio de esta app vive en
`tests/smoke/smoke.config.js` (URL, `<title>`, cómo representa el tema).

**No comprueba el build local: comprueba lo que se sirve.** Es la automatización
de la regla que cada CLAUDE.md repite — mergear no deploya nada, y hay que
verificar por contenido y no por hash. Afirma cuatro cosas, todas derivadas de
lo que el propio repo produce (nunca de copy adivinado, que se rompe al cambiar
una palabra y enseña a ignorar la suite):

1. responde 200 y el `<title>` es el de esta app — no un deploy viejo ni otro;
2. no lanza excepciones al pintar;
3. el tema llega resuelto desde el primer frame (el script pre-montaje viajó);
4. el selector de esquina está montado, cambia el tema y la preferencia
   sobrevive a un reload.

**No corre en el pipeline normal ni desde un sandbox de desarrollo**: la salida
HTTPS ahí va por un proxy con allowlist que no incluye estos dominios. Corre en
GitHub Actions (`.github/workflows/smoke.yml`): `workflow_dispatch` para
dispararla a mano justo después de un deploy, y un cron diario como red.

    npm run test:smoke                      # contra producción
    SMOKE_URL=https://… npm run test:smoke  # contra un preview

Desde el 2026-08-22 la suite añade una quinta afirmación, del **módulo 12**: el
selector no tapa nada y nada lo tapa, en móvil (390), tablet (834) y escritorio
(1440), plegado y desplegado. Un control anclado por encima de todo en una
esquina es justo lo que acaba sentado sobre una barra inferior o un botón
flotante, y entonces la app pierde una función al ancho que nadie abrió. La
comprobación distingue las dos direcciones — algo pintado encima del selector, y
el selector respondiendo por un control que hay debajo — y nombra el control
afectado. Se coloca con `--theme-switcher-bottom/right`; si otra cosa ya es dueña
de esa esquina, se mueve el selector, no el control.

## Módulo 14 — auditoría de aislamiento multi-tenant (2026-08-22)

Nuevo en `jospabloh/acacia-app-standard`. **No es releer las reglas de RLS** (eso
es el módulo 4): es recorrer, con fecha y por escrito, todo lo que puede cruzar
un inquilino con otro — cada entidad, cada función de backend (el inquilino se
re-deriva en el servidor, nunca del cuerpo de la petición, y en update/delete se
comprueba contra el registro **almacenado**), cada campo bloqueado, cada
exportación/reporte/búsqueda, cada destinatario de correo o webhook, y el cambio
de inquilino. Contra el **esquema desplegado**, no contra el archivo del repo.

Se repite cuando se añade una entidad, una función o un rol. El resultado se
anota aquí, incluyendo **lo que no se pudo verificar** desde el entorno de
trabajo — normalmente una sesión autenticada como usuario restringido de un
segundo inquilino. Decirlo vale más que insinuar una cobertura que no se logró.

Lo que motiva el módulo es que todos los fallos de aislamiento que este
portafolio llegó a desplegar eran **sintácticamente válidos**: la rama de rol sin
`$and` al inquilino en `Parish` de cateqhub, las 84 instancias de liuma donde el
motor descartaba la cláusula hermana de `user_condition`, los campos de licencia
escribibles por el propio inquilino en puntos y rumbo, y el `PermissionProfile`
que ningún RLS puede consultar porque vive en otra fila.

### Resultado — 2026-08-23, contra el esquema desplegado

Primera pasada del módulo 14 en este repo. **No se encontró ningún cruce entre
parroquias.** Lo que sigue es lo que se revisó y con qué evidencia, para que la
próxima pasada empiece donde acabó ésta y no desde cero.

**Las 10 entidades, leídas del esquema vivo** (`list_entity_schemas`, no los
`.jsonc`). Todas las tenant-scoped llevan `parish_id` **requerido** y las cuatro
operaciones con la forma `$and`/`$or` correcta. El arreglo de `Parish` de
2026-08-18 sigue desplegado: `delete` es
`$and[id == {{user.data.parish_id}}, parish_role:admin]` dentro del `$or` con la
rama de plataforma.

**Todos los writes son `role: admin` en RLS**, así que ninguna escritura de
inquilino pasa por RLS: pasan por funciones de servicio. Eso desplaza el peso
entero de la defensa a las 15 funciones, que es exactamente lo que este módulo
existe para mirar.

**Las 15 funciones.** El inquilino sale del token (`me.parish_id`) en las 15.
Dos leen `parish_id` del cuerpo de la petición —
`const parish_id = body.parish_id || me.parish_id` en `assign_parish_user:40` y
`sync_catequist_permissions:46` — que es el antipatrón que este módulo nombra;
las dos lo rechazan en la línea inmediatamente posterior con
`if (!isPlatformAdmin && parish_id !== me.parish_id) → 403`. Están cubiertas,
pero son la forma exacta que hay que volver a mirar si alguien las edita.

En update/delete la comprobación es contra el registro **almacenado**, no contra
la petición: `update_child`, `add_guardian` y `record_attendance` hacen
`child.parish_id !== me.parish_id → 404`. `record_attendance` es la forma más
fuerte — escribe `parish_id: child.parish_id`, tomado del registro, no del
token. `update_child` y `create_child` además validan que el **grupo destino**
sea de la misma parroquia, que es lo que cierra "mover un niño a otra parroquia".

**Exportaciones.** `export_parish_data` y `export_premium_data` filtran cada
lectura por el `parish_id` del solicitante. Se comprobó la hipótesis que las
haría inútiles — un filtro sobre un campo inexistente no filtra nada — leyendo
`Guardian` y `ChildGuardian` del esquema desplegado: las dos tienen `parish_id`
y es requerido. El filtro es real.

**El caso difícil que el preámbulo nombra, resuelto aquí con un espejo.**
Ningún RLS puede consultar `PermissionProfile` porque vive en otra fila, así que
esta app copia los permisos a campos `perm_ninos_*` en `User` y las funciones
leen el espejo. El riesgo de un espejo es el desfase, y está cubierto por los dos
extremos: al editar el perfil, `Permissions.jsx` llama a
`sync_catequist_permissions` y avisa por toast si falla (los permisos quedarían
guardados pero **no** aplicados — el aviso dice justo eso); al asignar un
catequista nuevo, `assign_parish_user` lee el `PermissionProfile` vigente y
estampa los flags en ese momento. `PermissionProfile` en sí exige
`$and[parish_id, $or[role:admin, parish_role:admin]]` para crear/editar/borrar,
así que un catequista no puede darse permisos.

**El único camino cross-tenant deliberado es `acaciaControl`** — el puente de
Mission Control, sin `auth.me()` y cerrado por HMAC. Es su función.
`seed_test_parish` está desplegada en producción pero exige rol de plataforma.

#### Dos cosas que no son fuga de inquilino, pero quedan anotadas

- **`Parish.update` es asimétrico con `delete`.** `delete` exige
  `parish_role: admin`; `update` se lo concede a **cualquier** miembro de la
  parroquia, catequista incluido. Los campos de licencia están bloqueados uno a
  uno con `rls.write: {role:admin}` — que es la mitad que importa — y
  `data_processing_accepted_at` también (su propia descripción explica por qué).
  Lo que queda es que un catequista puede renombrar la parroquia o estampar
  `implementation_requested_*`. Es dentro del inquilino: módulo 3, no 14.
- **`list_parish_users` devuelve el correo de todos los miembros a cualquier
  miembro**, sin comprobar `parish_role`. La proyección es una allowlist
  explícita y no cruza parroquias. También módulo 3.

#### No verificado

Una sesión autenticada como `catequist` de una segunda parroquia. No hay cuentas
de prueba en este entorno y no se crearon: sembrar dos inquilinos en producción
para probar aislamiento es peor que declarar el hueco. Todo lo de arriba es
lectura de código y del esquema desplegado — bastante para descartar los defectos
estructurales, insuficiente para afirmar que el motor evalúa cada regla como se
lee.

## Módulo 15 — el puente con Mission Control: una llave por app (2026-08-23)

`INGEST_HMAC_SECRET` es **un solo valor compartido por todo el portafolio**, así
que una firma hecha con él demuestra «alguien tiene el secreto compartido» y
nunca «esto es CateqHub». Como el nombre de la app viaja en el cuerpo, cualquier
app podía firmar una carga diciendo ser otra y Mission Control la escribía con
esa atribución. Lo encontró la auditoría del módulo 14 de Mission Control.

El arreglo es dejar de usar el maestro directamente:

    appKey = HMAC-SHA256(maestro, "acacia.app.v1." + slug)

El prefijo es separación de dominio: garantiza que una llave derivada no puede
coincidir con una firma sobre un cuerpo, y el `v1` permite rotar el esquema sin
rotar el maestro.

`base44/functions/acaciaControl/_acaciaSign.ts`
es **idéntico byte a byte en todas las apps del portafolio**. La fuente
canónica vive en `jospabloh/acacia-app-standard` →
`shared/bridge/acaciaSign.ts`: cámbialo allí y cópialo, no lo edites aquí.
Aquí lo usa `acaciaControl` para **verificar** lo que llega de Mission Control.

**La migración tiene un orden y es el contrario del obvio.** La verificación
acepta las dos llaves mientras `ACCEPT_LEGACY_MASTER` sea `true`, así que da
igual quién despliegue primero. Pero Mission Control despliega al mergear y las
apps a mano, así que MC siempre va primero — por eso MC sigue **firmando** con
el maestro hasta que las nueve apps acepten derivada. Falta el paso que cierra
el agujero de verdad: poner `ACCEPT_LEGACY_MASTER` en `false` en todas partes y
cambiar la firma de salida de MC a `signFor`. Mientras tanto una firma con el
maestro se sigue aceptando. Falta además poner `ACACIA_APP_SLUG=cateqhub` en
los secrets de esta app.

**Y ahora hay una prueba, que es lo que faltaba.** El helper no lo comprobaba
nada: cada PR de este módulo decía que recibía su primer type-check al
desplegar. `acaciaSign.test.ts` (canónico en el repo estándar) fija el vector
que la mitad Node de Mission Control ya fijaba —dos implementaciones de HMAC en
dos runtimes sólo siguen siendo iguales si algo lo afirma, y una divergencia se
ve en runtime como `bad signature` en cada llamada, que parece un secreto mal
puesto y no lo es— y afirma lo que este módulo promete: un cuerpo firmado por
una app que dice ser otra **no** verifica. No tiene imports externos ni toca la
red, así que corre en un sandbox donde `jsr.io` y `deno.land` están bloqueados.
El test canónico está en el repo estándar; este repo no tiene paso de deno en CI.

**La criptografía en línea que esto reemplaza ya no está.** Cada `acaciaControl`
llevaba su propio `stableStringify` / `hmacHex` / `timingSafeEqual`, copiados a
mano contra `api/_lib/ingestSign.js` de Mission Control. Dejarlos al lado del
helper no es desorden: es una segunda implementación de la misma rutina en el
mismo archivo, que es exactamente la deriva que este módulo quita.
