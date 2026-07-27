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
