import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePremiumStatus } from "@/lib/premium";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Sparkles, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

  const status = usePremiumStatus(parish);

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

      {status.tier === "trial" && (
        <div className="flex items-center gap-2 text-sm rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span>
            Tu parroquia está en periodo de prueba de las funciones premium — quedan <strong>{status.daysLeft} días</strong>
            {status.trialEndsAt && <> (vence el {format(status.trialEndsAt, "d 'de' MMMM yyyy", { locale: es })})</>}.
          </span>
        </div>
      )}
      {status.tier === "locked" && (
        <div className="flex items-center gap-2 text-sm rounded-lg border border-border bg-muted px-4 py-3">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>El periodo de prueba terminó. Lo que ya cargaste en Tutores sigue visible y lo puedes eliminar cuando quieras; para volver a editarlo hay que activar el plan.</span>
        </div>
      )}
      {status.tier === "premium" && (
        <div className="flex items-center gap-2 text-sm rounded-lg border border-moss/30 bg-moss/10 px-4 py-3">
          <Check className="w-4 h-4 text-moss shrink-0" />
          <span>Tu parroquia tiene el plan Premium activo.</span>
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
    </div>
  );
}