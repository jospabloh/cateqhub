// Fuente única de verdad para la versión de CateqHub — consumida por
// src/pages/About.jsx. Mantener package.json sincronizado con APP_VERSION.
export const APP_VERSION = "1.9.5";
export const RELEASE_DATE = "2026-08-11";

export const CHANGELOG = [
  {
    version: "1.9.5",
    date: "2026-08-11",
    changes: [
      "Corrección menor: en la ficha del niño, el botón para quitar a un tutor ya no se muestra a catequistas — quitar un tutor siempre ha requerido ser administrador de parroquia (regla de base de datos desde la 1.9.3), pero el botón aparecía para cualquier catequista y, al usarlo, fallaba con un aviso genérico de \"no se pudo\" sin explicar por qué. Ahora el botón solo aparece para quien realmente puede usarlo, igual que \"Cambiar grupo/libro\", \"Dar de baja\" y \"Agregar tutor\" en la misma ficha.",
      "Corrección: en Reportes, si la carga de asistencia o de grupos/libros fallaba (sesión vencida, corte de red), la pantalla se quedaba girando en el esqueleto de carga para siempre, sin aviso ni forma de reintentar salvo recargar. Ahora muestra el mismo aviso de error con reintento que ya tienen Dashboard, Niños, Grupos/Libros y Usuarios.",
      "Auditoría rutinaria: se revisaron a fondo los permisos y el aislamiento de datos (RLS) en las 10 entidades y en las funciones de backend (`assign_parish_user`, `add_guardian`, `create_child`, `update_child`, `record_attendance`, `acaciaControl`) — todas re-derivan `parish_id`/rol de la sesión autenticada, ninguna confía en un valor enviado por el cliente. No se encontraron huecos nuevos. `react-router`/`react-router-dom` (moderada, redirección abierta) sigue como riesgo aceptado, pendiente de la migración mayor 6→7 — el catálogo de avisos vigente añade una variante con potencial de XSS (antes se documentaba solo como redirección abierta), sin cambiar la mitigación: sigue sin haber una versión 6.x que la corrija.",
    ],
  },
  {
    version: "1.9.4",
    date: "2026-08-10",
    changes: [
      "Mantenimiento/seguridad: auditoría rutinaria de dependencias — se actualizaron `dompurify`, `js-yaml`, `nanoid` y `socket.io-parser` (transitiva) a versiones que corrigen vulnerabilidades conocidas (dos de severidad alta, dos moderadas). Sin cambios visibles para el usuario. Sigue pendiente `react-router`/`react-router-dom` (moderada, redirección abierta), ya documentada como riesgo aceptado para una migración planeada (6→7).",
      "Mantenimiento: se eliminaron las dependencias `@stripe/react-stripe-js` y `@stripe/stripe-js` — no se usaban en ninguna pantalla (el flujo de Premium hoy queda pendiente de confirmación manual con un ejecutivo de ACACIA, no cobra por tarjeta). Sin cambios visibles para el usuario.",
      "Auditoría rutinaria: se revisó el aislamiento de datos por parroquia (RLS) en las 10 entidades del esquema — todas ya cuentan con reglas explícitas de `create`/`read`/`update`/`delete` acotadas a `parish_id` (o a rol de plataforma \"admin\"); no se encontraron entidades sin proteger. Se confirmó también que no hay secretos ni tokens embebidos en el repositorio.",
    ],
  },
  {
    version: "1.9.3",
    date: "2026-08-03",
    changes: [
      "Seguridad: corregido un hueco de permisos que permitía a cualquier catequista desvincular al tutor de cualquier niño de la parroquia (ChildGuardian), sin el control de \"solo administrador de parroquia\" que ya aplicaba a niños, tutores y asistencia. También se cerró el mismo hueco, hasta ahora sin explotar desde la interfaz, en la edición directa de registros de asistencia (Attendance).",
      "Mantenimiento: se eliminó `react-quill`/`quill` (sin uso en el código) y se corrigió una vulnerabilidad de alta severidad en una dependencia transitiva (`brace-expansion`), sin cambios visibles para el usuario. Queda pendiente `react-router` (aceptado, requiere una actualización de versión mayor).",
      "Corrección menor de código: el hook de permisos ahora falla de forma segura (deniega en vez de permitir) si se usa fuera de su proveedor, en vez de conceder acceso por accidente — no había ningún caso en la app donde esto ocurriera hoy.",
    ],
  },
  {
    version: "1.9.2",
    date: "2026-07-28",
    changes: [
      "Mantenimiento: se actualizaron dependencias (dompurify, js-yaml, postcss) para cerrar vulnerabilidades conocidas de las librerías, sin cambios visibles para el usuario.",
    ],
  },
  {
    version: "1.9.1",
    date: "2026-07-28",
    changes: [
      "Planes y precios: se acotaron dos tramos más de mensualidad Premium (451-550 $1,100 MXN, 551-650 $1,250 MXN) que antes decían \"Contáctanos\" — mismo incremento de $150 por cada 100 niños de los tramos anteriores. 651+ o diócesis multi-parroquia sigue a cotización.",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-07-28",
    changes: [
      "Nuevo plan de cobro en 3 partes, en \"Planes y precios\": implementación asistida opcional (cargo único, $1,490–$3,990 MXN según niños activos, para migrar tus listas existentes, dar de alta catequistas y capacitar a tu coordinación), la mensualidad Premium de siempre (sin cambio de precio) y soporte adicional a la carta ($550 MXN/hora, $990 MXN/sesión de capacitación extra, o +$250 MXN/mes por soporte prioritario).",
      "Soporte: cada plan trae un tope de prioridad de ticket incluido (Gratis hasta Baja, Premium hasta Alta); el add-on de soporte prioritario lo sube a Urgente. Puedes solicitar la implementación asistida o el soporte prioritario desde \"Planes y precios\" — ambos quedan pendientes de confirmación de pago con tu ejecutivo de ACACIA, igual que la activación de Premium hoy.",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-07-27",
    changes: [
      "Nuevos planes: el plan Gratis (hasta 50 niños activos, sin vencimiento) se mantiene, y toda parroquia nueva arranca además con 30 días de prueba Premium completa (Tutores, mensajería, tareas y pulseras incluidos) sin costo y sin tarjeta.",
      "Precio de Premium por niños activos de la parroquia, con descuento en pago anual — antes era un precio único de referencia.",
      "Si el período de prueba o de pago Premium vence sin renovarse: con 50 niños activos o menos, la parroquia baja directo al plan Gratis sin ningún bloqueo; con más de 50, aplica el mismo ciclo de solo lectura → acceso denegado → exportación que antes solo restringía Tutores, ahora sobre toda la app, hasta reactivar el nivel Premium que corresponda. Ningún dato de niños/grupos/asistencia se elimina automáticamente; solo Tutores, y solo tras poder exportarlo.",
    ],
  },
  {
    version: "1.7.2",
    date: "2026-07-27",
    changes: [
      "Gafetes QR: la tarjeta impresa o descargada ahora muestra el nombre del niño arriba del código QR, para identificarlo a simple vista antes de escanearlo o entregarlo — sigue sin llevar ningún otro dato (grupo/libro, CURP, etc.).",
    ],
  },
  {
    version: "1.7.1",
    date: "2026-07-27",
    changes: [
      "Acerca de ahora incluye equipo desarrollador, contacto y soporte directo, derechos reservados (con la licencia registrada a tu correo) y un mensaje de cierre — la misma información institucional que ya tienen las demás aplicaciones del portafolio ACACIA.",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-07-27",
    changes: [
      "Escanear ya no pide elegir grupo/libro antes de empezar: cada código QR revela el grupo del niño automáticamente, así una sola estación de escaneo recibe a todos los grupos a la vez. Se sigue bloqueando si el niño no tiene grupo/libro asignado.",
      "Permisos dejó de ser una tabla de solo lectura: el administrador ahora activa o desactiva, permiso por permiso, lo que puede hacer el catequista (ver todos los grupos, cambiar/dar de baja niños, escanear cualquier grupo, agregar tutores) — y esos permisos ahora también se hacen cumplir en el backend, no solo en la pantalla.",
      "Nueva impresión de gafetes QR por lotes desde Niños: selecciona uno o varios niños y descarga o imprime la hoja en PNG, SVG o PDF, con solo el código QR y guías de corte, sin nombre del niño.",
      "Reportes: la gráfica de asistencia y la tabla de faltas ahora llevan al detalle con un toque — quién asistió cada día, o el historial sesión por sesión de un niño.",
      "Nuevo control para reasignar el grupo/libro de un niño desde su propia ficha, con aviso temporal de \"cambió de grupo/libro\" para catequistas con gafetes impresos por grupo.",
      "Correcciones de seguridad: el borrado de datos Premium ya no se reporta como exitoso si queda incompleto, y el consentimiento de datos sensibles de la parroquia ya no puede reescribirse desde una llamada directa a la API.",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-07-23",
    changes: [
      "Ciclo de vida de licencia Premium: si el pago no se confirma, Tutores pasa primero a solo lectura y después a acceso denegado, con exportación autoservicio de tus datos antes de cualquier eliminación.",
      "La restricción del plan Premium en Tutores ahora se hace cumplir también en el backend, no solo en la pantalla.",
      "Nuevo aviso de manejo de datos sensibles (CURP y datos de menores) al crear una parroquia, conforme a la LFPDPPP.",
      "Acerca de ahora indica las certificaciones de seguridad de Base44, el proveedor de infraestructura.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-07-23",
    changes: [
      "El plan por default de CateqHub ahora es Gratis, sin periodo de prueba ni vencimiento — antes era una prueba de 90 días de las funciones premium.",
      "Página Premium y Dashboard actualizados para reflejar el plan gratuito en vez del estado de prueba.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-07-23",
    changes: [
      "Aislamiento de datos por parroquia (RLS) en todas las entidades — corrige una falla de seguridad donde una parroquia podía ver datos de otra.",
      "CURP opcional en el registro de niños y tutores.",
      "Manual de usuario con búsqueda, sección de soporte con tickets, y esta página de versión.",
      "Sección de permisos para el administrador de la parroquia.",
      "Información de licencia visible en el plan Premium.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-22",
    changes: [
      "Rediseño minimalista de toda la interfaz, con gráficas reales en Reportes y un anillo de asistencia en el Dashboard.",
      "Marca oficial CateqHub (nombre y logo) en toda la app.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-20",
    changes: [
      "Niveles premium: tutores, mensajería, tareas y pulseras como funciones de pago, con periodo de prueba.",
      "Inicio de sesión rediseñado en dos paneles.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-20",
    changes: [
      "Identidad visual completa y CI con verificación automática antes de cada build.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-20",
    changes: [
      "Primera versión: alta de parroquia, grupos/libros y niños, generación de QR, escaneo de asistencia y reportes básicos.",
    ],
  },
];
