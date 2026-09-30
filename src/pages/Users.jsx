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
import { UserCog, Plus, Send, UserCheck, UserX, KeyRound, Copy, RefreshCw, Inbox } from "lucide-react";

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
  const [removing, setRemoving] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [requests, setRequests] = useState([]);
  // Rol/grupo elegidos por solicitud (id -> {role, group_id}). Sin valor por
  // defecto de rol "invisible": el select arranca en catequista pero es visible
  // y el administrador lo confirma al pulsar Aprobar.
  const [decisions, setDecisions] = useState({});
  const [deciding, setDeciding] = useState(null);

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

  // Código de la parroquia y solicitudes de acceso pendientes. Van por la
  // función (rol de servicio, acotada a la parroquia del administrador): la
  // entidad JoinRequest no se lee desde el cliente.
  const loadJoin = async () => {
    if (!user?.parish_id) return;
    try {
      const [c, r] = await Promise.all([
        base44.functions.invoke("assign_parish_user", { action: "join_code" }),
        base44.functions.invoke("assign_parish_user", { action: "list_join_requests" }),
      ]);
      setJoinCode(c.data?.join_code || "");
      setRequests(r.data?.requests || []);
    } catch (e) {
      toast({ title: "No se pudieron cargar las solicitudes", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };
  useEffect(() => { loadJoin(); }, [user?.parish_id]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      toast({ title: "Código copiado", description: joinCode });
    } catch {
      toast({ title: "No se pudo copiar", description: "Selecciónalo y cópialo a mano.", variant: "destructive" });
    }
  };

  const regenerateCode = async () => {
    if (!window.confirm("¿Generar un código nuevo? El anterior dejará de funcionar. Las solicitudes ya enviadas no se pierden.")) return;
    try {
      const res = await base44.functions.invoke("assign_parish_user", { action: "join_code", regenerate: true });
      setJoinCode(res.data?.join_code || "");
      toast({ title: "Código nuevo generado" });
    } catch (e) {
      toast({ title: "No se pudo generar el código", description: e?.response?.data?.error || e.message, variant: "destructive" });
    }
  };

  const decisionOf = (id) => decisions[id] || { role: "catequist", group_id: "" };
  const setDecision = (id, patch) => setDecisions((d) => ({ ...d, [id]: { ...decisionOf(id), ...patch } }));

  const decide = async (req, approve) => {
    const d = decisionOf(req.id);
    setDeciding(req.id);
    try {
      await base44.functions.invoke("assign_parish_user", approve
        ? { action: "approve_request", request_id: req.id, parish_role: d.role, group_id: d.role === "catequist" ? d.group_id : "" }
        : { action: "reject_request", request_id: req.id });
      toast({ title: approve ? "Solicitud aprobada" : "Solicitud rechazada", description: req.user_email });
      await Promise.all([loadJoin(), approve ? load() : Promise.resolve()]);
    } catch (e) {
      toast({ title: approve ? "No se pudo aprobar" : "No se pudo rechazar", description: e?.response?.data?.error || e.message, variant: "destructive" });
      loadJoin();
    } finally {
      setDeciding(null);
    }
  };

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

  const removeUser = async (u) => {
    if (!window.confirm(`¿Quitar a ${u.full_name || u.email} de tu parroquia? Perderá acceso hasta que lo vuelvas a asignar.`)) return;
    setRemoving(u.id);
    try {
      const res = await base44.functions.invoke("assign_parish_user", { action: "remove", email: u.email });
      if (res.data?.removed) {
        toast({ title: "Usuario removido", description: u.email });
        load();
      } else {
        toast({ title: "No se pudo quitar", description: res.data?.error || "error", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "No se pudo quitar", description: e.message || "error", variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

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

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium flex items-center gap-2"><KeyRound className="w-4 h-4 text-gold" />Código para unirse</p>
              <p className="text-xs text-muted-foreground">Compártelo con quien deba entrar. El código sólo abre una solicitud: tú la apruebas y eliges su rol.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono tracking-widest text-sm">{joinCode || "…"}</code>
              <Button size="sm" variant="outline" onClick={copyCode} disabled={!joinCode}><Copy className="w-4 h-4 mr-1" />Copiar</Button>
              <Button size="sm" variant="ghost" onClick={regenerateCode} disabled={!joinCode} title="Generar un código nuevo"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card className="border-gold/40">
          <CardContent className="pt-5 space-y-3">
            <p className="font-medium flex items-center gap-2"><Inbox className="w-4 h-4 text-gold" />Solicitudes de acceso ({requests.length})</p>
            {requests.map((r) => {
              const d = decisionOf(r.id);
              return (
                <div key={r.id} className="rounded-md border border-border p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm">{r.user_name || r.user_email}</p>
                    {r.user_name && <p className="text-xs text-muted-foreground">{r.user_email}</p>}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Rol al aprobar</Label>
                      <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={d.role} onChange={(e) => setDecision(r.id, { role: e.target.value })}>
                        <option value="catequist">Catequista</option>
                        <option value="admin">Administrador de parroquia</option>
                      </select>
                    </div>
                    {d.role === "catequist" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Grupo/Libro</Label>
                        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={d.group_id} onChange={(e) => setDecision(r.id, { group_id: e.target.value })}>
                          <option value="">Sin grupo/libro</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <Button size="sm" onClick={() => decide(r, true)} disabled={deciding === r.id}>Aprobar</Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => decide(r, false)} disabled={deciding === r.id}>Rechazar</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Editar</Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => removeUser(u)} disabled={removing === u.id}>
                      <UserX className="w-4 h-4 mr-1" />{removing === u.id ? "Quitando…" : "Quitar"}
                    </Button>
                  </div>
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