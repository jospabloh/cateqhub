# Changelog

Todas las versiones notables de CateqHub. Fuente estructurada en `src/lib/appConfig.js` (consumida por la página "Acerca de" dentro de la app); este archivo es la versión en prosa.

## 1.9.5 — 2026-08-11

- **Corrección de UX/permisos**: en la ficha del niño, el botón para quitar a un tutor (`ChildDetail.jsx`) se mostraba a cualquier catequista aunque la regla de base de datos (desde 1.9.3) exige ser administrador de parroquia para poder borrar el vínculo `ChildGuardian`. No era un hueco de seguridad — el borrado seguía rechazado por RLS — pero un catequista que lo intentaba veía un aviso genérico de "no se pudo quitar al tutor" sin saber que era por falta de permiso. Ahora el botón solo se muestra a quien puede usarlo, igual que el resto de acciones reservadas a administrador en la misma pantalla.
- **Corrección de manejo de errores**: en Reportes, una falla al cargar la asistencia o los grupos/libros (sesión vencida, corte de red) dejaba la pantalla girando en su esqueleto de carga indefinidamente, sin aviso ni botón de reintento — la única salida era recargar la página a mano. Se alineó con el patrón ya usado en Dashboard, Niños, Grupos/Libros y Usuarios: aviso de error visible y `loading` siempre se apaga, incluso si la carga falla.
- **Auditoría rutinaria**: revisión completa de permisos y aislamiento de datos (RLS) contra el código real de las 10 entidades y de las funciones de backend con privilegio elevado (`assign_parish_user`, `add_guardian`, `create_child`, `update_child`, `record_attendance`, `sync_catequist_permissions`, `export_premium_data`, `acaciaControl`) — todas re-derivan `parish_id` y rol de la sesión autenticada o de la firma HMAC (`acaciaControl`), ninguna confía en un valor enviado por el cliente. Se revisaron también inyección (XSS/HTML), secretos embebidos, PII en logs y las pruebas automatizadas existentes (`e2e/smoke.spec.js`, 8/8 aprobadas). No se encontraron huecos nuevos ni de severidad alta o crítica.
- **Nota sobre el riesgo aceptado de `react-router`**: sigue sin haber una versión 6.x que corrija el aviso de redirección abierta documentado desde 1.9.3 (`npm audit` confirma que el rango vulnerable llega hasta la última 6.x, 6.30.4) — la corrección real sigue requiriendo la migración mayor a 7.x, fuera de alcance de esta rutina. El catálogo de avisos vigente incluye ahora una variante (GHSA-jjmj-jmhj-qwj2) que describe la misma clase de redirección abierta con potencial de derivar en XSS, más específica que la redacción anterior — se deja anotado para quien planee la migración, sin cambiar la mitigación (riesgo aceptado, sin acción disponible hoy).
- Sin cambios de esquema (`base44/entities/*.jsonc` sin tocar) — no se requiere republicar nada en el panel de Base44 para esta versión.

## 1.9.4 — 2026-08-10

- **Mantenimiento/seguridad**: auditoría rutinaria de dependencias — se actualizaron `dompurify`, `js-yaml`, `nanoid` y `socket.io-parser` (transitiva) a versiones que corrigen vulnerabilidades conocidas (dos de severidad alta: `js-yaml` consumo de CPU cuadrático, `nanoid` generador vulnerable a bucle infinito; dos moderadas: `dompurify` XSS, `socket.io-parser` agotamiento de memoria). Sin cambios visibles para el usuario. Sigue pendiente `react-router`/`react-router-dom` (moderada, redirección abierta) — ya documentada en 1.9.3 como riesgo aceptado, requiere migración mayor 6→7.
- **Mantenimiento**: se eliminaron las dependencias `@stripe/react-stripe-js` y `@stripe/stripe-js`, declaradas en `package.json` pero sin ningún uso en el código (`grep` de `@stripe` en `src/` no arrojó resultados). El flujo de "Planes y precios" hoy no cobra por tarjeta — Premium y los add-ons quedan pendientes de confirmación manual con un ejecutivo de ACACIA. Sin cambios visibles para el usuario.
- **Auditoría rutinaria de seguridad — aislamiento por parroquia (RLS)**: se verificó, entidad por entidad en `base44/entities/*.jsonc`, que las 10 entidades del esquema (`Attendance`, `Child`, `ChildGuardian`, `Group`, `Guardian`, `Parish`, `PermissionProfile`, `SupportTicket`, `SupportTicketMessage`, `User`) ya tienen reglas `rls` explícitas de `create`/`read`/`update`/`delete` acotadas por `data.parish_id` (o reservadas al rol de plataforma `admin`). No se encontró ninguna entidad sin proteger. No se encontraron secretos, tokens ni credenciales embebidos en el repositorio; `.env*` sigue ignorado por git.
- **Nota para quien publique este cambio**: como en 1.9.3, las reglas `rls` viven en el repo pero solo quedan activas al publicarse desde el panel de Base44 — este cambio de dependencias no requiere republicar el esquema (no se tocó ningún `.jsonc`), pero conviene confirmar en el panel de Base44 que el esquema desplegado sigue coincidiendo con el del repo.

