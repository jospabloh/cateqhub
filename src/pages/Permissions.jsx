import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PermissionMatrix from "@/components/permissions/PermissionMatrix";
import { ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Permissions() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const { reload: reloadPermissions } = usePermissions();
  const { toast } = useToast();

  const loadProfile = useCallback(async () => {
    if (!user?.parish_id) return;
    try {
      const rows = await base44.entities.PermissionProfile.filter({ parish_id: user.parish_id, role_key: "catequist" });
      setProfile(rows?.[0] || null);
    } catch (_) {
      setProfile(null);
    }
  }, [user?.parish_id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (!isParishAdmin(user)) return <RestrictedNotice />;

  const handleSave = async (permissions) => {
    setSaving(true);
    try {
      if (profile) {
        await base44.entities.PermissionProfile.update(profile.id, { permissions });
      } else {
        await base44.entities.PermissionProfile.create({
          parish_id: user.parish_id,
          role_key: "catequist",
          permissions,
        });
      }
      await loadProfile();
      reloadPermissions();
      toast({ title: "Permisos guardados" });
      return true;
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-gold" />Permisos</h1>
        <p className="text-muted-foreground text-sm">Qué puede hacer cada rol dentro de tu parroquia. Visible solo para administradores.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Administrador de parroquia</strong> — gestiona grupos, usuarios y la configuración de la parroquia, y siempre tiene acceso total a los niños de toda la parroquia. Puede haber más de uno por parroquia. No es configurable.</p>
          <p><strong className="text-foreground">Catequista</strong> — trabaja con su propio grupo por defecto: escanea asistencia, ve sus niños y sus reportes. No gestiona usuarios ni la parroquia. Lo que sí puede hacer fuera de su grupo se configura abajo.</p>
        </CardContent>
      </Card>

      <PermissionMatrix permissions={profile?.permissions} onSave={handleSave} saving={saving} />

      <Card>
        <CardHeader><CardTitle className="text-base">Cómo se protege esto</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Estos permisos controlan comportamiento real de la app (qué grupos ve o edita un catequista), no solo lo que se muestra en pantalla. Usuarios, Parroquia, Premium y la administración de Grupos siguen reservados al administrador de parroquia y no son configurables aquí: esas acciones están protegidas también a nivel de base de datos, así que ningún ajuste de esta pantalla puede abrirlas. Los datos en sí están aislados por parroquia a nivel de base de datos — ninguna parroquia puede ver ni modificar los datos de otra.</p>
        </CardContent>
      </Card>
    </div>
  );
}
