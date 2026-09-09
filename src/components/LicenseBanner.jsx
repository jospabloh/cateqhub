import { Link } from "react-router-dom";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useLicenseStatus } from "@/lib/premium";

export default function LicenseBanner({ parish }) {
  const { status } = useLicenseStatus(parish);
  if (status === "active") return null;

  const isDenied = status === "access_denied" || status === "deletion_eligible";

  return (
    <div
      className={
        isDenied
          ? "flex items-center gap-2 text-sm px-4 py-2 bg-destructive/10 text-destructive border-b border-destructive/20 print:hidden"
          : "flex items-center gap-2 text-sm px-4 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800 print:hidden"
      }
    >
      {isDenied ? <ShieldAlert className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span>
        {isDenied
          ? "Tu período de prueba o pago venció: escanear, niños, grupos/libros, reportes y Tutores están pausados. Exporta tus datos de Tutores antes de que se eliminen."
          : "Tu período de prueba o pago venció. Agregar o editar está pausado en toda la app hasta renovar."}
      </span>
      <Link to="/premium" className="underline font-medium shrink-0">Ver detalles</Link>
    </div>
  );
}
