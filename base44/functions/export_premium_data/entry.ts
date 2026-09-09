import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    const isParishAdmin = me.parish_role === 'admin' || me.role === 'admin';
    if (!isParishAdmin || !me.parish_id) {
      return Response.json({ error: 'Solo un administrador de parroquia puede exportar estos datos' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const parish = await sr.entities.Parish.get(me.parish_id);
    if (!parish || parish.plan !== 'premium') {
      return Response.json({ error: 'Tu parroquia no tiene el plan Premium' }, { status: 400 });
    }

    const [guardians, childGuardians] = await Promise.all([
      sr.entities.Guardian.filter({ parish_id: me.parish_id }),
      sr.entities.ChildGuardian.filter({ parish_id: me.parish_id }),
    ]);

    return Response.json({
      exported_at: new Date().toISOString(),
      parish: { id: parish.id, name: parish.name },
      guardians,
      child_guardians: childGuardians,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
