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

**Y un paso más adentro: `deploy:site` construye siempre, desde el 2026-09-09.**
`npx base44 site deploy` *pregunta* si construir antes de subir, y mientras el
script no pasó `--build` esa pregunta se contestaba a mano en cada deploy. Basta
contestar que no una vez para subir el `dist/` que hubiera en disco —el de otra
rama, el de antes del arreglo— y entonces el repo dice una cosa y el sitio
servido dice otra. Pasó ese día: el arreglo del selector de tema estaba mergeado
en `main`, el `deploy:site` se corrió, y el smoke de producción siguió fallando
en la misma línea con el mismo elemento. No era que el arreglo estuviera mal:
era que no había viajado. `tests/unit/deploySite.test.js` fija la bandera, y
falla si alguien la quita o mete `--no-build`.

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

### Resultado — 2026-09-09, contra el esquema desplegado (12 entidades)

Segunda pasada. La disparó el deploy de ese día, que añadió `Session` y
`Membership` (10 → 12 entidades) y `session`, `memberships` y
`purge_stale_sessions` (15 → 18 funciones). Leída del esquema **vivo**
(`list_entity_schemas`), no de los `.jsonc`.

**No se encontró ningún cruce entre parroquias.** Las 10 entidades con alcance
de inquilino siguen acotadas por `data.parish_id == {{user.data.parish_id}}` en
las cuatro operaciones, y el arreglo de `Parish.delete` de 2026-08-18 sigue
desplegado.

**Las dos entidades nuevas, que son las que importaban:**

- `Membership.read` = `$or[{data.user_id: "{{user.id}}"}, role:admin]`. Va por
  **usuario, no por parroquia**, y tiene que ser así: el selector debe nombrar
  parroquias en las que la persona todavía no está activa. No es un hueco —
  `parish_name` es una copia guardada en la fila **propia**, así que no puede
  nombrar una parroquia ajena. Crear/editar/borrar son `role:admin`, o sea sólo
  funciones de servicio.
- `Session.read` = `$or[$and[parish_id, user_id], role:admin]` — las **dos**
  condiciones. Un compañero no ve los nombres de tus dispositivos, que son dato
  personal. Al salir de la parroquia tus filas viejas dejan de ser legibles para
  ti y el reaper las cierra a las 48 h. Escrituras, sólo servicio.

#### Hallazgo 1 — un administrador de parroquia BLOQUEADO en producción

No es una fuga entre inquilinos; es lo contrario, y es peor de lo que suena
porque está pasando ahora.

`Child`, `Attendance`, `Group`, `Guardian` y `ChildGuardian` exigen en su `read`,
además del `parish_id`:

    $or[ parish_plan:"free", parish_license_status:"active",
         parish_license_status:"read_only" ]

Eso se lee del **espejo** en `User` (`parish_plan`/`parish_license_status`),
porque la RLS de Base44 no puede consultar otra fila. Y una consulta a los
usuarios de producción (2026-09-09) devuelve **dos cuentas, ninguna con esos dos
campos**:

| correo | role | parish_role | parish_plan | parish_license_status |
|---|---|---|---|---|
| h.josepablo@gmail.com | `admin` | admin | *ausente* | *ausente* |
| cesar@domsot.com.mx | `user` | admin | *ausente* | *ausente* |

Un campo ausente **no iguala a nada**, así que no matchea ninguna de las tres
ramas. La primera cuenta se salva por la rama `role:admin` de plataforma del
`$or` exterior. **La segunda no.** `cesar@domsot.com.mx` es administrador de la
única parroquia en producción y no puede leer un solo niño, grupo ni registro de
asistencia por el SDK — que es como los leen `Children.jsx` y `Reports.jsx`.

`backfill_parish_license_mirror` existe exactamente para esto y su propia
descripción de campo lo advierte («debe correr inmediatamente después de
desplegar este esquema»). No corrió sobre esa cuenta, o corrió antes de que
existiera.

**El arreglo NO es estampar `free`**, que dejó de existir en la 1.10.0: es
`parish_license_status: "active"`, que matchea la segunda rama. Correr
`backfill_parish_license_mirror` después de desplegar la 1.10.0, no antes.

Vale la pena nombrar por qué la pasada anterior no lo vio: la del 2026-08-23
verificó la **forma** de las reglas y dio por buena la existencia del espejo.
Esta consultó los datos. Una regla correcta sobre un campo que nadie escribió
es una regla que niega todo.

#### Hallazgo 2 — la RLS desplegada todavía nombra el plan gratuito

`Guardian.update` y `ChildGuardian.update` siguen exigiendo
`parish_plan == "premium"`, y los cinco `read` de arriba siguen ofreciendo la
rama `parish_plan == "free"`. La 1.10.0 quitó el candado equivalente del lado de
las **funciones** (`add_guardian`), pero no el de la RLS.

Hoy es invisible porque toda escritura pasa por funciones con `asServiceRole`,
que se saltan la RLS. Pero deja el esquema desplegado diciendo algo que el
producto ya no dice, y la rama `"free"` es ahora una condición muerta que el
próximo lector va a creer viva. Se arregla en el siguiente `deploy:entities`
—destructivo, así que no se hace suelto— junto con las descripciones de
`Parish.plan` y `Parish.license_status`, que todavía explican en prosa el tope
de 50 niños y la bajada automática a `free`.

#### Lo que sigue anotado de la pasada anterior, sin cambio

`Parish.update` se lo concede a cualquier miembro de la parroquia (los campos de
licencia están bloqueados uno a uno, que es la mitad que importa), y
`list_parish_users` devuelve el correo de todos los miembros a cualquier
miembro. Los dos son módulo 3, dentro del inquilino, no módulo 14.

