import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, Users, ClipboardList, Church, QrCode, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const parishId = user?.parish_id;
  const [counts, setCounts] = useState({ groups: 0, children: 0, today: 0 });
  const [parish, setParish] = useState(null);

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
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 grid place-items-center">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Configura tu parroquia</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Aún no tienes una parroquia asignada. {user?.role === "admin" ? "Crea una y asígnala a tu cuenta para empezar." : "Contacta al administrador para que te asigne una."}
              </p>
            </div>
            {user?.role === "admin" && (
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
    { label: "Asistencia hoy", value: counts.today, icon: QrCode, to: "/reportes" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Hola 👋</h1>
        <p className="text-muted-foreground">{parish?.name || "Tu parroquia"} · {user?.role === "admin" ? "Administrador" : "Catequista"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Acciones rápidas</h3>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/escanear"><ScanLine className="w-4 h-4 mr-2" />Escanear asistencia</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/ninos"><ClipboardList className="w-4 h-4 mr-2" />Ver niños</Link></Button>
            {user?.role === "admin" && (
              <Button asChild size="lg" variant="outline"><Link to="/grupos"><Church className="w-4 h-4 mr-2" />Gestionar grupos</Link></Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}