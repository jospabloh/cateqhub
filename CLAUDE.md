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

## Dark theme (module 10) — not attempted, same shape of gap as elsewhere in the portfolio

`tailwind.config.js` has `darkMode: ["class"]` configured, but no theme
toggle exists anywhere in the app and only 3 spots use hardcoded
`bg-amber-50`/`text-amber-800`/`border-amber-200` without a `dark:` variant
(`LicenseBanner.jsx`, `ChildDetail.jsx`, `Premium.jsx`) — a real inconsistency,
but fixing only those 3 spots would have zero visible effect for any real
user, since dark mode is never actually engaged anywhere in the app (no
toggle, no `prefers-color-scheme` handling). A real dark theme means
re-skinning every page, which is a design-scale initiative — not attempted
here, same call made for `jospabloh/puntos`'s identical situation (see its
CLAUDE.md).
