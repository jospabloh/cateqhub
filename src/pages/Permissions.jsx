import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/lib/PermissionContext";
import { isParishAdmin } from "@/lib/roles";
import { getRegistryDefaults } from "@/lib/permissionRegistry";
import RestrictedNotice from "@/components/RestrictedNotice";
import ProgressRing from "@/components/ProgressRing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PermissionMatrix from "@/components/permissions/PermissionMatrix";
import { ShieldCheck, UserCog, Lock } from "lucide-react";
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

  const summary = useMemo(() => {
    const defaults = getRegistryDefaults();
    const effective = { ...defaults, ...profile?.permissions };
    const total = Object.keys(defaults).length;
    const granted = Object.values(effective).filter((v) => v === true).length;
    return { granted, total };
  }, [profile]);

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
      // Estampa perm_* en todos los catequistas de la parroquia para que la
      // aplicación real (RLS + funciones) quede sincronizada de inmediato,
      // no solo el PermissionProfile que lee la UI.
      const sync = await base44.functions.invoke("sync_catequist_permissions", {}).catch(() => null);
      if (sync?.data?.error) {
        toast({ title: "Permisos guardados, pero no se pudieron aplicar a los catequistas ya asignados", description: sync.data.error, variant: "destructive" });
      } else {
        toast({ title: "Permisos guardados" });
      }
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-gold/15 grid place-items-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">Administrador de parroquia</p>
                <Badge className="bg-moss text-moss-foreground hover:bg-moss/90 border-0">Acceso total</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona grupos/libros, usuarios, la parroquia y a todos los niños. Puede haber más de uno. No es configurable.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 flex items-center gap-4">
            <ProgressRing
              size={68}
              value={summary.granted}
              total={summary.total}
              stroke="hsl(var(--chart-1))"
              label={`${summary.granted}/${summary.total}`}
            />
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-1.5"><UserCog className="w-4 h-4 text-muted-foreground shrink-0" />Catequista</p>
              <p className="text-sm text-muted-foreground mt-1">
                Trabaja con su propio grupo/libro por defecto. {summary.granted} de {summary.total} permisos adicionales activos — ajústalos abajo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <PermissionMatrix permissions={profile?.permissions} onSave={handleSave} saving={saving} />

      <Card>
        <CardContent className="pt-5 flex items-start gap-3 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
          <p>
            Estos permisos controlan comportamiento real de la app, no solo lo que se muestra en pantalla. Usuarios, Parroquia, Premium y la administración de Grupos/Libros siguen reservados al administrador de parroquia y no son configurables aquí: esas acciones están protegidas también a nivel de base de datos, así que ningún ajuste de esta pantalla puede abrirlas. Los datos en sí están aislados por parroquia a nivel de base de datos — ninguna parroquia puede ver ni modificar los datos de otra.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
