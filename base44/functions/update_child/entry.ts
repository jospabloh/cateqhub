import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Child.update está bloqueado a user_condition:{role:admin} en Child.jsonc —
// las dos únicas acciones que el frontend hace sobre un niño existente
// (cambiar de grupo/libro, dar de baja/reactivar) pasan por aquí, para
// aplicar de verdad los permisos ninos:cambiar_grupo y ninos:dar_de_baja que
// antes solo ocultaban el botón en la interfaz.
//
// Duplicado de src/lib/premium.js FREE_PLAN_CHILD_CAP — los functions de
// Base44 no pueden importar de src/. Si cambia, cambia también ahí.
const FREE_PLAN_CHILD_CAP = 50;
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Módulo 22 del estándar. `auth.me()` sirve para IDENTIDAD (quién llama),
    // nunca para los campos server-authoritative que deciden una escritura:
    // parish_id, parish_role y role sólo los escribe una función de servicio, y
    // la vista de la sesión está cacheada — puede discrepar de lo persistido.
    // En rumbo eso hizo que switchTenant devolviera ok:true saltándose la
    // escritura durante días, y ese fallo no da error: da un éxito falso.
    //
    // Aquí no hay ningún diff-then-skip, pero sí el caso del punto 3 del
    // módulo: de `me.parish_id` cuelga el ACOTAMIENTO de toda la operación, y
    // una lectura rancia ahí no se salta una escritura — la dirige contra la
    // parroquia equivocada.
    //
    // Falla cerrado: si no se puede releer la cuenta, se aborta. Volver a la
    // vista cacheada como respaldo sería reintroducir exactamente el problema.
    const session = await base44.auth.me();
    if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
    const stored = await base44.asServiceRole.entities.User.filter({ id: session.id }).catch(() => null);
    const me = stored?.[0];
    if (!me) return Response.json({ error: 'No se pudo verificar tu cuenta, intenta de nuevo' }, { status: 500 });
    if (!me.parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    const body = await req.json();
    const { child_id, action, group_id } = body;
    if (!child_id || !action) return Response.json({ error: 'child_id y action requeridos' }, { status: 400 });

    const sr = base44.asServiceRole;
    const child = await sr.entities.Child.get(child_id).catch(() => null);
    if (!child || child.parish_id !== me.parish_id) {
      return Response.json({ error: 'Niño no encontrado en tu parroquia' }, { status: 404 });
    }

    const parish = await sr.entities.Parish.get(me.parish_id).catch(() => null);
    if (!parish) return Response.json({ error: 'No se pudo verificar tu parroquia, intenta de nuevo' }, { status: 500 });
    if (parish.plan === 'premium' && parish.license_status && parish.license_status !== 'active') {
      return Response.json({ error: 'Tu período de prueba o pago está pendiente', code: 'license_not_active' }, { status: 403 });
    }

    const isAdmin = me.role === 'admin' || me.parish_role === 'admin';
    let patch: Record<string, unknown>;

    if (action === 'toggle_active') {
      if (!isAdmin && !me.perm_ninos_dar_de_baja) {
        return Response.json({ error: 'No tienes permiso para dar de baja o reactivar niños' }, { status: 403 });
      }
      // Reactivar en plan Gratis también cuenta contra el tope de niños
      // activos — si no, dar de baja y reactivar sería una forma de
      // rodear el límite del alta.
      if (!child.active && parish.plan !== 'premium') {
        const activeChildren = await sr.entities.Child.filter({ parish_id: me.parish_id, active: true });
        if (activeChildren.length >= FREE_PLAN_CHILD_CAP) {
          return Response.json({
            error: `Tu parroquia alcanzó el límite de ${FREE_PLAN_CHILD_CAP} niños activos del plan Gratis — activa Premium para reactivar más`,
            code: 'free_plan_cap_reached',
          }, { status: 403 });
        }
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
