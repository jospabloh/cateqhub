import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";

const empty = { name: "", level: "", user_id: "" };

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.parish_id) return;
    const [g, s] = await Promise.all([
      base44.entities.Group.filter({ parish_id: user.parish_id }),
      base44.functions.invoke("list_parish_users", {}).then((r) => (r.data?.users || []).filter((u) => u.parish_role === "catequist")).catch(() => []),
    ]);
    setGroups(g);
    setStaff(s);
  };

  useEffect(() => { load(); }, [user]);

  const openNew = () => { setForm(empty); setEditingId(null); setOpen(true); };
  const openEdit = (g) => { setForm({ name: g.name, level: g.level || "", user_id: g.user_id || "" }); setEditingId(g.id); setOpen(true); };

  const save = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      if (editingId) {
        await base44.entities.Group.update(editingId, { ...form });
      } else {
        await base44.entities.Group.create({ ...form, parish_id: user.parish_id });
      }
      setOpen(false);
      load();
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este grupo?")) return;
    await base44.entities.Group.delete(id);
    load();
  };

  const staffName = (id) => staff.find((s) => s.id === id)?.full_name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Users className="w-6 h-6 text-gold" />Grupos</h1>
          <p className="text-muted-foreground text-sm">Clases de catecismo de tu parroquia.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
      </div>

      {groups.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Aún no hay grupos. Crea el primero.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{g.name}</p>
                    {g.level && <p className="text-sm text-muted-foreground">Nivel: {g.level}</p>}
                    <p className="text-sm text-muted-foreground mt-1">Catequista: {staffName(g.user_id)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(g)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar grupo" : "Nuevo grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Primera Comunión A" />
            </div>
            <div className="space-y-1.5">
              <Label>Nivel</Label>
              <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Ej. 2° año" />
            </div>
            <div className="space-y-1.5">
              <Label>Catequista</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading || !form.name}>{loading ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}