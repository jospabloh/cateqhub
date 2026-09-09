import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Módulo 20 del estándar, capa 3: lo que un temporizador en el cliente
// estructuralmente NO puede dar. Una sesión cuyo dispositivo murió —batería
// agotada, pestaña matada por el sistema, laptop cerrada y nunca reabierta—
// no manda otro latido nunca, así que se queda 'active'/'passive' para
// siempre: no queda nada corriendo en ese lado para cerrarla. Sólo un trabajo
// programado puede hacerlo desde el servidor.

// 48 h es la constante del portafolio, no una elección de esta app: bastante
// larga para que una laptop dormida un fin de semana no eche a nadie, bastante
// corta para que una sesión muerta no siga viva semanas.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const MAX_PER_RUN = 5000; // mismo tope documentado que el resto de este repo.

// Guardia de cron, EN LÍNEA a propósito: Base44 aísla cada función y no puede
// importar de una hermana ni de la raíz de functions/, así que un helper
// compartido no es una opción aquí.
//
// Falla CERRADO, y esa dirección es el punto entero. Mission Control tenía
// esta misma guardia escrita al revés —`if (secret && ...)`— y con la variable
// sin poner, el `secret &&` de delante saltaba la comprobación completa: sus
// cuatro crons quedaron ABIERTOS en producción, y uno devolvía el estado
// operativo del portafolio entero a cualquiera que supiera la URL. Aquí, sin
// CRON_SECRET no se corre: 503, nunca 200.
//
// No se acepta una cabecera sola como prueba —las controla quien llama—; con
// la variable puesta, el planificador adjunta el Bearer por su cuenta y entra
// por la misma puerta que todos.
function requireCron(req: Request): Response | null {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET not set in app secrets' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'no autorizado' }, { status: 401 });
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const blocked = requireCron(req);
    if (blocked) return blocked;

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

    // Se filtra en memoria y no con operadores del backend a propósito: este
    // repo no usa `status_ne`/`last_seen_before` en ninguna otra función, y un
    // operador que el backend ignorara en silencio devolvería TODAS las filas
    // y las revocaría todas. Con el tope de arriba, leer y filtrar aquí es
    // barato y no depende de una sintaxis sin comprobar.
    const all = await sr.entities.Session.list('-last_seen', MAX_PER_RUN);

    // Se revocan las `passive` igual que las `active`: un dispositivo que ya no
    // es el primario se queda rancio exactamente igual. Filtrar sólo por
    // 'active' dejaría vivas justo las sesiones olvidadas.
    const stale = (all || []).filter((s) =>
      s.status !== 'revoked' && (!s.last_seen || s.last_seen < cutoff));

    let revoked = 0;
    const errors: Array<{ id: string; message: string }> = [];
    for (const s of stale) {
      try {
        await sr.entities.Session.update(s.id, {
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: 'purge_stale_sessions',
        });
        revoked++;
      } catch (e) {
        errors.push({ id: s.id, message: (e as Error).message });
      }
    }

    // Revocar aquí es todo el arreglo: la comprobación que `session` ya hace en
    // sessionHeartbeat (`status === 'revoked'` → 403) lo convierte en un cierre
    // real la próxima vez que esa pestaña despierte. No hace falta ningún
    // cambio en el cliente.
    return Response.json({ ok: true, scanned: (all || []).length, revoked, cutoff, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
