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
npm run deploy:entities   # schema — DESTRUCTIVO, pide escribir "CateqHub"
npm run functions:audit   # quién llama a cada endpoint
```

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
