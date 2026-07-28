import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Ejecutar UNA VEZ, manualmente, inmediatamente después de desplegar el
// esquema de este PR (Parish/User/Guardian/ChildGuardian) y ANTES de que
// tráfico real llegue a Guardian/ChildGuardian — ver Task 16 Step 4 del plan
// para el detalle de por qué el orden importa. No es un cron, no se agenda:
// solo rellena el espejo (parish_plan/parish_license_status en User) para
// usuarios que ya existían antes de este despliegue.
//
// Idempotente y seguro de volver a correr: cuando se agregó
// parish_support_priority_addon (plan de cobro 2026-07-28) se sumó a este
// mismo backfill en vez de escribir uno nuevo — los usuarios ya cubiertos
// por la corrida anterior simplemente reciben también el campo nuevo.
const COUNT_CAP = 5000; // igual límite documentado que acaciaControl.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (me.role !== 'admin') {
      return Response.json({ error: 'Solo un administrador de plataforma puede ejecutar el backfill' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const parishes = await sr.entities.Parish.list('-created_date', COUNT_CAP);

    let usersUpdated = 0;
    const errors: Array<{ parish_id: string; message: string }> = [];

    for (const parish of parishes) {
      try {
        const users = await sr.entities.User.filter({ parish_id: parish.id });
        for (const user of users) {
          // Best-effort por usuario: un usuario que falle no debe abortar el
          // resto de la parroquia ni de las demás parroquias.
          try {
            await sr.entities.User.update(user.id, {
              parish_plan: parish.plan ?? 'free',
              parish_license_status: parish.license_status ?? 'active',
              parish_support_priority_addon: parish.support_priority_addon ?? false,
            });
            usersUpdated++;
          } catch (e) {
            errors.push({ parish_id: parish.id, message: `usuario ${user.id}: ${(e as Error).message}` });
          }
        }
      } catch (e) {
        errors.push({ parish_id: parish.id, message: (e as Error).message });
      }
    }

    return Response.json({ ok: true, parishes: parishes.length, usersUpdated, errors });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
