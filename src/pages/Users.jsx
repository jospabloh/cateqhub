import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { UserCog, Plus, Send, UserCheck } from "lucide-react";

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("catequist"); // parish_role (tenant)
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignGroupId, setAssignGroupId] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ group_id: "", parish_role: "catequist" });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = async () => {
    if (!user?.parish_id) return;
    setInitialLoading(true);
    try {
      const [res, g] = await Promise.all([
        base44.functions.invoke("list_parish_users", {}),
        base44.entities.Group.filter({ parish_id: user.parish_id }),
      ]);
      setStaff(res.data?.users || []);
      setGroups(g);
    } catch (e) {
      setStaff([]);
      toast({ title: "No se pudieron cargar los usuarios", description: e.message, variant: "destructive" });
    } finally {
      setInitialLoading(false);
    }
  };
  useEffect(() => { load(); }, [user]);

  const assignToParish = async (email, groupId, parishRole) => {
    const res = await base44.functions.invoke("assign_parish_user", {
      email,
      parish_id: user.parish_id,
      group_id: parishRole === "catequist" ? groupId : "",
      parish_role: parishRole,
    });
    return res.data;
  };

  const invite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    try {
      // La invitación a la app es siempre como `user` de plataforma.
      // El rol dentro de la parroquia (tenant) se asigna por backend.
      await base44.users.inviteUser(inviteEmail, "user");
      const data = await assignToParish(inviteEmail, inviteGroupId, inviteRole).catch(() => null);
      if (data?.assigned) {
        toast({ title: "Invitación enviada", description: `${inviteEmail} — ${inviteRole === "catequist" ? "catequista vinculado a tu parroquia." : "administrador de parroquia vinculado."}` });
      } else if (data?.found === false) {
        toast({ title: "Invitación enviada", description: `Cuando ${inviteEmail} registre su cuenta, presiona "Asignar" e ingresa su correo para vincularlo a tu parroquia.` });
      } else {
        toast({ title: "Invitación enviada", description: inviteEmail });
      }
      setInviteEmail("");
      setInviteGroupId("");
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: "No se pudo invitar", description: e.message || "error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const assign = async () => {
    if (!assignEmail) return;
    setLoading(true);
    try {
      const data = await assignToParish(assignEmail, assignGroupId, "catequist");
      if (data?.assigned) {
        toast({ title: "Catequista vinculado", description: data.user?.email || assignEmail });
        setAssignOpen(false);
        setAssignEmail("");
        setAssignGroupId("");
        load();
      } else {
        toast({ title: "No se pudo vincular", description: data?.message || "El usuario aún no ha registrado su cuenta.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "No se pudo asignar", description: e.message || "error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const openEdit = (u) => {
    setEditing(u);
    setEditForm({ group_id: u.group_id || "", parish_role: u.parish_role || "catequist" });
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      const data = await assignToParish(editing.email, editForm.group_id, editForm.parish_role);
      if (data?.assigned) {
        setEditing(null);
        load();
        toast({ title: "Usuario actualizado" });
      } else {
        toast({ title: "No se pudo actualizar", description: data?.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e.message || "error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const groupName = (id) => groups.find((g) => g.id === id)?.name || "—";
  const isMe = (u) => u.id === user?.id;

  if (!isParishAdmin(user)) return <RestrictedNotice />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><UserCog className="w-6 h-6 text-gold" />Usuarios</h1>
          <p className="text-muted-foreground text-sm">Catequistas y administradores de tu parroquia.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Invitar</Button>
          <Button variant="outline" onClick={() => setAssignOpen(true)}><UserCheck className="w-4 h-4 mr-2" />Asignar</Button>
        </div>
      </div>

      {initialLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-1/4" /></CardContent></Card>
          ))}
        </div>
      ) : staff.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No hay usuarios asignados a esta parroquia.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {staff.map((u) => (
            <Card key={u.id}>
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={u.parish_role === "admin" ? "default" : "secondary"}>{u.parish_role === "admin" ? "Administrador" : "Catequista"}</Badge>
                    {u.parish_role === "catequist" && <span className="text-sm text-muted-foreground">Grupo/Libro: {groupName(u.group_id)}</span>}
                  </div>
                </div>
                {isMe(u) ? (
                  <Badge variant="outline">Tú</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Editar</Button>
                )}
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
              <Label>Rol en la parroquia</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="catequist">Catequista</option>
                <option value="admin">Administrador de parroquia</option>
              </select>
            </div>
            {inviteRole === "catequist" && (
              <div className="space-y-1.5">
                <Label>Grupo/Libro</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={inviteGroupId} onChange={(e) => setInviteGroupId(e.target.value)}>
                  <option value="">Sin grupo/libro (asignar después)</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">El invitado recibirá un correo con acceso a la app. Su rol y grupo/libro quedan limitados a tu parroquia.</p>
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
              <Label>Rol en la parroquia</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.parish_role} onChange={(e) => setEditForm({ ...editForm, parish_role: e.target.value })}>
                <option value="catequist">Catequista</option>
                <option value="admin">Administrador de parroquia</option>
              </select>
            </div>
            {editForm.parish_role === "catequist" && (
              <div className="space-y-1.5">
                <Label>Grupo/Libro asignado</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.group_id} onChange={(e) => setEditForm({ ...editForm, group_id: e.target.value })}>
                  <option value="">Sin grupo/libro</option>
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

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar catequista registrado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Correo del catequista</Label>
              <input type="email" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Grupo/Libro</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)}>
                <option value="">Sin grupo/libro</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Para catequistas que ya aceptaron su invitación y registraron su cuenta.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={assign} disabled={loading || !assignEmail}>{loading ? "Asignando…" : "Vincular a la parroquia"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}