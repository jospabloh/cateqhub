import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Siembra (o completa) "Parroquia San Testing": 3 grupos, 20 niños y
// asistencia de prueba de las últimas semanas — para probar Mission Control
// (sync de licencia/uso) y las vistas de Reportes/Dashboard con datos reales.
// Gated a admin de plataforma. Idempotente por NOMBRE/fecha (no por "ya existe
// algo"), así que invocarla varias veces completa lo que falte en vez de
// quedarse atorada si una corrida anterior quedó parcial (p. ej. probada desde
// el editor de Base44 y cancelada a medio camino).
//
// También: (1) limpia cualquier grupo "extra" que no sea uno de los 3
// canónicos (p. ej. de una corrida parcial anterior con otro nombre),
// reasignando a sus niños antes de borrarlo; y (2) deja al admin de
// plataforma que invoca la función asignado a esta parroquia, para que pueda
// entrar a la app como usuario normal y ver los datos sembrados de inmediato
// — si su cuenta ya apuntaba a otra parroquia (p. ej. una vacía creada antes
// por accidente vía "crear tu parroquia" con el mismo nombre), se reasigna.
const PARISH_NAME = 'Parroquia San Testing';

const GROUPS = ['Iniciación', 'Primera Comunión', 'Confirmación'];

const CHILD_NAMES = [
  'Mateo Hernández', 'Sofía García', 'Santiago López', 'Valentina Martínez',
  'Emiliano Ramírez', 'Ximena Torres', 'Diego Flores', 'Camila Sánchez',
  'Sebastián Rivera', 'Fernanda Gómez', 'Leonardo Díaz', 'Isabella Cruz',
  'Joaquín Morales', 'Regina Ortiz', 'Emilio Reyes', 'Renata Vargas',
  'Daniel Castro', 'Mariana Jiménez', 'Alejandro Mendoza', 'Paulina Aguilar',
];

// Formato válido (no son personas reales) — cubre el caso "con CURP" en la
// UI; el resto de los niños se queda sin CURP para cubrir el caso "opcional".
const CURPS = [
  'GOSJ120315HDFRRL08', 'MARL110522HJCNTZ04', 'PEHL120118MNLRDR02',
  'LOVA100930HGTPQR07', 'HERM130712MPLTNS05', 'RAXO090203HVZLMN09',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (me.role !== 'admin') {
      return Response.json({ error: 'Solo un administrador de plataforma puede sembrar datos de prueba' }, { status: 403 });
    }

    const sr = base44.asServiceRole;

    const existingParish = await sr.entities.Parish.filter({ name: PARISH_NAME });
    const parish = existingParish?.[0] ?? await sr.entities.Parish.create({ name: PARISH_NAME, active: true });

    // Grupos: crea solo los nombres canónicos que falten.
    const allGroupsBefore = await sr.entities.Group.filter({ parish_id: parish.id });
    const existingGroupNames = new Set(allGroupsBefore.map((g) => g.name));
    const missingGroups = GROUPS.filter((name) => !existingGroupNames.has(name));
    const newGroups = await Promise.all(missingGroups.map((name) => sr.entities.Group.create({ parish_id: parish.id, name })));
    const canonicalGroups = [...allGroupsBefore.filter((g) => GROUPS.includes(g.name)), ...newGroups];

    // Limpieza: cualquier grupo que NO sea uno de los 3 canónicos es un
    // residuo de una corrida parcial anterior (nombre distinto por la razón
    // que sea) — mueve a sus niños al primer grupo canónico y bórralo.
    const strayGroups = allGroupsBefore.filter((g) => !GROUPS.includes(g.name));
    for (const stray of strayGroups) {
      const strayChildren = await sr.entities.Child.filter({ group_id: stray.id });
      await Promise.all(strayChildren.map((c) => sr.entities.Child.update(c.id, { group_id: canonicalGroups[0].id })));
      await sr.entities.Group.delete(stray.id);
    }

    // Niños: completa hasta CHILD_NAMES.length (por conteo existente, no por
    // nombre — dos niños pueden compartir nombre en la vida real).
    const existingChildren = await sr.entities.Child.filter({ parish_id: parish.id });
    const newChildren = await Promise.all(
      CHILD_NAMES.slice(existingChildren.length).map((name, offset) => {
        const i = existingChildren.length + offset;
        return sr.entities.Child.create({
          parish_id: parish.id,
          group_id: canonicalGroups[i % canonicalGroups.length].id,
          name,
          qr_token: crypto.randomUUID(),
          curp: CURPS[i] || '',
          active: true,
        });
      }),
    );
    const children = [...existingChildren, ...newChildren];

    // Asistencia: hoy + los últimos 4 domingos (deduplicado). Completa solo
    // los pares (niño, fecha) que aún no tengan un registro.
    const dateSet = new Set<string>();
    const today = new Date();
    dateSet.add(today.toISOString().slice(0, 10));
    const sunday = new Date(today);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    for (let w = 0; w < 4; w++) {
      const day = new Date(sunday);
      day.setDate(day.getDate() - w * 7);
      dateSet.add(day.toISOString().slice(0, 10));
    }

    const existingAttendance = await sr.entities.Attendance.filter({ parish_id: parish.id });
    const existingKeys = new Set(existingAttendance.map((a) => `${a.child_id}|${a.date}`));

    const records: Record<string, unknown>[] = [];
    for (const date of dateSet) {
      for (const child of children) {
        const key = `${child.id}|${date}`;
        if (existingKeys.has(key)) continue;
        if (Math.random() < 0.85) { // ~85% asistencia, para variación real en "faltas acumuladas"
          records.push({ parish_id: parish.id, group_id: child.group_id, child_id: child.id, date, recorded_by: me.id });
        }
      }
    }
    await Promise.all(records.map((r) => sr.entities.Attendance.create(r)));

    // Deja al admin que invoca esto viendo la parroquia sembrada como usuario
    // normal de la app, sin importar a qué parroquia apuntaba antes.
    const previousParishId = me.parish_id ?? null;
    if (previousParishId !== parish.id) {
      await sr.entities.User.update(me.id, { parish_id: parish.id, parish_role: 'admin' });
    }

    return Response.json({
      ok: true,
      parish: { id: parish.id, name: parish.name },
      groups: canonicalGroups.length,
      groups_created: newGroups.length,
      stray_groups_removed: strayGroups.length,
      children: children.length,
      children_created: newChildren.length,
      attendance_total: existingAttendance.length + records.length,
      attendance_created: records.length,
      reassigned_caller: previousParishId !== parish.id,
      previous_parish_id: previousParishId,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
