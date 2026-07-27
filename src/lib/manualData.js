// Manual de usuario de CateqHub. Igual que en stockflow/flowfin: un arreglo
// de artículos hardcodeado (no una entidad ni un CMS), revisado a mano en cada
// versión. `content` es texto plano; los párrafos se separan con línea en
// blanco y las líneas que empiezan con "- " se muestran como lista.
export const MANUAL_LAST_REVIEWED = "2026-07-23";

export const manualArticles = [
  {
    id: "primeros-pasos",
    category: "Primeros pasos",
    title: "Crear tu parroquia",
    keywords: ["parroquia", "crear", "empezar", "inicio", "nueva cuenta"],
    content: `Cuando entras por primera vez sin una parroquia asignada, ve a "Parroquia" en el menú y crea la tuya con su nombre y contacto del administrador.

Al crearla, quedas automáticamente como administrador de esa parroquia. Desde ahí puedes invitar catequistas, crear grupos/libros y empezar a dar de alta niños.`,
  },
  {
    id: "invitar-usuarios",
    category: "Primeros pasos",
    title: "Invitar catequistas y otros administradores",
    keywords: ["invitar", "usuarios", "catequista", "administrador", "equipo"],
    content: `Ve a "Usuarios" → "Invitar". Escribe el correo de la persona y elige su rol dentro de la parroquia: administrador o catequista.

La persona recibe un correo para crear su cuenta. Una vez que acepte, aparecerá en la lista y podrás asignarle un grupo/libro si es catequista.

- Un administrador de parroquia puede gestionar grupos/libros, niños, usuarios y ver todos los reportes.
- Un catequista solo ve y registra asistencia de su propio grupo/libro.`,
  },
  {
    id: "crear-grupos",
    category: "Niños y grupos/libros",
    title: "Crear un grupo/libro de catecismo",
    keywords: ["grupo", "libro", "clase", "nivel", "catequista asignado"],
    content: `Ve a "Grupos/Libros" → "Nuevo". Dale un nombre (por ejemplo "Primera Comunión A"), un nivel opcional, y asigna un catequista si ya lo invitaste.

Solo el administrador de la parroquia puede crear, editar o eliminar grupos/libros.`,
  },
  {
    id: "alta-ninos",
    category: "Niños y grupos/libros",
    title: "Dar de alta a un niño y su código QR",
    keywords: ["niño", "alta", "registrar", "qr", "código", "curp"],
    content: `Ve a "Niños" → "Nuevo". Captura el nombre completo, fecha de nacimiento opcional, CURP opcional (si es mexicano o residente) y el grupo/libro al que pertenece.

Al guardar, se genera automáticamente un código QR único e infalsificable para ese niño — nadie puede adivinarlo ni duplicarlo.

Para imprimir o descargar la tarjeta con el QR, entra al niño desde la lista y usa los botones "Descargar PNG" o "Imprimir".`,
  },
  {
    id: "dar-de-baja",
    category: "Niños y grupos/libros",
    title: "Dar de baja o reactivar a un niño",
    keywords: ["baja", "inactivo", "reactivar", "eliminar niño"],
    content: `Un niño no se elimina — se marca como inactivo desde su ficha ("Dar de baja"). Un niño inactivo no puede registrar asistencia al escanear su QR, pero su historial se conserva.

Puedes reactivarlo en cualquier momento desde el mismo botón.`,
  },
  {
    id: "escanear",
    category: "Asistencia",
    title: "Escanear asistencia",
    keywords: ["escanear", "qr", "cámara", "registrar asistencia", "presente"],
    content: `Ve a "Escanear", activa la cámara y apunta al código QR del niño. Si eres administrador, primero elige el grupo/libro; si eres catequista, se usa tu grupo/libro asignado automáticamente.

Escanear el mismo código dos veces el mismo día no genera un registro duplicado — verás el aviso "Ya registrado hoy".

El código QR de un niño inactivo no registra asistencia.`,
  },
  {
    id: "reportes",
    category: "Asistencia",
    title: "Ver reportes de asistencia y faltas",
    keywords: ["reporte", "asistencia", "faltas", "gráfica", "por fecha"],
    content: `Ve a "Reportes". Puedes filtrar por grupo/libro y por rango de fechas.

La gráfica de barras muestra cuántos niños asistieron en cada fecha. Abajo, "Faltas acumuladas por niño" muestra, para cada niño activo, cuántas sesiones tuvo su grupo/libro, a cuántas asistió y cuántas faltó — ordenado con las más faltas primero.`,
  },
  {
    id: "tutores",
    category: "Tutores y Premium",
    title: "Agregar tutores a un niño",
    keywords: ["tutor", "padre", "madre", "recoger", "autorizado", "premium"],
    content: `Desde la ficha del niño, sección "Tutores", puedes agregar nombre, teléfono, correo, CURP opcional, relación y si está autorizado para recoger al niño.

Agregar tutores es una función Premium. Tu parroquia empieza en el plan gratuito, donde se puede ver pero no agregar tutores nuevos — los que ya registraste siguen visibles y los puedes eliminar cuando quieras. Para agregar tutores hay que activar el plan Premium.`,
  },
  {
    id: "premium",
    category: "Tutores y Premium",
    title: "Plan Premium y licencia",
    keywords: ["premium", "licencia", "plan", "precio", "pago", "gratis", "free"],
    content: `CateqHub es gratis por default: la asistencia por QR, los reportes básicos y el alta de niños/grupos/libros no tienen costo ni vencimiento. El plan Premium suma tutores, mensajería a tutores, tareas de catecismo y pulseras/etiquetas físicas.

Ve a "Premium" para ver el estado de tu parroquia (gratuito o activo) y el precio de referencia. Ahí mismo se explica cómo activar el plan.`,
  },
  {
    id: "permisos",
    category: "Cuenta y permisos",
    title: "Qué puede hacer cada rol",
    keywords: ["permisos", "roles", "administrador", "catequista", "quien puede"],
    content: `CateqHub tiene dos roles dentro de cada parroquia: administrador y catequista. Ve a "Permisos" (solo visible para administradores) para ver exactamente qué puede hacer cada uno en cada sección de la app.`,
  },
  {
    id: "soporte",
    category: "Soporte",
    title: "Pedir ayuda o reportar un problema",
    keywords: ["soporte", "ticket", "ayuda", "problema", "contacto", "error"],
    content: `Ve a "Soporte" → "Nuevo ticket". Describe el problema o tu solicitud, elige categoría y prioridad. Podrás ver la respuesta y seguir la conversación desde la misma sección.`,
  },
];
