import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Search, QrCode } from "lucide-react";
import { usePermissions } from "@/lib/PermissionContext";
import { normalizeCurp, isValidCurp } from "@/lib/curp";

const empty = { name: "", birth_date: "", group_id: "", curp: "" };
const RECENT_GROUP_CHANGE_DAYS = 7;
const isRecentGroupChange = (c) => c.group_changed_at
  && (Date.now() - new Date(c.group_changed_at).getTime()) < RECENT_GROUP_CHANGE_DAYS * 24 * 60 * 60 * 1000;

export default function Children() {
  const { user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const [children, setChildren] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.parish_id) return;
    const filter = { parish_id: user.parish_id };
    if (!can("ninos", "ver_todos_los_grupos") && user.group_id) filter.group_id = user.group_id;
    const [c, g] = await Promise.all([
      base44.entities.Child.filter(filter, "-created_date"),
      base44.entities.Group.filter({ parish_id: user.parish_id }),
    ]);
    setChildren(c);
    setGroups(g);
  };

  useEffect(() => { load(); }, [user, permsLoading]);

  const groupMap = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g.name])), [groups]);

  const filtered = children.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setForm({ ...empty, group_id: !can("ninos", "ver_todos_los_grupos") ? user.group_id : "" }); setOpen(true); };

  const save = async () => {
    if (!form.name || !form.group_id) return;
    setLoading(true);
    try {
      const qr_token = crypto.randomUUID();
      await base44.entities.Child.create({
        name: form.name,
        birth_date: form.birth_date || undefined,
        curp: normalizeCurp(form.curp) || undefined,
        group_id: form.group_id,
        parish_id: user.parish_id,
        qr_token,
        active: true,
      });
      setOpen(false);
      load();
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><ClipboardList className="w-6 h-6 text-gold" />Niños</h1>
          <p className="text-muted-foreground text-sm">Alta de niños y sus códigos QR.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No hay niños registrados.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground grid place-items-center font-heading font-semibold uppercase ring-2 ring-gold/25">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{groupMap[c.group_id] || "Sin grupo"}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {!c.active && <Badge variant="secondary">Inactivo</Badge>}
                    {isRecentGroupChange(c) && <Badge variant="outline" className="text-[10px] font-normal">Cambió de grupo</Badge>}
                  </div>
                </div>
                <Button asChild size="icon" variant="ghost">
                  <Link to={`/ninos/${c.id}`}><QrCode className="w-5 h-5 text-gold" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo niño</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CURP <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                value={form.curp}
                onChange={(e) => setForm({ ...form, curp: normalizeCurp(e.target.value) })}
                maxLength={18}
                placeholder="18 caracteres"
                className="font-mono uppercase tracking-wide"
              />
              {form.curp && !isValidCurp(form.curp) && (
                <p className="text-xs text-destructive">El formato de la CURP no parece válido.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} disabled={!can("ninos", "ver_todos_los_grupos")}>
                <option value="">Selecciona…</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Se generará automáticamente un código QR único.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading || !form.name || !form.group_id}>{loading ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}