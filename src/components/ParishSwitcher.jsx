import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Church, Check, Loader2 } from "lucide-react";

// Módulo 18 del estándar: el selector de parroquia.
//
// Se muestra SÓLO cuando hay más de un candidato — un catequista que nunca ha
// servido en dos parroquias no tiene por qué ver un control que no hace nada.
// Esa es también la razón de que no haya estado vacío ni mensaje de "sólo
// tienes una": simplemente no se dibuja.
export default function ParishSwitcher() {
  const { user } = useAuth();
  const [options, setOptions] = useState([]);
  const [switching, setSwitching] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    base44.functions
      .invoke("memberships", { action: "list" })
      .then((r) => setOptions(r.data?.candidates || []))
      .catch(() => setOptions([]));
  }, [user?.id, user?.parish_id]);

  if (options.length < 2) return null;

  // Recarga entera tras cambiar, no un reseteo en sitio. El módulo 14 §6 existe
  // porque un parish_id rancio sobrevive en un closure con una facilidad
  // pasmosa; una recarga es el único reseteo que no puede dejar uno detrás. Y
  // el módulo 23 ya garantiza que la navegación se vea bien en el primer frame
  // después.
  const pick = async (parish_id) => {
    if (switching || parish_id === user?.parish_id) return;
    setSwitching(parish_id);
    try {
      const res = await base44.functions.invoke("memberships", { action: "switch", parish_id });
      if (res.data?.switched || res.data?.already) {
        window.location.href = "/";
        return;
      }
    } catch { /* el catch deja el control utilizable en vez de colgado */ }
    setSwitching("");
  };

  return (
    <div className="px-3 py-2 border-t border-sidebar-border">
      <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 px-1 pb-1">Parroquia</p>
      <ul className="space-y-0.5">
        {options.map((o) => (
          <li key={o.parish_id}>
            <button
              type="button"
              onClick={() => pick(o.parish_id)}
              disabled={!!switching}
              aria-current={o.is_active ? "true" : undefined}
              className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
                o.is_active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50"
              }`}
            >
              {switching === o.parish_id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Church className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{o.parish_name || o.parish_id}</span>
              {o.is_active && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
