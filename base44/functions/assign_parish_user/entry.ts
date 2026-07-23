import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });

    const isPlatformAdmin = me.role === 'admin';
    const canManage = me.parish_role === 'admin' || isPlatformAdmin;
    if (!canManage) {
      return Response.json({ error: 'Solo un administrador de parroquia puede asignar usuarios' }, { status: 403 });
    }

    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const parish_id = body.parish_id || me.parish_id;
    const parish_role = body.parish_role || 'catequist';
    const group_id = parish_role === 'catequist' ? (body.group_id || undefined) : undefined;

    if (!email) return Response.json({ error: 'Correo requerido' }, { status: 400 });
    if (!parish_id) return Response.json({ error: 'No tienes parroquia asignada' }, { status: 400 });

    // Aislamiento por tenant: un admin de parroquia solo opera en su propia parroquia.
    if (!isPlatformAdmin && parish_id !== me.parish_id) {
      return Response.json({ error: 'No puedes asignar usuarios a otra parroquia' }, { status: 403 });
    }

    // El rol de plataforma NO se toca: los invitados siempre son `user` de plataforma.
    // El rol dentro del tenant se guarda en `parish_role`.
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      return Response.json({
        found: false,
        assigned: false,
        message: 'El usuario aún no ha registrado su cuenta. Pídele que acepte la invitación y vuelve a intentarlo.',
      });
    }

    const target = users[0];

    // Prevenir secuestro de cuentas cross-tenant: un admin de parroquia no puede
    // reasociar un usuario que ya pertenece a otra parroquia. Solo un admin de
    // plataforma puede mover usuarios entre parroquias.
    if (!isPlatformAdmin && target.parish_id && target.parish_id !== parish_id) {
      return Response.json({
        found: true,
        assigned: false,
        message: 'El usuario ya pertenece a otra parroquia. Solo un administrador de plataforma puede reasociarlo.',
      }, { status: 403 });
    }

    await base44.asServiceRole.entities.User.update(target.id, {
      parish_id,
      group_id,
      parish_role,
    });

    return Response.json({
      found: true,
      assigned: true,
      user: {
        id: target.id,
        email: target.email,
        name: target.full_name,
        parish_role,
        group_id,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});