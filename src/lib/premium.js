import { useMemo } from "react";

// Plan Gratis, permanente: hasta FREE_PLAN_CHILD_CAP niños activos, con
// asistencia por QR, alta de parroquia/grupos/niños y reportes — sin
// vencimiento. Tutores/mensajería/tareas/pulseras son exclusivos de Premium.
// Duplicado en base44/functions/create_child/entry.ts (los functions de
// Base44 no pueden importar de src/) — si cambia, cambia también ahí.
export const FREE_PLAN_CHILD_CAP = 50;

// Toda parroquia nueva arranca en plan="premium" con una prueba de 30 días
// (premium_period_end_at), con acceso completo a TODA la app sin el tope de
// niños del plan Gratis. `plan` solo se escribe con rol de servicio (Mission
// Control o el panel de Base44) — un admin de parroquia no puede activarse
// el plan a sí mismo.
//
// `license_status` (solo relevante si plan=premium) sigue el ciclo:
// active → read_only → access_denied → deletion_eligible si el período
// (prueba o pago) vence sin renovarse y la parroquia tiene MÁS de
// FREE_PLAN_CHILD_CAP niños activos (si tiene menos, Mission Control la baja
// directo a plan="free" sin pasar por este ciclo — ver
// licenseLifecycle.js en el repo hermano acacia-mission-control). Este ciclo
// restringe TODA la app (no solo Tutores) mientras dura.
//
// plan="free" es un estado permanente y normal (no una penalización): el
// núcleo (asistencia, niños, grupos, reportes) sigue de lectura Y escritura
// hasta el tope de niños; solo Tutores/mensajería/tareas/pulseras no
// aplican. Se llega aquí por default vía la prueba vencida (≤50 niños) o el
// borrado automático de datos Premium tras deletion_eligible (>50 niños que
// luego bajaron de tope) — en ambos casos el resultado es el mismo Plan
// Gratis funcional, nunca una app bloqueada.
export function getLicenseStatus(parish) {
  const isPremium = parish?.plan === "premium";
  const status = isPremium ? (parish?.license_status || "active") : "active";
  return {
    tier: isPremium ? "premium" : "free",
    isPremium,
    status,
    isReadOnly: isPremium && status !== "active",
    isAccessDenied: isPremium && (status === "access_denied" || status === "deletion_eligible"),
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
