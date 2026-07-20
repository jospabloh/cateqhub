import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserCog, Plus, Send } from "lucide-react";

export default function Users() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("catechist");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ parish_id: "", group_id: "", role: "catechist" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.parish_id) return;
    const [s, g] = await Promise.all([
      base44.entities.User.filter({ parish_id: user.parish_id }),
      base44.entities.Group.filter({ parish_id: user.parish_id }),
    ]);
    setStaff(s);
    setGroups(g);
  };
  useEffect(() => { load(); }, [user]);

  const invite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteEmail("");
      setOpen(false);
      load();
    } catch (e) {
      alert("No se pudo invitar: " + (e.message || "error"));
    } finally { setLoading(false); }
  };

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({ parish_id: u.parish_id || user.parish_id, group_id: u.group_id || "", role: u.role || "catechist" });
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      await base44.entities.User.update(editing.id, {
        parish_id: user.parish_id,
        group_id: editForm.role === "catechist" ? editForm.group_id : undefined,
        role: editForm.role,
      });
      setEditing(null);
      load();
    } finally { setLoading(false); }
  };

  const groupName = (id) => groups.find((g) => g.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><UserCog className="w-6 h-6" />Usuarios</h1>
          <p className="text-muted-foreground text-sm">Catequistas y administradores de tu parroquia.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Invitar</Button>
      </div>

      {staff.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No hay usuarios asignados a esta parroquia.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {staff.map((u) => (
            <Card key={u.id}>
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? "Administrador" : "Catequista"}</Badge>
                    {u.role === "catechist" && <span className="text-sm text-muted-foreground">Grupo: {groupName(u.group_id)}</span>}
                  </div>
                </div>
                {u.role !== "admin" || u.id !== user?.id ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Editar</Button>
                ) : <Badge variant="outline">Tú</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Correo</Label>
              <input type="email" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="catechist">Catequista</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">El invitado recibirá un correo. Tras registrarse, asígnale su grupo aquí.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={invite} disabled={loading || !inviteEmail}><Send className="w-4 h-4 mr-2" />{loading ? "Enviando…" : "Enviar invitación"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="catechist">Catequista</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            {editForm.role === "catechist" && (
              <div className="space-y-1.5">
                <Label>Grupo asignado</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.group_id} onChange={(e) => setEditForm({ ...editForm, group_id: e.target.value })}>
                  <option value="">Sin grupo</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}