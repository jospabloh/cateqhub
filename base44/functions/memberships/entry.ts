import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Módulo 18 del estándar: una cuenta, varias parroquias.
//
// Lo que este endpoint NO hace, y conviene decirlo primero: no introduce una
// segunda identidad ni una sesión que abarque dos parroquias. El puntero activo
// sigue siendo el ÚNICO User.parish_id, y toda la RLS y las 15 funciones siguen
// acotando por él. Membership sólo registra a cuáles se pertenece; cambiar de
// una a otra reescribe ese mismo puntero por el camino de siempre.

// Los campos espejo que viajan con el puntero. Cambiar de parroquia sin
// recalcularlos dejaría al usuario con el plan y el estado de licencia de la
// parroquia ANTERIOR — que es de las dos, la peor dirección: acceso Premium
// heredado de otra parroquia.
async function pointerFor(sr, parish, membership) {
  return {
    parish_id: parish.id,
    parish_role: membership.parish_role || 'catequist',
    // El rol se re-deriva de la membresía de DESTINO, nunca se arrastra.
    group_id: '',
    parish_plan: parish.plan ?? 'free',
    parish_license_status: parish.license_status ?? 'active',
    parish_support_priority_addon: parish.support_priority_addon ?? false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Módulo 22, el mismo bloque literal que el resto — ver
    // tests/unit/freshCallerRead.test.js.
    const session = await base44.auth.me();
    if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 });
    const stored = await base44.asServiceRole.entities.User.filter({ id: session.id }).catch(() => null);
    const me = stored?.[0];
    if (!me) return Response.json({ error: 'No se pudo verificar tu cuenta, intenta de nuevo' }, { status: 500 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'list';

    // El conjunto legítimo, recalculado desde cero cada vez. Nunca se confía en
    // nada que venga del cliente, ni siquiera para listar.
    let candidates = (await sr.entities.Membership.filter({ user_id: me.id }) || [])
      .filter((m) => m.active !== false);

    // Backfill perezoso, y es la pieza que hace que este módulo funcione para
    // las cuentas que YA existen. Toda la app funcionó dos meses con parish_id
    // y sin esta entidad, así que nadie tiene una fila todavía: sin esto, `list`
    // devolvería cero candidatos y `switch` rechazaría hasta la parroquia
    // propia. Se resuelve al vuelo en vez de con una migración a mano porque
    // una migración hay que acordarse de correrla, y el estándar avisa justo de
    // eso al hablar de lo caro que es retrofitear este módulo.
    //
    // Sólo estampa lo que el registro almacenado del usuario YA dice. No
    // inventa pertenencias: si no tiene parish_id, no crea nada.
    if (me.parish_id && !candidates.some((m) => m.parish_id === me.parish_id)) {
      const own = await sr.entities.Parish.get(me.parish_id).catch(() => null);
      if (own) {
        const created = await sr.entities.Membership.create({
          user_id: me.id,
          email: me.email || '',
          parish_id: own.id,
          parish_name: own.name || '',
          parish_role: me.parish_role || 'catequist',
          active: true,
        }).catch(() => null);
        if (created) candidates = [...candidates, created];
      }
    }

    if (action === 'list') {
      return Response.json({
        active_parish_id: me.parish_id || null,
        candidates: candidates.map((m) => ({
          parish_id: m.parish_id,
          parish_name: m.parish_name || '',
          parish_role: m.parish_role || 'catequist',
          is_active: m.parish_id === me.parish_id,
        })),
      });
    }

    if (action === 'switch') {
      const target = String(body.parish_id || '').trim();
      if (!target) return Response.json({ error: 'parish_id requerido' }, { status: 400 });

      const membership = candidates.find((m) => m.parish_id === target);

      // Módulo 14 §6, aplicado de verdad: una parroquia a la que NO perteneces
      // y una parroquia que NO EXISTE reciben exactamente la misma respuesta.
      // Si se distinguieran, este endpoint sería un oráculo de existencia — se
      // podría enumerar qué parroquias hay probando ids.
      if (!membership) {
        return Response.json({ error: 'Parroquia no encontrada' }, { status: 404 });
      }
      const parish = await sr.entities.Parish.get(target).catch(() => null);
      if (!parish) {
        return Response.json({ error: 'Parroquia no encontrada' }, { status: 404 });
      }

      if (me.parish_id === target) {
        return Response.json({ switched: false, already: true, parish_id: target });
      }

      await sr.entities.User.update(me.id, await pointerFor(sr, parish, membership));
      return Response.json({ switched: true, parish_id: target, parish_name: parish.name || '' });
    }

    return Response.json({ error: `Acción no reconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
