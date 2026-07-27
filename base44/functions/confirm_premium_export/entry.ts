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
