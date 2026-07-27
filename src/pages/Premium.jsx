import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useLicenseStatus } from "@/lib/premium";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Clock, ShieldAlert } from "lucide-react";

const FREE_FEATURES = [
  "Registro de asistencia por QR, sin límite de niños",
  "Alta de parroquia, grupos y niños",
  "Reporte de asistencia por fecha y grupo",
  "Faltas acumuladas por niño",
];

const PREMIUM_FEATURES = [
  "Tutores y autorización de recogida",
  "Mensajería a tutores por WhatsApp o correo",
  "Tareas de catecismo y seguimiento de entregas",
  "Impresión de pulseras y etiquetas físicas",
];

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
      URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Plan Premium
        </h1>
        <p className="text-muted-foreground text-sm">
          La asistencia por QR es gratis para siempre. Esto es lo que se suma con Premium.
        </p>
      </div>

      {status.isAccessDenied ? (
        <Card className="border-destructive/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              <p className="font-medium">Acceso a Tutores denegado por falta de pago</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Tu parroquia dejó de tener acceso a la función Premium por falta de pago. Puedes descargar los datos de Tutores que registraste antes de que se eliminen. El resto de CateqHub (niños, grupos, asistencia) sigue funcionando normalmente.
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
              <span>Tu parroquia está en el plan gratuito. Lo que ya cargaste en Tutores sigue visible y lo puedes eliminar cuando quieras; para volver a editarlo hay que activar el plan Premium.</span>
            </div>
          )}
          {status.tier === "premium" && (
            <div className="flex items-center gap-2 text-sm rounded-lg border border-moss/30 bg-moss/10 px-4 py-3">
              <Check className="w-4 h-4 text-moss shrink-0" />
              <span>Tu parroquia tiene el plan Premium activo.</span>
            </div>
          )}
          {status.isPremium && status.isReadOnly && (
            <div className="flex items-center gap-2 text-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Tu plan Premium está pendiente de pago. Agregar o editar Tutores está pausado hasta que se confirme el pago.</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="font-medium">Gratis, para siempre</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-moss shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Premium</p>
                  <span className="text-sm text-muted-foreground">desde $500 MXN/mes</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {PREMIUM_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">El precio final depende de la cantidad de niños activos en tu parroquia.</p>
              </CardContent>
            </Card>
          </div>

          {isParishAdmin(user) && status.tier !== "premium" && (
            <p className="text-sm text-muted-foreground">
              Aún no hay activación automática de pago — {user?.role === "admin" ? "activa el plan Premium desde el panel de administración de Base44 para tu parroquia." : "contacta a quien administra la app para activar el plan Premium en tu parroquia."}
            </p>
          )}
        </>
      )}
    </div>
  );
}