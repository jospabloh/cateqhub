import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Search, QrCode, Printer, X } from "lucide-react";
import { usePermissions } from "@/lib/PermissionContext";
import { normalizeCurp, isValidCurp } from "@/lib/curp";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

const empty = { name: "", birth_date: "", group_id: "", curp: "" };
const RECENT_GROUP_CHANGE_DAYS = 7;
const isRecentGroupChange = (c) => c.group_changed_at
  && (Date.now() - new Date(c.group_changed_at).getTime()) < RECENT_GROUP_CHANGE_DAYS * 24 * 60 * 60 * 1000;

export default function Children() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { can, loading: permsLoading } = usePermissions();
  const { toast } = useToast();
  const [children, setChildren] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [initialLoading, setInitialLoading] = useState(true);

  const load = async () => {
    if (!user?.parish_id) return;
    setInitialLoading(true);
    try {
      const filter = { parish_id: user.parish_id };
      if (!can("ninos", "ver_todos_los_grupos") && user.group_id) filter.group_id = user.group_id;
      const [c, g] = await Promise.all([
        base44.entities.Child.filter(filter, "-created_date"),
        base44.entities.Group.filter({ parish_id: user.parish_id }),
      ]);
      setChildren(c);
      setGroups(g);
    } catch (e) {
      toast({ title: "No se pudieron cargar los niños", description: e.message, variant: "destructive" });
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, permsLoading]);

  const groupMap = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g.name])), [groups]);

  const filtered = children.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((c) => (allFilteredSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const printSelected = () => {
    const selected = children.filter((c) => selectedIds.has(c.id));
    if (!selected.length) return;
    navigate(`/ninos/gafetes?ids=${selected.map((c) => c.id).join(",")}`, { state: { children: selected } });
  };

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
      await load();
      toast({ title: "Niño registrado" });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" });
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

      {initialLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 flex items-center gap-4">
                <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No hay niños registrados.</CardContent></Card>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-muted-foreground select-none w-fit">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
            Seleccionar todos ({filtered.length})
          </label>

          <div className="grid gap-3 sm:grid-cols-2 pb-16">
            {filtered.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-5 flex items-center gap-4">
                  <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelected(c.id)} />
                  <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground grid place-items-center font-heading font-semibold uppercase ring-2 ring-gold/25">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{groupMap[c.group_id] || "Sin grupo/libro"}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {!c.active && <Badge variant="secondary">Inactivo</Badge>}
                      {isRecentGroupChange(c) && <Badge variant="outline" className="text-[10px] font-normal">Cambió de grupo/libro</Badge>}
                    </div>
                  </div>
                  <Button asChild size="icon" variant="ghost" aria-label={`Ver código QR de ${c.name}`}>
                    <Link to={`/ninos/${c.id}`}><QrCode className="w-5 h-5 text-gold" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-4 inset-x-4 md:inset-x-auto md:right-8 md:left-64 lg:left-72 z-20 flex items-center justify-between gap-3 bg-primary text-primary-foreground rounded-xl shadow-lg px-4 py-3">
          <span className="text-sm font-medium">{selectedIds.size} {selectedIds.size === 1 ? "seleccionado" : "seleccionados"}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={clearSelection}>
              <X className="w-4 h-4 mr-1" />Cancelar
            </Button>
            <Button size="sm" variant="secondary" onClick={printSelected}>
              <Printer className="w-4 h-4 mr-2" />Imprimir gafetes
            </Button>
          </div>
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
              <Label>Grupo/Libro</Label>
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