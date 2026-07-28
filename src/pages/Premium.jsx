import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  useLicenseStatus,
  FREE_PLAN_CHILD_CAP,
  IMPLEMENTATION_TIERS,
  implementationTierFor,
  SUPPORT_ADDON_MONTHLY_MXN,
  SUPPORT_HOURLY_MXN,
  SUPPORT_TRAINING_SESSION_MXN,
} from "@/lib/premium";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Clock, ShieldAlert, LifeBuoy, Wrench } from "lucide-react";

// Mismo número que About.jsx (Contacto y soporte directo).
const WHATSAPP_NUMBER = "524498958291";
function waLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

const FREE_FEATURES = [
  "Registro de asistencia por código QR",
  "Alta de parroquia, grupos/libros y niños",
  "Reportes de asistencia por fecha y grupo/libro",
  "Faltas acumuladas por niño",
];

const PREMIUM_FEATURES = [
  "Tutores y autorización de recogida",
  "Mensajería a tutores por correo",
  "Tareas de catequesis y seguimiento de entregas",
  "Impresión de pulseras y gafetes físicos",
];

// Precio mensual Premium por nivel de niños activos — mismos tramos que la
// tabla pública en acaciaco-site (apps/cateqhub.html). Si cambian los
// tramos o precios, cambia también ahí.
const PREMIUM_TIERS = [
  { min: 51, max: 150, price: 500 },
  { min: 151, max: 250, price: 650 },
  { min: 251, max: 350, price: 800 },
  { min: 351, max: 450, price: 950 },
  { min: 451, max: Infinity, price: null },
];

