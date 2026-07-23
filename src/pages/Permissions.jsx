import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Check, X } from "lucide-react";

const MATRIX = [
  { module: "Escanear asistencia", admin: "Elige cualquier grupo y escanea", catequist: "Escanea solo en su propio grupo" },
  { module: "Niños", admin: "Ve y da de alta niños de toda la parroquia; da de baja / reactiva", catequist: "Ve y da de alta niños solo de su grupo; no puede dar de baja" },
  { module: "Grupos", admin: "Crea, edita y elimina grupos", catequist: "Solo puede ver la lista de grupos" },
  { module: "Tutores (Premium)", admin: "Agrega tutores mientras el plan esté activo", catequist: "Agrega tutores mientras el plan esté activo (mismo permiso que admin)" },
  { module: "Reportes", admin: "Ve todos los grupos y puede filtrar", catequist: "Ve solo los reportes de su propio grupo" },
  { module: "Parroquia", admin: "Edita el nombre y contacto de la parroquia", catequist: "Sin acceso" },
  { module: "Usuarios", admin: "Invita, asigna roles y grupos", catequist: "Sin acceso" },
  { module: "Premium / Licencia", admin: "Ve el estado del plan y cómo activarlo", catequist: "Sin acceso" },
  { module: "Permisos (esta página)", admin: "Ve esta página", catequist: "Sin acceso" },
  { module: "Soporte", admin: "Abre y responde tickets", catequist: "Abre y responde tickets (mismo permiso que admin)" },
  { module: "Manual y Acerca de", admin: "Acceso libre", catequist: "Acceso libre" },
];

export default function Permissions() {
  const { user } = useAuth();
  if (!isParishAdmin(user)) return <RestrictedNotice />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-gold" />Permisos</h1>
        <p className="text-muted-foreground text-sm">Qué puede hacer cada rol dentro de tu parroquia. Visible solo para administradores.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Administrador de parroquia</strong> — gestiona grupos, niños de toda la parroquia, usuarios y la configuración de la parroquia. Puede haber más de uno por parroquia.</p>
          <p><strong className="text-foreground">Catequista</strong> — trabaja con su propio grupo: escanea asistencia, ve sus niños y sus reportes. No gestiona usuarios ni la parroquia.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Qué puede hacer cada rol</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sección</TableHead>
                <TableHead>Administrador de parroquia</TableHead>
                <TableHead>Catequista</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MATRIX.map((row) => (
                <TableRow key={row.module}>
                  <TableCell className="font-medium">{row.module}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="flex items-start gap-1.5"><Check className="w-3.5 h-3.5 text-moss shrink-0 mt-0.5" />{row.admin}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.catequist === "Sin acceso" ? (
                      <span className="flex items-center gap-1.5"><X className="w-3.5 h-3.5 text-destructive shrink-0" />{row.catequist}</span>
                    ) : (
                      <span className="flex items-start gap-1.5"><Check className="w-3.5 h-3.5 text-moss shrink-0 mt-0.5" />{row.catequist}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cómo se protege esto</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>La interfaz oculta lo que cada rol no puede usar, pero eso solo evita confusión — no es la protección real. Los datos en sí están aislados por parroquia a nivel de base de datos (ninguna parroquia puede ver ni modificar los datos de otra), y las acciones de gestión de usuarios se verifican también en el servidor, no solo en la pantalla.</p>
        </CardContent>
      </Card>
    </div>
  );
}
