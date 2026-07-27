import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Child.update está bloqueado a user_condition:{role:admin} en Child.jsonc —
// las dos únicas acciones que el frontend hace sobre un niño existente
// (cambiar de grupo/libro, dar de baja/reactivar) pasan por aquí, para
// aplicar de verdad los permisos ninos:cambiar_grupo y ninos:dar_de_baja que
// antes solo ocultaban el botón en la interfaz.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (!me.parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    const body = await req.json();
    const { child_id, action, group_id } = body;
    if (!child_id || !action) return Response.json({ error: 'child_id y action requeridos' }, { status: 400 });

    const sr = base44.asServiceRole;
    const child = await sr.entities.Child.get(child_id).catch(() => null);
    if (!child || child.parish_id !== me.parish_id) {
      return Response.json({ error: 'Niño no encontrado en tu parroquia' }, { status: 404 });
    }

    const isAdmin = me.role === 'admin' || me.parish_role === 'admin';
    let patch: Record<string, unknown>;

    if (action === 'toggle_active') {
      if (!isAdmin && !me.perm_ninos_dar_de_baja) {
        return Response.json({ error: 'No tienes permiso para dar de baja o reactivar niños' }, { status: 403 });
      }
      patch = { active: !child.active };
    } else if (action === 'change_group') {
      if (!group_id) return Response.json({ error: 'group_id requerido' }, { status: 400 });
      if (!isAdmin && !me.perm_ninos_cambiar_grupo) {
        return Response.json({ error: 'No tienes permiso para cambiar el grupo/libro de un niño' }, { status: 403 });
      }
      const group = await sr.entities.Group.get(group_id).catch(() => null);
      if (!group || group.parish_id !== me.parish_id) {
        return Response.json({ error: 'Grupo/libro inválido' }, { status: 400 });
      }
      patch = { group_id, group_changed_at: new Date().toISOString() };
    } else {
      return Response.json({ error: `action desconocida: ${action}` }, { status: 400 });
    }

    const updated = await sr.entities.Child.update(child_id, patch);
    return Response.json({ ok: true, child: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