## 1.9.3 — 2026-08-03

- **Seguridad**: corregido un hueco de permisos en `ChildGuardian` (vínculo niño–tutor) — el borrado solo comprobaba que el registro perteneciera a la parroquia del usuario, sin exigir que fuera administrador de parroquia o de plataforma, a diferencia de `Child`, `Guardian`, `Group` y `Attendance`, que sí lo exigían. En la práctica, cualquier catequista autenticado podía desvincular al tutor autorizado para recoger a cualquier niño de la parroquia, incluso uno al que el administrador le había restringido explícitamente el permiso de "agregar tutores", y sin importar el estado de la licencia. Se alineó la regla con el resto de las entidades. También se cerró la misma inconsistencia en la edición directa de `Attendance` (no explotable desde la interfaz actual — ningún flujo de la app edita asistencia así hoy — pero quedaba abierta a nivel de esquema).
- **Nota para quien publique este cambio**: las reglas de acceso de datos (`rls`) viven en `base44/entities/*.jsonc` en este repo, pero no quedan activas hasta publicarse desde el panel de Base44 — fusionar este PR por sí solo no corrige el hueco en producción, ver instrucciones de publicación en el reporte de esta rutina.
- **Mantenimiento/seguridad**: se eliminó la dependencia `react-quill`/`quill` (no se usaba en ninguna pantalla), lo que resuelve por completo su vulnerabilidad de XSS conocida en vez de solo documentarla como riesgo aceptado. Se corrigió además una vulnerabilidad de severidad alta (denegación de servicio) en `brace-expansion`, una dependencia indirecta. Sin cambios visibles para el usuario. Sigue pendiente `react-router`/`react-router-dom` (moderada, redirección abierta) — el arreglo requiere una actualización de versión mayor (6→7) con pruebas de todas las rutas, se deja documentada como riesgo aceptado para una migración planeada.
- Corrección menor: el hook de permisos (`usePermissions`) ahora falla de forma segura (deniega acceso) si se usa fuera de su proveedor de contexto, en vez de conceder acceso por accidente. No se detectó ningún caso real en la app donde esto ocurriera — es una corrección defensiva, no un hueco explotado.
- Corrección de documentación: la entrada 1.7.0 de este historial decía que los permisos de "ver todos los grupos" (niños y reportes) ya se hacían cumplir también en el backend — eso solo es cierto para los permisos de *escritura* (cambiar/dar de baja niños, escanear cualquier grupo, agregar tutores). Los dos permisos de *lectura* de "ver todos los grupos" siguen siendo un filtro del lado de la pantalla, tal como se decidió intencionalmente en el diseño original (ver `docs/superpowers/specs/2026-07-25-permisos-granulares-design.md`) — un catequista restringido a su grupo que conozca o adivine el enlace directo de un niño de otro grupo puede ver su ficha. Queda documentado como riesgo aceptado de baja prioridad, no corregido en esta rutina.

## 1.9.2 — 2026-07-28