function tierFor(activeChildren) {
  return PREMIUM_TIERS.find((t) => activeChildren >= t.min && activeChildren <= t.max) || PREMIUM_TIERS[0];
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function daysLeft(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function Premium() {
  const { user } = useAuth();
  const [parish, setParish] = useState(null);
  const [activeChildren, setActiveChildren] = useState(null);

  useEffect(() => {
    if (!user?.parish_id) return;
    base44.entities.Parish.get(user.parish_id).then(setParish).catch(() => {});
    base44.entities.Child.filter({ parish_id: user.parish_id, active: true })
      .then((rows) => setActiveChildren(rows.length))
      .catch(() => {});
  }, [user]);

  const status = useLicenseStatus(parish);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [implBusy, setImplBusy] = useState(false);
  const [implError, setImplError] = useState("");
  const [addonBusy, setAddonBusy] = useState(false);
  const [addonError, setAddonError] = useState("");

  const implTier = implementationTierFor(activeChildren);
  // "completed" solo lo escribe ACACIA (rol de servicio); una parroquia solo
  // puede pedirla (implementation_requested_at), nunca marcarse a sí misma
  // como completada — por eso el estado "requested" se deriva de la marca de
  // tiempo de la solicitud, no del campo implementation_status (ver
  // Parish.jsonc, ambos campos tienen FLS distinto a propósito).
  const implementationStatus =
    parish?.implementation_status === "completed"
      ? "completed"
      : parish?.implementation_requested_at
        ? "requested"
        : "none";
  const addonActive = !!parish?.support_priority_addon;
  const addonRequested = !addonActive && !!parish?.support_priority_addon_requested_at;

  const handleRequestImplementation = async () => {
    if (!parish) return;
    setImplBusy(true);
    setImplError("");
    try {
      const patch = {
        implementation_requested_at: new Date().toISOString(),
        implementation_requested_tier: implTier.value,
      };
      await base44.entities.Parish.update(parish.id, patch);
      setParish((p) => ({ ...p, ...patch }));
    } catch (e) {
      setImplError(e.message || "No se pudo enviar la solicitud.");
    } finally {
      setImplBusy(false);
    }
  };

  const handleRequestAddon = async () => {
    if (!parish) return;
    setAddonBusy(true);
    setAddonError("");
    try {
      const patch = { support_priority_addon_requested_at: new Date().toISOString() };
      await base44.entities.Parish.update(parish.id, patch);
      setParish((p) => ({ ...p, ...patch }));
    } catch (e) {
      setAddonError(e.message || "No se pudo enviar la solicitud.");
    } finally {
      setAddonBusy(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const res = await base44.functions.invoke("export_premium_data", {});
      if (res?.data?.error) throw new Error(res.data.error);
      const payload = res.data;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = (payload.parish?.name || "parroquia").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.href = url;
      a.download = `tutores-${safeName}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Diferido: revocar la URL en el mismo tick que a.click() puede hacer
      // que algunos navegadores cancelen la descarga que apenas se inició.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setExportError(e.message || "No se pudo exportar la información.");
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmExport = async () => {
    setConfirming(true);
    setExportError("");
    try {
      const res = await base44.functions.invoke("confirm_premium_export", {});
      if (res?.data?.error) throw new Error(res.data.error);
      setParish(res.data.parish);
    } catch (e) {
      setExportError(e.message || "No se pudo confirmar la exportación.");
    } finally {
      setConfirming(false);
    }
  };

  if (!isParishAdmin(user)) return <RestrictedNotice />;

  const trialEndLabel = formatDate(status.trialEndsAt);
  const trialDaysLeft = daysLeft(status.trialEndsAt);
  const tier = activeChildren != null ? tierFor(activeChildren) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Planes y precios
        </h1>
        <p className="text-muted-foreground text-sm">
          El plan Gratis es permanente, hasta {FREE_PLAN_CHILD_CAP} niños activos. Al dar de alta tu parroquia obtienes 30 días de Premium completo sin costo.
        </p>
      </div>

      {status.isAccessDenied ? (
        <Card className="border-destructive/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              <p className="font-medium">Acceso denegado por falta de pago</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Tu parroquia supera los {FREE_PLAN_CHILD_CAP} niños del plan Gratis y tu período de prueba o pago Premium venció sin renovarse. Toda la app quedó pausada: escanear, niños, grupos/libros, reportes y Tutores. Puedes descargar los datos de Tutores que registraste antes de que se eliminen — el resto de la información (niños, grupos, asistencia) no se borra, solo queda inaccesible hasta reactivar el plan.
            </p>
            {exportError && <p className="text-sm text-destructive">{exportError}</p>}
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Descargando…" : "Descargar mis datos (Tutores)"}
            </Button>
            {status.exportConfirmed ? (
              <p className="flex items-center gap-2 text-sm text-moss">
                <Check className="w-4 h-4" />
                Exportación confirmada el {new Date(parish.export_confirmed_at).toLocaleDateString("es-MX")}.
              </p>
            ) : (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={status.exportConfirmed}
                  onChange={(e) => { if (e.target.checked) handleConfirmExport(); }}
                  disabled={confirming}
                />
                Descargué y guardé mis datos
              </label>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {status.tier === "free" && (
            <div className="flex items-center gap-2 text-sm rounded-lg border border-border bg-muted px-4 py-3">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>
                Tu parroquia está en el plan Gratis{activeChildren != null ? ` (${activeChildren}/${FREE_PLAN_CHILD_CAP} niños activos)` : ""}. Asistencia, niños, grupos/libros y reportes siguen funcionando sin vencimiento; para Tutores, mensajería, tareas y pulseras activa Premium.
              </span>
            </div>
          )}
          {status.tier === "premium" && status.status === "active" && (
            <div className="flex items-center gap-2 text-sm rounded-lg border border-moss/30 bg-moss/10 px-4 py-3">
              <Check className="w-4 h-4 text-moss shrink-0" />
              <span>
                Tu parroquia tiene acceso Premium activo
                {trialEndLabel ? ` — vigente hasta el ${trialEndLabel}${trialDaysLeft != null && trialDaysLeft >= 0 ? ` (${trialDaysLeft} ${trialDaysLeft === 1 ? "día" : "días"})` : ""}.` : "."}
              </span>
            </div>
          )}
          {status.isPremium && status.isReadOnly && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Tu período de prueba o pago venció. Agregar o editar está pausado en toda la app hasta que se confirme el pago — lo que ya registraste sigue visible.</span>
              </div>
              {exportError && <p className="text-sm text-destructive">{exportError}</p>}
              <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? "Descargando…" : "Descargar mis datos (Tutores) por si acaso"}
              </Button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Gratis</p>
                  <span className="text-sm text-muted-foreground">hasta {FREE_PLAN_CHILD_CAP} niños activos</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-moss shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">$0, sin vencimiento.</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Premium</p>
                  <span className="text-sm text-muted-foreground">30 días gratis, luego desde $500 MXN/mes</span>
                </div>
                <p className="text-xs text-muted-foreground">Incluye todo lo del plan Gratis, más:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {PREMIUM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-muted-foreground">
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th className="py-1 pr-2 font-medium">Niños activos</th>
                        <th className="py-1 font-medium">Precio mensual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PREMIUM_TIERS.map((t) => (
                        <tr key={t.min} className={tier === t ? "text-foreground font-medium" : ""}>
                          <td className="py-1 pr-2">{t.max === Infinity ? `${t.min}+` : `${t.min}-${t.max}`}</td>
                          <td className="py-1">{t.price ? `$${t.price} MXN` : "Contáctanos"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">Pago anual disponible con 2 meses gratis. ¿Diócesis con varias parroquias? Precio preferencial — contáctanos.</p>
                <p className="text-xs text-muted-foreground">Todos los tramos Premium incluyen soporte con prioridad hasta <strong>Alta</strong> (respuesta en horas hábiles) — ver Soporte abajo.</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-heading font-semibold">Implementación asistida <span className="text-sm font-normal text-muted-foreground">(opcional)</span></h2>
              <p className="text-sm text-muted-foreground">No es necesaria para usar CateqHub — el alta sigue siendo autoservicio y gratis. Si prefieres que ACACIA migre tus listas existentes, dé de alta a tus catequistas y capacite a tu coordinación, es un cargo único.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {IMPLEMENTATION_TIERS.map((t) => (
                <Card key={t.value} className={implTier.value === t.value ? "border-primary/40" : ""}>
                  <CardContent className="pt-5 space-y-1">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-lg font-heading font-semibold">${t.price} <span className="text-xs font-normal text-muted-foreground">MXN único</span></p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Migración de tus listas existentes (Excel/papel) a niños, grupos y tutores</li>
              <li>Alta de catequistas</li>
              <li>Sesión de capacitación por videollamada para tu coordinación</li>
              <li>Configuración de la plantilla de pulseras/gafetes QR</li>
            </ul>
            {implementationStatus === "completed" ? (
              <p className="flex items-center gap-2 text-sm text-moss">
                <Check className="w-4 h-4 shrink-0" />
                Implementación asistida completada{parish?.implementation_completed_at ? ` el ${formatDate(parish.implementation_completed_at)}` : ""}.
              </p>
            ) : implementationStatus === "requested" ? (
              <p className="text-sm text-muted-foreground">
                Solicitud enviada el {formatDate(parish?.implementation_requested_at)} ({IMPLEMENTATION_TIERS.find((t) => t.value === parish?.implementation_requested_tier)?.label ?? implTier.label}) — te contactaremos por WhatsApp para confirmar el pago.
              </p>
            ) : (
              <>
                {implError && <p className="text-sm text-destructive">{implError}</p>}
                <Button variant="outline" onClick={handleRequestImplementation} disabled={implBusy}>
                  <Wrench className="w-4 h-4 mr-2" />
                  {implBusy ? "Enviando…" : `Solicitar implementación asistida (${implTier.label})`}
                </Button>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-heading font-semibold">Soporte</h2>
              <p className="text-sm text-muted-foreground">Tu plan trae un nivel de soporte incluido; para lo que quede fuera hay soporte adicional a la carta.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-5 space-y-1">
                  <p className="text-sm font-medium">Incluido en tu plan</p>
                  <p className="text-sm text-muted-foreground">
                    {status.tier === "premium"
                      ? "Ticket con prioridad hasta Alta — respuesta en horas hábiles."
                      : "Ticket con prioridad hasta Baja — respuesta por correo, mejor esfuerzo."}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Soporte prioritario</p>
                    <span className="text-xs text-muted-foreground">+${SUPPORT_ADDON_MONTHLY_MXN} MXN/mes</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Sube el tope a prioridad Urgente en cualquier ticket, sin cambiar de tramo.</p>
                  {addonActive ? (
                    <p className="flex items-center gap-1.5 text-sm text-moss">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      Activo
                    </p>
                  ) : addonRequested ? (
                    <p className="text-xs text-muted-foreground">Solicitado el {formatDate(parish?.support_priority_addon_requested_at)} — pendiente de confirmar pago.</p>
                  ) : (
                    <>
                      {addonError && <p className="text-xs text-destructive">{addonError}</p>}
                      <Button size="sm" variant="outline" onClick={handleRequestAddon} disabled={addonBusy}>
                        <LifeBuoy className="w-3.5 h-3.5 mr-2" />
                        {addonBusy ? "Enviando…" : "Solicitar"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
            <p className="text-xs text-muted-foreground">
              Soporte adicional a la carta: ${SUPPORT_HOURLY_MXN} MXN/hora (correcciones y ajustes puntuales) · ${SUPPORT_TRAINING_SESSION_MXN} MXN/sesión de capacitación extra.{" "}
              <a href={waLink("Hola, necesito soporte adicional para mi parroquia en CateqHub")} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Solicitar por WhatsApp
              </a>
              .
            </p>
          </div>

          {isParishAdmin(user) && (
            <p className="text-sm text-muted-foreground">
              Aún no hay activación automática de pago — contacta a tu ejecutivo de ACACIA para renovar o activar el plan Premium de tu parroquia. (La activación ya no se hace desde el panel de administración de Base44: ese camino deja desincronizado el control de acceso interno y la app puede quedar bloqueada aunque el plan diga "premium".)
            </p>
          )}
        </>
      )}
    </div>
  );
}