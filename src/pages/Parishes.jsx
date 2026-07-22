import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Church, Plus, Check, UserRound } from "lucide-react";

export default function Parishes() {
  const { user, checkUserAuth } = useAuth();
  const [parishes, setParishes] = useState([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const p = await base44.entities.Parish.list();
    setParishes(p);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const parish = await base44.entities.Parish.create({ name, admin_contact: contact, active: true });
      // Auto-assign the current admin to this parish
      await base44.auth.updateMe({ parish_id: parish.id, parish_role: "admin" });
      setName(""); setContact("");
      await load();
      await checkUserAuth();
    } finally { setLoading(false); }
  };

  const assignToMe = async (id) => {
    await base44.auth.updateMe({ parish_id: id, parish_role: "admin" });
    await checkUserAuth();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Church className="w-6 h-6 text-gold" />Parroquia</h1>
        <p className="text-muted-foreground text-sm">Crea tu parroquia y asígnala a tu cuenta.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tu parroquia actual</CardTitle></CardHeader>
        <CardContent>
          {user?.parish_id ? (
            (() => {
              const p = parishes.find((x) => x.id === user.parish_id);
              return (
                <div className="flex items-center gap-2 text-moss">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{p?.name || "Asignada"}</span>
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-muted-foreground">Aún no tienes parroquia asignada. Crea una abajo y se asignará automáticamente.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Crear nueva parroquia</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parroquia San Juan" /></div>
          <div className="space-y-1.5"><Label>Contacto del administrador</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nombre o email" /></div>
          <Button onClick={create} disabled={loading || !name}><Plus className="w-4 h-4 mr-2" />Crear y asignar</Button>
        </CardContent>
      </Card>

      {parishes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Parroquias existentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {parishes.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.admin_contact && <p className="text-xs text-muted-foreground">{p.admin_contact}</p>}
                </div>
                {user?.parish_id === p.id ? (
                  <span className="text-xs text-moss flex items-center gap-1"><Check className="w-4 h-4" />Asignada</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => assignToMe(p.id)}><UserRound className="w-4 h-4 mr-1" />Asignarme</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}