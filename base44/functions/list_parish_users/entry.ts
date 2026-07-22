import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Lista los usuarios del mismo tenant (parroquia) que el solicitante.
// Usa service role para evitar la restricción de que solo los admins de
// plataforma pueden listar usuarios — el aislamiento se garantiza
// forzando el filtro al parish_id del solicitante.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
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