#### No verificado

Una sesión autenticada como `catequist` de una segunda parroquia — sigue sin
haber una segunda parroquia. Todo lo de arriba es lectura del esquema desplegado
y una consulta a los datos de producción.

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
el maestro hasta que las nueve apps acepten derivada. **Los dos pasos ya están hechos** (2026-08-24): MC firma con `signFor` y
`ACCEPT_LEGACY_MASTER` está en `false` en los once sitios, así que una firma con
el maestro **ya no se acepta** — que es exactamente lo que cierra el agujero. `ACACIA_APP_SLUG=cateqhub` está puesto en los secrets de esta app y verificado:
la sincronización de las 16:29 UTC no registró ni una advertencia contra ella.

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

## ACACIA Portfolio Standard

**Cómo leer estas casillas, porque en este repo la distinción no es un
tecnicismo.** `[x]` significa CORRIENDO, no "mergeado". Mergear a `main` no
despliega nada aquí (ver "Deploy" arriba: en flowfin se comprobó al revés, y
costó horas). Un módulo cuyo código está en `main` pero cuya función sigue sin
`npm run deploy` **no está hecho**: está escrito. Los que están así llevan
`[ ]` y dicen "escrito, falta desplegar" — no `[x]` con una nota al lado, que
es lo que alguien escaneando casillas lee como hecho.

This app is part of the ACACIA portfolio and must stay compliant with
`jospabloh/acacia-app-standard`. Full rationale for each item is in that repo's
`STANDARD.md` — read it before implementing any item below for the first time,
and re-read the relevant section before touching a module that's already
implemented. Status boxes below are checked only where this repo's own code or
a live query proved it; the dated audit under them says with what evidence.

- [x] Module 1 — License lifecycle: tenant entity has `billing_status`
      (trial|active|view_only|suspended), written ONLY by Mission Control's
      unified cron. No native lifecycle/renewal/reminder cron in this repo.
      Trial is exactly 30 calendar days from tenant creation; automatic
      (Mercado Pago) renewal always lands on the 1st of the calendar month
      regardless of the app's manual-payment day convention. Self-serve
      tenant creation (any user with no tenant may create one) sets
      billing_status: trial and fires a real-time, HMAC-signed ping to
      Mission Control so the platform owner is alerted immediately, not at
      the next daily sync.
      → **parcial, a propósito.** Sin cron nativo y con la prueba de 30 días
      correcta. El estado no se llama `billing_status` (son `plan` +
      `license_status`): desviación deliberada que Mission Control mapea. La
      parroquia demo sin campos de licencia resuelve a Plan Gratis en toda la
      app, que es lo correcto para un demo; su presentación en el panel se
      arregló en acacia-mission-control#103 (`config.field_defaults`,
      desplegado el 2026-09-08). Sigue sin ping en tiempo real al crear tenant
      — hueco de TODO el portafolio, ninguna app lo tiene y MC no tiene el
      endpoint.
- [x] Module 2 — Roles: app role model declared in one file, mapped onto the
      backend's built-in role field; Mission Control operator roles
      (owner/admin/viewer) are a separate layer, never conflated. Only a
      tenant's own admin can promote a member to admin or demote a fellow
      admin (same server-derived gate, shared code path, blocked if it would
      leave zero admins). Joining an EXISTING tenant is by invite code
      (request → admin approves) or emailed invite (admin-initiated,
      pre-approved) — never an open self-serve join.
      → Cerrado 2026-09-08, CORRIENDO desde el 2026-09-09.
      `wouldLeaveNoAdmin` es UN gate compartido por quitar y degradar. Cubre
      las tres rutas por las que alguien deja de ser administrador, contando
      siempre contra `target.parish_id` (el registro almacenado).
- [x] Module 3 — Granular permissions: one client registry file + server-side
      re-check on every write path (permission key, in the same precedence
      order as the client), gated behind billing_status too. No entity is
      written to directly from the client without a Safe-function equivalent.
      An admin-facing "Permisos" screen renders that same registry as a
      matrix (module x action, tri-state group + per-section overrides) so
      the tenant's own admin can see and approve what each role can do,
      instead of a registry file only the client hides/disables UI from.
      → Cerrado 2026-09-08, con un hueco nombrado. Hay corredor de pruebas
      (`npm run test:unit`, bloqueante en CI) y guardia contra la deriva de las
      tres copias. PENDIENTE DE DECISIÓN: `reportes:ver_todos_los_grupos` sólo
      se aplica en el cliente — ver `UI_ONLY` en
      tests/unit/permissionRegistry.test.js.
- [x] Module 4 — RLS: every tenant-scoped entity has the four-op `$or` shape
      (tenant branch + service-role admin branch), both halves of every rule
      verified (data.* on the entity side, {{user.data.*}} on the user side).
      Static validator wired into CI. Schema changes are deployed, not just
      committed.
- [x] Module 5 — Health: a real (not hardcoded-200) health/latency endpoint
      Mission Control's adapter can poll.
- [x] Module 6 — Changelog: APP_VERSION/RELEASE_DATE + in-app changelog,
      generated only by the release script, never by the routine build.
      → Cerrado 2026-09-08. `npm run release` escribe los cuatro sitios de una
      vez y se niega a correr sin notas o con una versión ya usada.
      tests/unit/release.test.js fija los invariantes.
