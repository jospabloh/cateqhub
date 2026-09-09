import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Crea un niño con rol de servicio. Child.create está bloqueado a
// user_condition:{role:admin} en Child.jsonc — este función es el único
// camino, para poder aplicar el mismo permiso "ver todos los grupos/libros"
// que hoy solo se aplicaba en el cliente (un catequista restringido podía
// llamar Child.create directo con cualquier group_id de su parroquia).
//
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
    const name = (body.name || '').trim();
    const birth_date = body.birth_date || undefined;
    const curp = body.curp || undefined;
    const group_id = body.group_id;

    if (!name) return Response.json({ error: 'Nombre requerido' }, { status: 400 });
    if (!group_id) return Response.json({ error: 'Grupo/libro requerido' }, { status: 400 });

    const sr = base44.asServiceRole;
    const isAdmin = me.role === 'admin' || me.parish_role === 'admin';

    // Lee plan/license_status en vivo (no el espejo en User) — mismo motivo
    // que add_guardian: esta función siempre tiene el estado real de Parish.
    const parish = await sr.entities.Parish.get(me.parish_id).catch(() => null);
    if (!parish) return Response.json({ error: 'No se pudo verificar tu parroquia, intenta de nuevo' }, { status: 500 });
    // No hay tope de niños: CateqHub es un solo producto con precio por
    // volumen desde el 2026-09-09 (ver src/lib/premium.js). Lo único que
    // detiene un alta es una licencia que no está activa.
    if (parish.license_status && parish.license_status !== 'active') {
      return Response.json({ error: 'Tu período de prueba o pago está pendiente', code: 'license_not_active' }, { status: 403 });
    }

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
