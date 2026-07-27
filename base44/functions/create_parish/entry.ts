import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Debe coincidir con DATA_PROCESSING_TERMS_VERSION en src/lib/legal.js —
// Base44 functions no pueden importar de src/, así que este valor se
// duplica a propósito. Súbelo en el mismo commit que el de src/lib/legal.js.
const DATA_PROCESSING_TERMS_VERSION = '2026-07-27';

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
    const now = new Date();
    const nowIso = now.toISOString();
    // Toda parroquia nueva arranca con 30 días de prueba Premium completa (todo
    // el núcleo + Tutores/mensajería/tareas/pulseras) — ya no hay plan gratuito
    // permanente. Si no se confirma un pago antes de que venza
    // premium_period_end_at, el cron license-lifecycle de Mission Control
    // arranca el mismo ciclo active → read_only → access_denied →
    // deletion_eligible que ya existía para pagos vencidos, ahora aplicado a
    // toda la app.
    const trialEnd = new Date(now.getTime());
    trialEnd.setUTCDate(trialEnd.getUTCDate() + 30);
    const parish = await sr.entities.Parish.create({
      name,
      admin_contact,
      active: true,
      plan: 'premium',
      license_status: 'active',
      premium_period_end_at: trialEnd.toISOString(),
      data_processing_accepted_at: nowIso,
      data_processing_accepted_by: me.email,
      data_processing_terms_version: DATA_PROCESSING_TERMS_VERSION,
    });
    await sr.entities.User.update(me.id, {
      parish_id: parish.id,
      parish_role: 'admin',
      parish_plan: 'premium',
      parish_license_status: 'active',
    });

    return Response.json({ parish });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