- [x] Module 7 — Account & danger zone: member management gated by Module 3,
      data export, irreversible delete with a real confirmation step.
      Danger zone covers BOTH scopes, not just one: "delete my account"
      (leave the tenant) is separate from "delete the tenant" (every
      member loses access), plus delegate/transfer tenant admin to another
      approved member and promote a member to tenant admin — all three
      re-derive actor and target from the tenant's own stored membership,
      never from the request body.
      → Cerrado 2026-09-08, CORRIENDO desde el 2026-09-09. `action:'leave'`
      (en /acerca-de, la única pantalla que alcanza cualquier miembro) y
      `action:'transfer_admin'` (en el danger zone de /parroquia).
- [x] Module 8 — Support/mejoras: entry point writes to this app first, then
      syncs into Mission Control's tickets/leads bodega. No parallel triage UI.
      EVERY place a ticket is born (support page AND the danger zone's deletion
      request) notifies Mission Control in real time.
- [x] Module 9 — acaciaco-site: this app has a page under apps/ (or freeware/),
      using styles/base.css tokens, dark-theme correct.
- [x] Module 10 — Login page: a real in-app screen, on-brand, real
      error/suspended/view_only states, links to trial and support,
      dark-theme correct. Every social button shown corresponds to a
      provider actually enabled on the Base44 app.
      → Cerrado 2026-09-08, CORRIENDO desde el 2026-09-09. Enlaces a /soporte
      y a /apps/cateqhub de acaciaco.com.mx, verificados renderizando el build
      en claro y oscuro, y después contra el sitio servido por la corrida 23
      del smoke.
- [x] Module 11 — Deploy discipline: `base44.app.json` + `npm run deploy`
      (refuses `--app-id`), `deploy:site` for the frontend, `deploy:entities`
      behind a typed confirmation, and `validate:functions` in lint keeping
      endpoints under 40.
- [x] Module 12 — Theme control: the shared corner switcher from
      `shared/theme/`, copied in unchanged and rendered once inside the theme
      provider, no other theme control left in the app.
- [x] Module 13 — Live-site smoke test: the shared suite from `shared/smoke/`
      against the DEPLOYED site, wired to `.github/workflows/smoke.yml`.
      → Cerrado 2026-09-08. `routes` cubre login, registro, recuperación y un
      404. El spec compartido sigue byte a byte idéntico al canónico.
- [x] Module 14 — Multi-tenant isolation audit: dated, evidenced, and repeated
      whenever an entity, a function or a role is added.
      → Rehecha el 2026-09-09 contra las 12 entidades desplegadas (hoy son 11
      en el repo: `Membership` se retiró el 2026-09-10). Sin cruce
      entre parroquias. DOS hallazgos, ninguno de aislamiento: un administrador
      de parroquia bloqueado en producción por el espejo sin backfill, y la RLS
      desplegada que todavía nombra el plan gratuito. Detalle arriba.
      → (histórico) **VENCIDA desde el 2026-09-09.** La pasada del 2026-08-23 cubre 10
      entidades y 15 funciones. El deploy de ese día subió `Session` y
      `Membership` (12 entidades) y `session`, `memberships` y
      `purge_stale_sessions` (18 funciones) — que es literalmente el
      disparador que este módulo define. Rehacerla contra el esquema
      DESPLEGADO; ahora sí existe uno que leer.
- [x] Module 15 — Bridge to Mission Control: `shared/bridge/acaciaSign.ts`
      copied in unchanged plus its test at the functions ROOT, and outbound
      signing on the DERIVED key.
      → Cerrado 2026-09-08. `base44/functions/_acaciaSign.test.ts` (copia del
      canónico, difiere sólo en la ruta del import) y CORRIENDO: job
      `bridge-signing` con Deno en CI. Antes recibía su primer type-check al
      desplegar.
- [ ] Module 16 — Secrets: every guard built on one FAILS CLOSED when the
      value is missing, and that branch has a test. Each value has been READ
      BACK from the panel or proven by a call that only succeeds if it is right.
      → Las tres guardias están DESPLEGADAS y fallan cerrado: `ACACIA_APP_SLUG`
      ausente devuelve su propio 500 con su nombre, igual que
      `INGEST_HMAC_SECRET`, y `CRON_SECRET` responde 503. Los tres valores
      están puestos en los secrets de la app (`CRON_SECRET` desde el
      2026-09-09).
      **Lo que falta es la prueba, que es la mitad cara del módulo.**
      `INGEST_HMAC_SECRET` y `ACACIA_APP_SLUG` sí están probados: la
      sincronización diaria es una llamada que sólo tiene éxito si valen lo que
      deben. `CRON_SECRET` no — nada lo ha ejercido todavía, porque no hay
      quien llame al reaper (ver módulo 20). La primera invocación autenticada
      que devuelva 200 en vez de 503 es lo que cierra esta casilla; hasta
      entonces «está puesto» es una afirmación sin evidencia, que es
      exactamente lo que este módulo existe para no aceptar.
- [x] Module 17 — Mission Control side: row in `apps`, an adapter, and entries
      in `licenseControl.js`, `ticketControl.js`, `messaging.js` plus the client
      catalogue mirror. Then PROVE the data path.
- [ ] Module 18 — Multi-tenant account switching AND joining.
      → **RETIRADO el 2026-09-10, y esta casilla ya no se va a marcar.** La
      entidad `Membership`, la función `memberships` y el `ParishSwitcher` se
      borraron: una cuenta pertenece a una sola parroquia. La mitad que
      corría (el cambio) se fue con la mitad que nunca existió (el alta
      cross-parroquia, que este archivo dejaba como decisión pendiente). Ver
      la sección al final. La decisión de producto que bloqueaba el alta ya no
      hace falta tomarla.
- [x] Module 19 — Lock survives debugging: every security-relevant RLS/field
      lock states its rationale AND which operation it governs in its own
      field description.
