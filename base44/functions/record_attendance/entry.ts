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
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
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
