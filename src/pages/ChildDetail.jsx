import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import QRCard, { downloadQRCard } from "@/components/QRCard";
import { ArrowLeft, Download, Printer, Plus, Trash2, Phone, Mail } from "lucide-react";

export default function ChildDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const cardRef = useRef(null);
  const [child, setChild] = useState(null);
  const [group, setGroup] = useState(null);
  const [parish, setParish] = useState(null);
  const [links, setLinks] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [openG, setOpenG] = useState(false);
  const [gForm, setGForm] = useState({ name: "", phone: "", email: "", relationship: "tutor", pickup_authorized: true });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const c = await base44.entities.Child.get(id);
    setChild(c);
    if (c.group_id) base44.entities.Group.get(c.group_id).then(setGroup).catch(() => {});
    if (c.parish_id) base44.entities.Parish.get(c.parish_id).then(setParish).catch(() => {});
    const rels = await base44.entities.ChildGuardian.filter({ child_id: id });
    setLinks(rels);
    if (rels.length) {
      const gs = await Promise.all(rels.map((r) => base44.entities.Guardian.get(r.guardian_id)));
      setGuardians(gs);
    } else {
      setGuardians([]);
    }
  };

  useEffect(() => { load(); }, [id]);

  const toggleActive = async () => {
    await base44.entities.Child.update(child.id, { active: !child.active });
    load();
  };

  const addGuardian = async () => {
    if (!gForm.name) return;
    setLoading(true);
    try {
      const guardian = await base44.entities.Guardian.create({
        parish_id: user.parish_id,
        name: gForm.name,
        phone: gForm.phone,
        email: gForm.email,
        whatsapp_opt_in: false,
      });
      await base44.entities.ChildGuardian.create({
        parish_id: user.parish_id,
        child_id: child.id,
        guardian_id: guardian.id,
        relationship: gForm.relationship,
        pickup_authorized: gForm.pickup_authorized,
      });
      setOpenG(false);
      setGForm({ name: "", phone: "", email: "", relationship: "tutor", pickup_authorized: true });
      load();
    } finally { setLoading(false); }
  };

  const removeGuardian = async (linkId) => {
    if (!confirm("¿Quitar a este tutor del niño?")) return;
    await base44.entities.ChildGuardian.delete(linkId);
    load();
  };

  if (!child) return <div className="grid place-items-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const relMap = (id) => links.find((l) => l.guardian_id === id);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm"><Link to="/ninos"><ArrowLeft className="w-4 h-4 mr-1" />Volver</Link></Button>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-4">
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
              {group && <p className="text-muted-foreground">Grupo: {group.name}{group.level ? ` · ${group.level}` : ""}</p>}
              {child.birth_date && <p className="text-muted-foreground text-sm">Nacimiento: {child.birth_date}</p>}
              <Button variant="outline" size="sm" onClick={toggleActive} className="mt-2">
                {child.active ? "Dar de baja" : "Reactivar"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tutores</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setOpenG(true)}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {guardians.length === 0 && <p className="text-sm text-muted-foreground">Sin tutores registrados.</p>}
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
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeGuardian(rel.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <QRCard ref={cardRef} child={child} parish={parish} group={group} />
          <div className="flex gap-3 justify-center print:hidden">
            <Button variant="outline" onClick={() => downloadQRCard(child)}><Download className="w-4 h-4 mr-2" />Descargar PNG</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
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
    </div>
  );
}