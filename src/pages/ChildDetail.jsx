import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import QRCard from "@/components/QRCard";
import QRBadge from "@/components/QRBadge";
import BadgeSheet from "@/components/BadgeSheet";
import { exportBadgeSheetPNG } from "@/lib/badgeExport";
import { BADGE_BLEED_MM } from "@/lib/badgeLayout";
import { useLicenseStatus } from "@/lib/premium";
import { usePermissions } from "@/lib/PermissionContext";
import { normalizeCurp, isValidCurp } from "@/lib/curp";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Download, Printer, Plus, Trash2, Phone, Mail, Lock, IdCard, Repeat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const RECENT_GROUP_CHANGE_DAYS = 7;

export default function ChildDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const badgePageRefs = useRef([]);
  const badgeCardRef = useRef(null);
  const [child, setChild] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [exportingBadge, setExportingBadge] = useState(false);
  const [group, setGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [parish, setParish] = useState(null);
  const [links, setLinks] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [openG, setOpenG] = useState(false);
  const [gForm, setGForm] = useState({ name: "", phone: "", email: "", curp: "", relationship: "tutor", pickup_authorized: true });
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupChoice, setGroupChoice] = useState("");
  const [loading, setLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const status = useLicenseStatus(parish);

  // Solo el fetch de Child va en el try/catch de notFound — el de Tutores
  // (Guardian/ChildGuardian) va aparte en loadGuardians(), porque ahora puede
  // fallar legítimamente por RLS cuando el acceso está denegado, y eso no
  // significa que el niño no exista.
  const load = async () => {
    try {
      const c = await base44.entities.Child.get(id);
      setChild(c);
      if (c.group_id) base44.entities.Group.get(c.group_id).then(setGroup).catch(() => {});
      if (c.parish_id) {
        base44.entities.Parish.get(c.parish_id).then(setParish).catch(() => {});
        base44.entities.Group.filter({ parish_id: c.parish_id }).then(setGroups).catch(() => {});
      }
    } catch (e) {
      setNotFound(true);
    }
  };

  useEffect(() => { load(); }, [id]);

  const loadGuardians = async () => {
    if (status.isAccessDenied) { setLinks([]); setGuardians([]); return; }
    const rels = await base44.entities.ChildGuardian.filter({ child_id: id }).catch(() => []);
    setLinks(rels);
    if (rels.length) {
      const gs = await Promise.all(
        rels.map((r) => base44.entities.Guardian.get(r.guardian_id).catch(() => null))
      );
      setGuardians(gs.filter(Boolean));
    } else {
      setGuardians([]);
    }
  };

  useEffect(() => { if (child) loadGuardians(); }, [child?.id, status.isAccessDenied]);

  const toggleActive = async () => {
    try {
      const res = await base44.functions.invoke("update_child", { child_id: child.id, action: "toggle_active" });
      if (res.data?.error) throw new Error(res.data.error);
      await load();
      toast({ title: child.active ? "Niño dado de baja" : "Niño reactivado" });
    } catch (e) {
      toast({ title: "No se pudo actualizar", description: e.message, variant: "destructive" });
    }
  };

  const openGroupEdit = () => { setGroupChoice(child.group_id || ""); setEditingGroup(true); };

  const saveGroup = async () => {
    if (!groupChoice || groupChoice === child.group_id) { setEditingGroup(false); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("update_child", { child_id: child.id, action: "change_group", group_id: groupChoice });
      if (res.data?.error) throw new Error(res.data.error);
      setEditingGroup(false);
      await load();
      toast({ title: "Grupo/libro actualizado" });
    } catch (e) {
      toast({ title: "No se pudo cambiar el grupo/libro", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const recentGroupChange = child?.group_changed_at
    && (Date.now() - new Date(child.group_changed_at).getTime()) < RECENT_GROUP_CHANGE_DAYS * 24 * 60 * 60 * 1000;

  const addGuardian = async () => {
    if (!gForm.name) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("add_guardian", {
        child_id: child.id,
        guardian: {
          name: gForm.name,
          phone: gForm.phone,
          email: gForm.email,
          curp: normalizeCurp(gForm.curp) || undefined,
        },
        relationship: gForm.relationship,
        pickup_authorized: gForm.pickup_authorized,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setOpenG(false);
      setGForm({ name: "", phone: "", email: "", curp: "", relationship: "tutor", pickup_authorized: true });
      await loadGuardians();
      toast({ title: "Tutor agregado" });
    } catch (e) {
      toast({ title: "No se pudo agregar al tutor", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const removeGuardian = async () => {
    if (!removeTarget) return;
    try {
      await base44.entities.ChildGuardian.delete(removeTarget.id);
      setRemoveTarget(null);
      await loadGuardians();
      toast({ title: "Tutor eliminado" });
    } catch (e) {
      toast({ title: "No se pudo quitar al tutor", description: e.message, variant: "destructive" });
    }
  };

  const downloadBadge = async () => {
    setExportingBadge(true);
    try {
      await exportBadgeSheetPNG(badgeCardRef.current, `qr-${child.name.replace(/\s+/g, "_")}.png`);
    } finally {
      setExportingBadge(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-semibold">Niño no encontrado</h2>
            <p className="text-muted-foreground text-sm">Este niño no existe o ya no está disponible.</p>
            <Button asChild variant="outline"><Link to="/ninos"><ArrowLeft className="w-4 h-4 mr-1" />Volver a Niños</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!child) return <div className="grid place-items-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const relMap = (id) => links.find((l) => l.guardian_id === id);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="print:hidden"><Link to="/ninos"><ArrowLeft className="w-4 h-4 mr-1" />Volver</Link></Button>

      <div className="grid md:grid-cols-2 gap-5 print:block">
        <div className="space-y-4 print:hidden">
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-heading font-semibold">{child.name}</h1>
                <Badge
                  variant={child.active ? "default" : "secondary"}
                  className={child.active ? "bg-moss text-moss-foreground hover:bg-moss/90" : undefined}
                >
                  {child.active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              {editingGroup ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={groupChoice}
                    onChange={(e) => setGroupChoice(e.target.value)}
                  >
                    <option value="">Selecciona…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <Button size="sm" onClick={saveGroup} disabled={loading || !groupChoice}>Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingGroup(false)}>Cancelar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-muted-foreground">Grupo/Libro: {group ? group.name : "Sin grupo/libro"}{group?.level ? ` · ${group.level}` : ""}</p>
                  {can("ninos", "cambiar_grupo") && (
                    <Button size="sm" variant="ghost" onClick={openGroupEdit}><Repeat className="w-3.5 h-3.5 mr-1" />Cambiar</Button>
                  )}
                  {recentGroupChange && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Cambió de grupo/libro {formatDistanceToNow(new Date(child.group_changed_at), { addSuffix: true, locale: es })}
                    </Badge>
                  )}
                </div>
              )}
              {child.birth_date && <p className="text-muted-foreground text-sm">Nacimiento: {child.birth_date}</p>}
              {child.curp && <p className="text-muted-foreground text-sm flex items-center gap-1"><IdCard className="w-3.5 h-3.5" />CURP: <span className="font-mono">{child.curp}</span></p>}
              {can("ninos", "dar_de_baja") && (
                <Button variant="outline" size="sm" onClick={toggleActive} className="mt-2">
                  {child.active ? "Dar de baja" : "Reactivar"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Tutores
                {!status.isPremium && <Badge variant="outline" className="font-normal text-[10px]">Premium</Badge>}
              </CardTitle>
              {status.isPremium && !status.isReadOnly && can("tutores", "agregar") ? (
                <Button size="sm" variant="ghost" onClick={() => setOpenG(true)}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  title={
                    !status.isPremium
                      ? "Disponible con el plan Premium"
                      : status.isReadOnly
                      ? "Pausado por falta de pago"
                      : "Tu parroquia desactivó este permiso para catequistas"
                  }
                >
                  <Lock className="w-3.5 h-3.5 mr-1" />Agregar
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {status.isAccessDenied ? (
                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  El acceso a Tutores está bloqueado por falta de pago del plan Premium.{" "}
                  <Link to="/premium" className="underline">Ver plan Premium</Link>
                </p>
              ) : (
                <>
                  {!status.isPremium && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                      Agregar tutores requiere el plan Premium activo.{" "}
                      <Link to="/premium" className="text-primary hover:underline">Ver plan Premium</Link>
                    </p>
                  )}
                  {status.isPremium && status.isReadOnly && !status.isAccessDenied && (
                    <p className="text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2">
                      Tu período de prueba o pago está vencido — puedes ver los tutores registrados, pero no agregar ni editar.
                    </p>
                  )}
                  {guardians.length === 0 && <p className="text-sm text-muted-foreground">Sin tutores registrados.</p>}
                </>
              )}
              {guardians.map((g) => {
                const rel = relMap(g.id);
                return (
                  <div key={g.id} className="flex items-start justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{rel?.relationship}</p>
                      {rel?.pickup_authorized && <Badge variant="outline" className="mt-1">Autorizado para recoger</Badge>}
                      {g.phone && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{g.phone}</p>}
                      {g.email && <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{g.email}</p>}
                      {g.curp && <p className="text-sm text-muted-foreground flex items-center gap-1"><IdCard className="w-3 h-3" /><span className="font-mono">{g.curp}</span></p>}
                    </div>
                    {isParishAdmin(user) && (
                      <Button size="icon" variant="ghost" aria-label={`Quitar a ${g.name} como tutor`} onClick={() => setRemoveTarget({ id: rel.id, name: g.name })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="print:hidden">
            <QRCard child={child} parish={parish} group={group} />
          </div>
          <p className="text-xs text-muted-foreground text-center print:hidden">
            Lo que se descarga o imprime lleva únicamente el nombre y el código QR con guías de corte — sin ningún otro dato del niño.
          </p>
          <div className="flex gap-3 justify-center print:hidden">
            <Button variant="outline" disabled={exportingBadge} onClick={downloadBadge}><Download className="w-4 h-4 mr-2" />Descargar PNG</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
          </div>
          {/* Gafete real (solo QR + guías de corte): oculto en pantalla, usado para imprimir la hoja completa. */}
          <BadgeSheet pages={[[child]]} activePage={-1} pageRefs={badgePageRefs} />
          {/* Recorte ajustado a la tarjeta (con el margen justo para las marcas de esquina) — lo que descarga "Descargar PNG", sin el resto de la hoja carta en blanco. */}
          <div
            ref={badgeCardRef}
            className="bg-white inline-block"
            style={{ position: "absolute", left: "-9999px", top: 0, padding: `${BADGE_BLEED_MM}mm` }}
          >
            <QRBadge token={child.qr_token} name={child.name} />
          </div>
        </div>
      </div>

      <Dialog open={openG} onOpenChange={setOpenG}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar tutor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={gForm.name} onChange={(e) => setGForm({ ...gForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Teléfono</Label><Input value={gForm.phone} onChange={(e) => setGForm({ ...gForm, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Correo</Label><Input type="email" value={gForm.email} onChange={(e) => setGForm({ ...gForm, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>CURP <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                value={gForm.curp}
                onChange={(e) => setGForm({ ...gForm, curp: normalizeCurp(e.target.value) })}
                maxLength={18}
                placeholder="18 caracteres"
                className="font-mono uppercase tracking-wide"
              />
              {gForm.curp && !isValidCurp(gForm.curp) && (
                <p className="text-xs text-destructive">El formato de la CURP no parece válido.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Relación</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={gForm.relationship} onChange={(e) => setGForm({ ...gForm, relationship: e.target.value })}>
                <option value="padre">Padre</option>
                <option value="madre">Madre</option>
                <option value="tutor">Tutor</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={gForm.pickup_authorized} onChange={(e) => setGForm({ ...gForm, pickup_authorized: e.target.checked })} />
              Autorizado para recoger al niño
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenG(false)}>Cancelar</Button>
            <Button onClick={addGuardian} disabled={loading || !gForm.name}>{loading ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a este tutor del niño?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name ? `"${removeTarget.name}" dejará de estar vinculado a ${child.name}.` : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeGuardian}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}