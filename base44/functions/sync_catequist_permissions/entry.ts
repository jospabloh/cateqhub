import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Traduce el PermissionProfile (role_key:"catequist") de una parroquia a los
// campos perm_* del User, y los estampa en TODOS los catequistas de esa
// parroquia. Los campos perm_* son los que de verdad se checan en
// create_child/update_child/record_attendance/add_guardian — PermissionProfile
// sigue siendo la fuente de verdad que edita el admin en Permisos, esto solo
// mantiene sincronizada la copia por-usuario que la RLS/las funciones pueden
// leer sin tener que consultar otra entidad.
//
// DEFAULTS debe reflejar exactamente src/lib/permissionRegistry.js — si se
// agrega o cambia un permiso configurable ahí, actualiza también este mapa.
const DEFAULTS: Record<string, boolean> = {
  'ninos:ver_todos_los_grupos': false,
  'ninos:cambiar_grupo': false,
  'ninos:dar_de_baja': false,
  'escanear:cualquier_grupo': true,
  'reportes:ver_todos_los_grupos': false,
  'tutores:agregar': true,
};

function computeFlags(effective: Record<string, boolean>) {
  return {
    perm_ninos_ver_todos: !!effective['ninos:ver_todos_los_grupos'],
    perm_ninos_cambiar_grupo: !!effective['ninos:cambiar_grupo'],
    perm_ninos_dar_de_baja: !!effective['ninos:dar_de_baja'],
    // Invertidos a propósito — ver User.jsonc.
    perm_escanear_restringido: !effective['escanear:cualquier_grupo'],
    perm_tutores_restringido: !effective['tutores:agregar'],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const isPlatformAdmin = me.role === 'admin';
    const canManage = me.parish_role === 'admin' || isPlatformAdmin;
    if (!canManage) {
      return Response.json({ error: 'Solo un administrador de parroquia puede sincronizar permisos' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parish_id = body.parish_id || me.parish_id;
    if (!parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });
    if (!isPlatformAdmin && parish_id !== me.parish_id) {
      return Response.json({ error: 'No puedes sincronizar permisos de otra parroquia' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const profiles = await sr.entities.PermissionProfile.filter({ parish_id, role_key: 'catequist' });
    const effective = { ...DEFAULTS, ...(profiles?.[0]?.permissions || {}) };
    const flags = computeFlags(effective);

    const catequists = await sr.entities.User.filter({ parish_id, parish_role: 'catequist' });
    let updated = 0;
    for (const u of catequists) {
      await sr.entities.User.update(u.id, flags);
      updated++;
    }

    return Response.json({ ok: true, updated, flags });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
