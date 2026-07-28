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

// ─── Plan de cobro (2026-07-28): implementación + mensualidad + soporte ────
//
// Implementación asistida: cargo único, opcional (el autoservicio sigue
// siendo $0). Mismos tramos en acaciaco-site/apps/cateqhub.html — si
// cambian, cambia también ahí. El precio no se aplica desde ningún código
// (el cobro sigue siendo manual, WhatsApp/factura, igual que Premium hoy);
// esto solo decide qué tramo se le muestra/registra a cada parroquia.
export const IMPLEMENTATION_TIERS = [
  { value: "hasta_150", max: 150, price: 1490, label: "Hasta 150 niños activos" },
  { value: "151_350", max: 350, price: 2490, label: "151 a 350 niños activos" },
  { value: "351_mas", max: Infinity, price: 3990, label: "351+ niños activos o diócesis" },
];

export function implementationTierFor(activeChildren) {
  if (activeChildren == null) return IMPLEMENTATION_TIERS[0];
  return (
    IMPLEMENTATION_TIERS.find((t) => activeChildren <= t.max) ||
    IMPLEMENTATION_TIERS[IMPLEMENTATION_TIERS.length - 1]
  );
}

// Soporte adicional a la carta. $550/hora y $990/sesión son los mismos
// números que ya cobra ACACIA en acaciaco-site/servicios.html (correctivos
// sin póliza y sesión de capacitación) — no se inventó un tabulador nuevo
// solo para CateqHub.
export const SUPPORT_ADDON_MONTHLY_MXN = 250;
export const SUPPORT_HOURLY_MXN = 550;
export const SUPPORT_TRAINING_SESSION_MXN = 990;

// Nivel de soporte incluido, expresado como el tope de prioridad
// seleccionable en un SupportTicket (ver SupportTicket.priority). No
// reinventa tiempos de respuesta: se apoya en el mismo SLA de 4 niveles que
// ya usa Mission Control para todo el portafolio (api/_lib/sla.js en
// acacia-mission-control: urgent 1h/4h, high 4h/8h, normal 8h/24h,
// low 24h/72h).
const PRIORITY_RANK = { low: 0, normal: 1, high: 2, urgent: 3 };
export const PRIORITY_ORDER = ["low", "normal", "high", "urgent"];

// Gratis → hasta "low" (mejor esfuerzo). Premium (cualquier tramo de
// niños) → hasta "high" (prioridad alta). El add-on de soporte prioritario
// ($250 MXN/mes, ver support_priority_addon en Parish/User) sube el tope a
// "urgent" sin importar el plan.
export function maxTicketPriority(user) {
  if (user?.parish_support_priority_addon) return "urgent";
  return user?.parish_plan === "premium" ? "high" : "low";
}

export function allowedTicketPriorities(user) {
  const maxRank = PRIORITY_RANK[maxTicketPriority(user)] ?? 0;
  return PRIORITY_ORDER.filter((p) => PRIORITY_RANK[p] <= maxRank);
}
