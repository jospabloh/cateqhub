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

// Lo que queda escrito en un User al desvincularlo de su parroquia. Vive aquí,
// en una sola constante, porque ahora lo usan DOS caminos —que un admin te
// quite (`remove`) y que te vayas tú (`leave`)— y son la misma escritura: dos
// copias en línea se separan en cuanto alguien agregue un campo perm_*.
//
// Cadenas vacías, no null/undefined: `undefined` se cae del JSON y Base44 lo
// interpreta como "no toques este campo", no como "vacíalo", y `null` chocaría
// con el enum de parish_role. `parish_id: ''` no matchea el id de ninguna
// parroquia real, así que con eso solo ya queda cerrado el aislamiento por
// tenant en el resto de las entidades.
const DETACHED = {
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
};

// Módulo 18: Membership registra TODAS las parroquias a las que pertenece una
// cuenta; User.parish_id sigue siendo la única en la que está actuando ahora.
// Los dos se escriben juntos, aquí, porque una fila que no se mantiene es peor
// que no tener la entidad: el selector ofrecería parroquias de las que ya
// salió.
async function upsertMembership(sr, user, parish, parish_role: string) {
  const rows = await sr.entities.Membership.filter({ user_id: user.id }).catch(() => []);
  const existing = (rows || []).find((m) => m.parish_id === parish.id);
  const patch = {
    email: user.email || '',
    parish_name: parish.name || '',
    parish_role,
    active: true,
  };
  if (existing) return sr.entities.Membership.update(existing.id, patch);
  return sr.entities.Membership.create({ user_id: user.id, parish_id: parish.id, ...patch });
}

// Salir o ser removido NO borra la fila: se marca inactiva. Saber que alguien
// estuvo sirve para reincorporarlo, y un borrado real perdería ese rastro.
async function deactivateMembership(sr, userId: string, parishId: string) {
  const rows = await sr.entities.Membership.filter({ user_id: userId }).catch(() => []);
  for (const m of rows || []) {
    if (m.parish_id === parishId && m.active !== false) {
      await sr.entities.Membership.update(m.id, { active: false }).catch(() => {});
    }
  }
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

    const isPlatformAdmin = me.role === 'admin';
    const body = await req.json();

    // action: 'leave' — el llamante se va de su propia parroquia.
    //
    // Va ANTES del gate de administración a propósito, y es la razón de que el
    // orden de esta función cambiara: `canManage` responde 403 a cualquiera que
    // no sea admin, y quien más necesita irse es justo un catequista que dejó
    // de servir. Debajo del gate, esta acción habría quedado disponible sólo
    // para quien no la necesita. Tampoco pasa por el `if (!email)` de más
    // abajo: irse no lleva destinatario.
    if (body.action === 'leave') {
      if (!me.parish_id) {
        return Response.json({ error: 'No perteneces a ninguna parroquia' }, { status: 400 });
      }
      // Mismo gate que quitar y que degradar: irse siendo el último
      // administrador deja la parroquia sin quién la administre, y este app no
      // tiene camino de vuelta. Se le pide nombrar sucesor, que es justo lo que
      // hace la acción de abajo.
      if (me.parish_role === 'admin'
          && await wouldLeaveNoAdmin(base44.asServiceRole, me.parish_id, me.id)) {
        return Response.json({
          error: 'Eres el único administrador. Transfiere la administración a otro miembro antes de salir.',
          code: 'last_admin',
        }, { status: 409 });
      }
      await deactivateMembership(base44.asServiceRole, me.id, me.parish_id);
      await base44.asServiceRole.entities.User.update(me.id, DETACHED);
      return Response.json({ left: true });
    }

    const canManage = me.parish_role === 'admin' || isPlatformAdmin;
    if (!canManage) {
      return Response.json({ error: 'Solo un administrador de parroquia puede asignar usuarios' }, { status: 403 });
    }

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

    // ── Módulo 7, segundo alcance ────────────────────────────────────────
    //
    // Hasta 2026-09-08 el danger zone sólo cubría "borrar la parroquia". Faltaba
    // el otro alcance entero, y no era simetría de catálogo: `remove` bloquea
    // quitarte a ti mismo y te remite a "pide a otro administrador que lo haga",
    // lo cual deja SIN SALIDA al único administrador —y a cualquiera cuyo admin
    // ya no esté—. Un catequista que deja de servir en la parroquia se quedaba
    // dentro para siempre, viendo datos de menores.
    //
    // Las dos acciones re-derivan actor y objetivo del registro ALMACENADO del
    // llamante, nunca del cuerpo: `me.id` viene del token y el resto se lee con
    // rol de servicio. El cuerpo sólo aporta a QUIÉN se transfiere, y ese
    // usuario se valida contra la parroquia del propio llamante.

    // action: 'transfer_admin' — el llamante nombra administrador a otro
    // miembro de SU parroquia y se queda como catequista. Es la salida del
    // último administrador, así que el orden importa: primero se promueve al
    // sucesor y sólo si esa escritura salió bien se degrada el llamante. Al
    // revés, un fallo a medias deja la parroquia sin ningún administrador, que
    // es exactamente lo que todo esto existe para impedir.
    if (body.action === 'transfer_admin') {
      const isParishAdmin = me.parish_role === 'admin' || isPlatformAdmin;
      if (!isParishAdmin || !me.parish_id) {
        return Response.json({ error: 'Solo un administrador de parroquia puede transferir la administración' }, { status: 403 });
      }
      if (!email) return Response.json({ error: 'Correo requerido' }, { status: 400 });

      const found = await base44.asServiceRole.entities.User.filter({ email });
      const successor = found?.[0];
      if (!successor) return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
      // Contra el registro almacenado del sucesor, no contra el cuerpo: sólo se
      // puede transferir a alguien que YA es miembro de esta misma parroquia.
      if (successor.parish_id !== me.parish_id) {
        return Response.json({ error: 'Ese usuario no pertenece a tu parroquia' }, { status: 403 });
      }
      if (successor.id === me.id) {
        return Response.json({ error: 'Ya eres administrador de esta parroquia' }, { status: 400 });
      }

      const ownParish = await base44.asServiceRole.entities.Parish.get(me.parish_id).catch(() => null);
      await base44.asServiceRole.entities.User.update(successor.id, { parish_role: 'admin', group_id: '' });
      if (ownParish) await upsertMembership(base44.asServiceRole, successor, ownParish, 'admin');
      // El llamante baja a catequista sólo después. Si esto falla, la parroquia
      // queda con DOS administradores —un estado válido y reversible a mano—,
      // nunca con cero.
      await base44.asServiceRole.entities.User.update(me.id, { parish_role: 'catequist' });
      if (ownParish) await upsertMembership(base44.asServiceRole, me, ownParish, 'catequist');
      return Response.json({ transferred: true, to: { id: successor.id, email: successor.email } });
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
      await deactivateMembership(base44.asServiceRole, targetUser.id, targetUser.parish_id);
      await base44.asServiceRole.entities.User.update(targetUser.id, DETACHED);

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
    await upsertMembership(sr, target, targetParish, parish_role);

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