- [ ] Module 20 — Session control: client-side idle warning + hard logout
      (`shared/session/`), a per-device Session with the active/passive
      model, and a server-side reap job at 48h.
      → **DESPLEGADO el 2026-09-09, y el reaper SIGUE SIN CORRER.** Los cuatro
      archivos de `shared/session/` byte a byte, entidad `Session`, router
      `session` y `purge_stale_sessions` están arriba, y `CRON_SECRET` ya está
      en los secrets de la app. Falta la última pieza y es la que hace el
      trabajo: **nadie invoca la función.** Algo tiene que llamarla a diario
      con `Authorization: Bearer <CRON_SECRET>`.
      Si las automatizaciones de Base44 no admiten cabeceras propias, el reaper
      no puede autenticarse contra su propia guardia y hace falta un disparador
      externo. La URL no se puede deducir del repo: Mission Control invoca por
      el SDK (`client.functions.invoke` en `api/_lib/appBridge.js`), no por URL
      cruda, así que hay que leerla del panel antes de cablear cualquier
      workflow — adivinarla es cómo se despliega contra la app equivocada.
      Mientras tanto: el aviso de inactividad y el heartbeat sí corren; la
      cosecha a 48 h no. En una app que guarda CURP y datos de menores, esa es
      la mitad que importa.
- [x] Module 21 — About screen: user manual, changelog, version line in sync
      with package.json, contact + ACACIA acknowledgment card.
- [x] Module 22 — Server-authoritative diffing: any backend function that
      compares a server-authoritative custom field against a target value to
      decide whether to write it does a FRESH read via `asServiceRole` first.
      → Cerrado 2026-09-08, CORRIENDO desde el 2026-09-09. Las funciones con
      sesión releen al llamante con `asServiceRole`; `session` es la identidad,
      `me` el registro almacenado. tests/unit/freshCallerRead.test.js exige el
      bloque literal en todas.
- [x] Module 23 — Nav survives reload: the nav's active item is derived from
      the current route on every render.

### Estado del despliegue — 2026-09-09

**Los 23 módulos ya no están sólo escritos: están arriba.** El 2026-09-09 se
corrieron `deploy:entities` (12 entidades, `Session` y `Membership` incluidas),
`deploy` (18 funciones) y `deploy:site` con `--build`. La corrida 23 del smoke
contra el sitio servido pasa las cinco afirmaciones.

Lo que sigue SIN CORRER, y ya es **una sola cosa**: `CRON_SECRET` se puso en
los secrets de la app el 2026-09-09, así que lo único que falta es **quién
llame al reaper**. Algo tiene que invocar `purge_stale_sessions` a diario con
`Authorization: Bearer <CRON_SECRET>`; hasta entonces la función está
desplegada, falla cerrado, y no corre nunca.

Esa misma invocación es lo que cierra las dos casillas: el módulo 20 porque la
cosecha a 48 h empieza a pasar, y el módulo 16 porque un 200 en vez de un 503 es
la prueba de que el secreto vale lo que debe — el módulo no acepta «está
puesto» sin una llamada que lo demuestre.

Dos decisiones que NO son mías y bloquean cerrar dos módulos del todo:

- **`reportes:ver_todos_los_grupos` (módulo 3).** Está en el registro y en los
  dos `DEFAULTS`, pero no tiene bandera `perm_*`: sólo se comprueba en
  `Reports.jsx`, del lado del cliente. Reportes no pasa por función de
  servicio —la página consulta Attendance/Child por el SDK y la RLS acota por
  `parish_id`, no por `group_id`— así que un catequista al que su parroquia le
  apagó ese permiso puede pedir los datos de otro grupo desde devtools. **No
  cruza parroquias.** O una función de servicio que devuelva el reporte ya
  filtrado, o aceptarlo como comodidad de interfaz y decirlo en la pantalla de
  Permisos en vez de dibujarlo como candado. Vive en `UI_ONLY` en
  tests/unit/permissionRegistry.test.js; esa lista se encoge, nunca se agranda.
- **El alta cross-parroquia (módulo 18, punto 2).** `assign_parish_user`
  rechaza dar de alta a quien ya pertenece a otra parroquia — que es la forma
  "leave your tenant first" que el módulo prohíbe. Pero ese mismo rechazo es el
  candado contra el secuestro de cuentas cross-tenant. Levantarlo exige decidir
  antes si un alta ajena debe MOVER el puntero activo de esa persona o sólo
  añadir la membresía y dejar que se cambie ella. Es una decisión de producto
  con consecuencia de seguridad.

**El módulo 14 está vencido desde ese mismo deploy.** Se añadieron dos entidades
y tres funciones, que es exactamente su disparador. La pasada del 2026-08-23
cubre 10 entidades y 15 funciones; hoy son 12 y 18. Ahora sí hay esquema
desplegado contra el que correrla — hace falta el MCP de Base44 autorizado en la
sesión, porque leer los `.jsonc` del repo es justo lo que ese módulo prohíbe.

### El día que el smoke mintió — 2026-09-09

Vale la pena por la forma, no por el bug. El arreglo del selector de tema se
mergeó, se corrió `deploy:site`, y el smoke de producción volvió a fallar
**byte a byte igual** que antes: misma línea, mismo ancho, mismo elemento.

La tentación era volver a mirar el arreglo. La señal decía lo contrario: un
fallo idéntico después de un deploy significa que no cambió nada. Y no había
cambiado — `npx base44 site deploy` preguntaba si construir, el script no pasaba
`--build`, y se subió un `dist/` viejo. Ver "Deploy" arriba.

Dos cosas que sirven para la próxima:

