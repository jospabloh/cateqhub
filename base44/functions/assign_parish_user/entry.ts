import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  checkRequestDecision,
  generateJoinCode,
  normalizeJoinCode,
  resolveApprovalRole,
} from './joinRequests.ts';

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

type Sr = ReturnType<typeof createClientFromRequest>['asServiceRole'];

// Lo que se escribe en un User al meterlo a una parroquia: parish_id/parish_role
// más el espejo de licencia y las banderas de permisos. Lo comparten los DOS
// caminos que dan acceso —el alta directa del administrador y la aprobación de
// una solicitud— porque son la misma escritura; dos copias se separan.
//
// Espejar plan/license_status vigentes de la parroquia — Guardian/ChildGuardian
// RLS los lee de aquí (Base44 RLS no puede hacer lookup a Parish). Falla
// cerrado a propósito: el llamante ya leyó la parroquia y aborta si no pudo, en
// vez de asumir los valores más permisivos.
async function membershipPatch(
  sr: Sr,
  parish: { id: string; plan?: string; license_status?: string; support_priority_addon?: boolean },
  parish_role: string,
  group_id: string | undefined,
) {
  let permFlags = {};
  if (parish_role === 'catequist') {
    const profiles = await sr.entities.PermissionProfile.filter({ parish_id: parish.id, role_key: 'catequist' });
    const effective = { ...DEFAULTS, ...(profiles?.[0]?.permissions || {}) };
    permFlags = computeFlags(effective);
  }
  return {
    parish_id: parish.id,
    group_id,
    parish_role,
    parish_plan: parish.plan ?? 'free',
    parish_license_status: parish.license_status ?? 'active',
    parish_support_priority_addon: parish.support_priority_addon ?? false,
    ...permFlags,
  };
}

