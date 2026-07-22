import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (admin.role !== 'admin') return Response.json({ error: 'Solo un administrador puede asignar usuarios' }, { status: 403 });

    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const parish_id = body.parish_id || admin.parish_id;
    const group_id = body.group_id || undefined;
    const role = body.role || 'user';

    if (!email) return Response.json({ error: 'Correo requerido' }, { status: 400 });
    if (!parish_id) return Response.json({ error: 'El administrador no tiene parroquia asignada' }, { status: 400 });

    // Find the user by email using service role
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      return Response.json({
        found: false,
        assigned: false,
        message: 'El usuario aún no ha registrado su cuenta. Pídele que acepte la invitación y vuelve a intentarlo.',
      });
    }

    const target = users[0];
    await base44.asServiceRole.entities.User.update(target.id, {
      parish_id,
      group_id: role === 'user' ? group_id : undefined,
      role,
    });

    return Response.json({
      found: true,
      assigned: true,
      user: { id: target.id, email: target.email, name: target.full_name },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});