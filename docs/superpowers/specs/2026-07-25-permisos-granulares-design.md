# Permisos granulares para catequistas — diseño

## Problema

`src/pages/Permissions.jsx` es hoy una tabla estática de solo lectura: describe
en texto libre qué puede hacer cada rol, pero no controla nada — es puramente
informativa, y una de sus filas (escaneo restringido al propio grupo) ni
siquiera describe el comportamiento real del código (`Scan.jsx` no restringe
por grupo para ningún rol). No hay forma de que un administrador de parroquia
ajuste qué puede hacer un catequista sin editar código.

Se pidió mimetizar la sección y funcionalidad de Permisos de stockflow: una
matriz de permisos editable, por rol, persistida en backend, con toggles
por módulo/acción.

## Alcance

Stockflow es multi-tenant con roles configurables por negocio y una capa de
feature-flag (`TenantRule`) para activar el sistema granular gradualmente por
negocio, gobernada por un "platform owner" fijo. Asistencia-catecismo solo
tiene dos roles fijos por parroquia (`parish_role`: `admin` | `catequist`), y
el admin de parroquia siempre tiene acceso total (invariante ya usado en toda
la app). Por eso el diseño se reduce a lo que aporta valor real:

- Solo el rol `catequist` es editable — `admin` de parroquia y el `role`
  nativo de plataforma (`admin` = dueño de la app) mantienen acceso total no
  configurable, igual que hoy.
- Sin feature-flag ni infraestructura de `TenantRule`: el sistema queda
  siempre activo; mientras una parroquia no guarde su propio perfil, el
  comportamiento por defecto es idéntico al actual (restringido).
- Solo se hacen configurables los módulos/acciones donde la restricción es
  puramente de UI hoy (la RLS de la entidad ya permite la acción a cualquier
  miembro de la parroquia). Se excluyen explícitamente Grupos
  (crear/editar/eliminar), Usuarios, Parroquia y Premium/Permisos: esas
  acciones están bloqueadas a nivel de RLS o de función backend a
  `parish_role: admin`, así que "permitírselas" a un catequista desde esta
  matriz sería cosmético (backend seguiría rechazando) o, peor, engañoso.

## Registro de permisos (`src/lib/permissionRegistry.js`)

| Módulo     | Acción                  | Default (comportamiento actual) |
|------------|--------------------------|----------------------------------|
| ninos      | ver_todos_los_grupos     | false (solo su grupo) |
| ninos      | cambiar_grupo            | false (solo admin puede reasignar) |
| ninos      | dar_de_baja               | false (solo admin puede dar de baja/reactivar) |
| escanear   | cualquier_grupo           | true (hoy no hay restricción real) |
| reportes   | ver_todos_los_grupos     | false (solo su grupo) |
| tutores    | agregar                   | true (hoy solo depende de Premium, no de rol) |

Cada acción tiene `label`/`description` en español para la UI.

## Backend

### Entidad `PermissionProfile`

```jsonc
{
  "parish_id": "x-ref Parish",
  "role_key": "enum: catequist",
  "permissions": "object, 'modulo:accion' -> boolean"
}
```

RLS: lectura abierta a cualquier miembro de la parroquia (`data.parish_id ==
user.data.parish_id`) o admin de plataforma — así un catequista puede resolver
sus propios permisos sin pasar por la función backend. Escritura
(`create`/`update`/`delete`) restringida a `parish_role: admin` o admin de
plataforma.

### Función `permissions`

- `getPermissionProfiles`: devuelve el perfil `catequist` de la parroquia del
  usuario autenticado (defaults en memoria si no existe fila aún).
- `upsertPermissionProfile`: solo admin de parroquia/plataforma; crea o
  actualiza el perfil `catequist` de su parroquia.

Sin `seedDefaultPermissionProfiles` ni `backfillPermissionDefaults` — no hacen
falta sin feature-flag ni rol `admin` editable.

## Frontend

- `src/lib/PermissionContext.jsx`: nuevo provider (junto a `AuthProvider` en
  `App.jsx`) que expone `can(module, action)` y `reload()`. Admin de parroquia
  o de plataforma → siempre `true`. Catequista → valor del perfil cargado,
  con fallback al default del registro si la clave no está guardada.
- `src/components/permissions/PermissionMatrix.jsx`: matriz editable agrupada
  por módulo (Cards + Switch), con modo edición, botón Guardar/Cancelar y
  "Restaurar valores por defecto" — mismo patrón de interacción que
  `UnifiedPermissionMatrix` de stockflow, sin pestañas de rol (solo hay un rol
  editable).
- `src/pages/Permissions.jsx`: conserva las cards "Roles" y "Cómo se protege
  esto" (siguen siendo precisas y útiles), reemplaza la tabla estática por
  `PermissionMatrix`. Sigue detrás de `isParishAdmin`.
- Reemplazar los usos de `isCatechist(user)` relacionados con estos módulos en
  `Scan.jsx`, `Children.jsx`, `Reports.jsx` y `ChildDetail.jsx` por
  `can('modulo', 'accion')`, para que los toggles tengan efecto real. `Scan.jsx`
  gana una restricción que no existe hoy (filtrar por grupo cuando
  `escanear:cualquier_grupo` es `false`).

## Fuera de alcance

- Feature flag / activación gradual por parroquia.
- Hacer editable el rol `admin` de parroquia (sería cosmético: la app ya
  asume acceso total de admin en decenas de sitios).
- Tocar RLS de `Group`, `User` o las funciones de invitación/asignación — eso
  exigiría rediseñar la seguridad de esos módulos, no solo la UI de permisos.