// Cierra las solicitudes pendientes de alguien que acaba de entrar a una
// parroquia por otro camino (alta directa del administrador): las de ESA
// parroquia quedan aprobadas —ya tiene acceso, y el administrador lo decidió—
// y las de otra se cancelan, porque una cuenta sólo pertenece a una. Best
// effort: el acceso ya se otorgó y una solicitud colgada no lo revierte.
async function settlePendingRequests(sr: Sr, userId: string, parishId: string, decidedBy: string, role: string) {
  try {
    const pending = await sr.entities.JoinRequest.filter({ user_id: userId, status: 'pending' });
    for (const r of pending || []) {
      const same = r.parish_id === parishId;
      await sr.entities.JoinRequest.update(r.id, same
        ? { status: 'approved', decided_by: decidedBy, decided_at: new Date().toISOString(), parish_role_assigned: role }
        : { status: 'cancelled', decided_by: decidedBy, decided_at: new Date().toISOString() });
    }
  } catch (e) {
    console.error('settlePendingRequests failed', e);
  }
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const safeRequest = (r: Record<string, unknown>) => ({
  id: r.id,
  parish_id: r.parish_id,
  parish_name: r.parish_name,
  user_id: r.user_id,
  user_email: r.user_email,
  user_name: r.user_name,
  status: r.status,
  reject_reason: r.reject_reason,
  created_date: r.created_date,
});

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
      await base44.asServiceRole.entities.User.update(me.id, DETACHED);
      return Response.json({ left: true });
    }

    // ── Unirse con código: una SOLICITUD, no acceso ──────────────────────────
    //
    // El código de la parroquia sólo abre una solicitud PENDIENTE. Mientras
    // esté pendiente la persona no tiene parish_id, así que la RLS (que compara
    // contra él) no le enseña ningún dato. El acceso se otorga únicamente en
    // `approve_request`, con un administrador de esa parroquia eligiendo el rol.
    // Por eso estas tres acciones van antes del gate de administración —quien
    // las usa todavía no es de ninguna parroquia— y NINGUNA escribe el User.
    if (body.action === 'join') {
      if (me.parish_id) {
        return Response.json({ error: 'Ya perteneces a una parroquia', code: 'already_in_parish' }, { status: 409 });
      }
      const code = normalizeJoinCode(body.code);
      if (!code) {
        return Response.json({ error: 'Escribe el código completo (8 caracteres, por ejemplo ABCD-EFGH)', code: 'invalid_code' }, { status: 400 });
      }
      const sr = base44.asServiceRole;
      const parish = (await sr.entities.Parish.filter({ join_code: code }))?.[0];
      // Inexistente, mal escrito o de una parroquia dada de baja: mismo mensaje,
      // para que el endpoint no confirme qué códigos existen.
      if (!parish || parish.active === false) {
        return Response.json({ error: 'Código no válido. Pídele a tu administrador que te lo confirme.', code: 'invalid_code' }, { status: 404 });
      }
      const pending = (await sr.entities.JoinRequest.filter({ user_id: me.id, status: 'pending' }))?.[0];
      if (pending) {
        if (pending.parish_id === parish.id) {
          return Response.json({ request: safeRequest(pending), existing: true });
        }
        return Response.json({
          error: 'Ya tienes una solicitud pendiente en otra parroquia. Cancélala antes de pedir acceso a esta.',
          code: 'pending_elsewhere',
        }, { status: 409 });
      }
      const created = await sr.entities.JoinRequest.create({
        parish_id: parish.id,
        parish_name: parish.name || '',
        user_id: me.id,
        user_email: (me.email || '').toLowerCase(),
        user_name: me.full_name || '',
        status: 'pending',
      });
      return Response.json({ request: safeRequest(created) });
    }

    // La pantalla "Solicitud enviada, esperando aprobación" lee esto, no un
    // estado local de React: así sobrevive a recargar y a cambiar de dispositivo.
    if (body.action === 'join_status') {
      if (me.parish_id) return Response.json({ joined: true });
      const latest = (await base44.asServiceRole.entities.JoinRequest.filter({ user_id: me.id }, '-created_date', 1))?.[0];
      return Response.json({ joined: false, request: latest ? safeRequest(latest) : null });
    }

    if (body.action === 'cancel_join_request') {
      const sr = base44.asServiceRole;
      const pending = (await sr.entities.JoinRequest.filter({ user_id: me.id, status: 'pending' }))?.[0];
      if (!pending) return Response.json({ cancelled: false });
      await sr.entities.JoinRequest.update(pending.id, { status: 'cancelled', decided_at: new Date().toISOString() });
      return Response.json({ cancelled: true });
    }

    const canManage = me.parish_role === 'admin' || isPlatformAdmin;
    if (!canManage) {
      return Response.json({ error: 'Solo un administrador de parroquia puede asignar usuarios' }, { status: 403 });
    }

    // ── Solicitudes y código de la parroquia (sólo administradores) ─────────
    //
    // La parroquia sale de la cuenta ALMACENADA del administrador; el cuerpo
    // sólo puede nombrar otra si quien llama es admin de plataforma.
    if (body.action === 'join_code' || body.action === 'list_join_requests'
        || body.action === 'approve_request' || body.action === 'reject_request') {
      const sr = base44.asServiceRole;

      if (body.action === 'join_code') {
        const pid = isPlatformAdmin && body.parish_id ? body.parish_id : me.parish_id;
        if (!pid) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });
        const parish = await sr.entities.Parish.get(pid).catch(() => null);
        if (!parish) return Response.json({ error: 'No se pudo leer la parroquia, intenta de nuevo' }, { status: 500 });
        if (parish.join_code && body.regenerate !== true) return Response.json({ join_code: parish.join_code });
        // Único entre parroquias: si choca (improbable con 31^8), se reintenta.
        let code = '';
        for (let i = 0; i < 5 && !code; i++) {
          const candidate = generateJoinCode(randomBytes);
          const clash = await sr.entities.Parish.filter({ join_code: candidate });
          if (!clash?.length) code = candidate;
        }
        if (!code) return Response.json({ error: 'No se pudo generar el código, intenta de nuevo' }, { status: 500 });
        await sr.entities.Parish.update(pid, { join_code: code });
        return Response.json({ join_code: code, regenerated: !!parish.join_code });
      }

      if (body.action === 'list_join_requests') {
        const pid = isPlatformAdmin && body.parish_id ? body.parish_id : me.parish_id;
        if (!pid) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });
        const pending = await sr.entities.JoinRequest.filter({ parish_id: pid, status: 'pending' });
        return Response.json({ requests: (pending || []).map(safeRequest) });
      }

      // approve_request / reject_request: se relee la solicitud GUARDADA y se
      // valida contra la parroquia del administrador; nada del cuerpo decide a
      // quién ni a qué parroquia.
      const request = (await sr.entities.JoinRequest.filter({ id: String(body.request_id || '') }))?.[0];
      const gate = checkRequestDecision(request, { parishId: me.parish_id, isPlatformAdmin });
      if (!gate.ok) return Response.json({ error: gate.error, code: gate.code }, { status: gate.status });
      const decidedAt = new Date().toISOString();

      if (body.action === 'reject_request') {
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
        await sr.entities.JoinRequest.update(request.id, {
          status: 'rejected', decided_by: me.email, decided_at: decidedAt, reject_reason: reason,
        });
        return Response.json({ rejected: true });
      }

      // approve_request. El rol lo ELIGE el administrador, de la lista blanca.
      const role = resolveApprovalRole(body.parish_role);
      if (!role) {
        return Response.json({ error: 'Elige el rol del usuario: administrador o catequista', code: 'invalid_role' }, { status: 400 });
      }
      const applicant = (await sr.entities.User.filter({ id: request.user_id }))?.[0];
      if (!applicant) return Response.json({ error: 'La cuenta que pidió acceso ya no existe' }, { status: 404 });
      // Una cuenta sólo pertenece a una parroquia. Si entre la solicitud y la
      // aprobación ya entró a otra (o creó la suya), no se mueve: la solicitud
      // se cierra y se le dice al administrador.
      if (applicant.parish_id) {
        await sr.entities.JoinRequest.update(request.id, { status: 'cancelled', decided_by: me.email, decided_at: decidedAt });
        return Response.json({
          error: applicant.parish_id === request.parish_id
            ? 'Esta persona ya pertenece a tu parroquia'
            : 'Esta persona ya pertenece a otra parroquia, así que la solicitud se cerró',
          code: 'already_in_parish',
        }, { status: 409 });
      }
      const parish = await sr.entities.Parish.get(request.parish_id).catch(() => null);
      if (!parish) return Response.json({ error: 'No se pudo leer la parroquia para aprobar, intenta de nuevo' }, { status: 500 });
      let groupId: string | undefined;
      if (role === 'catequist' && body.group_id) {
        const group = await sr.entities.Group.get(String(body.group_id)).catch(() => null);
        if (!group || group.parish_id !== parish.id) {
          return Response.json({ error: 'Ese grupo/libro no pertenece a tu parroquia' }, { status: 400 });
        }
        groupId = group.id;
      }
      // El acceso se otorga PRIMERO; si cerrar la solicitud falla después, el
      // usuario ya está dentro y una pendiente colgada no lo revierte
      // (settlePendingRequests la cierra en el siguiente alta o edición).
      await sr.entities.User.update(applicant.id, await membershipPatch(sr, parish, role, groupId));
      await sr.entities.JoinRequest.update(request.id, {
        status: 'approved', decided_by: me.email, decided_at: decidedAt, parish_role_assigned: role,
      }).catch((e: unknown) => console.error('approve: no se pudo cerrar la solicitud', e));
      return Response.json({ approved: true, user: { id: applicant.id, email: applicant.email, parish_role: role, group_id: groupId } });
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

      await base44.asServiceRole.entities.User.update(successor.id, { parish_role: 'admin', group_id: '' });
      // El llamante baja a catequista sólo después. Si esto falla, la parroquia
      // queda con DOS administradores —un estado válido y reversible a mano—,
      // nunca con cero.
      await base44.asServiceRole.entities.User.update(me.id, { parish_role: 'catequist' });
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

    await sr.entities.User.update(target.id, await membershipPatch(sr, targetParish, parish_role, group_id));
    // El alta del administrador es pre-aprobada: si esta persona tenía una
    // solicitud pendiente, queda resuelta.
    await settlePendingRequests(sr, target.id, parish_id, me.email, parish_role);

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