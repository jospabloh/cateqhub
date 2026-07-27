# Ciclo de vida de licencia Premium — Implementation Plan (asistencia-catecismo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the Premium (Tutores) license lifecycle in the backend (not just UI), add a self-service data-export flow gated behind a real "access denied" state, require a versioned data-processing consent from every new parish admin, and disclose Base44's security certifications in "Acerca de".

**Architecture:** `Parish` gains license-state fields written exclusively by Mission Control (service role); those fields are mirrored onto every `User` of that parish (Base44 RLS cannot join across entities) so `Guardian`/`ChildGuardian` RLS can gate create/update/read on the mirrored fields. Two new Base44 functions (`export_premium_data`, `confirm_premium_export`) give a parish admin a self-service way to pull their own data and record a confirmation once access is denied. The `acaciaControl` bridge gains a generic `mirror` capability (used by any future patch, not just this one) and a new `license.deletePremiumData` action, invoked only by Mission Control after export is confirmed.

**Tech Stack:** Base44 (entities/RLS in `base44/entities/*.jsonc`, Deno functions in `base44/functions/*/entry.ts`), React 18 + Vite, `@base44/sdk` client.

**Spec:** `docs/superpowers/specs/2026-07-23-premium-license-lifecycle-design.md` (this repo). Sibling spec/plan live in `jospabloh/acacia-mission-control`.

## Global Constraints

- Scope is **Premium only**. `Child`, `Attendance`, `Group`, `SupportTicket*` are never touched by this feature — the free core stays available forever, in every license state.
- License-state fields on `Parish` (`license_status`, `premium_period_end_at`, `read_only_since`, `access_denied_since`, `deletion_eligible_since`) and their mirrors on `User` (`parish_plan`, `parish_license_status`) get field-level RLS `"rls": { "write": { "user_condition": { "role": "admin" } } }` — same shape as the existing `plan` field on `Parish`. Only `export_confirmed_at`/`export_confirmed_by` get the same admin-only FLS too (see Task 1) — they must not be writable by a parish admin directly, only via `confirm_premium_export`.
- `data_processing_accepted_at`/`_by`/`_terms_version` on `Parish` are written once, at creation, by `create_parish` (service role) — no FLS override needed since the entity-level `create` RLS already requires the caller to go through that function's service-role write path for a *new* parish (an existing parish's `update` RLS lets a parish admin edit their own record, but re-running consent fields through `update` is out of scope here — see Task 1 for why plain FLS equality is still added defensively).
- This session's Base44 MCP connector is **not authorized** — no task in this plan deploys schema/functions to a live Base44 backend. Every task's deliverable is verified via `npm run build`, `npm run lint`, `npm run typecheck`, and (where noted) a manual checklist to run once someone with Base44 access deploys. Do not attempt `update_entity_schema` or any Base44 CLI deploy command as part of this plan.
- No unit test runner exists in this repo (no vitest/jest — only Playwright e2e `e2e/smoke.spec.js` and lint/build/typecheck). Do not add one as part of this feature. Each task's "test" step is build+lint(+typecheck where the task touches `.ts`) plus a manual verification note.
- Every `.jsonc` edit must remain valid JSON-with-comments — after editing, run `node -e "require('jsonc-parser')"`-free sanity check by re-reading the file; the actual validator that matters is `npm run build` (the Base44 Vite plugin parses these).
- Follow existing Spanish copy conventions throughout (all user-facing strings in this repo are Spanish).

---

### Task 1: `Parish` and `User` schema — license, consent, and mirror fields

**Files:**
- Modify: `base44/entities/Parish.jsonc`
- Modify: `base44/entities/User.jsonc`

**Interfaces:**
- Produces: `Parish.license_status` (`"active"|"read_only"|"access_denied"|"deletion_eligible"`, default `"active"`), `Parish.premium_period_end_at`, `Parish.read_only_since`, `Parish.access_denied_since`, `Parish.deletion_eligible_since`, `Parish.export_confirmed_at`, `Parish.export_confirmed_by`, `Parish.data_processing_accepted_at`, `Parish.data_processing_accepted_by`, `Parish.data_processing_terms_version` — all `string`, consumed by Task 2 (RLS), Task 4 (`create_parish`), Task 7/8 (export functions), Task 9 (`src/lib/premium.js`), Task 11–13 (UI).
- Produces: `User.parish_plan`, `User.parish_license_status` (`string`, mirrors of the two `Parish` fields above) — consumed by Task 2 (RLS templates `{{user.data.parish_plan}}` / `{{user.data.parish_license_status}}`), Task 4, Task 5.

- [ ] **Step 1: Add the new fields to `Parish.jsonc`**

Replace the `plan` property block (and everything after it up to the closing of `properties`) in `base44/entities/Parish.jsonc`:

```jsonc
    "plan": {
      "type": "string",
      "title": "Plan",
      "description": "Nivel de suscripción. CateqHub es free por default (sin vencimiento); el límite de niños del plan free aún no está definido. Se activa a premium desde Mission Control (rol de servicio) o el panel de Base44 — un admin de parroquia puede verlo pero no activarlo por sí mismo.",
      "enum": ["free", "premium"],
      "default": "free",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "license_status": {
      "type": "string",
      "title": "Estado de licencia Premium",
      "description": "Solo aplica mientras plan=premium. Escrito exclusivamente por Mission Control (rol de servicio) vía el puente acaciaControl — nunca a mano desde el panel de Base44, porque el espejo en User (parish_license_status) quedaría desincronizado.",
      "enum": ["active", "read_only", "access_denied", "deletion_eligible"],
      "default": "active",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "premium_period_end_at": {
      "type": "string",
      "format": "date-time",
      "title": "Fin del periodo Premium pagado",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "read_only_since": {
      "type": "string",
      "format": "date-time",
      "title": "Desde cuándo está en solo lectura",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "access_denied_since": {
      "type": "string",
      "format": "date-time",
      "title": "Desde cuándo se denegó el acceso",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "deletion_eligible_since": {
      "type": "string",
      "format": "date-time",
      "title": "Desde cuándo es candidata a borrado",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "export_confirmed_at": {
      "type": "string",
      "format": "date-time",
      "title": "Exportación de datos Premium confirmada",
      "description": "Se escribe únicamente desde la función confirm_premium_export (rol de servicio) — nunca editable directo, para que no se pueda falsificar la confirmación.",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "export_confirmed_by": {
      "type": "string",
      "title": "Quién confirmó la exportación (correo)",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "data_processing_accepted_at": {
      "type": "string",
      "format": "date-time",
      "title": "Aviso de manejo de datos sensibles aceptado"
    },
    "data_processing_accepted_by": {
      "type": "string",
      "title": "Quién aceptó el aviso (correo)"
    },
    "data_processing_terms_version": {
      "type": "string",
      "title": "Versión del aviso aceptado"
    }
```

Keep the file's `required`/`rls` (entity-level create/read/update/delete) blocks below this exactly as they are today — this task only touches `properties`.

