// Roles a nivel tenant (parroquia). El `role` nativo de la plataforma
// (admin = propietario de la app) solo identifica al dueño; los permisos
// reales dentro de una parroquia se controlan con `parish_role`.
export const isParishAdmin = (user) =>
  user?.parish_role === "admin" || user?.role === "admin";

export const isCatechist = (user) => !isParishAdmin(user);

export const parishRoleLabel = (user) =>
  isParishAdmin(user) ? "Administrador" : "Catequista";