import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

// Vista previa "bloqueada pero visible" para funciones premium que aún no
// existen (mensajería, tareas, pulseras): un mockup abstracto detrás y, encima,
// el candado + la explicación. Nunca se presenta como si funcionara.
export default function PremiumLockedPanel({ icon: Icon, title, description }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card min-h-[156px]">
      <div className="pointer-events-none select-none opacity-25 p-5 space-y-2.5" aria-hidden="true">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-foreground" />
          <div className="h-2 w-24 rounded-full bg-foreground/50" />
        </div>
        <div className="h-2 w-full rounded-full bg-foreground/25" />
        <div className="h-2 w-4/5 rounded-full bg-foreground/25" />
        <div className="h-2 w-3/5 rounded-full bg-foreground/25" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-card/85 backdrop-blur-[1px] p-5 text-center">
        <div className="w-8 h-8 rounded-full bg-primary/10 grid place-items-center mb-1">
          <Lock className="w-3.5 h-3.5 text-primary" />
        </div>
        <p className="font-medium text-sm leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        <Link to="/premium" className="text-xs font-medium text-primary hover:underline mt-1">
          Ver plan Premium
        </Link>
      </div>
    </div>
  );
}
