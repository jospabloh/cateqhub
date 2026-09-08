import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { APP_VERSION, RELEASE_DATE, CHANGELOG } from "@/lib/appConfig";
import { Info, ChevronDown, BookOpen, LifeBuoy, ShieldCheck, Users, Mail, MessageCircle, Copyright, Heart, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function About() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [latest, ...older] = CHANGELOG;
  const visibleOlder = showAll ? older : [];

  // Módulo 7, segundo alcance: salir de la parroquia. Vive aquí y no en
  // /parroquia porque esa página corta con RestrictedNotice a quien no es
  // admin, y quien más necesita salir es justo un catequista que dejó de
  // servir. /acerca-de es la única pantalla que alcanza cualquier miembro.
  //
  // El backend re-deriva quién se va del token, nunca del cuerpo, y rechaza a
  // un último administrador remitiéndolo a transferir primero (code
  // 'last_admin'). Al salir se recarga entera: la sesión sigue viva pero ya no
  // tiene parroquia, y medio árbol de la app está montado sobre parish_id.
  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await base44.functions.invoke("assign_parish_user", { action: "leave" });
      if (res.data?.left) {
        window.location.href = "/";
        return;
      }
      toast({
        title: "No se pudo salir",
        description: res.data?.error || "Intenta de nuevo",
        variant: "destructive",
      });
    } catch (e) {
      toast({ title: "No se pudo salir", description: e.message, variant: "destructive" });
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Info className="w-6 h-6 text-gold" />Acerca de</h1>
        <p className="text-muted-foreground text-sm">Versión, historial de cambios y ayuda.</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <Logo className="w-12 h-12 shrink-0" />
          <div>
            <p className="font-heading font-semibold text-lg leading-tight">CateqHub</p>
            <p className="text-sm text-muted-foreground">
              Versión {APP_VERSION} · {format(parseISO(RELEASE_DATE), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <p className="font-medium text-sm">Seguridad de la infraestructura</p>
          </div>
          <p className="text-sm text-muted-foreground">
            CateqHub corre sobre Base44, que declara cumplimiento{" "}
            <strong className="text-foreground">SOC 2 Tipo II</strong> y ofrece un{" "}
            <strong className="text-foreground">Acuerdo de Procesamiento de Datos (DPA)</strong> para el manejo
            de datos personales. Puedes verificar el estado vigente de estas certificaciones directamente en el{" "}
            <a
              href="https://base44.com/security"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Centro de Confianza de Base44
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/manual">
          <Card className="hover:border-primary/30 transition-colors h-full">
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/10 grid place-items-center shrink-0"><BookOpen className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="font-medium text-sm">Manual de usuario</p>
                <p className="text-xs text-muted-foreground">Guías buscables</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/soporte">
          <Card className="hover:border-primary/30 transition-colors h-full">
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/10 grid place-items-center shrink-0"><LifeBuoy className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="font-medium text-sm">Soporte</p>
                <p className="text-xs text-muted-foreground">Abre o revisa un ticket</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/10 grid place-items-center shrink-0"><Users className="w-4 h-4 text-primary" /></div>
          <div>
            <p className="font-medium text-sm">Equipo desarrollador</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Desarrollado por <span className="text-foreground font-medium">ACACIA Consultoría en Informática y Cómputo</span>, y forma parte de su portafolio de aplicaciones.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary shrink-0" />
            <p className="font-medium text-sm">Contacto y soporte</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Para dudas o soporte técnico directo con ACACIA, además del{" "}
            <Link to="/soporte" className="text-primary hover:underline">sistema de tickets</Link> dentro de la app:
          </p>
          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <a href="mailto:soporte@acaciaco.com.mx" className="text-primary hover:underline font-medium">soporte@acaciaco.com.mx</a>
            </p>
            <p className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <a href="https://wa.me/524498958291" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">+52 449 895 8291</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {user?.parish_id && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-destructive shrink-0" />
              <p className="font-medium text-sm">Salir de la parroquia</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Dejas de tener acceso a los niños, grupos y reportes de esta parroquia. Tu cuenta sigue existiendo — un administrador puede volver a invitarte. No se borra ningún dato de la parroquia.
            </p>
            {!confirmLeave ? (
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmLeave(true)}
              >
                Salir de la parroquia
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-destructive font-medium">
                  ¿Seguro? Perderás el acceso de inmediato.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirmLeave(false)} disabled={leaving}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={handleLeave} disabled={leaving}>
                    {leaving ? "Saliendo…" : "Sí, salir"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2">
            <Copyright className="w-4 h-4 text-primary shrink-0" />
            <p className="font-medium text-sm">Derechos reservados</p>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} <span className="text-foreground font-medium">ACACIA Consultoría en Informática y Cómputo</span>. Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted-foreground">
            Licencia registrada a: <span className="text-foreground font-medium">{user?.email || "—"}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gold/5 border-gold/20">
        <CardContent className="pt-6 flex items-start gap-3">
          <Heart className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Hecho con cuidado para acompañar el trabajo de catequistas y parroquias en su día a día.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 text-sm text-muted-foreground">Historial de cambios</h3>
          <ChangelogEntry entry={latest} />
          {visibleOlder.map((entry) => <ChangelogEntry key={entry.version} entry={entry} />)}
          {older.length > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
              {showAll ? "Ocultar versiones anteriores" : `Ver ${older.length} versiones anteriores`}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChangelogEntry({ entry }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant="outline" className="font-mono font-normal">v{entry.version}</Badge>
        <span className="text-xs text-muted-foreground">{format(parseISO(entry.date), "d MMM yyyy", { locale: es })}</span>
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
        {entry.changes.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  );
}
