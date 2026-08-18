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
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

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