- **Un fallo que no se mueve tras un cambio es evidencia sobre el canal, no
  sobre el arreglo.** Si el arreglo fuera insuficiente, fallaría en otro sitio o
  con otro elemento, no exactamente igual.
- **Desde el sandbox no se alcanza el sitio** (el proxy deniega el CONNECT a
  `cateqhub.acaciaco.com.mx`), así que la verificación local tiene que ser un
  SUPERCONJUNTO de lo que mide el smoke, no una muestra: aquí fueron 6 anchos ×
  5 rutas × 2 estados × 2 posiciones de scroll = 120 combinaciones, contra las
  24 del smoke. Con eso, cuando prod falla y local no, la diferencia sólo puede
  estar en qué se sirve.

Last audited against the standard: 2026-09-08 — primera pasada completa de los
23 módulos; el detalle de esa pasada está abajo. El hallazgo 1 se **corrigió el
mismo día**: afirmaba un fallo abierto de licencia que no existe (un `plan`
ausente resuelve a Plan Gratis en toda la app). Lo que queda ahí es una
incoherencia de presentación entre el app y el panel.

**Cuenta al 2026-09-09, al cierre del día: 20 CORRIENDO, 3 abiertos** — 16 y 20
(los dos por la misma causa: nadie invoca el reaper, y esa invocación es a la
vez lo que lo hace correr y la prueba de que `CRON_SECRET` vale lo que debe) y
18 (el cambio de inquilino corre; el alta cross-parroquia espera una decisión).
El módulo 14 se cerró ese mismo día contra el esquema desplegado. Ninguno de los
tres está abierto por código sin escribir.
Last multi-tenant isolation audit: **2026-09-09**, contra las 12 entidades del
esquema desplegado — ver "Resultado — 2026-09-09" bajo el módulo 14. Sin cruce
entre parroquias; dos hallazgos que no son de aislamiento, uno de ellos un
bloqueo vivo en producción.

## Auditoría contra el estándar — 2026-09-08

Primera pasada de los **23 módulos**. Antes de esto el repo documentaba en prosa
los módulos 11, 12, 13, 14 y 15 y no llevaba cuenta de los otros dieciocho, así
que "cumple el estándar" no era una afirmación que nadie pudiera comprobar. El
bloque de arriba es ahora esa cuenta.

Tres cosas se verificaron **contra la base viva de Mission Control**
(`app_health`, `audit_actions`, `apps`, `licenses`), no contra el repo — que es
lo que las tablas de "verification gates" del estándar piden y lo que este
portafolio ha aprendido a no dar por supuesto.

### Lo que está bien, y con qué evidencia

**El puente funciona de verdad** (módulos 5 y 17). `app_health` tiene una fila
`status: ok` con fecha de hoy y latencia real (342 ms; 226-429 ms los cinco días
anteriores), y `audit_actions` una fila `control:run-sync` para `cateqhub` del
2026-09-08 00:40 UTC. La fila en `apps` está completa (`backend: base44`,
`external_id` = el `appId` de `base44.app.json`, `status: active`) y las entradas
de `licenseControl.js`, `ticketControl.js`, `messaging.js` y el espejo
`licenseCatalog.js` existen del lado de Mission Control. El camino de datos está
probado, no solo configurado.

**Los tres archivos compartidos son idénticos byte a byte** a su fuente canónica
en `jospabloh/acacia-app-standard` — comprobado con `diff`, no con la vista:
`tests/smoke/smoke.spec.js` ↔ `shared/smoke/`, `src/components/ThemeSwitcher.jsx`
↔ `shared/theme/`, y `base44/functions/acaciaControl/_acaciaSign.ts` ↔
`shared/bridge/`. `ACCEPT_LEGACY_MASTER` está en `false`.

**La RLS pasa su propio validador**: `npm run validate:rls` limpio sobre 10
entidades, 9 tenant-scoped, y es un paso bloqueante de CI desde 1.9.6.

**El tema tiene un solo dueño**: los únicos escritores de `.dark` son
`src/lib/ThemeContext.jsx` y el script pre-montaje de `index.html`, que son
justo la pareja documentada. Ningún resto de un control viejo.

### Los cuatro hallazgos que valen la pena

#### 1. La parroquia demo y el panel no dicen lo mismo (módulo 1)

**Corregido el 2026-09-08, después de que el dueño del repo señalara el error.**
La primera redacción de este hallazgo afirmaba que la parroquia sin campos de
licencia tenía «Premium completo, sin tope de niños y sin vencimiento posible».
Eso es **falso en los tres términos**, y la lectura del código lo desmiente:

- `create_child:37` — `if (parish.plan !== 'premium')` es **verdadero** con el
  campo ausente, así que sí entra al bloque del Plan Gratis y sí aplica
  `FREE_PLAN_CHILD_CAP`.
- `add_guardian:32` — `if (!parish || parish.plan !== 'premium')` → **403
  `premium_required`**. Tutores queda bloqueado, no abierto.
- `premium.js:33` — `isPremium = parish?.plan === "premium"` → `tier: "free"`.

Un `plan` ausente resuelve a **Plan Gratis** en toda la app: núcleo completo,
tope de 50 niños activos, sin Tutores. Que es exactamente lo que le toca a una
parroquia demo sin licencia. No hay fallo abierto y no hay nada que arreglar
del lado del app. La lección de método está abajo, porque vale más que el
hallazgo.

**Lo que sí queda, que es una incoherencia entre las tres superficies.** La
parroquia se creó el 2026-07-22, antes de que existieran `plan`,
`license_status` y `premium_period_end_at`, y los `default` de un `.jsonc` se
aplican al crear el registro, no retroactivamente: esa fila no tiene los campos
—no los tiene en `null`, no los tiene—. El puente manda el registro crudo, así
que:

