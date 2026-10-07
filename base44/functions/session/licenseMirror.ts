// Lógica pura, sin imports, para que `node --test` la cargue (mismo patrón que
// assign_parish_user/joinRequests.ts).
//
// Guardian/Child/Group/Attendance/ChildGuardian exigen en su `read` que el User
// traiga `parish_license_status`, porque la RLS de Base44 no puede consultar otra
// fila. Un campo AUSENTE no iguala a nada, así que una cuenta sin el espejo no lee
// un solo niño — sin error, sin aviso: la lista sale vacía. Pasó con la cuenta
// administradora de la única parroquia en producción, y duró semanas porque la
// única vía de repararla era que alguien corriera backfill_parish_license_mirror a
// mano.
//
// Esto devuelve el parche que repara ESA cuenta, o null si no hace falta tocar
// nada. Sólo copia lo que la propia parroquia del usuario dice — el mismo
// contenido que escribe membershipPatch — y nunca decide por su cuenta qué
// licencia tiene alguien: si no puede leer la parroquia, no hay parche.

export type ParishLicense = {
  plan?: string | null;
  license_status?: string | null;
  support_priority_addon?: boolean | null;
};

export type MirrorFields = {
  parish_plan?: string | null;
  parish_license_status?: string | null;
};

export function licenseMirrorPatch(
  user: MirrorFields,
  parish: ParishLicense | null | undefined,
) {
  // Sin parroquia legible no se asume nada: asumir "active" ante un error
  // transitorio le daría acceso a una parroquia que quizá está access_denied.
  if (!parish) return null;

  const missing = !user.parish_plan || !user.parish_license_status;
  if (!missing) return null;

  return {
    // Una parroquia creada antes de que existiera `plan` no lo trae. Desde la
    // 1.10.0 hay un solo producto, así que resuelve a 'premium' — nunca 'free'.
    parish_plan: parish.plan ?? 'premium',
    parish_license_status: parish.license_status ?? 'active',
    parish_support_priority_addon: parish.support_priority_addon ?? false,
  };
}
