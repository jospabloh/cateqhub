// Fuente única de verdad para la versión de CateqHub — consumida por
// src/pages/About.jsx. Mantener package.json sincronizado con APP_VERSION.
export const APP_VERSION = "1.5.0";
export const RELEASE_DATE = "2026-07-23";

export const CHANGELOG = [
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