| superficie | qué dice de esa parroquia |
|---|---|
| el app | `tier: "free"`, activa, tope de 50, sin Tutores |
| Mission Control | `licenses.plan = null`, `status = null` → `Licenses.jsx:578` pinta `—` / `—` |
| correos automatizados | ninguno: `portfolioLifecycle.js:120` filtra por `paidPlanValues.includes(l.plan)`, y `null` no está |

Los correos aciertan, pero por omisión, no por decisión. El que falla es el
panel: **un operador no puede distinguir «Gratis» de «el sync está roto»**,
porque las dos cosas se pintan igual. El app ya sabe resolver la ausencia
(`getLicenseStatus` lo hace en una línea); Mission Control recibe el campo
crudo y no tiene con qué.

El arreglo correcto es enseñarle esa misma resolución al lado que lee, no
escribir la fila de producción: un `config.field_defaults` en el registro de
apps, hermano del `field_map` que ya existe, que `mapLicenseRecord` aplica
cuando el campo llega ausente. Sirve para toda parroquia futura creada antes de
un campo nuevo, no solo para ésta. Estampar `plan: 'free'` a mano arregla una
fila y vuelve a romperse en la siguiente migración de esquema.

`migrate_free_parishes_to_trial` sigue filtrando `{ plan: 'free' }` y sigue sin
alcanzar una fila sin el campo — pero eso ya **no** es un bug que haya que
correr: a un demo no se le regala una prueba. Queda anotado sólo para que nadie
lo «arregle» de más.

Lo que se mantiene del hallazgo original, sin exagerarlo: **el ciclo de licencia
de esta app nunca se ha ejercido de extremo a extremo contra un registro real.**
Con un solo inquilino y sin campos de licencia, nada ha hecho recorrer
`premium_period_end_at` → `read_only` → `access_denied` por el cron. El día que
se onboardee una parroquia de verdad será la primera vez.

**La lección de método, que es lo que hay que quedarse.** El hallazgo se
escribió leyendo *una* condición (`plan === 'premium' && license_status !==
'active'`) y deduciendo el comportamiento del resto. La condición siguiente
—`if (parish.plan !== 'premium')`, ocho líneas más abajo en el mismo archivo—
decía lo contrario y no se leyó. Un `&&` que sale falso no significa «pasa sin
control»; significa «pasa a la siguiente rama», y la siguiente rama hay que
abrirla. Vale para toda esta auditoría: donde el veredicto dependa de qué
camino toma un valor ausente, hay que leer las dos ramas, no una.

Aparte, y menor: el estado no se llama `billing_status` ni toma los cuatro
valores del estándar. `plan` + `license_status` es una desviación deliberada y
Mission Control la mapea (`suspended→access_denied`, `view_only→read_only`), pero
no hay estado `trial` — la prueba es "plan=premium con `premium_period_end_at`
en el futuro", que no es un estado que se pueda consultar. La renovación al día 1
del mes no aplica: `billing: null`, este app no cobra por Mercado Pago todavía.

#### 2. Se puede degradar al último administrador de una parroquia (módulo 2)

`assign_parish_user` tiene el candado de cero administradores, y está bien
escrito — pero solo en la rama `action: 'remove'` (entry.ts:67-73): lee los
administradores de la parroquia con rol de servicio, descuenta al objetivo, y
devuelve 409 si no queda ninguno. La rama de asignación/edición, que es la que
usa el botón "Editar" de `Users.jsx:113`, no tiene nada equivalente: pasa
`parish_role` directo al `User.update` final (entry.ts:146).

Un administrador puede abrir su propia ficha, ponerse "Catequista" y guardar. No
hay comprobación de que sea él mismo (la rama `remove` sí la tiene,
entry.ts:64), ni de que quede algún otro admin. A partir de ahí la parroquia no
tiene quién invite, edite permisos, exporte datos ni solicite la baja — y como
el módulo 7 tampoco tiene transferencia de administración, no hay camino de
vuelta sin tocar el panel de Base44 a mano.

El estándar lo nombra literalmente: *"a demote that would leave zero admins on
the tenant is rejected, not silently allowed — there is no support-ticket-free
way back in once that happens."* Es el hallazgo más barato de arreglar y el de
peor consecuencia: mover las dos comprobaciones que ya existen en `remove` a un
punto anterior, común a las dos ramas.

#### 3. El catálogo de permisos vive en tres copias a mano (módulo 3)

El servidor sí re-checa — eso está bien y es la mitad que importa. Las funciones
leen los espejos `perm_*` del `User`, y antes de eso comprueban `license_status`
con una lectura fresca de `Parish`, en el orden que el estándar pide.

Lo que no está es el generador. `DEFAULTS` y `computeFlags` están duplicados
literalmente en `sync_catequist_permissions/entry.ts:13-31` y en
`assign_parish_user/entry.ts:7-24`, y los dos tienen que coincidir con
`src/lib/permissionRegistry.js`. La garantía es un comentario: *"DEFAULTS debe
reflejar exactamente src/lib/permissionRegistry.js — si se agrega o cambia un
permiso configurable ahí, actualiza también este mapa."*

Este portafolio ya sabe cómo termina eso. Mission Control tenía tres espejos
sueltos del catálogo de licencias dentro de una sola página y derivaron:
**rumbo llevaba `view_only` desplegado desde el 2026-08-03 sin que el panel lo
ofreciera, y radar no estaba en ninguno de los tres.** Se cerró con
`src/lib/licenseCatalog.test.js`, que falla si las copias se separan. Aquí el
equivalente sería un generador (`scripts/generatePermissionManifests.mjs`, el
patrón que el estándar nombra) o, más barato, una prueba que lea los tres
archivos y compare.

