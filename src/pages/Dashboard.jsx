import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePremiumStatus } from "@/lib/premium";
import PremiumLockedPanel from "@/components/PremiumLockedPanel";
import ProgressRing from "@/components/ProgressRing";
import { ScanLine, Users, ClipboardList, Church, AlertCircle, Clock, MessageCircle, ListChecks, Tag } from "lucide-react";
import { isParishAdmin } from "@/lib/roles";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const parishId = user?.parish_id;
  const [counts, setCounts] = useState({ groups: 0, children: 0, today: 0 });
  const [parish, setParish] = useState(null);
  const [loading, setLoading] = useState(true);
  const status = usePremiumStatus(parish);

  useEffect(() => {
    if (!parishId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [groups, children, todayAtt, p] = await Promise.all([
          base44.entities.Group.filter({ parish_id: parishId }),
          base44.entities.Child.filter({ parish_id: parishId, active: true }),
          base44.entities.Attendance.filter({ parish_id: parishId, date: today }),
          base44.entities.Parish.get(parishId).catch(() => null),
        ]);
        if (cancelled) return;
        setCounts({ groups: groups.length, children: children.length, today: todayAtt.length });
        setParish(p);
      } catch (e) {
        if (!cancelled) toast({ title: "No se pudo cargar el panel", description: e.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Hola 👋</h1>
        <p className="text-muted-foreground">{parish?.name || "Tu parroquia"} · {isParishAdmin(user) ? "Administrador" : "Catequista"}</p>
      </div>

      {isParishAdmin(user) && status.status === "active" && status.trialEndsAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg border border-border bg-muted px-4 py-3">
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground shrink-0" />Tu parroquia tiene acceso activo.</span>
          <Link to="/premium" className="text-primary font-medium hover:underline shrink-0">Ver detalles</Link>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="pt-6 flex items-center gap-6 flex-wrap">
          {loading ? (
            <>
              <Skeleton className="w-28 h-28 rounded-full shrink-0" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-56" />
              </div>
            </>
          ) : (
            <>
              <ProgressRing value={counts.today} total={counts.children} size={112} />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground capitalize">{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</p>
                <p className="text-3xl font-heading font-semibold mt-0.5">
                  {counts.today} <span className="text-base font-normal text-muted-foreground">de {counts.children} niños activos hoy</span>
                </p>
                <Link to="/reportes" className="text-sm text-primary font-medium hover:underline mt-1 inline-block">Ver reportes →</Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Grupos/Libros</p>
              {loading ? <Skeleton className="h-7 w-10 mt-0.5" /> : <p className="text-2xl font-heading font-semibold mt-0.5">{counts.groups}</p>}
            </div>
            <Link to="/grupos" className="w-9 h-9 rounded-md bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Ir a Grupos/Libros">
              <Users className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Niños activos</p>
              {loading ? <Skeleton className="h-7 w-10 mt-0.5" /> : <p className="text-2xl font-heading font-semibold mt-0.5">{counts.children}</p>}
            </div>
            <Link to="/ninos" className="w-9 h-9 rounded-md bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Ir a Niños">
              <ClipboardList className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Acciones rápidas</h3>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/escanear"><ScanLine className="w-4 h-4 mr-2" />Escanear asistencia</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/ninos"><ClipboardList className="w-4 h-4 mr-2" />Ver niños</Link></Button>
            {isParishAdmin(user) && (
              <Button asChild size="lg" variant="outline"><Link to="/grupos"><Church className="w-4 h-4 mr-2" />Gestionar grupos/libros</Link></Button>
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
            <PremiumLockedPanel icon={Tag} title="Pulseras y etiquetas" description="Identificación física para grupos/libros grandes. Próximamente en Premium." />
          </div>
        </div>
      )}
    </div>
  );
}