- **Mantenimiento/seguridad**: auditoría rutinaria de dependencias — se actualizaron `dompurify`, `js-yaml` y `postcss` a versiones que corrigen vulnerabilidades conocidas (XSS, consumo excesivo de CPU, y divulgación de archivos vía source maps, respectivamente). Sin cambios visibles para el usuario. Quedan pendientes dos vulnerabilidades moderadas (`react-router`, `quill`) cuyo arreglo requiere una actualización de versión mayor — se dejan documentadas para una migración planeada en vez de aplicarse a ciegas en esta rutina.

## 1.9.1 — 2026-07-28

- **Planes y precios**: se acotaron dos tramos más de mensualidad Premium que antes decían "Contáctanos" — 451-550 niños activos $1,100 MXN/mes, 551-650 $1,250 MXN/mes, mismo incremento de $150 por cada 100 niños que ya traían los tramos anteriores. 651+ (o diócesis con varias parroquias) sigue a cotización.

## 1.9.0 — 2026-07-28

- **Plan de cobro en 3 partes** ("Planes y precios"): implementación asistida opcional (cargo único, $1,490–$3,990 MXN según niños activos — migración de listas existentes, alta de catequistas, capacitación y diseño de gafete QR listo para imprimir), la mensualidad Premium de siempre sin cambio de precio, y soporte adicional a la carta ($550 MXN/hora, $990 MXN/sesión de capacitación extra, +$250 MXN/mes por soporte prioritario).
- **Soporte**: cada plan trae un tope de prioridad de ticket incluido (Gratis hasta Baja, Premium hasta Alta); el nuevo add-on de soporte prioritario lo sube a Urgente. El formulario de "Nuevo ticket" en Soporte ahora solo ofrece las prioridades que tu plan incluye.
- Puedes solicitar la implementación asistida o el soporte prioritario directamente desde "Planes y precios" — ambos quedan pendientes de confirmación de pago con tu ejecutivo de ACACIA, igual que la activación de Premium hoy (no hay cobro automático todavía).

## 1.7.2 — 2026-07-27

- **Gafetes QR**: la tarjeta impresa o descargada ahora muestra el nombre del niño arriba del código QR, para poder identificarlo a simple vista antes de escanearlo o entregarlo. Sigue sin llevar ningún otro dato (grupo/libro, CURP, logo, etc.) — aplica tanto al gafete individual (ficha del niño) como a la hoja de gafetes por lote.

## 1.7.1 — 2026-07-27

- **Acerca de**: se agregó la información institucional que ya tienen las demás aplicaciones del portafolio ACACIA — Equipo desarrollador, Contacto y soporte directo (correo y WhatsApp), Derechos reservados (con la licencia registrada al correo de la persona que inició sesión) y un mensaje de cierre. Antes la página solo mostraba versión, historial de cambios y certificaciones de seguridad de Base44.

## 1.7.0 — 2026-07-27

- **Escanear**: se eliminó el selector de grupo/libro antes de escanear. Cada código QR trae consigo el grupo del niño, así que una sola estación de escaneo puede recibir a todos los grupos al mismo tiempo, sin riesgo de registrar a un niño bajo el grupo equivocado. Sigue bloqueando el registro si el niño está inactivo o no tiene grupo/libro asignado.
- **Permisos**: la sección pasó de ser una tabla informativa de solo lectura a una matriz editable. El administrador de la parroquia ahora decide, permiso por permiso, qué puede hacer el catequista: ver niños/reportes de todos los grupos, cambiar o dar de baja niños, escanear cualquier grupo, y agregar tutores. El cambio se aplica de inmediato a los catequistas ya asignados.
- **Seguridad**: esos mismos permisos (y el candado del plan Premium sobre Tutores) ahora se hacen cumplir también en el backend — antes una llamada directa a la API de entidades podía saltárselos, aunque la pantalla los respetara.
- **Gafetes QR por lotes**: desde "Niños" se pueden seleccionar uno o varios niños e imprimir o descargar (PNG, SVG o PDF) una hoja de gafetes con únicamente el código QR y guías de corte — sin nombre ni datos del niño. Se corrigieron además varios detalles de impresión: el QR ya llena la tarjeta completa y ya no se genera una segunda hoja casi en blanco.
- **Reportes**: la gráfica de asistencia por fecha y la tabla de faltas acumuladas ahora llevan al detalle. Tocar una barra (o una fecha en la tabla) muestra quién asistió y quién faltó ese día, agrupado por grupo/libro; tocar un niño en "Faltas acumuladas" muestra su historial sesión por sesión, ambos con enlace directo al perfil del niño. El tooltip de la gráfica también muestra el porcentaje de asistencia, no solo el conteo.
- Nuevo control en la ficha del niño para reasignar su grupo/libro (antes no existía en la interfaz), con un aviso de "cambió de grupo/libro" visible durante 7 días — útil para catequistas que trabajan con gafetes impresos organizados por grupo.
- Corrección: asignar un catequista a un grupo/libro ahora sí se guarda (el campo se escribía con el nombre equivocado y se perdía en silencio).
- Correcciones de manejo de datos sensibles: el borrado de datos Premium ya no se reporta como exitoso (`ok: true`) si una parte quedó sin borrar, y el registro de consentimiento de tratamiento de datos de una parroquia ya no puede reescribirse desde una llamada directa a la API — solo el administrador, y solo por el flujo previsto.

