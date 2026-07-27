import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useLicenseStatus } from "@/lib/premium";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Clock, ShieldAlert } from "lucide-react";

const ALL_FEATURES = [
  "Registro de asistencia por QR, sin límite de niños",
  "Alta de parroquia, grupos/libros y niños",
  "Reporte de asistencia por fecha y grupo/libro",
  "Faltas acumuladas por niño",
  "Tutores y autorización de recogida",
  "Mensajería a tutores por WhatsApp o correo",
  "Tareas de catecismo y seguimiento de entregas",
  "Impresión de pulseras y etiquetas físicas",
];

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

  useEffect(() => {
    if (!user?.parish_id) return;
    base44.entities.Parish.get(user.parish_id).then(setParish).catch(() => {});
  }, [user]);

  const status = useLicenseStatus(parish);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [confirming, setConfirming] = useState(false);

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Plan Premium
        </h1>
        <p className="text-muted-foreground text-sm">
          Toda parroquia nueva arranca con 30 días de acceso completo, sin costo. Ya no hay un plan gratuito permanente.
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
              Tu período de prueba o pago venció y no se renovó. Toda la app quedó pausada: escanear, niños, grupos/libros, reportes y Tutores. Puedes descargar los datos de Tutores que registraste antes de que se eliminen — el resto de la información (niños, grupos, asistencia) no se borra, solo queda inaccesible hasta reactivar el plan.
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
              <span>Tus datos de Tutores se eliminaron tras un período sin pago. El resto (niños, grupos, asistencia) sigue visible en modo de solo lectura; para volver a editar todo y agregar tutores, activa el plan Premium.</span>
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

          <Card className="border-primary/30">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Todo incluido</p>
                <span className="text-sm text-muted-foreground">desde $500 MXN/mes</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {ALL_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Los primeros 30 días son gratis. El precio final se confirma con tu ejecutivo ACACIA.</p>
            </CardContent>
          </Card>

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