- [ ] **Step 2: Add the mirror fields to `User.jsonc`**

In `base44/entities/User.jsonc`, insert two new properties immediately after `group_id` (before the closing `}` of `properties`):

```jsonc
    "group_id": {
      "type": "string",
      "title": "Grupo asignado",
      "description": "Si es catequista, el grupo que dirige",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "parish_plan": {
      "type": "string",
      "title": "Plan de la parroquia (espejo)",
      "description": "Espejo de Parish.plan. Base44 RLS no puede hacer lookups entre entidades, así que Guardian/ChildGuardian leen este campo en vez de consultar Parish directamente. Mantenido por create_parish, assign_parish_user, y el puente acaciaControl (acción license.set con params.mirror). Fuente de verdad = Parish.plan.",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    },
    "parish_license_status": {
      "type": "string",
      "title": "Estado de licencia de la parroquia (espejo)",
      "description": "Espejo de Parish.license_status. Mismo mecanismo de sincronización que parish_plan.",
      "rls": { "write": { "user_condition": { "role": "admin" } } }
    }
```

- [ ] **Step 3: Verify the JSONC is still valid and the app builds**

Run: `npm run build`
Expected: build succeeds (exit 0). The Base44 Vite plugin parses every `base44/entities/*.jsonc` file at build time, so a syntax error here fails the build immediately.

- [ ] **Step 4: Commit**

```bash
git add base44/entities/Parish.jsonc base44/entities/User.jsonc
git commit -m "Agregar campos de licencia Premium, consentimiento y espejo de User"
```

---

### Task 2: `Guardian`/`ChildGuardian` RLS — enforce Premium + license status server-side

**Files:**
- Modify: `base44/entities/Guardian.jsonc`
- Modify: `base44/entities/ChildGuardian.jsonc`

**Interfaces:**
- Consumes: `User.parish_plan`, `User.parish_license_status` (Task 1).
- Produces: real backend enforcement of the Premium gate that today only exists in the UI (`ChildDetail.jsx:125`) — closes a security gap where any authenticated user could create/edit Tutores on a free-tier parish via a direct API call.

- [ ] **Step 1: Replace the RLS block in `Guardian.jsonc`**

The current `rls` block (all four operations identical: `parish_id` match OR platform admin) becomes:

```jsonc
  "rls": {
    "create": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "$and": [
            { "data.parish_id": "{{user.data.parish_id}}" },
            { "user_condition": { "data.parish_plan": "premium" } },
            { "user_condition": { "data.parish_license_status": "active" } }
        ] }
      ]
    },
    "read": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "$and": [
            { "data.parish_id": "{{user.data.parish_id}}" },
            { "$or": [
                { "user_condition": { "data.parish_plan": "free" } },
                { "user_condition": { "data.parish_license_status": "active" } },
                { "user_condition": { "data.parish_license_status": "read_only" } }
            ] }
        ] }
      ]
    },
    "update": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "$and": [
            { "data.parish_id": "{{user.data.parish_id}}" },
            { "user_condition": { "data.parish_plan": "premium" } },
            { "user_condition": { "data.parish_license_status": "active" } }
        ] }
      ]
    },
    "delete": {
      "$and": [
        {
          "data.parish_id": "{{user.data.parish_id}}"
        },
        {
          "$or": [
            {
              "user_condition": {
                "role": "admin"
              }
            },
            {
              "user_condition": {
                "data.parish_role": "admin"
              }
            }
          ]
        }
      ]
    }
  }
```

**Correction:** an earlier draft of this plan claimed `Guardian.jsonc`'s original `delete` block was the simple `parish_id match OR platform admin` form — that was a transcription error. Guardian's actual original `delete` requires parish match AND (platform admin OR parish-level admin), shown above; leave it exactly as it already is (do not touch it) — only `create`/`read`/`update` change in this task. `ChildGuardian.jsonc`'s `delete` genuinely is the simpler `$or` form already (see Step 2) — the two entities were never identical on `delete`, and that's correct/intentional, not something to reconcile.

- [ ] **Step 2: Apply the identical `create`/`read`/`update` blocks to `ChildGuardian.jsonc` (its `delete` stays as-is, the simpler `$or` form)**

Replace `ChildGuardian.jsonc`'s `create`/`read`/`update` blocks with the exact same three blocks from Step 1 — but leave `ChildGuardian.jsonc`'s `delete` block untouched (it's already the simpler `parish_id match OR platform admin` form, which is correct for this entity and was never meant to match Guardian's stricter `delete`).

- [ ] **Step 3: Verify the app builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add base44/entities/Guardian.jsonc base44/entities/ChildGuardian.jsonc
git commit -m "Exigir plan Premium activo en RLS de Guardian/ChildGuardian (antes solo UI)"
```

---

### Task 3: Consent copy and terms version constant

**Files:**
- Create: `src/lib/legal.js`

**Interfaces:**
- Produces: `DATA_PROCESSING_TERMS_VERSION` (string constant, `"2026-07-23"`), `DATA_PROCESSING_NOTICE` (array of `{heading: string, body: string}` sections) — consumed by Task 10 (`ConsentDialog.jsx`, `Parishes.jsx`) and referenced (duplicated, see note) by Task 4 (`create_parish`, a Deno function that cannot import from `src/`).

- [ ] **Step 1: Write `src/lib/legal.js`**

```js
// Versión del aviso de manejo de datos sensibles. Súbela cada vez que cambie
// el contenido de DATA_PROCESSING_NOTICE — un cambio de versión no re-pide
// aceptación a parroquias existentes automáticamente (esa función queda
// fuera de alcance por ahora; solo aplica a parroquias nuevas).
//
// NOTA: Base44 functions (base44/functions/*/entry.ts) no pueden importar de
// src/, así que create_parish (base44/functions/create_parish/entry.ts)
// declara su propia copia de este valor. Si cambias esta constante, cambia
// también la de create_parish/entry.ts en el mismo commit.
export const DATA_PROCESSING_TERMS_VERSION = "2026-07-23";

