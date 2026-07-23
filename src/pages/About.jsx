import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION, RELEASE_DATE, CHANGELOG } from "@/lib/appConfig";
import { Info, ChevronDown, BookOpen, LifeBuoy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function About() {
  const [showAll, setShowAll] = useState(false);
  const [latest, ...older] = CHANGELOG;
  const visibleOlder = showAll ? older : [];

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
