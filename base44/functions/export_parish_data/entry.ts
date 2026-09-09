import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// export_parish_data — "Descargar mis datos" para el módulo 7 (cuenta y
// zona de peligro). Ya existía export_premium_data (solo Tutores, ligado al
// flujo de baja de licencia) pero no una exportación general de todos los
// datos operativos de la parroquia.
//
// Corre con service role para leer todas las entidades de la parroquia sin
// depender de la RLS de cada una, pero cada lectura está explícitamente
// filtrada por el parish_id del solicitante — nunca cruza tenants. Solo un
// administrador de la parroquia (o el admin de plataforma) puede exportar.
const PARISH_ENTITIES = ['Child', 'Group', 'Guardian', 'ChildGuardian', 'Attendance'];

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
    const canManage = me.parish_role === 'admin' || isPlatformAdmin;
    if (!canManage) {
      return Response.json({ error: 'Solo un administrador de parroquia puede exportar los datos' }, { status: 403 });
    }

    const parish_id = me.parish_id;
    if (!parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    const sr = base44.asServiceRole;
    const parish = await sr.entities.Parish.get(parish_id).catch(() => null);
    if (!parish) return Response.json({ error: 'Parroquia no encontrada' }, { status: 404 });

    const data: Record<string, unknown[]> = {};
    for (const entity of PARISH_ENTITIES) {
      try {
        data[entity] = await sr.entities[entity].filter({ parish_id });
      } catch (e) {
        data[entity] = [];
        console.error(`[export_parish_data] ${entity} failed: ${(e as Error).message}`);
      }
    }

    return Response.json({
      success: true,
      exported_at: new Date().toISOString(),
      parish: { id: parish.id, name: parish.name, plan: parish.plan },
      data,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
