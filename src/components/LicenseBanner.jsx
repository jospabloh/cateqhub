import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useLicenseStatus } from "@/lib/premium";

export default function LicenseBanner({ parish }) {
  const { isPremium, status } = useLicenseStatus(parish);
  if (!isPremium || status === "active") return null;

  const isDenied = status === "access_denied" || status === "deletion_eligible";

  return (
    <div
      className={
        isDenied
          ? "flex items-center gap-2 text-sm px-4 py-2 bg-destructive/10 text-destructive border-b border-destructive/20 print:hidden"
          : "flex items-center gap-2 text-sm px-4 py-2 bg-amber-50 text-amber-800 border-b border-amber-200 print:hidden"
      }
    >
      {isDenied ? <ShieldAlert className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span>
        {isDenied
          ? "Acceso a Tutores denegado por falta de pago del plan Premium. Exporta tus datos antes de que se eliminen."
          : "Tu plan Premium está pendiente de pago. Agregar o editar Tutores está pausado."}
      </span>
      <Link to="/premium" className="underline font-medium shrink-0">Ver detalles</Link>
    </div>
  );
}
