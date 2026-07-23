import { useMemo } from "react";

// CateqHub es free por default: asistencia por QR, alta de parroquia/grupos/
// niños y reportes básicos no tienen costo ni vencimiento. Tutores/mensajería/
// tareas/pulseras son parte del plan de pago (todavía sin nombre). El límite
// de niños del plan free aún no está definido — hoy no se aplica ningún tope.
// `plan` en Parish solo se escribe con rol de servicio (Mission Control o el
// panel de Base44) — un admin de parroquia no puede activarse el plan a sí
// mismo.
export function getPremiumStatus(parish) {
  const isPremium = parish?.plan === "premium";
  return { tier: isPremium ? "premium" : "free", isPremium };
}

export function usePremiumStatus(parish) {
  return useMemo(() => getPremiumStatus(parish), [parish?.id, parish?.plan]);
}
