// Manual de usuario de CateqHub. Igual que en stockflow/flowfin: un arreglo
// de artículos hardcodeado (no una entidad ni un CMS), revisado a mano en cada
// versión. `content` es texto plano; los párrafos se separan con línea en
// blanco y las líneas que empiezan con "- " se muestran como lista.
export const MANUAL_LAST_REVIEWED = "2026-07-27";

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
- Por default, un catequista solo ve y registra asistencia de su propio grupo/libro — el administrador puede ampliar esto desde "Permisos".`,
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

Para imprimir o descargar la tarjeta con el QR, entra al niño desde la lista y usa los botones "Descargar PNG" o "Imprimir". La tarjeta lleva el nombre del niño arriba del código QR, con guías de corte — sin ningún otro dato.

No hay tope de niños: puedes dar de alta a todos los de tu parroquia. El número de niños activos es lo que determina tu tramo de precio mensual.`,
  },
  {
    id: "gafetes-lote",
    category: "Niños y grupos/libros",
    title: "Imprimir gafetes QR de varios niños a la vez",
    keywords: ["gafete", "gafetes", "imprimir", "qr", "lote", "hoja", "pdf"],
    content: `Ve a "Niños", selecciona a los niños que necesitas (casilla junto a cada nombre) y usa "Imprimir gafetes". Se arma una hoja carta con hasta 9 tarjetas QR, con navegación entre páginas si seleccionaste más.

Desde ahí puedes imprimir directamente o descargar la hoja como PNG, SVG o PDF — el PDF incluye todas las páginas si seleccionaste más de 9 niños. Igual que el gafete individual, cada tarjeta lleva el nombre del niño y el código QR con guías de corte.`,
  },
  {
    id: "cambiar-grupo-nino",
    category: "Niños y grupos/libros",
    title: "Cambiar el grupo/libro de un niño",
    keywords: ["cambiar grupo", "reasignar", "mover niño", "grupo/libro"],
    content: `Desde la ficha del niño, usa "Cambiar" junto al grupo/libro actual y elige el nuevo. Requiere el permiso "Cambiar el grupo/libro de un niño" (los administradores siempre lo tienen; para catequistas se activa en "Permisos").

Después de un cambio, el niño muestra un aviso "Cambió de grupo/libro" durante 7 días — útil si trabajas con gafetes o listas impresas organizadas por grupo, para saber que ese niño ya no está donde dice el papel.`,
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
    keywords: ["escanear", "qr", "cámara", "registrar asistencia", "presente", "grupo automático"],
    content: `Ve a "Escanear", activa la cámara y apunta al código QR del niño. Ya no eliges un grupo/libro antes de empezar: cada código trae consigo el grupo del niño, así que una sola estación de escaneo puede recibir a niños de cualquier grupo, uno tras otro.

Si el niño no tiene grupo/libro asignado, o está inactivo, el escaneo se rechaza con un mensaje explicando por qué. Un catequista sin el permiso "Escanear niños de cualquier grupo/libro" (ajustable en "Permisos") solo puede registrar asistencia de niños de su propio grupo/libro; si intenta escanear a otro, ve el aviso "Este niño no pertenece a tu grupo/libro" y no se registra nada.

Escanear el mismo código dos veces el mismo día no genera un registro duplicado — verás el aviso "Ya registrado hoy".`,
  },
  {
    id: "reportes",
    category: "Asistencia",
    title: "Ver reportes de asistencia y faltas",
    keywords: ["reporte", "asistencia", "faltas", "gráfica", "por fecha", "detalle"],
    content: `Ve a "Reportes". Puedes filtrar por grupo/libro y por rango de fechas. Arriba verás un resumen rápido: clases registradas, asistencia promedio y el niño con más faltas en el rango.

La gráfica de barras muestra cuántos niños asistieron en cada fecha — tócala (o toca una fecha en "Ver tabla de datos") para abrir el detalle de ese día: quién asistió y quién faltó, agrupado por grupo/libro, con enlace directo a la ficha de cada niño.

Abajo, "Faltas acumuladas por niño" muestra, para cada niño activo, cuántas sesiones tuvo su grupo/libro, a cuántas asistió y cuántas faltó — ordenado con las más faltas primero. Toca a un niño para ver su historial sesión por sesión (presente/falta en cada fecha) y un enlace a su perfil completo.`,
  },
  {
    id: "tutores",
    category: "Tutores y Premium",
    title: "Agregar tutores a un niño",
    keywords: ["tutor", "padre", "madre", "recoger", "autorizado", "premium"],
    content: `Desde la ficha del niño, sección "Tutores", puedes agregar nombre, teléfono, correo, CURP opcional, relación y si está autorizado para recoger al niño.

Tutores viene incluido, como todo lo demás. Toda parroquia nueva arranca con 30 días sin costo; al terminar, se activa la suscripción. Si el período vence sin renovarse, la app entra en solo lectura y después en acceso restringido — lo que ya registraste sigue visible y lo puedes exportar.`,
  },
  {
    id: "premium",
    category: "Tutores y Premium",
    title: "Precio, prueba de 30 días y licencia",
    keywords: ["premium", "licencia", "plan", "precio", "pago", "prueba", "trial", "suscripción", "tramo"],
    content: `CateqHub es un solo plan con todo incluido: asistencia por QR, alta de parroquia/grupos/niños, reportes, tutores y autorización de recogida, y gafetes imprimibles con QR. El precio depende solo del número de niños activos de tu parroquia: hasta 150, $500 MXN al mes; de 151 a 500, $900 MXN; de 501 en adelante, contáctanos.

Mensajería a tutores, tareas de catecismo y pulseras aparecen en el tablero como vista previa: todavía no están construidas y no se cobran aparte cuando lo estén — entran en el mismo plan.

Toda parroquia nueva arranca automáticamente con 30 días sin costo y sin tarjeta. Si el período de prueba (o de pago, una vez activada la suscripción) vence sin renovarse, la app entra en solo lectura y después en acceso restringido, hasta reactivar. Los datos de niños, grupos y asistencia nunca se eliminan por falta de pago; solo los de Tutores, y solo tras haber podido exportarlos.

Ve a "Premium" para ver el estado de tu parroquia (días restantes de prueba, niños activos frente al tope, plan activo o pausado) y la tabla de precios completa.`,
  },
  {
    id: "permisos",
    category: "Cuenta y permisos",
    title: "Qué puede hacer cada rol — y cómo ajustarlo",
    keywords: ["permisos", "roles", "administrador", "catequista", "quien puede", "ajustar", "matriz"],
    content: `CateqHub tiene dos roles dentro de cada parroquia: administrador y catequista. El administrador tiene acceso total (grupos/libros, usuarios, parroquia y todos los niños) y eso no es configurable — puede haber más de un administrador por parroquia.

Ve a "Permisos" (solo visible para administradores) para ajustar qué puede hacer el catequista, permiso por permiso:

- Ver niños de todos los grupos/libros, o solo el propio.
- Cambiar el grupo/libro de un niño.
- Dar de baja o reactivar niños.
- Escanear niños de cualquier grupo/libro, o solo el propio.
- Ver y filtrar reportes de todos los grupos/libros, o solo el propio.
- Agregar tutores (además requiere que la parroquia tenga el plan Premium activo).

Los cambios se guardan por parroquia y se aplican de inmediato a todos los catequistas ya asignados — no hace falta reinvitarlos. Estos permisos controlan comportamiento real de la app (incluido el backend), no solo lo que se muestra en pantalla; las secciones reservadas al administrador (Usuarios, Parroquia, Premium, gestión de Grupos/Libros) no aparecen aquí porque están protegidas también a nivel de base de datos.`,
  },
  {
    id: "soporte",
    category: "Soporte",
    title: "Pedir ayuda o reportar un problema",
    keywords: ["soporte", "ticket", "ayuda", "problema", "contacto", "error"],
    content: `Ve a "Soporte" → "Nuevo ticket". Describe el problema o tu solicitud, elige categoría y prioridad. Podrás ver la respuesta y seguir la conversación desde la misma sección.`,
  },
];
