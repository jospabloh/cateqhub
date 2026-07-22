import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Church, Check } from "lucide-react";

export default function Parishes() {
  const { user, checkUserAuth } = useAuth();
  const [parish, setParish] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.parish_id) return;
    const p = await base44.entities.Parish.get(user.parish_id).catch(() => null);
    setParish(p);
    setName(p?.name || "");
    setContact(p?.admin_contact || "");
  };
  useEffect(() => { load(); }, [user?.parish_id]);

  if (!isParishAdmin(user)) return <RestrictedNotice />;

  const save = async () => {
    if (!name) return;
    setLoading(true);
    try {
      if (user?.parish_id && parish) {
        await base44.entities.Parish.update(parish.id, { name, admin_contact: contact });
      } else {
        const created = await base44.entities.Parish.create({ name, admin_contact: contact, active: true });
        await base44.auth.updateMe({ parish_id: created.id, parish_role: "admin" });
        await checkUserAuth();
      }
      await load();
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Church className="w-6 h-6 text-gold" />Parroquia</h1>
        <p className="text-muted-foreground text-sm">Datos de tu parroquia. Puede tener varios administradores (invítalos desde Usuarios).</p>
      </div>

      {user?.parish_id && parish && (
        <Card>
          <CardContent className="pt-5 flex items-center gap-2 text-moss">
            <Check className="w-5 h-5" />
            <span className="font-medium">{parish.name}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{user?.parish_id ? "Editar parroquia" : "Crear parroquia"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parroquia San Juan" /></div>
          <div className="space-y-1.5"><Label>Contacto del administrador</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nombre o email" /></div>
          <Button onClick={save} disabled={loading || !name}>{loading ? "Guardando…" : user?.parish_id ? "Guardar cambios" : "Crear y asignar"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}