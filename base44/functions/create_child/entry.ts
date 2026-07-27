import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Crea un niño con rol de servicio. Child.create está bloqueado a
// user_condition:{role:admin} en Child.jsonc — este función es el único
// camino, para poder aplicar el mismo permiso "ver todos los grupos/libros"
// que hoy solo se aplicaba en el cliente (un catequista restringido podía
// llamar Child.create directo con cualquier group_id de su parroquia).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (!me.parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    const body = await req.json();
    const name = (body.name || '').trim();
    const birth_date = body.birth_date || undefined;
    const curp = body.curp || undefined;
    const group_id = body.group_id;

    if (!name) return Response.json({ error: 'Nombre requerido' }, { status: 400 });
    if (!group_id) return Response.json({ error: 'Grupo/libro requerido' }, { status: 400 });

    const sr = base44.asServiceRole;
    const isAdmin = me.role === 'admin' || me.parish_role === 'admin';

    const group = await sr.entities.Group.get(group_id).catch(() => null);
    if (!group || group.parish_id !== me.parish_id) {
      return Response.json({ error: 'Grupo/libro inválido' }, { status: 400 });
    }

    // Permiso ninos:ver_todos_los_grupos — si no lo tiene, solo puede dar de
    // alta niños en su propio grupo/libro asignado.
    if (!isAdmin && !me.perm_ninos_ver_todos && group_id !== me.group_id) {
      return Response.json({ error: 'Solo puedes registrar niños en tu propio grupo/libro' }, { status: 403 });
    }

    const child = await sr.entities.Child.create({
      parish_id: me.parish_id,
      name,
      birth_date,
      curp,
      group_id,
      qr_token: crypto.randomUUID(),
      active: true,
    });

    return Response.json({ ok: true, child });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