Lo que hace este caso más incómodo que el de Mission Control: **el repo no tiene
corredor de pruebas unitarias.** `package.json` no declara vitest ni jest; lo
único que corre es Playwright (`test:e2e`, `test:smoke`). Así que la prueba del
resolver que el módulo 3 pide como su verification gate no está, y no puede
estar sin añadir primero esa pieza. Lo mismo bloquea la prueba de fallo cerrado
del módulo 16 y la prueba `acaciaSign.test.ts` del módulo 15.

#### 4. La parroquia se deriva de `auth.me()` en las 15 funciones (módulo 22)

Todas hacen la misma forma: `me = await base44.auth.me()`, y a partir de ahí
`me.parish_id` para acotar la operación y `me.parish_role` / `me.role` para
autorizarla. Ninguna relee el registro del propio llamante con `asServiceRole`
antes de usarlos.

Es exactamente el punto 3 del módulo: *"the same rule applies one layer up
whenever a caller's own server-authoritative field gates the operation — e.g.
deriving which tenant an admin action should scope to from the caller's own
tenant_id. A stale read there doesn't just skip a write, it can scope an entire
operation against the wrong record."*

Conviene ser justo con lo que sí está bien, porque no es poco:

- **No hay ningún diff-then-skip**, que es la forma concreta que tumbó a rumbo.
  Ninguna función compara "ya vale esto, no escribo".
- **El lado del objetivo sí se lee fresco**: `assign_parish_user:61` compara
  contra el `targetUser` leído con rol de servicio, y `update_child`,
  `add_guardian` y `record_attendance` comprueban `child.parish_id` contra el
  registro almacenado. El módulo 14 del 2026-08-23 ya lo había verificado.
- **Los parches son campos nombrados**, no un `data: {...}` que arrase con los
  hermanos.

El punto más expuesto es `create_parish:17`: `if (me.parish_id) return 400`. Ese
`if` es lo único que impide que un usuario cree una segunda parroquia, y sale de
la vista cacheada. Si esa vista discrepa de lo persistido —el escenario entero
del módulo 22— el usuario crea una parroquia nueva, la función lo re-apunta a
ella (`User.update` en la línea 55), y queda huérfano de la primera sin que
nadie devuelva un error. Y como no hay `Membership` (módulo 18), la primera
parroquia se queda sin él.

No está demostrado que pase aquí; el mecanismo que lo causó en rumbo era un
campo suelto en la raíz del documento. Lo que sí es cierto es que la defensa
cuesta una línea y no está puesta.

### Los dos módulos ausentes, y qué implica cada uno

**Módulo 18 (cambio y alta de inquilino).** No hay entidad `Membership`; la
pertenencia es un `parish_id` plano en `User`. Las tres consecuencias que el
estándar nombra están las tres presentes: `create_parish:17` rechaza si ya
tienes una, `assign_parish_user:113` rechaza mover a alguien que pertenece a
otra parroquia (*"El usuario ya pertenece a otra parroquia"*), y no hay control
de cambio de inquilino en ninguna pantalla. Es la forma "leave your tenant
first" que el módulo prohíbe explícitamente — agravada porque, por el módulo 7,
**no existe manera de salir**. Un catequista que sirva en dos parroquias necesita
dos cuentas de correo. Retrofitearlo es caro y el estándar avisa por qué: cada
perfil ya fijado a la parroquia equivocada necesita un empujón para re-resolver.

**Módulo 20 (control de sesión).** Nada de `shared/session/` está copiado: ni el
par aviso-de-inactividad/logout, ni el heartbeat, ni la entidad `Session` por
dispositivo, ni el job de reaper a 48 h. Vale la pena decir dónde muerde esto en
concreto: `acaciaControl` **ya trae** los casos `sessions.list` y
`sessions.revoke` (entry.ts:302-326), porque el archivo es idéntico en todo el
portafolio. Los dos reciben el nombre de la entidad en `params.entity`. Aquí no
hay ninguna que darles, así que Mission Control tiene el botón de revocar sesión
y no tiene a qué apuntarlo. En una app que guarda CURP y datos de menores, una
sesión abierta en un dispositivo prestado no caduca nunca por sí sola.

### Lo menor, junto

- **Módulo 6**: no hay script de release. El arreglo `CHANGELOG` de
  `src/lib/appConfig.js` se edita a mano y convive con un `CHANGELOG.md` en la
  raíz que se mantiene aparte — dos registros del mismo hecho, que es la forma
  de la deriva. La versión sí está en sync (1.9.10 en los dos sitios) y el
  módulo 21 la muestra bien.
- **Módulo 7**: el primer alcance está completo (exportación, solicitud de
  borrado con confirmación y aviso en tiempo real a Mission Control, gestión de
  miembros). Falta el segundo entero: no hay "salir de la parroquia" ni
  transferencia/delegación de administración. `assign_parish_user:64-66` bloquea
  quitarse a uno mismo y remite a *"pide a otro administrador que lo haga"* —
  correcto contra el auto-bloqueo, pero deja sin salida al único admin.
- **Módulo 10**: el login es real (campos propios llamando a
  `loginViaEmailPassword`, Google por `loginWithProvider`, estado de error,
  enlace a registro). No enlaza a soporte ni a precios/prueba, que el estándar
  sí pide.
- **Módulo 13**: la suite está bien cableada pero `smoke.config.js` no declara
  `routes`, así que la quinta afirmación —el selector no tapa nada y nada lo
  tapa— solo corre sobre el login. `/register`, `/forgot-password` y un 404 son
  públicas y quedan fuera, que es justo donde el ejemplo del estándar avisa que
  suele aparecer un segundo control de esquina.
