// Fuente única de verdad para la versión de CateqHub — consumida por
// src/pages/About.jsx. Mantener package.json sincronizado con APP_VERSION.
export const APP_VERSION = "1.7.0";
export const RELEASE_DATE = "2026-07-27";

export const CHANGELOG = [
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
