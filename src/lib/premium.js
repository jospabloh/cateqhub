import { useMemo } from "react";

// CateqHub es free por default: asistencia por QR, alta de parroquia/grupos/
// niños y reportes básicos no tienen costo ni vencimiento. Tutores/mensajería/
// tareas/pulseras son parte del plan de pago (todavía sin nombre). El límite
// de niños del plan free aún no está definido — hoy no se aplica ningún tope.
// `plan` en Parish solo se escribe con rol de servicio (Mission Control o el
// panel de Base44) — un admin de parroquia no puede activarse el plan a sí
// mismo.
//
// `license_status` (solo relevante si plan=premium) sigue el ciclo:
// active → read_only → access_denied → deletion_eligible, escrito por
// Mission Control cuando el pago de Premium no se confirma. El núcleo
// gratuito nunca entra a este ciclo.
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
  };
}

export function useLicenseStatus(parish) {
  return useMemo(
    () => getLicenseStatus(parish),
    [parish?.id, parish?.plan, parish?.license_status, parish?.export_confirmed_at]
  );
}

// Alias de compatibilidad — mismo shape que antes (tier/isPremium), más los
// campos nuevos. No romper mientras se termina de migrar cada consumidor.
export const getPremiumStatus = getLicenseStatus;
export const usePremiumStatus = useLicenseStatus;