export const DATA_PROCESSING_NOTICE = [
  {
    heading: "Qué datos recabas en CateqHub",
    body: "CateqHub te permite registrar datos de niñas, niños y adolescentes inscritos en catecismo, incluyendo su CURP, nombre completo y fecha de nacimiento, así como datos de sus tutores. Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, los datos de menores de edad y la CURP se consideran información sensible y requieren un manejo cuidadoso.",
  },
  {
    heading: "Quién es responsable de estos datos",
    body: "Tu parroquia es la responsable (quien decide qué datos se recaban y para qué) de la información que cargas en CateqHub. CateqHub, operado sobre la infraestructura de Base44, actúa como encargado (quien trata los datos por cuenta de la parroquia, siguiendo sus instrucciones).",
  },
  {
    heading: "Tu obligación como responsable",
    body: "Antes de registrar los datos de un niño o niña en la plataforma, tu parroquia debe haber obtenido el consentimiento de su padre, madre o tutor (por ejemplo, en la hoja de inscripción física al catecismo) — este consentimiento en pantalla lo aceptas tú como administrador de la parroquia, y no sustituye el consentimiento que debes recabar de cada familia.",
  },
  {
    heading: "Para qué se usan estos datos",
    body: "Únicamente para llevar el control de asistencia, grupos y catecismo dentro de tu parroquia. CateqHub no vende ni comparte estos datos con terceros para fines distintos.",
  },
  {
    heading: "Derechos ARCO",
    body: "Las familias pueden solicitar a tu parroquia acceder, rectificar o cancelar los datos de sus hijos, u oponerse a su tratamiento, en cualquier momento — como responsable, tu parroquia debe poder atender esas solicitudes (editar/eliminar los registros correspondientes desde CateqHub).",
  },
  {
    heading: "Retención y eliminación",
    body: "Los datos del núcleo gratuito (niños, grupos, asistencia) permanecen mientras tu parroquia use la plataforma. Los datos de Tutores (función Premium) siguen las reglas del ciclo de vida de la licencia: si el pago de Premium no se confirma, primero se restringe la edición, después el acceso completo, y solo se eliminan tras haber tenido oportunidad de exportarlos — nunca de forma automática sin ese paso.",
  },
];

export const DATA_PROCESSING_ACCEPTANCE_TEXT =
  "Acepto que mi parroquia es responsable del manejo de estos datos conforme a la LFPDPPP, que cuento con el consentimiento de los padres/tutores para registrar los datos de cada niño o niña, y entiendo el ciclo de solo lectura → acceso denegado → exportación → eliminación aplicable a la función Premium.";
```

- [ ] **Step 2: Verify the app builds and lints**

Run: `npm run build && npm run lint`
Expected: both succeed. (This file has no consumers yet — Tasks 4 and 10 wire it in — so this step just confirms the file itself is syntactically valid ESM.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/legal.js
git commit -m "Agregar texto del aviso de manejo de datos sensibles (LFPDPPP)"
```

---

### Task 4: `create_parish` — require consent, seed license fields, seed mirror

**Files:**
- Modify: `base44/functions/create_parish/entry.ts`

**Interfaces:**
- Consumes: `Parish.data_processing_accepted_at/_by/_terms_version`, `User.parish_plan/parish_license_status` (Task 1).
- Produces: `create_parish` now rejects `{ data_processing_accepted: false }` with `400`, and returns the same `{ parish }` shape as before (unchanged response contract) — consumed by Task 10 (`Parishes.jsx`).

