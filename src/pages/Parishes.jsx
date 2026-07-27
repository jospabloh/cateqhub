import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import ConsentDialog from "@/components/ConsentDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DATA_PROCESSING_ACCEPTANCE_TEXT } from "@/lib/legal";
import { Church, Check } from "lucide-react";

export default function Parishes() {
  const { user, checkUserAuth } = useAuth();
  const [parish, setParish] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

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
    setError("");
    try {
      if (user?.parish_id && parish) {
        await base44.entities.Parish.update(parish.id, { name, admin_contact: contact });
      } else {
        // parish_id/parish_role solo se pueden escribir con rol de servicio (ver
        // User.jsonc) — create_parish es el único camino para reclamar una
        // primera parroquia como administrador.
        const res = await base44.functions.invoke("create_parish", { name, admin_contact: contact, data_processing_accepted: accepted });
        if (res?.data?.error) throw new Error(res.data.error);
        await checkUserAuth();
      }
      await load();
    } catch (e) {
      setError(e.message || "No se pudo guardar la parroquia.");
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
          {!user?.parish_id && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <Checkbox id="consent" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <label htmlFor="consent" className="text-sm text-muted-foreground">
                {DATA_PROCESSING_ACCEPTANCE_TEXT}{" "}
                <button type="button" onClick={() => setShowNotice(true)} className="text-primary hover:underline">
                  Leer aviso completo
                </button>
              </label>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={loading || !name || (!user?.parish_id && !accepted)}>{loading ? "Guardando…" : user?.parish_id ? "Guardar cambios" : "Crear y asignar"}</Button>
        </CardContent>
      </Card>

      <ConsentDialog open={showNotice} onOpenChange={setShowNotice} />
    </div>
  );
}