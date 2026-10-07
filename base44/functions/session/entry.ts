import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { licenseMirrorPatch } from './licenseMirror.ts';

// Módulo 20 del estándar, capas 1 y 2. Un solo endpoint con router de acciones
// porque es lo que invoca el hook compartido (`base44.functions.invoke('session',
// { action, … })` en src/hooks/useSessionManager.js, idéntico en todo el
// portafolio) — y porque tres endpoints separados gastarían tres de los 40
// slots de Base44 para lo mismo.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Módulo 22, el mismo bloque literal que las otras 14 funciones — ver
    // tests/unit/freshCallerRead.test.js, que exige que sea idéntico.
    const session = await base44.auth.me();
    if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
    const stored = await base44.asServiceRole.entities.User.filter({ id: session.id }).catch(() => null);
    const me = stored?.[0];
    if (!me) return Response.json({ error: 'No se pudo verificar tu cuenta, intenta de nuevo' }, { status: 500 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const nowIso = new Date().toISOString();

    // ── manageSession ────────────────────────────────────────────────────
    // Encuentra-o-crea la fila de (usuario, dispositivo), la marca `active` y
    // baja a `passive` las DEMÁS sesiones activas del mismo usuario. Eso es la
    // capa 2: se puede estar en varios equipos a la vez, pero la app siempre
    // sabe cuál es el actual y puede enseñar los otros para revisarlos.
    if (action === 'manageSession') {
      // Repara el espejo de licencia si le falta (ver licenseMirror.ts). Mejor
      // esfuerzo: un fallo aquí jamás debe impedir abrir una sesión.
      if (me.parish_id) {
        try {
          const parish = await sr.entities.Parish.get(me.parish_id).catch(() => null);
          const patch = licenseMirrorPatch(me, parish);
          if (patch) await sr.entities.User.update(me.id, patch);
        } catch (_e) { /* best-effort */ }
      }

      const device_id = String(body.device_id || '').trim();
      if (!device_id) return Response.json({ error: 'device_id requerido' }, { status: 400 });
      const device_name = String(body.device_name || '').slice(0, 120);

      const mine = await sr.entities.Session.filter({ user_id: me.id });
      const existing = (mine || []).find((s) => s.device_id === device_id);

      // Una sesión ya revocada NO se reactiva sola al recargar la pestaña: si
      // lo hiciera, el reaper y la revocación remota no servirían de nada —
      // bastaría con un F5 para volver a entrar.
      if (existing?.status === 'revoked') {
        return Response.json({ error: 'Sesión cerrada' }, { status: 403 });
      }

      const row = existing
        ? await sr.entities.Session.update(existing.id, { status: 'active', last_seen: nowIso, device_name })
        : await sr.entities.Session.create({
            user_id: me.id,
            // Del registro almacenado del llamante, nunca del cuerpo.
            parish_id: me.parish_id || '',
            device_id,
            device_name,
            status: 'active',
            last_seen: nowIso,
          });

      for (const other of mine || []) {
        if (other.id !== row.id && other.status === 'active') {
          await sr.entities.Session.update(other.id, { status: 'passive' }).catch(() => {});
        }
      }

      return Response.json({ session: { id: row.id, status: row.status ?? 'active' } });
    }

    // ── sessionHeartbeat ─────────────────────────────────────────────────
    // Mueve last_seen y devuelve el estado. Esta lectura es lo que hace que la
    // capa 3 exista de verdad: revocar del lado del servidor no cambia nada
    // hasta que el siguiente latido lo lee de vuelta.
    if (action === 'sessionHeartbeat') {
      const session_id = String(body.session_id || '').trim();
      if (!session_id) return Response.json({ error: 'session_id requerido' }, { status: 400 });

      const found = await sr.entities.Session.get(session_id).catch(() => null);
      // Contra el registro almacenado: la sesión tiene que ser de quien llama.
      // Sin esto, un session_id adivinado movería el latido de otra persona.
      if (!found || found.user_id !== me.id) {
        return Response.json({ error: 'Sesión no encontrada' }, { status: 403 });
      }
      if (found.status === 'revoked') {
        return Response.json({ status: 'revoked' }, { status: 403 });
      }

      await sr.entities.Session.update(session_id, { last_seen: nowIso });
      return Response.json({ status: found.status ?? 'active' });
    }

    // ── trackActivity ────────────────────────────────────────────────────
    // Señal de uso, no latido. useActivityTracker la acota a una por hora.
    if (action === 'trackActivity') {
      const mine = await sr.entities.Session.filter({ user_id: me.id });
      const current = (mine || []).find((s) => s.status === 'active');
      if (current) await sr.entities.Session.update(current.id, { last_activity_at: nowIso }).catch(() => {});
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Acción no reconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
