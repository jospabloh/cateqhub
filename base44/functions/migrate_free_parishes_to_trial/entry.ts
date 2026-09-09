import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Opcional, promocional, ejecutar manualmente cuando se decida: plan="free"
// sigue siendo un plan permanente y normal (núcleo completo hasta 50 niños
// activos), así que esto YA NO es una migración obligatoria — es un regalo
// de bienvenida de una sola vez, para darle a cada parroquia que ya estaba
// en plan="free" antes del lanzamiento del trial una probada de 30 días de
// Premium completo (mismo tratamiento que create_parish le da a una
// parroquia nueva), por si tiene más de 50 niños o quiere probar
// Tutores/mensajería/tareas/pulseras. Espeja plan/license_status en sus
// User, igual que backfill_parish_license_mirror. No toca parroquias ya en
// plan="premium" (en prueba, pagando, o en el ciclo read_only/
// access_denied/deletion_eligible) ni las que llegaron a plan="free" como
// estado terminal del borrado automático de datos Premium (esas ya pasaron
// por su prueba; no se les regala una segunda).
const COUNT_CAP = 5000; // mismo límite documentado que backfill_parish_license_mirror.

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
    if (me.role !== 'admin') {
      return Response.json({ error: 'Solo un administrador de plataforma puede ejecutar esta migración' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const parishes = await sr.entities.Parish.filter({ plan: 'free' });
    if (parishes.length > COUNT_CAP) {
      return Response.json({ error: `${parishes.length} parroquias en plan free supera el límite de ${COUNT_CAP} de esta migración — súbelo o córrela en lotes` }, { status: 400 });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime());
    trialEnd.setUTCDate(trialEnd.getUTCDate() + 30);
    const trialEndIso = trialEnd.toISOString();

    let parishesMigrated = 0;
    let usersUpdated = 0;
    const errors: Array<{ parish_id: string; message: string }> = [];

    for (const parish of parishes) {
      try {
        await sr.entities.Parish.update(parish.id, {
          plan: 'premium',
          license_status: 'active',
          premium_period_end_at: trialEndIso,
        });
        parishesMigrated++;

        const users = await sr.entities.User.filter({ parish_id: parish.id });
        for (const user of users) {
          // Best-effort por usuario, igual que backfill_parish_license_mirror.
          try {
            await sr.entities.User.update(user.id, {
              parish_plan: 'premium',
              parish_license_status: 'active',
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

    return Response.json({ ok: true, parishesFound: parishes.length, parishesMigrated, usersUpdated, trialEnd: trialEndIso, errors });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
