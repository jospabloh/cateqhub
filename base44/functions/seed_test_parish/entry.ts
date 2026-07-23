import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Siembra (o reutiliza) "Parroquia San Testing": 3 grupos, 20 niños y
// asistencia de prueba de las últimas semanas — para probar Mission Control
// (sync de licencia/uso) y las vistas de Reportes/Dashboard con datos reales.
// Gated a admin de plataforma. Idempotente: si la parroquia/niños/asistencia
// ya existen, no se duplica nada — solo se reporta lo que ya había.
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

    let groups = await sr.entities.Group.filter({ parish_id: parish.id });
    if (!groups || groups.length === 0) {
      groups = await Promise.all(GROUPS.map((name) => sr.entities.Group.create({ parish_id: parish.id, name })));
    }

    let children = await sr.entities.Child.filter({ parish_id: parish.id });
    if (!children || children.length === 0) {
      children = await Promise.all(
        CHILD_NAMES.map((name, i) => sr.entities.Child.create({
          parish_id: parish.id,
          group_id: groups[i % groups.length].id,
          name,
          qr_token: crypto.randomUUID(),
          curp: CURPS[i] || '',
          active: true,
        })),
      );
    }

    let attendanceCreated = 0;
    const existingAttendance = await sr.entities.Attendance.filter({ parish_id: parish.id });
    if (!existingAttendance || existingAttendance.length === 0) {
      // Hoy + los últimos 4 domingos (deduplicado), para que Dashboard/Reportes
      // tengan datos incluso si hoy no cae en domingo.
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

      const records: Record<string, unknown>[] = [];
      for (const date of dateSet) {
        for (const child of children) {
          if (Math.random() < 0.85) { // ~85% asistencia, para variación real en "faltas acumuladas"
            records.push({ parish_id: parish.id, group_id: child.group_id, child_id: child.id, date, recorded_by: me.id });
          }
        }
      }
      await Promise.all(records.map((r) => sr.entities.Attendance.create(r)));
      attendanceCreated = records.length;
    }

    return Response.json({
      ok: true,
      parish: { id: parish.id, name: parish.name },
      groups: groups.length,
      children: children.length,
      attendance_created: attendanceCreated,
      note: attendanceCreated === 0 ? 'La parroquia ya existía con niños/asistencia — no se duplicó nada.' : undefined,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