- **Módulo 15**: `_acaciaSign.ts` es idéntico al canónico, pero
  `acaciaSign.test.ts` no está en la raíz de `base44/functions/` como el módulo
  pide. Y un comentario en `acaciaControl/entry.ts:31-34` sigue diciendo *"While
  ACCEPT_LEGACY_MASTER is true a signature made with the bare
  INGEST_HMAC_SECRET is still accepted"* — quedó viejo en el commit 63a8337, que
  lo puso en `false`. Es el tipo de comentario que hace perder una hora.
- **Módulo 16**: `INGEST_HMAC_SECRET` ausente devuelve un 500 con su nombre
  (`entry.ts:23-24`), que es lo correcto. `ACACIA_APP_SLUG` no: `?? ''` deriva
  una llave desde una cadena vacía y el resultado es un `bad signature` genérico
  en cada llamada. Falla cerrado, sí, pero **con el síntoma exacto que este
  portafolio ya diagnosticó mal durante dos horas** el 2026-08-24 (ver módulo 15
  del `CLAUDE.md` de Mission Control: *"parece un secreto mal puesto y no lo
  es"*). Merece su propio 500, como su vecino.

### Lo que NO se pudo verificar

- **El esquema desplegado.** Esta sesión no tiene el MCP de Base44, así que todo
  lo que se dice de entidades y RLS sale de `base44/entities/*.jsonc` y del
  validador estático, no de `list_entity_schemas`. La última lectura del esquema
  vivo es la del módulo 14 del 2026-08-23 y sigue siendo la referencia. El
  módulo 19 pide precisamente que repo y esquema desplegado coincidan; eso queda
  sin comprobar en esta pasada.
- **Los valores de los secrets en el panel de Base44** (módulo 16). Que la
  sincronización de hoy pasara demuestra que `INGEST_HMAC_SECRET` y
  `ACACIA_APP_SLUG` valen lo que deben — es una llamada que solo tiene éxito si
  son correctos, que es el estándar de prueba que pide el módulo — pero no se
  leyeron de vuelta uno por uno.
- **Los proveedores sociales habilitados** en el app de Base44 (módulo 10). El
  login solo ofrece Google, así que no hay un botón que lleve a un callejón sin
  salida; que Google esté configurado se infiere de que es el único y de que el
  app está en producción, no se comprobó en el panel.
- **El camino de tickets de extremo a extremo** (módulo 8). Los dos sitios donde
  nace un ticket llaman a `/api/ingest/ticket-pull`, pero `tickets` tiene **0**
  filas para cateqhub en Mission Control, así que el camino nunca se ha
  recorrido con un ticket real. El gate del módulo es *"raise one and watch it
  appear in MC in seconds"*, y eso no se hizo: levantar un ticket de prueba en
  producción para auditar tiene su propio costo.
- **Cualquier pantalla autenticada.** Sin sesión de Base44 en este entorno, igual
  que en las pasadas anteriores.

## Retirado: el selector de parroquia (módulo 18) — 2026-09-10

**Una cuenta pertenece a una sola parroquia.** `User.parish_id` es la
pertenencia, y toda la RLS de las 10 entidades con inquilino compara contra
`{{user.data.parish_id}}`. La entidad `Membership`, la función `memberships`
(`list`/`switch`) y `src/components/ParishSwitcher.jsx` se borraron.

Este módulo llevaba desde el 2026-09-09 **a medias a propósito**: el cambio de
parroquia corría, el alta cross-parroquia no, y este archivo la dejaba anotada
como una decisión de producto con consecuencia de seguridad —si un alta ajena
debía MOVER el puntero activo o sólo añadir la membresía—. **Esa decisión ya no
hay que tomarla.** `assign_parish_user` sigue rechazando dar de alta a quien ya
pertenece a otra parroquia, que es exactamente lo correcto ahora: sin selector,
mover el puntero dejaría la parroquia anterior inalcanzable.

Lo que cambió alrededor:

- `create_parish` y `assign_parish_user` pierden `upsertMembership` /
  `deactivateMembership`. Escribir el `User` (o dejarlo en `DETACHED`) vuelve a
  ser toda la operación: no hay segunda fila que pueda quedar desincronizada.
- `scripts/lib/entity-rls-rules.mjs`: `USER_SCOPED_READ` queda **vacía**.
  `Membership` era su única entrada. La comprobación que exige `{{user.id}}` a
  cualquier cosa que se meta ahí se queda tal cual — es lo que impide que esa
  lista se use para saltarse el check por parroquia.
- `validate:rls` pasa de 12 a **11 entidades, 10 con inquilino**.

### Pendiente a mano: borrar `Membership` del esquema desplegado

Sólo `npm run deploy:entities` la borra, y **va a fallar tal cual está**: al
2026-09-10 hay **1 fila viva** (`6aa1ae5aeaca45cfe078d5ac`,
`h.josepablo@gmail.com` en "Parroquia San Testing"). Base44 rechaza borrar una
entidad con registros y el push es **todo-o-nada** — el mismo fallo dejó a
rumbo sin desplegar ninguna de sus 27 entidades. Borra la fila primero.

Mientras siga desplegada no hace daño: no queda un lector ni un escritor en el
repo.

**Verificado:** `npm run lint` (eslint + `validate:functions` 17/40),
`npm run validate:rls` (11 entidades, 10 con inquilino), `npm run test:unit`
(45/45) y `npm run build` — todos limpios. `deno check` sobre
`assign_parish_user` y `create_parish`: **15 errores preexistentes → 5**,
ninguno nuevo. **No verificado:** el deploy ni una sesión de navegador.
