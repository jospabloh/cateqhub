import { useMemo } from "react";

// CateqHub es UN producto con precio por volumen, no dos planes con funciones
// partidas. Hasta el 2026-09-09 existía un plan="free" permanente (núcleo
// completo hasta 50 niños activos, sin Tutores/mensajería/tareas/pulseras) al
// que Mission Control bajaba a las parroquias pequeñas cuya prueba vencía.
// Ese plan no era un producto que ACACIA vendiera: la tabla de precios pública
// empezaba en 51 niños, así que una parroquia de 50 o menos no tenía forma de
// pagar. Se eliminó — el precio arranca en el primer niño y todo va incluido.
//
// Con eso el app queda además alineado con el módulo 1 del estándar del
// portafolio, que define exactamente cuatro estados
// (trial | active | view_only | suspended) y no contempla ninguno gratuito;
// `plan="free"` era la desviación.
//
// Toda parroquia nueva arranca con una prueba de 30 días
// (`premium_period_end_at`). `license_status` sigue el ciclo unificado del
// portafolio si ese período vence sin renovarse:
// active → read_only → access_denied → deletion_eligible (8/15/30/45 días
// acumulados, iguales para los 7 apps — ver licenseControl.js en
// acacia-mission-control). Ese ciclo restringe TODA la app, no un subconjunto
// de funciones.
//
// `plan` sobrevive como campo porque Mission Control lo escribe y lo lee, pero
// ya no decide funciones: lo único que gatea el acceso es `license_status`.
// Un campo ausente resuelve a "active", que es lo correcto para la parroquia
// demo (creada antes de que estos campos existieran) y para cualquier
// parroquia futura creada antes de un campo nuevo.
export function getLicenseStatus(parish) {
  const status = parish?.license_status || "active";
  return {
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
    [parish?.id, parish?.license_status, parish?.export_confirmed_at, parish?.premium_period_end_at]
  );
}

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
  { value: "151_500", max: 500, price: 2490, label: "151 a 500 niños activos" },
  { value: "501_mas", max: Infinity, price: 3990, label: "501+ niños activos o diócesis" },
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
