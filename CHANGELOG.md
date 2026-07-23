# Changelog

Todas las versiones notables de CateqHub. Fuente estructurada en `src/lib/appConfig.js` (consumida por la página "Acerca de" dentro de la app); este archivo es la versión en prosa.

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
