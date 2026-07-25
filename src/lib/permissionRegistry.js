// Catálogo de permisos configurables para el rol "catequista". El admin de
// parroquia (y el admin de plataforma) siempre tiene acceso total y no pasa
// por este registro — ver `isParishAdmin` en `roles.js`.
//
// Solo viven aquí los módulos/acciones donde restringir o permitir algo es
// puramente una decisión de la parroquia: la base de datos (RLS) ya permite
// la acción a cualquier miembro de la parroquia, así que el valor guardado
// aquí controla el comportamiento real de la app, no solo la interfaz.
export const PERMISSION_REGISTRY = {
  ninos: {
    label: "Niños",
    actions: [
      {
        id: "ver_todos_los_grupos",
        label: "Ver niños de todos los grupos",
        description: "Si está desactivado, el catequista solo ve y registra niños de su propio grupo.",
        default: false,
      },
      {
        id: "cambiar_grupo",
        label: "Cambiar el grupo de un niño",
        description: "Permite reasignar a qué grupo pertenece un niño desde su ficha.",
        default: false,
      },
      {
        id: "dar_de_baja",
        label: "Dar de baja / reactivar niños",
        description: "Permite marcar a un niño como inactivo o reactivarlo.",
        default: false,
      },
    ],
  },
  escanear: {
    label: "Escanear asistencia",
    actions: [
      {
        id: "cualquier_grupo",
        label: "Escanear niños de cualquier grupo",
        description: "Si está desactivado, el catequista solo puede registrar asistencia de niños de su propio grupo.",
        default: true,
      },
    ],
  },
  reportes: {
    label: "Reportes",
    actions: [
      {
        id: "ver_todos_los_grupos",
        label: "Ver y filtrar reportes de todos los grupos",
        description: "Si está desactivado, el catequista solo ve los reportes de su propio grupo.",
        default: false,
      },
    ],
  },
  tutores: {
    label: "Tutores",
    actions: [
      {
        id: "agregar",
        label: "Agregar tutores",
        description: "Requiere además que la parroquia tenga el plan Premium activo.",
        default: true,
      },
    ],
  },
};

export function permissionKey(module, action) {
  return `${module}:${action}`;
}

export function getRegistryDefaults() {
  const defaults = {};
  Object.entries(PERMISSION_REGISTRY).forEach(([module, data]) => {
    data.actions.forEach((action) => {
      defaults[permissionKey(module, action.id)] = action.default;
    });
  });
  return defaults;
}
