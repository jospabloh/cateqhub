// Fuente única de verdad para la versión de CateqHub — consumida por
// src/pages/About.jsx.
//
// NO edites este archivo a mano para publicar: `npm run release <version>
// --nota "…"` escribe APP_VERSION, RELEASE_DATE, la entrada de CHANGELOG de
// aquí, la de CHANGELOG.md y la versión de package.json de una sola vez
// (módulo 6 del estándar). Antes eran cuatro ediciones manuales garantizadas
// por un comentario, y así se perdió la 1.8.0 entera de CHANGELOG.md.
// tests/unit/release.test.js afirma los invariantes después.
export const APP_VERSION = "1.10.3";
export const RELEASE_DATE = "2026-09-21";

export const CHANGELOG = [
  {
    version: "1.10.3",
    date: "2026-09-21",
    changes: [
      "Auditoría rutinaria: dependencia vulnerable corregida. `npm audit` reportó `js-yaml` (alta, GHSA-2883-xcg3-v3hh: `maxTotalMergeKeys` no limita el uso de CPU con fuentes de merge vacías) — es dependencia transitiva de ESLint (herramienta de desarrollo, no llega al bundle ni al servidor), corregida sin cambios de comportamiento vía `npm audit fix` (4.3.1 → 4.3.2). `react-router`/`react-router-dom` (moderada, redirección abierta) sigue como riesgo aceptado sin cambio — la corrección real requiere la migración mayor 6→7, fuera de alcance de una rutina automatizada, como en cada auditoría desde la 1.9.3. Se corrió el conjunto completo de verificaciones: `npm run lint` (incl. `validate:functions`, 17/40 endpoints), `npm run validate:rls` (11 entidades, 10 con alcance de parroquia, limpio), `npm run test:unit` (45/45), `npm run build` + `verify-build`, y `e2e/smoke.spec.js` (8/8, corrido localmente contra el preview build). Sin cambios de esquema ni de función desde la pasada del módulo 14 del 2026-09-10 (`git log --since=2026-09-10 -- base44/` vacío), así que ese módulo no vence todavía por su propio disparador (entidad/función/rol nuevos). Revisión de secretos: ningún `.env*\\' comiteado, sin secretos embebidos. Revisión de PII en logs: `console.error` de `export_parish_data` sólo registra el nombre de la entidad y el mensaje de error, no datos. No verificado en esta pasada (mismo criterio de honestidad de siempre): esquema RLS **desplegado** vs. el del repo (sin MCP de Base44 en este entorno — el chequeo estático de `validate:rls` sí corrió), `npm run test:smoke` contra el sitio servido (el proxy de salida no alcanza esos dominios), y cualquier pantalla autenticada (sin sesión Base44 real). El reaper de sesiones a 48h (módulo 20) y su prueba de `CRON_SECRET` (módulo 16) siguen sin quien los invoque — pendiente de leer la URL de la función en el panel de Base44, que este entorno no tiene; no es un hallazgo nuevo, sigue igual que el 2026-09-09.",
    ],
  },
  {
    version: "1.10.2",
    date: "2026-09-10",
    changes: [
      "Se quita la oferta de licenciamiento multi-parroquia para diócesis, de la pantalla de suscripción y del tramo de implementación asistida. Una diócesis puede tener varias parroquias en CateqHub, pero una misma persona no puede pertenecer a dos: assign_parish_user rechaza dar de alta a quien ya está en otra. Mientras eso siga así, el coordinador de una diócesis necesita una cuenta de correo por parroquia, y ofrecer un precio preferencial por algo que no se puede operar es venderlo antes de construirlo.",
      "El tramo de implementación asistida deja de llamarse «501+ niños activos o diócesis» y pasa a «501 o más niños activos», que es lo único que ese tramo mide de verdad.",
    ],
  },
  {
    version: "1.10.1",
    date: "2026-09-09",
    changes: [
      "Corrección a la 1.10.0. Esa entrada decía que «mensajería a tutores, tareas de catecismo y diseño de pulseras/gafetes dejan de estar bloqueados». Es falso en tres de los cuatro términos: mensajería, tareas y pulseras no estaban bloqueadas — no existen. No tienen ruta, ni componente, ni entidad que las guarde. Lo único que sí se desbloqueó fue Tutores.",
      "Las tres se quitan de la lista de funciones incluidas de la pantalla de suscripción y del manual. Siguen en el tablero como vista previa bloqueada, que es donde el app ya las nombraba correctamente: el comentario de PremiumLockedPanel dice literalmente «funciones premium que aún no existen». El producto se contradecía a sí mismo en dos pantallas, y la página pública las vendía dentro de un plan de pago.",
      "Lo que la app hace hoy, y es lo que queda anunciado: asistencia por código QR, alta de parroquia/grupos/niños, reportes por fecha y grupo, faltas acumuladas por niño, tutores con autorización de recogida, y gafetes imprimibles con QR (individuales o en hoja de hasta 9, con descarga en PNG, SVG o PDF).",
      "El tablero deja de llamarlas «Próximamente en Premium»: ya no hay un plan Premium del que dependan, así que dicen «Todavía no está disponible» bajo el encabezado «En camino». Cuando existan entrarán en el mismo plan, sin costo aparte.",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-09-09",
    changes: [
      "CateqHub pasa a ser un solo producto con precio por volumen. El plan Gratis (hasta 50 niños activos, sin tutores/mensajería/tareas/pulseras) deja de existir: no era un producto que ACACIA vendiera —la tabla de precios pública empezaba en 51 niños, así que una parroquia de 50 o menos no tenía forma de pagar— y era además la desviación que impedía cumplir el módulo 1 del estándar del portafolio, que define exactamente cuatro estados y ninguno gratuito.",
      "Todo va incluido para todas las parroquias: tutores y autorización de recogida, mensajería a tutores, tareas de catecismo y diseño de pulseras/gafetes dejan de estar bloqueados. Desaparece también el tope de 50 niños activos, tanto en el alta como en la reactivación.",
      "Los precios pasan de 7 tramos a 3, y el primero arranca en el primer niño: hasta 150 niños $500 MXN al mes, de 151 a 500 $900 MXN, de 501 en adelante a cotizar. Los tramos del servicio de implementación se realinean a las mismas fronteras sin cambiar de precio.",
      "Si el período de prueba o de pago vence sin renovarse, ahora aplica el mismo ciclo a toda parroquia sin importar su tamaño: solo lectura, después acceso restringido, con exportación de los datos de Tutores antes de cualquier eliminación. Antes, una parroquia de 50 niños o menos bajaba al plan Gratis y nunca entraba a ese ciclo.",
    ],
  },
  {
    version: "1.9.11",
    date: "2026-09-09",
    changes: [
      "Corrección al registro de versiones: el cierre del módulo 15 (puente con Mission Control) nunca tuvo entrada aquí. Entre la 1.9.9 y esta versión, `base44/functions/acaciaControl/_acaciaSign.ts` cambió — `ACCEPT_LEGACY_MASTER` pasó a `false`, ya desplegado (detalle completo en `CLAUDE.md`, sección Módulo 15) — dejando de aceptar una firma hecha con el secreto maestro compartido por las diez apps del portafolio. Quedó documentado solo en `CLAUDE.md` y nunca en este changelog versionado. Un primer borrador de esta misma entrada decía que el único cambio desde 1.9.9 eran dos bumps de dependencias — incorrecto, detectado por una revisión automatizada sobre el PR de esta rutina antes de mergear (el chequeo había comparado `base44/entities/` contra la 1.9.9 pero no `base44/functions/`). Corregido aquí.",
      "Auditoría rutinaria: se corrió de nuevo el conjunto completo de verificaciones automatizadas (`validate:rls` — 10 entidades, 9 con alcance de parroquia, limpio; `lint` incl. `validate:functions` — 15 endpoints de 40 permitidos; `build` + `verify-build`; `e2e/smoke.spec.js` 8/8; `npm audit`). Aparte del cambio de `acaciaControl` de arriba, el único movimiento en el repo desde la 1.9.9 fueron dos actualizaciones automáticas de `@base44/sdk` (0.8.43→0.8.44) y `@base44/vite-plugin` (1.0.30→1.0.31) por el bot de Base44, sin tocar ningún `.jsonc` de esquema. Sin hallazgos nuevos. `react-router`/`react-router-dom` (moderada, redirección abierta) sigue como riesgo aceptado sin cambio — la migración mayor 6→7 sigue fuera de alcance de una rutina automatizada. `migrate_free_parishes_to_trial` y `seed_test_parish` siguen sin llamador visible en el repo pero ambas siguen exigiendo rol de administrador de plataforma en el propio código.",
      "No verificado en esta pasada (mismo criterio del módulo 14): sin acceso al MCP de Base44 desde este entorno, no se pudo comparar el esquema `rls` desplegado contra el del repo — solo el chequeo estático de `validate:rls` corrió; sin sesión autenticada real, no se ejercitaron las pantallas ni los escenarios de UAT por rol; `npm run test:smoke` contra el sitio desplegado no corre desde este entorno (el proxy no alcanza esos dominios, por diseño — ver CLAUDE.md), así que rendimiento y Core Web Vitals en producción no se midieron esta vez. Este repo no tiene ninguna función de envío de correo propia (`base44/functions/` no trae ningún `send_*`) — el correo de autenticación (invitación, restablecer contraseña) lo maneja la plataforma Base44, fuera del alcance de este repositorio.",
    ],
  },
  {
    version: "1.9.10",
    date: "2026-09-07",
    changes: [
      "Mantenimiento/seguridad: auditoría rutinaria de dependencias — `npm audit fix` corrigió 4 de 6 vulnerabilidades (1 alta en `browserslist`, agotamiento de memoria sin límite de caché; 3 moderadas/bajas en `@humanfs/node`, `fflate` y `postcss-selector-parser`), todas mediante actualizaciones menores sin cambios de comportamiento. `react-router`/`react-router-dom` (moderada, redirección abierta — GHSA-wrjc-x8rr-h8h6) sigue como riesgo aceptado sin cambio: la única corrección disponible sigue siendo la migración mayor a 7.x, fuera de alcance de una rutina automatizada — documentado igual desde la 1.9.3.",
      "Auditoría rutinaria: RLS (`npm run validate:rls`, 10 entidades, aislamiento por `parish_id` intacto), `npm run lint`, `npm run build` y `npm run functions:audit` limpios; `tsc` en el mismo recuento preexistente de 470 errores (sin relación con este cambio); `e2e/smoke.spec.js` 8/8 aprobadas. Sin hallazgos nuevos de severidad media o alta. Módulos 14/15 (aislamiento multi-tenant y firma del puente con Mission Control) re-verificados: el único archivo tocado desde la última pasada (`base44/functions/acaciaControl/_acaciaSign.ts`, el vaivén de `ACCEPT_LEGACY_MASTER` documentado el 2026-08-24) sigue en el estado correcto (`false`) — sin cambios de esquema ni de funciones que ameriten repetir la auditoría completa.",
    ],
  },
  {
    version: "1.9.9",
    date: "2026-08-24",
    changes: [
      "Rendimiento: las pantallas detrás del inicio de sesión (Panel, Escanear, Niños, Reportes, Usuarios, etc.) ahora se cargan bajo demanda (`React.lazy`) en vez de venir todas en el mismo archivo que Ingresar/Crear cuenta. El paquete principal que descarga cualquier visitante — incluida la mitad que solo ve la pantalla de login — bajó de 1.93 MB a 437 KB minificados (–77%); nadie que no entre a Reportes o a Escanear vuelve a pagar el peso de esas pantallas.",
      "Auditoría rutinaria: revisión completa de seguridad (RLS contra el validador estático, secretos, XSS/inyección, PII en logs, dependencias), calidad de código, permisos, CI, pruebas automatizadas (8/8 e2e) y funciones de backend — sin hallazgos nuevos de severidad media o alta. `react-router`/`react-router-dom` (moderada, redirección abierta con variante XSS) sigue como riesgo aceptado sin cambio: la corrección real sigue requiriendo la migración mayor 6→7, fuera de alcance de esta rutina. `migrate_free_parishes_to_trial` y `seed_test_parish` siguen sin llamador visible en el repo pero ambas exigen rol de administrador de plataforma en el propio código — confirmado de nuevo, no se tocaron.",
    ],
  },
  {
    version: "1.9.8",
    date: "2026-08-18",
    changes: [
      "Tema oscuro: CateqHub ahora tiene un interruptor de tema claro/oscuro (icono de sol/luna en la barra lateral y en la barra superior en celular) — antes la app ya tenía toda la paleta de colores lista para modo oscuro pero no había forma de activarla. Se respeta tu elección entre sesiones y, si nunca elegiste una, se usa el modo del sistema operativo. Se corrigieron además 3 avisos (en la ficha del niño, en Premium y en el aviso de licencia) que quedaban con fondo claro fijo aunque activaras el modo oscuro.",
    ],
  },
  {
    version: "1.9.7",
    date: "2026-08-18",
    changes: [
      "Seguridad (crítico): la regla de eliminación de `Parish` permitía a cualquier administrador de parroquia borrar la parroquia de OTRO administrador — la condición que le daba paso al rol \"administrador de parroquia\" no comprobaba a cuál parroquia pertenecía, solo el rol. Las de crear/editar tenían el mismo defecto (editar, sin llegar a borrar). Ya corregido y publicado en el esquema en vivo de inmediato al detectarse — un administrador de parroquia ahora solo puede editar/eliminar la suya. Se agregó además un chequeo nuevo al validador de RLS (`npm run validate:rls`) que detecta esta clase específica de error (un rol propio del tenant sin la condición de \"solo tu propio tenant\" combinada) para que no pueda repetirse sin que CI lo note — no lo detectaba antes porque, a diferencia de los defectos que el validador ya cazaba, esta regla era sintácticamente válida; el problema era puramente que permitía de más.",
      "Cuenta y zona de peligro: Usuarios ahora tiene un botón para quitar a un catequista o administrador de tu parroquia (antes solo se podía invitar, asignar o editar, nunca remover) — protegido para que nadie pueda quitarse a sí mismo ni quitar al último administrador de la parroquia. Parroquia ahora tiene \"Descargar mis datos\" (niños, grupos/libros, tutores y asistencias en JSON) y una zona de peligro para solicitar la eliminación permanente de la parroquia — vía un ticket de soporte, no un borrado instantáneo, porque eliminar el registro de la parroquia no borra en cascada sus niños/grupos/tutores/asistencias.",
    ],
  },
  {
    version: "1.9.6",
    date: "2026-08-18",
    changes: [
      "Mantenimiento: se agregó un validador estático de RLS (`npm run validate:rls`, bloqueante en CI) que revisa las 10 entidades de `base44/entities/*.jsonc` en cada push/PR — hasta ahora este repo dependía solo de revisión manual (las auditorías 1.9.3-1.9.5 de este mismo changelog). Las reglas ya eran correctas; este cambio evita que una futura edición las regrese sin que nadie lo note antes de publicar. Portado del guard equivalente en stockflow/puntos, adaptado al campo `parish_id` de CateqHub.",
    ],
  },
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
