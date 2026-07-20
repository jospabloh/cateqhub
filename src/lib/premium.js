import { useMemo } from "react";

// La asistencia por QR es gratis para siempre. Tutores/mensajería/tareas/pulseras
// son premium: se ven completos durante 90 días desde que se crea la parroquia y
// luego pasan a solo-lectura hasta que se activa el plan. Los campos `plan` /
// `trial_ends_at` en Parish aún no existen en el esquema — si se agregan más
// adelante (vía el panel de Base44), este cálculo los usa automáticamente sin
// cambiar el resto del código.
export const PREMIUM_TRIAL_DAYS = 90;

export function getPremiumStatus(parish) {
  if (!parish) {
    return { tier: "trial", isPremium: true, isLocked: false, daysLeft: PREMIUM_TRIAL_DAYS, trialEndsAt: null };
  }

  if (parish.plan === "premium") {
    return { tier: "premium", isPremium: true, isLocked: false, daysLeft: null, trialEndsAt: null };
  }

  const start = parish.created_date ? new Date(parish.created_date) : new Date();
  const trialEndsAt = parish.trial_ends_at
    ? new Date(parish.trial_ends_at)
    : new Date(start.getTime() + PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const msLeft = trialEndsAt.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const isPremium = msLeft > 0;

  return {
    tier: isPremium ? "trial" : "locked",
    isPremium,
    isLocked: !isPremium,
    daysLeft,
    trialEndsAt,
  };
}

export function usePremiumStatus(parish) {
  return useMemo(
    () => getPremiumStatus(parish),
    [parish?.id, parish?.plan, parish?.trial_ends_at, parish?.created_date]
  );
}