## 1.6.0 — 2026-07-23

- Ciclo de vida de licencia Premium: si el pago no se confirma, Tutores pasa primero a solo lectura y después a acceso denegado, con exportación autoservicio de tus datos antes de cualquier eliminación.
- La restricción del plan Premium en Tutores ahora se hace cumplir también en el backend, no solo en la pantalla.
- Nuevo aviso de manejo de datos sensibles (CURP y datos de menores) al crear una parroquia, conforme a la LFPDPPP.
- "Acerca de" ahora indica las certificaciones de seguridad de Base44, el proveedor de infraestructura.

## 1.5.0 — 2026-07-23

- El plan por default de `Parish` cambió de `trial` (90 días de funciones premium, luego bloqueo) a `free`: CateqHub arranca en el plan gratuito sin vencimiento, sin acceso a tutores/mensajería/tareas/pulseras hasta activar Premium. El límite de niños del plan gratuito todavía no está definido.
- Página Premium y Dashboard actualizados: ya no muestran cuenta regresiva de prueba, solo el estado gratuito/Premium.

## 1.4.0 — 2026-07-23

- **Seguridad crítica**: se agregó aislamiento de datos por parroquia (RLS) en `Parish`, `Group`, `Child`, `Guardian`, `ChildGuardian` y `Attendance`. Antes de este cambio, cualquier usuario autenticado podía leer o escribir datos de cualquier otra parroquia llamando la API de entidades directamente — el aislamiento solo existía en los filtros del lado del cliente.
- CURP (Clave Única de Registro de Población) opcional en el alta de niños y tutores, con validación de formato.
- Manual de usuario con búsqueda, sección de soporte con tickets, y esta página de changelog/"Acerca de".
- Sección de permisos visible solo para el administrador de la parroquia.
- Información de licencia/plan visible en la página Premium.
- Puente de integración con ACACIA Mission Control (`acaciaControl`), pendiente de activar el secreto compartido.

## 1.3.0 — 2026-07-22

- Rediseño minimalista de toda la interfaz: un solo tipo (Inter), un anillo de asistencia en el Dashboard y gráficas reales (barras, proporciones) en Reportes en vez de solo tablas.
- Marca oficial "CateqHub" (nombre y logo) en toda la aplicación, con el nombre de cada parroquia visible debajo.

## 1.2.0 — 2026-07-20

- Niveles premium: tutores, mensajería, tareas y pulseras/etiquetas como funciones de pago con periodo de prueba de 90 días; las funciones no construidas aún se muestran como vistas previas bloqueadas.
- Inicio de sesión rediseñado en formato de dos paneles.

## 1.1.0 — 2026-07-20

- Identidad visual completa de la aplicación.
- Integración continua (lint, build, verificación de artefactos, pruebas de humo) antes de cada cambio.

## 1.0.0 — 2026-07-20

- Primera versión: alta de parroquia, grupos y niños, generación de código QR único por niño, escaneo de asistencia y reportes básicos de asistencia y faltas.
