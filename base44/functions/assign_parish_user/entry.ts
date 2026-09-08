import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// DEFAULTS/computeFlags deben reflejar exactamente
// sync_catequist_permissions/entry.ts (que a su vez refleja
// src/lib/permissionRegistry.js) — se duplica aquí porque las funciones de
// Base44 no comparten módulos entre sí.
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
    perm_escanear_restringido: !effective['escanear:cualquier_grupo'],
    perm_tutores_restringido: !effective['tutores:agregar'],
  };
}

// Una parroquia que se queda sin ningún administrador no tiene camino de vuelta:
// nadie puede invitar, editar permisos, exportar datos ni solicitar la baja, y
// este app todavía no tiene transferencia de administración (módulo 7 del
// estándar). El único remedio sería el panel de Base44 a mano.
//
// Por eso QUITAR y DEGRADAR pasan por el mismo gate en vez de dos que puedan
// derivar: son la misma operación con la dirección cambiada. Hasta 2026-09-08
// el candado vivía solo en la rama `action:'remove'`, así que el botón "Editar"
// de Users.jsx podía dejar la parroquia sin administrador — incluso el propio
// admin sobre su propia ficha.
//
// Cuenta contra los administradores REALES de la parroquia, leídos con rol de
// servicio, nunca contra lo que diga el cuerpo de la petición. `parish_id` es
// siempre el del registro ALMACENADO del objetivo, no el del cuerpo: un admin
// de plataforma puede mandar otra parroquia, y contar los administradores de
// una parroquia distinta a la que se está tocando no responde la pregunta.
type ServiceRole = {
  entities: { User: { filter: (q: Record<string, unknown>) => Promise<Array<{ id: string }>> } };
};
async function wouldLeaveNoAdmin(sr: ServiceRole, parish_id: string, targetId: string) {
  const admins = await sr.entities.User.filter({ parish_id, parish_role: 'admin' });
  return (admins || []).filter((u) => u.id !== targetId).length === 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const isPlatformAdmin = me.role === 'admin';
    const canManage = me.parish_role === 'admin' || isPlatformAdmin;
    if (!canManage) {
      return Response.json({ error: 'Solo un administrador de parroquia puede asignar usuarios' }, { status: 403 });
    }

    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const parish_id = body.parish_id || me.parish_id;
    const parish_role = body.parish_role || 'catequist';
    const group_id = parish_role === 'catequist' ? (body.group_id || undefined) : undefined;

    if (!email) return Response.json({ error: 'Correo requerido' }, { status: 400 });
    if (!parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    // Aislamiento por tenant: un admin de parroquia solo opera en su propia parroquia.
    if (!isPlatformAdmin && parish_id !== me.parish_id) {
      return Response.json({ error: 'No puedes asignar usuarios a otra parroquia' }, { status: 403 });
    }

    // action: 'remove' — desvincula al usuario de la parroquia (module 7:
    // Users.jsx podía invitar/asignar/editar pero nunca quitar a nadie).
    // No borra la cuenta de plataforma del usuario, solo su membresía en
    // esta parroquia — mismo alcance que el resto de las acciones de esta
    // función, que ya solo tocan el espejo `parish_*` en User, no la cuenta.
    if (body.action === 'remove') {
      const usersToRemove = await base44.asServiceRole.entities.User.filter({ email });
      const targetUser = usersToRemove?.[0];
      if (!targetUser) return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
      if (!isPlatformAdmin && targetUser.parish_id !== me.parish_id) {
        return Response.json({ error: 'Ese usuario no pertenece a tu parroquia' }, { status: 403 });
      }
      if (targetUser.id === me.id) {
        return Response.json({ error: 'No puedes quitarte a ti mismo. Pide a otro administrador que lo haga.' }, { status: 400 });
      }
      if (targetUser.parish_role === 'admin'
          && await wouldLeaveNoAdmin(base44.asServiceRole, targetUser.parish_id, targetUser.id)) {
        return Response.json({ error: 'No puedes quitar al último administrador de la parroquia' }, { status: 409 });
      }

      // Cadenas vacías, no null/undefined: undefined se cae del JSON (Base44
      // lo interpretaría como "no tocar este campo", no como "vaciarlo"), y
      // null podría chocar con el enum de parish_role. parish_id="" no
      // matchea el id de ninguna parroquia real, así que el aislamiento por
      // tenant en el resto de las entidades ya queda cerrado con eso solo.
      await base44.asServiceRole.entities.User.update(targetUser.id, {
        parish_id: '',
        group_id: '',
        parish_role: '',
        parish_plan: '',
        parish_license_status: '',
        parish_support_priority_addon: false,
        perm_ninos_ver_todos: false,
        perm_ninos_cambiar_grupo: false,
        perm_ninos_dar_de_baja: false,
        perm_escanear_restringido: false,
        perm_tutores_restringido: false,
      });

      return Response.json({ removed: true, user: { id: targetUser.id, email: targetUser.email } });
    }

    // El rol de plataforma NO se toca: los invitados siempre son `user` de plataforma.
    // El rol dentro del tenant se guarda en `parish_role`.
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      return Response.json({
        found: false,
        assigned: false,
        message: 'El usuario aún no ha registrado su cuenta. Pídele que acepte la invitación y vuelve a intentarlo.',
      });
    }

    const target = users[0];

    // Prevenir secuestro de cuentas cross-tenant: un admin de parroquia no puede
    // reasociar un usuario que ya pertenece a otra parroquia. Solo un admin de
    // plataforma puede mover usuarios entre parroquias.
    if (!isPlatformAdmin && target.parish_id && target.parish_id !== parish_id) {
      return Response.json({
        found: true,
        assigned: false,
        message: 'El usuario ya pertenece a otra parroquia. Solo un administrador de plataforma puede reasociarlo.',
      }, { status: 403 });
    }

    const sr = base44.asServiceRole;

    // Degradar es quitar con otro nombre, así que pasa por el mismo gate. Un
    // administrador deja de serlo de su parroquia actual de dos maneras, y las
    // dos cuentan: se le cambia el rol ahí mismo, o un admin de plataforma lo
    // mueve a otra parroquia (la de origen se queda igual de huérfana). Todo se
    // evalúa contra `target.parish_id` —el registro almacenado— porque es el
    // único que dice de qué parroquia es administrador HOY.
    const leavesAdminPost = target.parish_role === 'admin' && !!target.parish_id
      && (parish_role !== 'admin' || parish_id !== target.parish_id);
    if (leavesAdminPost && await wouldLeaveNoAdmin(sr, target.parish_id, target.id)) {
      return Response.json({
        error: 'No puedes dejar a la parroquia sin administrador. Nombra a otro administrador antes de cambiar este rol.',
      }, { status: 409 });
    }

    // Espejar plan/license_status vigentes de la parroquia en el usuario
    // recién asignado — Guardian/ChildGuardian RLS los lee de aquí (Base44
    // RLS no puede hacer lookup a Parish directamente). Sin esto, un
    // catequista invitado después de que la parroquia ya tenía Premium
    // arrancaría con el espejo vacío y quedaría bloqueado de más.
    //
    // Falla cerrado a propósito: si Parish.get falla, NO asumimos 'free'/
    // 'active' (los valores más permisivos) — eso dejaría entrar a un
    // catequista con acceso a Tutores en una parroquia que en realidad está
    // access_denied, por un simple error transitorio de red. Se aborta la
    // asignación completa y se le pide reintentar.
    const targetParish = await sr.entities.Parish.get(parish_id).catch(() => null);
    if (!targetParish) {
      return Response.json({ error: 'No se pudo leer la parroquia para asignar el usuario, intenta de nuevo' }, { status: 500 });
    }

    let permFlags = {};
    if (parish_role === 'catequist') {
      const profiles = await sr.entities.PermissionProfile.filter({ parish_id, role_key: 'catequist' });
      const effective = { ...DEFAULTS, ...(profiles?.[0]?.permissions || {}) };
      permFlags = computeFlags(effective);
    }

    await sr.entities.User.update(target.id, {
      parish_id,
      group_id,
      parish_role,
      parish_plan: targetParish.plan ?? 'free',
      parish_license_status: targetParish.license_status ?? 'active',
      parish_support_priority_addon: targetParish.support_priority_addon ?? false,
      ...permFlags,
    });

    return Response.json({
      found: true,
      assigned: true,
      user: {
        id: target.id,
        email: target.email,
        name: target.full_name,
        parish_role,
        group_id,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});