import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Siembra (o completa) "Parroquia San Testing": 3 grupos, 20 niños y
// asistencia de prueba de las últimas semanas — para probar Mission Control
// (sync de licencia/uso) y las vistas de Reportes/Dashboard con datos reales.
// Gated a admin de plataforma. Idempotente por NOMBRE/fecha (no por "ya existe
// algo"), así que invocarla varias veces completa lo que falte en vez de
// quedarse atorada si una corrida anterior quedó parcial (p. ej. probada desde
// el editor de Base44 y cancelada a medio camino).
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

    // Grupos: crea solo los nombres que falten (por nombre, no por conteo).
    const existingGroups = await sr.entities.Group.filter({ parish_id: parish.id });
    const existingGroupNames = new Set(existingGroups.map((g) => g.name));
    const missingGroups = GROUPS.filter((name) => !existingGroupNames.has(name));
    const newGroups = await Promise.all(missingGroups.map((name) => sr.entities.Group.create({ parish_id: parish.id, name })));
    const groups = [...existingGroups, ...newGroups];

    // Niños: completa hasta CHILD_NAMES.length (por conteo existente, no por
    // nombre — dos niños pueden compartir nombre en la vida real).
    const existingChildren = await sr.entities.Child.filter({ parish_id: parish.id });
    const newChildren = await Promise.all(
      CHILD_NAMES.slice(existingChildren.length).map((name, offset) => {
        const i = existingChildren.length + offset;
        return sr.entities.Child.create({
          parish_id: parish.id,
          group_id: groups[i % groups.length].id,
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

    return Response.json({
      ok: true,
      parish: { id: parish.id, name: parish.name },
      groups: groups.length,
      groups_created: newGroups.length,
      children: children.length,
      children_created: newChildren.length,
      attendance_total: existingAttendance.length + records.length,
      attendance_created: records.length,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