- [ ] **Step 1: Rewrite `base44/functions/create_parish/entry.ts`**

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Debe coincidir con DATA_PROCESSING_TERMS_VERSION en src/lib/legal.js —
// Base44 functions no pueden importar de src/, así que este valor se
// duplica a propósito. Súbelo en el mismo commit que el de src/lib/legal.js.
const DATA_PROCESSING_TERMS_VERSION = '2026-07-23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

    // parish_id solo se puede escribir con rol de servicio (ver User.jsonc) — esta
    // función es el único camino para que un usuario nuevo reclame su primera
    // parroquia como administrador, y solo si aún no tiene una asignada.
    if (me.parish_id) {
      return Response.json({ error: 'Ya tienes una parroquia asignada' }, { status: 400 });
    }

    const body = await req.json();
    const name = (body.name || '').trim();
    const admin_contact = body.admin_contact || '';
    if (!name) return Response.json({ error: 'Nombre requerido' }, { status: 400 });

    // Datos de menores (CURP incluida) son sensibles bajo la LFPDPPP — no se
    // crea una parroquia sin que su primer admin acepte el aviso.
    if (body.data_processing_accepted !== true) {
      return Response.json({ error: 'Debes aceptar el aviso de manejo de datos sensibles' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const now = new Date().toISOString();
    const parish = await sr.entities.Parish.create({
      name,
      admin_contact,
      active: true,
      data_processing_accepted_at: now,
      data_processing_accepted_by: me.email,
      data_processing_terms_version: DATA_PROCESSING_TERMS_VERSION,
    });
    await sr.entities.User.update(me.id, {
      parish_id: parish.id,
      parish_role: 'admin',
      parish_plan: 'free',
      parish_license_status: 'active',
    });

    return Response.json({ parish });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: succeeds (no new type errors). This function isn't covered by `tsc` project references the same way `src/` is in every repo, but this repo's `jsconfig.json`-driven `typecheck` script should still pass since it doesn't touch this file's syntax validity — if `tsc` errors on `base44/functions/**`, that's pre-existing repo scope, not something this task introduces; confirm by checking `git stash` then re-running `npm run typecheck` shows the same error set, then `git stash pop`.

- [ ] **Step 3: Commit**

```bash
git add base44/functions/create_parish/entry.ts
git commit -m "create_parish: exigir aceptación del aviso de datos sensibles"
```

---

### Task 5: `assign_parish_user` — seed the mirror for newly-assigned users

**Files:**
- Modify: `base44/functions/assign_parish_user/entry.ts`

**Interfaces:**
- Consumes: `Parish.plan`, `Parish.license_status` (Task 1).
- Produces: every user assigned to a parish (not just the one who created it) gets `parish_plan`/`parish_license_status` seeded from that parish's current values at assignment time — without this, a catechist invited after the parish went Premium would have a stale/empty mirror and get incorrectly blocked (or wrongly allowed) by the Task 2 RLS.

- [ ] **Step 1: Modify the assignment write in `base44/functions/assign_parish_user/entry.ts`**

Find this block (the function's final write before the response):

```ts
    await base44.asServiceRole.entities.User.update(target.id, {
      parish_id,
      group_id,
      parish_role,
    });
```

Replace it with:

```ts
    // Espejar plan/license_status vigentes de la parroquia en el usuario
    // recién asignado — Guardian/ChildGuardian RLS los lee de aquí (Base44
    // RLS no puede hacer lookup a Parish directamente). Sin esto, un
    // catequista invitado después de que la parroquia ya tenía Premium
    // arrancaría con el espejo vacío y quedaría bloqueado de más.
    const targetParish = await base44.asServiceRole.entities.Parish.get(parish_id).catch(() => null);

    await base44.asServiceRole.entities.User.update(target.id, {
      parish_id,
      group_id,
      parish_role,
      parish_plan: targetParish?.plan ?? 'free',
      parish_license_status: targetParish?.license_status ?? 'active',
    });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: succeeds, same baseline as Task 4 Step 2.

- [ ] **Step 3: Commit**

```bash
git add base44/functions/assign_parish_user/entry.ts
git commit -m "assign_parish_user: sembrar espejo de plan/license_status al asignar"
```

---

### Task 6: `acaciaControl` bridge — generic `mirror` capability + `license.deletePremiumData`

**Files:**
- Modify: `base44/functions/acaciaControl/entry.ts`

**Interfaces:**
- Produces: `license.set` action now accepts an optional `params.mirror: Array<{entity: string, matchField: string, fields: object}>` — after patching the primary entity, for each mirror spec it filters `sr.entities[entity]` by `{[matchField]: id}` (the same `id` being patched) and applies `fields` to every matching row. Response gains `mirrored: number`.
- Produces: new action `license.deletePremiumData`, params `{ deleteEntities: Array<{entity: string, field: string, value: string}> }`, response `{ ok: true, deletedCounts: Record<string, number> }`. Consumed by Mission Control (sibling repo/plan) — never called from this app's own frontend.

- [ ] **Step 1: Replace the `license.set` case**

Find:

```ts
      case 'license.set': {
        // Mission Control writes a tenant's license (service-role, HMAC-gated).
        // MC owns the per-app field mapping and builds `patch`; optional `log`
        // appends an audit row (e.g. puntos LicenseEvent). Returns the updated row.
        const entity = params.entity;
        const id = params.id;
        const patch = params.patch;
        if (!entity || !id || !patch || typeof patch !== 'object') {
          return Response.json({ error: 'params.entity/id/patch required' }, { status: 400 });
        }
        const updated = await sr.entities[entity].update(id, patch);
        const log = params.log;
        if (log && log.entity && log.row && typeof log.row === 'object') {
          try { await sr.entities[log.entity].create(log.row); } catch { /* audit best-effort */ }
        }
        return Response.json({ ok: true, updated });
      }
```

Replace with:

```ts
      case 'license.set': {
        // Mission Control writes a tenant's license (service-role, HMAC-gated).
        // MC owns the per-app field mapping and builds `patch`; optional `log`
        // appends an audit row (e.g. puntos LicenseEvent). Optional `mirror`
        // propagates fields from this same patch onto related records — used
        // by CateqHub to keep Guardian/ChildGuardian RLS (which can't look up
        // a related Parish directly) in sync with Parish.plan/license_status.
        // Generic: any app/entity can pass `mirror`, harmless if omitted.
        // Returns the updated row.
        const entity = params.entity;
        const id = params.id;
        const patch = params.patch;
        if (!entity || !id || !patch || typeof patch !== 'object') {
          return Response.json({ error: 'params.entity/id/patch required' }, { status: 400 });
        }
        const updated = await sr.entities[entity].update(id, patch);
        let mirrored = 0;
        const mirror = params.mirror;
        if (Array.isArray(mirror)) {
          for (const m of mirror) {
            if (!m || !m.entity || !m.matchField || !m.fields || typeof m.fields !== 'object') continue;
            try {
              const rows = await sr.entities[m.entity].filter({ [m.matchField]: id });
              for (const row of rows) {
                try { await sr.entities[m.entity].update(row.id, m.fields); mirrored++; } catch { /* best-effort per row */ }
              }
            } catch { /* best-effort per mirror spec */ }
          }
        }
        const log = params.log;
        if (log && log.entity && log.row && typeof log.row === 'object') {
          try { await sr.entities[log.entity].create(log.row); } catch { /* audit best-effort */ }
        }
        return Response.json({ ok: true, updated, mirrored });
      }
```

- [ ] **Step 2: Replace the stale placeholder comment with the new action**

Find:

```ts
      // Fase 6 — writes land here, e.g. 'license.activate' / 'license.suspend'.

      default:
```

Replace with:

```ts
      case 'license.deletePremiumData': {
        // Mission Control triggers this only after a tenant has confirmed its
        // own data export (gated on Mission Control's side, never trusted
        // blindly here) — service-role, HMAC-gated. Deletes rows by filter,
        // never by a fixed id list, so a retried call after a partial failure
        // is safe (nothing left to find = nothing to delete). Does NOT touch
        // the license entity itself — Mission Control resets it with a
        // separate license.set call so the mirror stays consistent.
        const deleteEntities = params.deleteEntities;
        if (!Array.isArray(deleteEntities) || deleteEntities.length === 0) {
          return Response.json({ error: 'params.deleteEntities required' }, { status: 400 });
        }
        const deletedCounts: Record<string, number> = {};
        for (const spec of deleteEntities) {
          if (!spec || !spec.entity || !spec.field || spec.value === undefined) continue;
          // Todo el cuerpo del spec va en un try/catch: un nombre de entidad
          // desconocido/no desplegada no debe abortar los specs restantes del
          // arreglo (mismo principio best-effort que el bucle de mirror en
          // license.set, arriba).
          try {
            const rows = await sr.entities[spec.entity].filter({ [spec.field]: spec.value });
            let count = 0;
            for (const row of rows) {
              try { await sr.entities[spec.entity].delete(row.id); count++; } catch { /* already gone or inaccessible, continue */ }
            }
            deletedCounts[spec.entity] = count;
          } catch { /* entidad desconocida o filter() falló — seguir con el siguiente spec */ }
        }
        return Response.json({ ok: true, deletedCounts });
      }

      default:
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: succeeds, same baseline as Task 4 Step 2.

- [ ] **Step 4: Commit**

```bash
git add base44/functions/acaciaControl/entry.ts
git commit -m "acaciaControl: capacidad genérica de espejo + acción license.deletePremiumData"
```

---

### Task 7: `export_premium_data` function — self-service data export

**Files:**
- Create: `base44/functions/export_premium_data/entry.ts`

**Interfaces:**
- Produces: `POST` (invoked via `base44.functions.invoke("export_premium_data", {})`) → `{ exported_at: string, parish: {id: string, name: string}, guardians: object[], child_guardians: object[] }` on success; `{ error: string }` with `401/403/400` otherwise. Consumed by Task 13 (`Premium.jsx`).

- [ ] **Step 1: Write `base44/functions/export_premium_data/entry.ts`**

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const isParishAdmin = me.parish_role === 'admin' || me.role === 'admin';
    if (!isParishAdmin || !me.parish_id) {
      return Response.json({ error: 'Solo un administrador de parroquia puede exportar estos datos' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const parish = await sr.entities.Parish.get(me.parish_id);
    if (!parish || parish.plan !== 'premium') {
      return Response.json({ error: 'Tu parroquia no tiene el plan Premium' }, { status: 400 });
    }

    const [guardians, childGuardians] = await Promise.all([
      sr.entities.Guardian.filter({ parish_id: me.parish_id }),
      sr.entities.ChildGuardian.filter({ parish_id: me.parish_id }),
    ]);

    return Response.json({
      exported_at: new Date().toISOString(),
      parish: { id: parish.id, name: parish.name },
      guardians,
      child_guardians: childGuardians,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: succeeds, same baseline as Task 4 Step 2.

- [ ] **Step 3: Commit**

```bash
git add base44/functions/export_premium_data/entry.ts
git commit -m "Agregar función export_premium_data (autoservicio de exportación)"
```

---

### Task 8: `confirm_premium_export` function — record the confirmation

**Files:**
- Create: `base44/functions/confirm_premium_export/entry.ts`

**Interfaces:**
- Produces: `POST` (invoked via `base44.functions.invoke("confirm_premium_export", {})`) → `{ parish: object }` on success; `{ error: string }` with `401/403/400` otherwise. Consumed by Task 13 (`Premium.jsx`).

- [ ] **Step 1: Write `base44/functions/confirm_premium_export/entry.ts`**

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const isParishAdmin = me.parish_role === 'admin' || me.role === 'admin';
    if (!isParishAdmin || !me.parish_id) {
      return Response.json({ error: 'Solo un administrador de parroquia puede confirmar esta exportación' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const parish = await sr.entities.Parish.get(me.parish_id);
    if (!parish) return Response.json({ error: 'Parroquia no encontrada' }, { status: 404 });

    // Solo se puede confirmar en los estados donde el acceso ya está
    // restringido — evita un estado contradictorio ("confirmé la
    // exportación" mientras todavía tienes acceso normal).
    if (parish.license_status !== 'access_denied' && parish.license_status !== 'deletion_eligible') {
      return Response.json({ error: 'No aplica en el estado actual de tu licencia' }, { status: 400 });
    }

    const updated = await sr.entities.Parish.update(me.parish_id, {
      export_confirmed_at: new Date().toISOString(),
      export_confirmed_by: me.email,
    });

    return Response.json({ parish: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: succeeds, same baseline as Task 4 Step 2.

- [ ] **Step 3: Commit**

```bash
git add base44/functions/confirm_premium_export/entry.ts
git commit -m "Agregar función confirm_premium_export"
```

---

### Task 9: `src/lib/premium.js` — `getLicenseStatus`/`useLicenseStatus`

**Files:**
- Modify: `src/lib/premium.js`

**Interfaces:**
- Consumes: `Parish.plan`, `Parish.license_status`, `Parish.export_confirmed_at` (Task 1).
- Produces: `getLicenseStatus(parish)` → `{ tier: "free"|"premium", isPremium: boolean, status: "active"|"read_only"|"access_denied"|"deletion_eligible", isReadOnly: boolean, isAccessDenied: boolean, exportConfirmed: boolean }`; `useLicenseStatus(parish)` (memoized hook wrapper). Keeps `getPremiumStatus`/`usePremiumStatus` as back-compat aliases (existing imports in `ChildDetail.jsx`/`Premium.jsx` are updated to the new names in Tasks 12–13, but the aliases mean nothing breaks mid-refactor). Consumed by Tasks 11, 12, 13.

- [ ] **Step 1: Rewrite `src/lib/premium.js`**

```js
import { useMemo } from "react";

// CateqHub es free por default: asistencia por QR, alta de parroquia/grupos/
// niños y reportes básicos no tienen costo ni vencimiento. Tutores/mensajería/
// tareas/pulseras son parte del plan de pago (todavía sin nombre). El límite
// de niños del plan free aún no está definido — hoy no se aplica ningún tope.
// `plan` en Parish solo se escribe con rol de servicio (Mission Control o el
// panel de Base44) — un admin de parroquia no puede activarse el plan a sí
// mismo.
//
// `license_status` (solo relevante si plan=premium) sigue el ciclo:
// active → read_only → access_denied → deletion_eligible, escrito por
// Mission Control cuando el pago de Premium no se confirma. El núcleo
// gratuito nunca entra a este ciclo.
export function getLicenseStatus(parish) {
  const isPremium = parish?.plan === "premium";
  const status = isPremium ? (parish?.license_status || "active") : "active";
  return {
    tier: isPremium ? "premium" : "free",
    isPremium,
    status,
    isReadOnly: isPremium && status !== "active",
    isAccessDenied: isPremium && (status === "access_denied" || status === "deletion_eligible"),
    exportConfirmed: !!parish?.export_confirmed_at,
  };
}

export function useLicenseStatus(parish) {
  return useMemo(
    () => getLicenseStatus(parish),
    [parish?.id, parish?.plan, parish?.license_status, parish?.export_confirmed_at]
  );
}

// Alias de compatibilidad — mismo shape que antes (tier/isPremium), más los
// campos nuevos. No romper mientras se termina de migrar cada consumidor.
export const getPremiumStatus = getLicenseStatus;
export const usePremiumStatus = useLicenseStatus;
```

- [ ] **Step 2: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed — existing imports of `usePremiumStatus`/`getPremiumStatus` in `ChildDetail.jsx`/`Premium.jsx` still resolve via the aliases.

- [ ] **Step 3: Commit**

```bash
git add src/lib/premium.js
git commit -m "premium.js: agregar getLicenseStatus/useLicenseStatus (read_only/access_denied)"
```

---

### Task 10: Consent dialog + gate on parish creation

**Files:**
- Create: `src/components/ConsentDialog.jsx`
- Modify: `src/pages/Parishes.jsx`

**Interfaces:**
- Consumes: `DATA_PROCESSING_NOTICE`, `DATA_PROCESSING_ACCEPTANCE_TEXT`, `DATA_PROCESSING_TERMS_VERSION` (Task 3).
- Produces: `<ConsentDialog open, onOpenChange />` (pure display component, no side effects) — consumed only by `Parishes.jsx`. `Parishes.jsx` now sends `data_processing_accepted: true` to `create_parish` only after the admin has checked the acceptance box.

- [ ] **Step 1: Write `src/components/ConsentDialog.jsx`**

```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DATA_PROCESSING_NOTICE } from "@/lib/legal";

export default function ConsentDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aviso sobre el manejo de datos personales sensibles</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          {DATA_PROCESSING_NOTICE.map((section) => (
            <div key={section.heading}>
              <p className="font-medium text-foreground mb-1">{section.heading}</p>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the consent gate into `Parishes.jsx`**

Modify the imports at the top of `src/pages/Parishes.jsx`:

```jsx
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import ConsentDialog from "@/components/ConsentDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DATA_PROCESSING_ACCEPTANCE_TEXT } from "@/lib/legal";
import { Church, Check } from "lucide-react";
```

Add state (alongside the existing `useState` calls):

```jsx
  const [accepted, setAccepted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
```

Change the `save` function's `create_parish` call to include the flag:

```jsx
        const res = await base44.functions.invoke("create_parish", { name, admin_contact: contact, data_processing_accepted: accepted });
```

In the JSX, right before the closing `{error && ...}` / submit `<Button>` line inside the "Crear parroquia" card, add the checkbox — **only when creating** (i.e. `!user?.parish_id`):

```jsx
          {!user?.parish_id && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <Checkbox id="consent" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <label htmlFor="consent" className="text-sm text-muted-foreground">
                {DATA_PROCESSING_ACCEPTANCE_TEXT}{" "}
                <button type="button" onClick={() => setShowNotice(true)} className="text-primary hover:underline">
                  Leer aviso completo
                </button>
              </label>
            </div>
          )}
```

Update the submit button's `disabled` condition to also require acceptance when creating:

```jsx
          <Button onClick={save} disabled={loading || !name || (!user?.parish_id && !accepted)}>{loading ? "Guardando…" : user?.parish_id ? "Guardar cambios" : "Crear y asignar"}</Button>
```

And render the dialog at the end of the component's returned JSX, just before the final closing `</div>`:

```jsx
      <ConsentDialog open={showNotice} onOpenChange={setShowNotice} />
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Manual verification (browser, against a local/dev Base44 backend once deployed)**

Run: `npm run dev`, then in the browser: log in as a user with no `parish_id`, go to `/parroquia`. Confirm: (a) the "Crear y asignar" button is disabled until the checkbox is checked, (b) "Leer aviso completo" opens the full notice text, (c) after checking the box and submitting, the parish is created (this last part requires a deployed backend with Task 1/4's schema/function changes live — note as pending in the PR if the backend isn't deployed yet).

- [ ] **Step 5: Commit**

```bash
git add src/components/ConsentDialog.jsx src/pages/Parishes.jsx
git commit -m "Exigir aceptación del aviso de datos sensibles al crear una parroquia"
```

---

### Task 11: License banner in `Layout.jsx`

**Files:**
- Create: `src/components/LicenseBanner.jsx`
- Modify: `src/components/Layout.jsx`

**Interfaces:**
- Consumes: `useLicenseStatus` (Task 9).
- Produces: `<LicenseBanner parish={parish} />` (renders `null` when `plan !== "premium"` or `status === "active"`) — consumed only by `Layout.jsx`.

- [ ] **Step 1: Write `src/components/LicenseBanner.jsx`**

```jsx
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useLicenseStatus } from "@/lib/premium";

export default function LicenseBanner({ parish }) {
  const { isPremium, status } = useLicenseStatus(parish);
  if (!isPremium || status === "active") return null;

  const isDenied = status === "access_denied" || status === "deletion_eligible";

  return (
    <div
      className={
        isDenied
          ? "flex items-center gap-2 text-sm px-4 py-2 bg-destructive/10 text-destructive border-b border-destructive/20"
          : "flex items-center gap-2 text-sm px-4 py-2 bg-amber-50 text-amber-800 border-b border-amber-200"
      }
    >
      {isDenied ? <ShieldAlert className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span>
        {isDenied
          ? "Acceso a Tutores denegado por falta de pago del plan Premium. Exporta tus datos antes de que se eliminen."
          : "Tu plan Premium está pendiente de pago. Agregar o editar Tutores está pausado."}
      </span>
      <Link to="/premium" className="underline font-medium shrink-0">Ver detalles</Link>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `Layout.jsx`**

Add the import at the top of `src/components/Layout.jsx`:

```jsx
import LicenseBanner from "@/components/LicenseBanner";
```

`Layout.jsx` already fetches the parish for the sidebar subtitle (`parishName` state) but discards the full object. Change the existing state and effect from:

```jsx
  const [parishName, setParishName] = useState(null);

  const items = navItems.filter((i) => !i.adminOnly || isParishAdmin(user));

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  // Cada tenant (parroquia) muestra su propio nombre bajo la marca CateqHub.
  useEffect(() => {
    if (!user?.parish_id) { setParishName(null); return; }
    base44.entities.Parish.get(user.parish_id)
      .then((p) => setParishName(p?.name ?? null))
      .catch(() => setParishName(null));
  }, [user?.parish_id]);

  const subtitle = parishName ?? parishRoleLabel(user);
```

to:

```jsx
  const [parish, setParish] = useState(null);

  const items = navItems.filter((i) => !i.adminOnly || isParishAdmin(user));

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  // Cada tenant (parroquia) muestra su propio nombre bajo la marca CateqHub,
  // y el estado de licencia alimenta el banner de Premium (LicenseBanner).
  useEffect(() => {
    if (!user?.parish_id) { setParish(null); return; }
    base44.entities.Parish.get(user.parish_id)
      .then(setParish)
      .catch(() => setParish(null));
  }, [user?.parish_id]);

  const subtitle = parish?.name ?? parishRoleLabel(user);
```

Then render the banner right above `<Outlet>` inside `<main>`:

```jsx
      {/* Content */}
      <main className="md:pl-60 pb-20 md:pb-0">
        <LicenseBanner parish={parish} />
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet context={{ user }} />
        </div>
      </main>
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/LicenseBanner.jsx src/components/Layout.jsx
git commit -m "Mostrar banner de estado de licencia Premium en el layout"
```

---

### Task 12: `ChildDetail.jsx` — Tutores section respects `access_denied`

**Files:**
- Modify: `src/pages/ChildDetail.jsx`

**Interfaces:**
- Consumes: `useLicenseStatus` (Task 9).
- Produces: when `isAccessDenied`, the component no longer calls `ChildGuardian.filter`/`Guardian.get` (which would now 403 under Task 2's RLS) and instead shows a blocked-access message with a link to `/premium`.

- [ ] **Step 1: Swap the import and hook call**

Change:

```jsx
import { usePremiumStatus } from "@/lib/premium";
```

to:

```jsx
import { useLicenseStatus } from "@/lib/premium";
```

Change:

```jsx
  const status = usePremiumStatus(parish);
```

to:

```jsx
  const status = useLicenseStatus(parish);
```

- [ ] **Step 2: Skip the now-forbidden fetch when access is denied**

`parish` state is populated asynchronously (a separate `.then()` inside `load()`), so gating the guardian fetch has to happen in its own effect keyed off the `status` the component already derives from `parish` — not inline inside `load()`. Replace the entire existing `load` function and the `useEffect` that calls it:

```jsx
  const load = async () => {
    const c = await base44.entities.Child.get(id);
    setChild(c);
    if (c.group_id) base44.entities.Group.get(c.group_id).then(setGroup).catch(() => {});
    if (c.parish_id) base44.entities.Parish.get(c.parish_id).then(setParish).catch(() => {});
    const rels = await base44.entities.ChildGuardian.filter({ child_id: id });
    setLinks(rels);
    if (rels.length) {
      const gs = await Promise.all(rels.map((r) => base44.entities.Guardian.get(r.guardian_id)));
      setGuardians(gs);
    } else {
      setGuardians([]);
    }
  };

  useEffect(() => { load(); }, [id]);
```

with:

```jsx
  const load = async () => {
    const c = await base44.entities.Child.get(id);
    setChild(c);
    if (c.group_id) base44.entities.Group.get(c.group_id).then(setGroup).catch(() => {});
    if (c.parish_id) base44.entities.Parish.get(c.parish_id).then(setParish).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const loadGuardians = async () => {
    if (status.isAccessDenied) { setLinks([]); setGuardians([]); return; }
    const rels = await base44.entities.ChildGuardian.filter({ child_id: id });
    setLinks(rels);
    if (rels.length) {
      const gs = await Promise.all(rels.map((r) => base44.entities.Guardian.get(r.guardian_id)));
      setGuardians(gs);
    } else {
      setGuardians([]);
    }
  };

  useEffect(() => { if (child) loadGuardians(); }, [child?.id, status.isAccessDenied]);
```

Every other call site that referenced `load()` to refresh the Tutores list (`addGuardian`, `removeGuardian`) must call `loadGuardians()` instead — update:

```jsx
      setOpenG(false);
      setGForm({ name: "", phone: "", email: "", curp: "", relationship: "tutor", pickup_authorized: true });
      load();
    } finally { setLoading(false); }
  };

  const removeGuardian = async (linkId) => {
    if (!confirm("¿Quitar a este tutor del niño?")) return;
    await base44.entities.ChildGuardian.delete(linkId);
    load();
  };
```

to:

```jsx
      setOpenG(false);
      setGForm({ name: "", phone: "", email: "", curp: "", relationship: "tutor", pickup_authorized: true });
      loadGuardians();
    } finally { setLoading(false); }
  };

  const removeGuardian = async (linkId) => {
    if (!confirm("¿Quitar a este tutor del niño?")) return;
    await base44.entities.ChildGuardian.delete(linkId);
    loadGuardians();
  };
```

(`toggleActive`'s call to `load()` is untouched — it only needs to refresh `child`, not guardians.)

- [ ] **Step 3: Show the blocked-access message**

In the Tutores `CardContent`, change:

```jsx
            <CardContent className="space-y-3">
              {!status.isPremium && (
                <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                  Agregar tutores es una función premium. Lo que ya registraste sigue aquí — puedes eliminarlo cuando quieras.{" "}
                  <Link to="/premium" className="text-primary hover:underline">Ver plan Premium</Link>
                </p>
              )}
              {guardians.length === 0 && <p className="text-sm text-muted-foreground">Sin tutores registrados.</p>}
```

to:

```jsx
            <CardContent className="space-y-3">
              {status.isAccessDenied ? (
                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  El acceso a Tutores está bloqueado por falta de pago del plan Premium.{" "}
                  <Link to="/premium" className="underline">Ver plan Premium</Link>
                </p>
              ) : (
                <>
                  {!status.isPremium && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                      Agregar tutores es una función premium. Lo que ya registraste sigue aquí — puedes eliminarlo cuando quieras.{" "}
                      <Link to="/premium" className="text-primary hover:underline">Ver plan Premium</Link>
                    </p>
                  )}
                  {status.isReadOnly && !status.isAccessDenied && (
                    <p className="text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2">
                      Tu plan Premium está pendiente de pago — puedes ver los tutores registrados, pero no agregar ni editar.
                    </p>
                  )}
                  {guardians.length === 0 && <p className="text-sm text-muted-foreground">Sin tutores registrados.</p>}
                </>
              )}
```

Note the closing `</>` must wrap through to just before the `{guardians.map(...)}` block — leave `{guardians.map(...)}` itself outside this conditional (it renders `[]` harmlessly when `isAccessDenied`, since `loadGuardians` already skips fetching and leaves `guardians` empty).

Also update the "Agregar" button guard (`{status.isPremium ? ... : ...}`) to also hide/disable when `isReadOnly` (today it only checks `isPremium`, but a `read_only` Premium parish must not be able to add Tutores either):

Change:

```jsx
              {status.isPremium ? (
                <Button size="sm" variant="ghost" onClick={() => setOpenG(true)}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
              ) : (
                <Button size="sm" variant="ghost" disabled title="Disponible con el plan Premium">
                  <Lock className="w-3.5 h-3.5 mr-1" />Agregar
                </Button>
              )}
```

to:

```jsx
              {status.isPremium && !status.isReadOnly ? (
                <Button size="sm" variant="ghost" onClick={() => setOpenG(true)}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
              ) : (
                <Button size="sm" variant="ghost" disabled title={status.isPremium ? "Pausado por falta de pago" : "Disponible con el plan Premium"}>
                  <Lock className="w-3.5 h-3.5 mr-1" />Agregar
                </Button>
              )}
```

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ChildDetail.jsx
git commit -m "ChildDetail: bloquear lectura de Tutores en access_denied, pausar en read_only"
```

---

### Task 13: `Premium.jsx` — read_only/access_denied states + export flow

**Files:**
- Modify: `src/pages/Premium.jsx`

**Interfaces:**
- Consumes: `useLicenseStatus` (Task 9), `export_premium_data`/`confirm_premium_export` functions (Tasks 7–8).
- Produces: the page's UI now branches on `status.status`, and renders a self-service export flow when `isAccessDenied`.

- [ ] **Step 1: Replace the imports and hook call**

Change:

```jsx
import { usePremiumStatus } from "@/lib/premium";
```

to:

```jsx
import { useState } from "react";
import { useLicenseStatus } from "@/lib/premium";
```

(the existing `import { useEffect, useState } from "react";` already covers `useState`; if so, don't duplicate — merge into the existing React import line instead of adding a second one.)

Change:

```jsx
  const status = usePremiumStatus(parish);
```

to:

```jsx
  const status = useLicenseStatus(parish);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [confirming, setConfirming] = useState(false);
```

- [ ] **Step 2: Add the export handlers**

Add these functions after the `useEffect` that loads `parish` and before the `if (!isParishAdmin(user)) return <RestrictedNotice />;` line:

```jsx
  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const res = await base44.functions.invoke("export_premium_data", {});
      if (res?.data?.error) throw new Error(res.data.error);
      const payload = res.data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = (payload.parish?.name || "parroquia").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.href = url;
      a.download = `tutores-${safeName}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e.message || "No se pudo exportar la información.");
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmExport = async () => {
    setConfirming(true);
    setExportError("");
    try {
      const res = await base44.functions.invoke("confirm_premium_export", {});
      if (res?.data?.error) throw new Error(res.data.error);
      setParish(res.data.parish);
    } catch (e) {
      setExportError(e.message || "No se pudo confirmar la exportación.");
    } finally {
      setConfirming(false);
    }
  };
```

- [ ] **Step 3: Render the access-denied export screen**

Immediately after the `<div>` opening the page (after the header block with the "Plan Premium" title, before the two status banners `status.tier === "free"` / `status.tier === "premium"`), add an early branch that replaces the rest of the page's content when access is denied:

```jsx
      {status.isAccessDenied ? (
        <Card className="border-destructive/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              <p className="font-medium">Acceso a Tutores denegado por falta de pago</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Tu parroquia dejó de tener acceso a la función Premium por falta de pago. Puedes descargar los datos de Tutores que registraste antes de que se eliminen. El resto de CateqHub (niños, grupos, asistencia) sigue funcionando normalmente.
            </p>
            {exportError && <p className="text-sm text-destructive">{exportError}</p>}
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Descargando…" : "Descargar mis datos (Tutores)"}
            </Button>
            {status.exportConfirmed ? (
              <p className="flex items-center gap-2 text-sm text-moss">
                <Check className="w-4 h-4" />
                Exportación confirmada el {new Date(parish.export_confirmed_at).toLocaleDateString("es-MX")}.
              </p>
            ) : (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  onChange={(e) => { if (e.target.checked) handleConfirmExport(); }}
                  disabled={confirming}
                />
                Descargué y guardé mis datos
              </label>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
```

And close that `<>` fragment right before the component's final closing `</div>` (i.e. wrap everything from the current `{status.tier === "free" && (...)}` block through the end of the existing JSX in this new fragment, ending with `</>` just before the outer `</div>`).

- [ ] **Step 4: Add the `read_only` banner branch**

Inside the same `<>` fragment (non-denied path), add a `read_only`-specific notice alongside the existing `free`/`premium` tier banners — insert this block right after the existing `{status.tier === "premium" && (...)}` block:

```jsx
      {status.isPremium && status.isReadOnly && (
        <div className="flex items-center gap-2 text-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <Clock className="w-4 h-4 shrink-0" />
          <span>Tu plan Premium está pendiente de pago. Agregar o editar Tutores está pausado hasta que se confirme el pago.</span>
        </div>
      )}
```

- [ ] **Step 5: Add the `ShieldAlert` icon import**

Change:

```jsx
import { Check, Sparkles, Clock } from "lucide-react";
```

to:

```jsx
import { Check, Sparkles, Clock, ShieldAlert } from "lucide-react";
```

- [ ] **Step 6: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Premium.jsx
git commit -m "Premium: pantalla de exportación autoservicio en access_denied, aviso en read_only"
```

---

### Task 14: "Acerca de" — Base44 certifications section

**Files:**
- Modify: `src/pages/About.jsx`

**Interfaces:**
- Produces: a new card in `About.jsx` disclosing Base44's SOC 2 Type II compliance and DPA, attributed to Base44's own Trust Center with a link — no claim that CateqHub itself is separately certified.

- [ ] **Step 1: Add the `ShieldCheck` icon import**

Change:

```jsx
import { Info, ChevronDown, BookOpen, LifeBuoy } from "lucide-react";
```

to:

```jsx
import { Info, ChevronDown, BookOpen, LifeBuoy, ShieldCheck } from "lucide-react";
```

- [ ] **Step 2: Insert the certifications card**

Insert this new `<Card>` right after the logo/version card (after the closing `</Card>` that contains the `Logo`/version block, before the `<div className="grid sm:grid-cols-2 gap-3">` nav-links block):

```jsx
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <p className="font-medium text-sm">Seguridad de la infraestructura</p>
          </div>
          <p className="text-sm text-muted-foreground">
            CateqHub corre sobre Base44, que declara cumplimiento{" "}
            <strong className="text-foreground">SOC 2 Tipo II</strong> y ofrece un{" "}
            <strong className="text-foreground">Acuerdo de Procesamiento de Datos (DPA)</strong> para el manejo
            de datos personales. Puedes verificar el estado vigente de estas certificaciones directamente en el{" "}
            <a
              href="https://base44.com/security"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Centro de Confianza de Base44
            </a>
            .
          </p>
        </CardContent>
      </Card>
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/About.jsx
git commit -m "Acerca de: agregar sección de certificaciones de seguridad de Base44"
```

---

### Task 15: Version bump and changelog entry

**Files:**
- Modify: `src/lib/appConfig.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `APP_VERSION` bumped from `"1.5.0"` to `"1.6.0"`, new `CHANGELOG` entry — this repo's established convention (see `appConfig.js`'s existing entries, e.g. commit `ee7827e`) for any user-facing release.

- [ ] **Step 1: Update `src/lib/appConfig.js`**

Change:

```js
export const APP_VERSION = "1.5.0";
export const RELEASE_DATE = "2026-07-23";

export const CHANGELOG = [
  {
    version: "1.5.0",
    date: "2026-07-23",
```

to:

```js
export const APP_VERSION = "1.6.0";
export const RELEASE_DATE = "2026-07-23";

export const CHANGELOG = [
  {
    version: "1.6.0",
    date: "2026-07-23",
    changes: [
      "Ciclo de vida de licencia Premium: si el pago no se confirma, Tutores pasa primero a solo lectura y después a acceso denegado, con exportación autoservicio de tus datos antes de cualquier eliminación.",
      "La restricción del plan Premium en Tutores ahora se hace cumplir también en el backend, no solo en la pantalla.",
      "Nuevo aviso de manejo de datos sensibles (CURP y datos de menores) al crear una parroquia, conforme a la LFPDPPP.",
      "Acerca de ahora indica las certificaciones de seguridad de Base44, el proveedor de infraestructura.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-07-23",
```

- [ ] **Step 2: Update `package.json`'s `version` field to match**

Change:

```json
  "version": "1.5.0",
```

to:

```json
  "version": "1.6.0",
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/appConfig.js package.json
git commit -m "Subir versión a 1.6.0 — ciclo de vida de licencia Premium"
```

---

### Task 16: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full build/lint/typecheck**

Run: `npm run build && npm run lint && npm run typecheck`
Expected: all three succeed with no errors.

- [ ] **Step 2: Playwright smoke test**

Run: `npm run test:e2e`
Expected: `e2e/smoke.spec.js` passes (this task's changes don't touch anything the smoke test exercises directly, but confirm no regression before calling the feature done).

- [ ] **Step 3: Manual QA checklist (write into the PR description, run once someone with Base44 MCP/CLI access has deployed this branch's schema/function changes to a live backend)**

- [ ] Crear una parroquia nueva sin aceptar el aviso → botón deshabilitado.
- [ ] Aceptar el aviso → parroquia creada, `Parish.data_processing_accepted_at/_by/_terms_version` poblados.
- [ ] Con `plan=free`: intentar `POST` directo a `Guardian.create` (o desde la consola del navegador) con un `parish_id` de una parroquia free → rechazado por RLS.
- [ ] Activar `plan=premium` en Base44 panel → Agregar Tutor funciona en la UI.
- [ ] Setear `license_status=read_only` en Base44 panel → banner ámbar visible, botón "Agregar" deshabilitado en ChildDetail, Tutores existentes siguen visibles.
- [ ] Setear `license_status=access_denied` → banner rojo, ChildDetail muestra "acceso bloqueado" sin listar Tutores, `/premium` muestra la pantalla de exportación.
- [ ] Click "Descargar mis datos" → se descarga un `.json` con `guardians`/`child_guardians` de esa parroquia.
- [ ] Marcar "Descargué y guardé mis datos" → `Parish.export_confirmed_at`/`_by` se escriben, el checkbox se reemplaza por el mensaje de confirmación.
- [ ] Volver `plan=free` y `license_status=active` en Base44 panel → banner desaparece, Tutores vuelven a ser de solo-lectura-para-crear (mensaje "función premium"), lectura/eliminación siguen disponibles.
- [ ] `/acerca-de` muestra la tarjeta de certificaciones de Base44 con el link correcto.

- [ ] **Step 4: Note deployment status in the PR**

The PR description must state explicitly that `base44/entities/*.jsonc` and `base44/functions/*/entry.ts` changes in this branch have **not** been deployed to the live Base44 backend (no MCP/CLI access in this session) — deployment is a manual follow-up step for whoever has Base44 access, per this repo's `CLAUDE.md`/`AGENTS.md`.
