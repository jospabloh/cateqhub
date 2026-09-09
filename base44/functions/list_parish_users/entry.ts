import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lista los usuarios del mismo tenant (parroquia) que el solicitante.
// Usa service role para evitar la restricción de que solo los admins de
// plataforma pueden listar usuarios — el aislamiento se garantiza
// forzando el filtro al parish_id del solicitante.
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

    const users = await base44.asServiceRole.entities.User.filter({ parish_id: me.parish_id });
    const safe = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      parish_role: u.parish_role,
      group_id: u.group_id,
    }));

    return Response.json({ users: safe });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});