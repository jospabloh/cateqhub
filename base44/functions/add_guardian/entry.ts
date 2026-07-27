import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Guardian.create y ChildGuardian.create están bloqueados a
// user_condition:{role:admin} — antes cualquier parroquia en plan free podía
// llamar esos dos create directo y usar "Tutores" gratis (el candado
// "Premium" solo vivía en el botón del cliente). Esta función checa
// Parish.plan de verdad antes de crear ambos registros.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (!me.parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    const body = await req.json();
    const child_id = body.child_id;
    const guardian = body.guardian || {};
    const relationship = body.relationship || 'tutor';
    const pickup_authorized = body.pickup_authorized !== false;

    if (!child_id) return Response.json({ error: 'child_id requerido' }, { status: 400 });
    const name = (guardian.name || '').trim();
    if (!name) return Response.json({ error: 'Nombre del tutor requerido' }, { status: 400 });

    const sr = base44.asServiceRole;
    const child = await sr.entities.Child.get(child_id).catch(() => null);
    if (!child || child.parish_id !== me.parish_id) {
      return Response.json({ error: 'Niño no encontrado en tu parroquia' }, { status: 404 });
    }

    const parish = await sr.entities.Parish.get(me.parish_id).catch(() => null);
    if (!parish || parish.plan !== 'premium') {
      return Response.json({ error: 'Agregar tutores requiere el plan Premium', code: 'premium_required' }, { status: 403 });
    }
    // Lee license_status en vivo (no un espejo) — esta función siempre tiene
    // el estado real de Parish, así que el ciclo de vida de licencia se hace
    // cumplir aquí sin depender del espejo en User (que solo existe para
    // Guardian/ChildGuardian.read, donde no hay función intermedia).
    if (parish.license_status && parish.license_status !== 'active') {
      return Response.json({ error: 'Tu plan Premium está pendiente de pago', code: 'license_not_active' }, { status: 403 });
    }

    const isAdmin = me.role === 'admin' || me.parish_role === 'admin';
    if (!isAdmin && me.perm_tutores_restringido) {
      return Response.json({ error: 'Tu parroquia desactivó este permiso para catequistas' }, { status: 403 });
    }

    const createdGuardian = await sr.entities.Guardian.create({
      parish_id: me.parish_id,
      name,
      phone: guardian.phone || undefined,
      email: guardian.email || undefined,
      curp: guardian.curp || undefined,
      whatsapp_opt_in: false,
    });

    const link = await sr.entities.ChildGuardian.create({
      parish_id: me.parish_id,
      child_id,
      guardian_id: createdGuardian.id,
      relationship,
      pickup_authorized,
    });

    return Response.json({ ok: true, guardian: createdGuardian, link });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
