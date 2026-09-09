import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Attendance.create está bloqueado a user_condition:{role:admin} en
// Attendance.jsonc — Scan.jsx llama a esta función en vez de crear el
// registro directo, para aplicar de verdad el permiso
// escanear:cualquier_grupo (antes solo se checaba en el cliente: un
// catequista restringido podía llamar Attendance.create directo con el
// group_id de cualquier niño de su parroquia). También hace la validación
// de duplicado del día aquí, con rol de servicio, para no depender de un
// Attendance.read sin restricción de grupo/libro en el cliente.
//
// Plan Gratis registra asistencia sin vencimiento. Si la parroquia está en
// plan="premium" (prueba o pago) y ese período vence sin renovarse, esta
// función bloquea registrar asistencia igual que add_guardian ya hacía con
// Tutores.
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

    const { child_id } = await req.json();
    if (!child_id) return Response.json({ error: 'child_id requerido' }, { status: 400 });

    const sr = base44.asServiceRole;

    const parish = await sr.entities.Parish.get(me.parish_id).catch(() => null);
    if (!parish) return Response.json({ error: 'No se pudo verificar tu parroquia, intenta de nuevo' }, { status: 500 });
    if (parish.plan === 'premium' && parish.license_status && parish.license_status !== 'active') {
      return Response.json({ error: 'Tu período de prueba o pago está pendiente', code: 'license_not_active' }, { status: 403 });
    }

    const child = await sr.entities.Child.get(child_id).catch(() => null);
    if (!child || child.parish_id !== me.parish_id) {
      return Response.json({ error: 'QR no reconocido en esta parroquia', code: 'not_found' }, { status: 404 });
    }
    if (!child.active) {
      return Response.json({ error: 'Niño inactivo — no se registra asistencia', code: 'inactive', childName: child.name }, { status: 400 });
    }
    if (!child.group_id) {
      return Response.json({ error: 'No tiene grupo/libro asignado — actualízalo en Niños', code: 'no_group', childName: child.name }, { status: 400 });
    }

    const isAdmin = me.role === 'admin' || me.parish_role === 'admin';
    const canAnyGroup = isAdmin || !me.perm_escanear_restringido;
    if (!canAnyGroup && child.group_id !== me.group_id) {
      return Response.json({ error: 'Este niño no pertenece a tu grupo/libro', code: 'wrong_group', childName: child.name }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const existing = await sr.entities.Attendance.filter({ child_id, date: today });
    if (existing.length > 0) {
      return Response.json({ ok: true, duplicate: true, childName: child.name });
    }

    const attendance = await sr.entities.Attendance.create({
      parish_id: child.parish_id,
      group_id: child.group_id,
      child_id,
      date: today,
      recorded_by: me.id,
    });

    return Response.json({ ok: true, duplicate: false, childName: child.name, groupId: child.group_id, attendance });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
