import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    const sr = base44.asServiceRole;
    const parish = await sr.entities.Parish.create({ name, admin_contact, active: true });
    await sr.entities.User.update(me.id, { parish_id: parish.id, parish_role: 'admin' });

    return Response.json({ parish });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
