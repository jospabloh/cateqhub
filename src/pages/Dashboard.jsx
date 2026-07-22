import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePremiumStatus } from "@/lib/premium";
import PremiumLockedPanel from "@/components/PremiumLockedPanel";
import { ScanLine, Users, ClipboardList, Church, QrCode, AlertCircle, Clock, MessageCircle, ListChecks, Tag } from "lucide-react";
import { isParishAdmin } from "@/lib/roles";

export default function Dashboard() {
  const { user } = useAuth();
  const parishId = user?.parish_id;
  const [counts, setCounts] = useState({ groups: 0, children: 0, today: 0 });
  const [parish, setParish] = useState(null);
  const status = usePremiumStatus(parish);

  useEffect(() => {
    if (!parishId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [groups, children, todayAtt, p] = await Promise.all([
        base44.entities.Group.filter({ parish_id: parishId }),
        base44.entities.Child.filter({ parish_id: parishId, active: true }),
        base44.entities.Attendance.filter({ parish_id: parishId, date: today }),
        base44.entities.Parish.get(parishId).catch(() => null),
      ]);
      setCounts({ groups: groups.length, children: children.length, today: todayAtt.length });
      setParish(p);
    })();
  }, [parishId]);

  if (!parishId) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-gold/15 grid place-items-center">
              <AlertCircle className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Configura tu parroquia</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Aún no tienes una parroquia asignada. {isParishAdmin(user) ? "Crea una y asígnala a tu cuenta para empezar." : "Contacta al administrador para que te asigne una."}
              </p>
            </div>
            {isParishAdmin(user) && (
              <Button asChild>
                <Link to="/parroquia">Ir a configuración</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const cards = [
    { label: "Grupos", value: counts.groups, icon: Users, to: "/grupos" },
    { label: "Niños activos", value: counts.children, icon: ClipboardList, to: "/ninos" },
    { label: "Asistencia hoy", value: counts.today, icon: QrCode, to: "/reportes", accent: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Hola 👋</h1>
        <p className="text-muted-foreground">{parish?.name || "Tu parroquia"} · {isParishAdmin(user) ? "Administrador" : "Catequista"}</p>
      </div>

      {isParishAdmin(user) && status.tier === "trial" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary shrink-0" />Prueba de funciones premium: quedan <strong>{status.daysLeft} días</strong>.</span>
          <Link to="/premium" className="text-primary font-medium hover:underline shrink-0">Ver plan</Link>
        </div>
      )}
      {isParishAdmin(user) && status.tier === "locked" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg border border-border bg-muted px-4 py-3">
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground shrink-0" />Tu prueba de funciones premium terminó.</span>
          <Link to="/premium" className="text-primary font-medium hover:underline shrink-0">Ver plan</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className={c.accent ? "border-gold/40" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`w-4 h-4 ${c.accent ? "text-gold" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent><p className="text-3xl font-heading font-semibold">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Acciones rápidas</h3>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/escanear"><ScanLine className="w-4 h-4 mr-2" />Escanear asistencia</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/ninos"><ClipboardList className="w-4 h-4 mr-2" />Ver niños</Link></Button>
            {isParishAdmin(user) && (
              <Button asChild size="lg" variant="outline"><Link to="/grupos"><Church className="w-4 h-4 mr-2" />Gestionar grupos</Link></Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isParishAdmin(user) && (
        <div>
          <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Funciones premium</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <PremiumLockedPanel icon={MessageCircle} title="Mensajería a tutores" description="Recordatorios por WhatsApp o correo. Próximamente en Premium." />
            <PremiumLockedPanel icon={ListChecks} title="Tareas de catecismo" description="Asigna tareas y da seguimiento a las entregas. Próximamente en Premium." />
            <PremiumLockedPanel icon={Tag} title="Pulseras y etiquetas" description="Identificación física para grupos grandes. Próximamente en Premium." />
          </div>
        </div>
      )}
    </div>
  );
}