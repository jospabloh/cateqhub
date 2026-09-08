// acaciaControl — ACACIA Mission Control admin bridge for this Base44 app.
//
// Mission Control calls this function over an HMAC-signed body (no user token):
//   { action, params, ts, sig }
// We verify the signature against the app secret INGEST_HMAC_SECRET (set via
// `npx base44 secrets set`), then run the requested action with the service
// role. Single channel for reads (license sync, usage) and writes (Fase 6).
// Same file deploys to every app.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { verifyAs } from './_acaciaSign.ts';

const MAX_SKEW_MS = 5 * 60 * 1000;
const COUNT_CAP = 5000; // Base44 caps list at 5,000 — usage counts are capped here.

// stableStringify / hmacHex / timingSafeEqual used to live here, hand-mirrored
// against Mission Control's api/_lib/ingestSign.js. verifyAs() in
// _acaciaSign.ts owns all three now — a hand-kept mirror of a signing routine
// is exactly the thing that drifts, and a drift here surfaces only as
// "bad signature" at runtime.

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('INGEST_HMAC_SECRET');
    if (!secret) return Response.json({ error: 'INGEST_HMAC_SECRET not set in app secrets' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const { action, params = {}, ts, sig } = body ?? {};
    if (!action || !ts || !sig) return Response.json({ error: 'missing action/ts/sig' }, { status: 400 });
    if (Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return Response.json({ error: 'stale request' }, { status: 401 });

    // Verified against THIS app's derived key — see _acaciaSign.ts, and Module
    // 15 of jospabloh/acacia-app-standard. ACCEPT_LEGACY_MASTER has been false
    // since 63a8337, so a signature made with the bare INGEST_HMAC_SECRET is no
    // longer accepted: that is exactly what closes the hole this module exists
    // for. (This comment claimed the opposite until 2026-09-08 — it was written
    // during the migration and went stale on the commit that ended it.)
    //
    // The slug gets its own named 500, like INGEST_HMAC_SECRET above, instead of
    // `?? ''`. Both directions fail closed, but they fail LEGIBLY differently:
    // an empty slug derives a key from an empty string, so every call comes back
    // `bad signature` — which reads as a wrong secret and is not one. That exact
    // confusion cost this portfolio two hours on 2026-08-24, when four apps had
    // ACACIA_APP_SLUG set to something that was not their Mission Control id
    // (see Module 15 in Mission Control's CLAUDE.md: "parece un secreto mal
    // puesto y no lo es"). A missing value should say its own name.
    const slug = Deno.env.get('ACACIA_APP_SLUG');
    if (!slug) return Response.json({ error: 'ACACIA_APP_SLUG not set in app secrets' }, { status: 500 });
    if (!(await verifyAs(secret, slug, { ts, action, params, sig }))) {
      return Response.json({ error: 'bad signature' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    switch (action) {
      case 'ping':
        return Response.json({ ok: true, pong: true });

      case 'licenses.list': {
        const entity = params.entity;
        if (!entity) return Response.json({ error: 'params.entity required' }, { status: 400 });
        const records = await sr.entities[entity].list('-created_date', COUNT_CAP);
        return Response.json({ ok: true, records });
      }

      case 'usage.summary': {
        // Count records of each requested entity → product-usage signal.
        const entities: string[] = Array.isArray(params.entities) ? params.entities : [];
        const counts: Record<string, number | null> = {};
        for (const e of entities) {
          try {
            const rows = await sr.entities[e].list('-created_date', COUNT_CAP);
            counts[e] = rows.length;
          } catch {
            counts[e] = null; // entity missing/inaccessible in this app
          }
        }
        return Response.json({ ok: true, counts, cap: COUNT_CAP });
      }

      case 'emails.status': {
        // Read follow-up / lifecycle email history for one tenant from the app's
        // email log entity (apps that have one). Returns [] when absent. Read-only.
        const logEntity = params.logEntity;
        const idField = params.idField;
        const id = params.id;
        if (!logEntity || !idField || !id) return Response.json({ error: 'params.logEntity/idField/id required' }, { status: 400 });
        try {
          const rows = await sr.entities[logEntity].filter({ [idField]: id });
          const records = (rows ?? []).map((r: Record<string, unknown>) => ({
            email_type: r.email_type, status: r.status, sent_at: r.sent_at, recipient_email: r.recipient_email,
          }));
          return Response.json({ ok: true, records });
        } catch (e) {
          return Response.json({ ok: true, records: [], note: (e as Error).message });
        }
      }

      case 'license.set': {
        // Mission Control writes a tenant's license (service-role, HMAC-gated).
        // MC owns the per-app field mapping and builds `patch`; optional `log`
        // appends an audit row (e.g. puntos LicenseEvent). Optional `mirror`
        // propagates fields from this same patch onto related records — used
        // by CateqHub to keep Guardian/ChildGuardian RLS (which can't look up
        // a related Parish directly) in sync with Parish.plan/license_status.
        // Generic: any app/entity can pass `mirror`, harmless if omitted.
        //
        // Mirror runs BEFORE the primary patch. Any mirror problem — a row
        // update failing, or a malformed mirror spec that would otherwise
        // silently no-op — blocks the primary patch entirely (returns
        // ok:false, patch NOT applied). Doing it the other way around (patch
        // first, mirror best-effort) opened a real bug: Parish.license_status
        // could flip to a more restrictive value while some Users still
        // carried the old, more permissive mirror — RLS stayed wide open for
        // those users for as long as the next transition took to arrive (up
        // to 30 days on the Premium lifecycle). Mission Control is expected
        // to retry a ok:false response; it never treats it as a completed
        // transition (see the sibling repo's license-lifecycle cron/
        // license-action). Note this is NOT atomic: mirror rows already
        // updated when a later row/spec fails are not rolled back — that's
        // fine because every mirror write is idempotent (same `id`/`fields`
        // every retry), so a retry after a partial failure just re-applies
        // the same values to the rows that already got them.
        const entity = params.entity;
        const id = params.id;
        const patch = params.patch;
        if (!entity || !id || !patch || typeof patch !== 'object') {
          return Response.json({ error: 'params.entity/id/patch required' }, { status: 400 });
        }

        let mirrored = 0;
        const mirrorErrors: Array<{ entity: string; id?: string; message: string }> = [];
        const mirror = params.mirror;
        if (Array.isArray(mirror)) {
          for (const m of mirror) {
            if (!m || !m.entity || !m.matchField || !m.fields || typeof m.fields !== 'object') {
              mirrorErrors.push({ entity: m?.entity ?? 'unknown', message: 'malformed mirror spec (missing entity/matchField/fields)' });
              continue;
            }
            try {
              const rows = await sr.entities[m.entity].filter({ [m.matchField]: id });
              for (const row of rows) {
                try {
                  await sr.entities[m.entity].update(row.id, m.fields);
                  mirrored++;
                } catch (e) {
                  mirrorErrors.push({ entity: m.entity, id: row.id, message: (e as Error).message });
                }
              }
            } catch (e) {
              mirrorErrors.push({ entity: m.entity, message: (e as Error).message });
            }
          }
        }
        if (mirrorErrors.length > 0) {
          return Response.json({ ok: false, error: 'mirror_failed', mirrored, mirrorErrors }, { status: 502 });
        }

        const updated = await sr.entities[entity].update(id, patch);
        const log = params.log;
        if (log && log.entity && log.row && typeof log.row === 'object') {
          try { await sr.entities[log.entity].create(log.row); } catch { /* audit best-effort */ }
        }
        return Response.json({ ok: true, updated, mirrored });
      }

      case 'emails.sendFollowup': {
        // Mission Control sends ONE renewal follow-up to a tenant (HMAC-gated,
        // service-role). MC owns the recipient + rendered content; the bridge
        // just sends via the app email integration and optionally logs it.
        const to = params.to;
        const subject = params.subject;
        const html = params.html;
        if (!to || !subject || !html) return Response.json({ error: 'params.to/subject/html required' }, { status: 400 });
        await sr.integrations.Core.SendEmail({ to, subject, body: html, from_name: 'ACACIA' });
        const sent_at = new Date().toISOString();
        const log = params.log;
        if (log && log.entity && log.row && typeof log.row === 'object') {
          try { await sr.entities[log.entity].create({ ...log.row, sent_at }); } catch { /* audit best-effort */ }
        }
        return Response.json({ ok: true, sent_at, recipient: to });
      }

      case 'tenants.contacts': {
        // Resolve recipient contacts for the app's tenants (read-only). MC passes
        // the per-app recipient spec: emails from fields on the license record, or
        // from a related entity (membership / school). Used to target campaigns.
        const entity = params.entity;
        const r = params.recipient || {};
        if (!entity) return Response.json({ error: 'params.entity required' }, { status: 400 });
        const records = await sr.entities[entity].list('-created_date', COUNT_CAP);
        const contacts = [];
        for (const rec of records) {
          let email = '';
          if (Array.isArray(r.fields)) {
            for (const f of r.fields) { if (rec[f]) { email = String(rec[f]); break; } }
          }
          if (!email && r.related && r.related.entity && r.related.keyField && r.related.emailField) {
            try {
              const key = r.related.keyFromRecord ? rec[r.related.keyFromRecord] : rec.id;
              const rows = await sr.entities[r.related.entity].filter({ [r.related.keyField]: key });
              // When roles are required, ONLY accept a row with an allowed role —
              // never fall back to an arbitrary (wrong-role) contact.
              let pick;
              if (Array.isArray(r.related.roles) && r.related.roleField) {
                pick = rows.find((x) => r.related.roles.includes(x[r.related.roleField])) || null;
              } else {
                pick = rows[0] || null;
              }
              if (pick) email = String(pick[r.related.emailField] || '');
            } catch { /* skip this record */ }
          }
          contacts.push({ id: rec.id, name: (r.nameField ? rec[r.nameField] : rec.name) || null, email: email || null });
        }
        return Response.json({ ok: true, contacts });
      }

      case 'usage.byTenant': {
        // Per-tenant consumption: count records of an entity grouped by its tenant
        // FK field. Privacy: returns ONLY { tenant id, count } — no record data.
        const entity = params.entity;
        const field = params.tenantField;
        if (!entity || !field) return Response.json({ error: 'params.entity/tenantField required' }, { status: 400 });
        try {
          const rows = await sr.entities[entity].list('-created_date', COUNT_CAP);
          const counts: Record<string, number> = {};
          for (const r of rows) {
            const k = r?.[field];
            if (k) counts[String(k)] = (counts[String(k)] ?? 0) + 1;
          }
          const top = Object.entries(counts)
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 50);
          return Response.json({ ok: true, entity, field, top, capped: rows.length >= COUNT_CAP });
        } catch (e) {
          return Response.json({ ok: true, top: [], note: (e as Error).message });
        }
      }

      case 'usage.tenantCount': {
        // Exact count for ONE tenant (optionally filtered by a second field,
        // e.g. active:true) — usage.byTenant only returns the top 50 tenants
        // portfolio-wide, so it can't be trusted to find any single tenant's
        // count (a tenant with a low count simply falls off that list). Used
        // by CateqHub's free-plan-cap downgrade decision in license-lifecycle
        // (Mission Control): does this parish have ≤ N active children?
        const entity = params.entity;
        const tenantField = params.tenantField;
        const tenantValue = params.tenantValue;
        if (!entity || !tenantField || tenantValue === undefined) {
          return Response.json({ error: 'params.entity/tenantField/tenantValue required' }, { status: 400 });
        }
        const filter: Record<string, unknown> = { [tenantField]: tenantValue };
        if (params.filterField !== undefined && params.filterValue !== undefined) {
          filter[params.filterField] = params.filterValue;
        }
        try {
          const rows = await sr.entities[entity].filter(filter);
          return Response.json({ ok: true, count: rows.length });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      }

      case 'tickets.list': {
        // List an app's support tickets (service-role). MC owns the per-app field
        // mapping; this returns the raw records. Read-only.
        const entity = params.entity;
        if (!entity) return Response.json({ error: 'params.entity required' }, { status: 400 });
        const records = await sr.entities[entity].list(params.order || '-created_date', COUNT_CAP);
        return Response.json({ ok: true, records });
      }

      case 'tickets.thread': {
        // Messages of one ticket, for apps with a SEPARATE message entity
        // (puntos/liuma). Rumbo stores the thread inline so MC never calls this.
        const messageEntity = params.messageEntity;
        const fkField = params.fkField;
        const ticketId = params.ticketId;
        if (!messageEntity || !fkField || !ticketId) return Response.json({ error: 'params.messageEntity/fkField/ticketId required' }, { status: 400 });
        const records = await sr.entities[messageEntity].filter({ [fkField]: ticketId });
        return Response.json({ ok: true, records });
      }

      case 'tickets.update': {
        // Reply to and/or change the status of a ticket (service-role, HMAC-gated).
        // MC owns the per-app shape: optionally create a message row (separate-entity
        // apps), optionally append to an inline array (rumbo `responses`), and patch
        // the ticket (status / activity / counters). Returns the updated row.
        const entity = params.entity;
        const id = params.id;
        if (!entity || !id) return Response.json({ error: 'params.entity/id required' }, { status: 400 });
        if (params.messageEntity && params.message && typeof params.message === 'object') {
          await sr.entities[params.messageEntity].create(params.message);
        }
        const patch = (params.patch && typeof params.patch === 'object') ? { ...params.patch } : {};
        if (params.appendField && params.appendItem && typeof params.appendItem === 'object') {
          // Append to an inline array on the ticket. Read the LIVE array first so a
          // concurrent customer reply isn't lost; fall back to MC's snapshot.
          let arr = null;
          try {
            const cur = await sr.entities[entity].get(id);
            if (Array.isArray(cur?.[params.appendField])) arr = cur[params.appendField];
          } catch { /* get unavailable — use the snapshot below */ }
          if (arr === null && Array.isArray(params.currentArray)) arr = params.currentArray;
          if (arr === null) arr = [];
          patch[params.appendField] = [...arr, params.appendItem];
        }
        const updated = Object.keys(patch).length ? await sr.entities[entity].update(id, patch) : null;
        return Response.json({ ok: true, updated });
      }

      case 'sessions.list': {
        // List this app's end-user sessions for Mission Control (service-role).
        // MC computes idle/state from last_active_at; here we just return the raw
        // rows, most-recently-active first. Read-only.
        const entity = params.entity;
        if (!entity) return Response.json({ error: 'params.entity required' }, { status: 400 });
        const records = await sr.entities[entity].list('-last_active_at', COUNT_CAP);
        return Response.json({ ok: true, records });
      }

      case 'sessions.revoke': {
        // Force-logout: mark the given sessions revoked (service-role, HMAC-gated).
        // The app's client checks its own row each heartbeat and logs out when
        // revoked_at is set. `actorEmail` is recorded for the in-app audit trail.
        const entity = params.entity;
        const ids = Array.isArray(params.ids) ? params.ids : [];
        const revokedBy = typeof params.actorEmail === 'string' ? params.actorEmail : null;
        if (!entity || ids.length === 0) return Response.json({ error: 'params.entity/ids required' }, { status: 400 });
        const revoked_at = new Date().toISOString();
        let revoked = 0;
        for (const id of ids) {
          try { await sr.entities[entity].update(id, { revoked_at, revoked_by: revokedBy }); revoked++; } catch { /* skip missing */ }
        }
        return Response.json({ ok: true, revoked });
      }

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
        const MAX_DELETE_ROUNDS = 1000; // salvaguarda contra un loop sin fin (p.ej. borrado lógico donde la fila sigue matcheando el filter)
        const deletedCounts: Record<string, number> = {};
        const incomplete: string[] = [];
        for (const spec of deleteEntities) {
          if (!spec || !spec.entity || !spec.field || spec.value === undefined) continue;
          // Todo el cuerpo del spec va en un try/catch: un nombre de entidad
          // desconocida/no desplegada no debe abortar los specs restantes del
          // arreglo (mismo principio best-effort que el bucle de mirror en
          // license.set, arriba). Si el spec falla a mitad de camino, lo que
          // ya se acumuló en deletedCounts para esa entidad se conserva —
          // ver el porqué de acumular DENTRO del loop, no solo al final.
          try {
            // filter() no trae un cap explícito documentado (a diferencia de
            // list(..., COUNT_CAP) usado en otras acciones de este archivo) —
            // en vez de asumir cuántas filas trae de una vez, se repite hasta
            // que ya no queden filas, así se borra todo sin importar el tope
            // de página real del SDK.
            for (let round = 0; round < MAX_DELETE_ROUNDS; round++) {
              const rows = await sr.entities[spec.entity].filter({ [spec.field]: spec.value });
              if (rows.length === 0) break;
              let deletedThisRound = 0;
              for (const row of rows) {
                try { await sr.entities[spec.entity].delete(row.id); deletedThisRound++; } catch { /* already gone or inaccessible, continue */ }
              }
              // Se acumula cada vuelta (no solo al final): si filter() lanza
              // en la vuelta siguiente, lo ya borrado en esta no se pierde
              // del reporte.
              deletedCounts[spec.entity] = (deletedCounts[spec.entity] ?? 0) + deletedThisRound;
              if (deletedThisRound === 0) {
                // delete() falló para todas las filas de esta vuelta (p.ej.
                // permisos) — reintentar para siempre no ayuda. Se marca
                // incompleto en vez de fingir que terminó: un borrado LFPDPPP
                // nunca debe reportar "listo" de más.
                incomplete.push(spec.entity);
                break;
              }
              if (round === MAX_DELETE_ROUNDS - 1) incomplete.push(spec.entity);
            }
          } catch (e) {
            incomplete.push(spec.entity);
          }
        }
        return Response.json({ ok: incomplete.length === 0, deletedCounts, incomplete });
      }

      default:
        return Response.json({ error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
