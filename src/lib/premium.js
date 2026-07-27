import { useMemo } from "react";

// Ya no hay plan gratuito permanente. Toda parroquia nueva arranca en
// plan="premium" con una prueba de 30 días (premium_period_end_at), con
// acceso completo a TODA la app — núcleo (asistencia, niños, grupos,
// reportes) y Tutores/mensajería/tareas/pulseras por igual. `plan` solo se
// escribe con rol de servicio (Mission Control o el panel de Base44) — un
// admin de parroquia no puede activarse el plan a sí mismo.
//
// `license_status` (solo relevante si plan=premium) sigue el ciclo:
// active → read_only → access_denied → deletion_eligible si el período
// (prueba o pago) vence sin renovarse — escrito por Mission Control. Este
// ciclo aplica a toda la app, no solo a Tutores.
//
// plan="free" ya no se asigna a parroquias nuevas: solo lo alcanza una
// parroquia como estado terminal, después de que sus datos de Tutores se
// borraron tras deletion_eligible (ver license-delete-premium-data en
// Mission Control) — en ese estado el núcleo vuelve a ser de solo lectura y
// Tutores/mensajería/tareas/pulseras dejan de aplicar, hasta reactivar
// Premium. Por eso, para efectos de la interfaz, plan="free" se trata como
// "read_only": Child/Group/Attendance.jsonc en base44/entities siguen
// permitiendo lectura en plan="free", solo bloquean escritura.
export function getLicenseStatus(parish) {
  const isPremium = parish?.plan === "premium";
  const status = isPremium ? (parish?.license_status || "active") : "read_only";
  return {
    tier: isPremium ? "premium" : "free",
    isPremium,
    status,
    isReadOnly: status !== "active",
    isAccessDenied: status === "access_denied" || status === "deletion_eligible",
    exportConfirmed: !!parish?.export_confirmed_at,
    trialEndsAt: parish?.premium_period_end_at || null,
  };
}

export function useLicenseStatus(parish) {
  return useMemo(
    () => getLicenseStatus(parish),
    [parish?.id, parish?.plan, parish?.license_status, parish?.export_confirmed_at, parish?.premium_period_end_at]
  );
}

// Alias de compatibilidad — mismo shape que antes (tier/isPremium), más los
// campos nuevos. No romper mientras se termina de migrar cada consumidor.
export const getPremiumStatus = getLicenseStatus;
export const usePremiumStatus = useLicenseStatus;
