import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { LifeBuoy, Plus, ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORIES = [
  { value: "technical", label: "Técnico" },
  { value: "billing", label: "Facturación / Premium" },
  { value: "account", label: "Cuenta" },
  { value: "feature_request", label: "Sugerencia de función" },
  { value: "other", label: "Otro" },
];

const PRIORITIES = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const STATUS_LABEL = {
  open: "Abierto",
  in_progress: "En proceso",
  waiting_customer: "Esperando tu respuesta",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const STATUS_CLASS = {
  open: "bg-primary/10 text-primary hover:bg-primary/10",
  in_progress: "bg-gold/15 text-gold hover:bg-gold/15",
  waiting_customer: "bg-muted text-muted-foreground hover:bg-muted",
  resolved: "bg-moss/15 text-moss hover:bg-moss/15",
  closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

const emptyForm = { subject: "", description: "", category: "technical", priority: "normal" };

export default function SupportTickets() {
  const { user } = useAuth();
  const [view, setView] = useState("list");
  const [tickets, setTickets] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const loadTickets = async () => {
    if (!user?.parish_id) return;
    const rows = await base44.entities.SupportTicket.filter({ parish_id: user.parish_id }, "-last_message_at").catch(() => []);
    setTickets(rows);
  };
  useEffect(() => { loadTickets(); }, [user?.parish_id]);

  const openThread = async (ticket) => {
    setActive(ticket);
    setView("thread");
    setMessages(null);
    const rows = await base44.entities.SupportTicketMessage.filter({ ticket_id: ticket.id }, "created_date").catch(() => []);
    setMessages(rows);
    if (ticket.unread_for_tenant) {
      base44.entities.SupportTicket.update(ticket.id, { unread_for_tenant: false }).catch(() => {});
    }
  };

  const createTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: "Faltan datos", description: "Asunto y descripción son obligatorios.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const ticket = await base44.entities.SupportTicket.create({
        parish_id: user.parish_id,
        parish_name: user.parish_name || "",
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        status: "open",
        created_by_id: user.id,
        created_by_email: user.email,
        unread_for_owner: true,
        unread_for_tenant: false,
        last_message_at: now,
        last_message_by_role: "tenant",
        messages_count: 1,
      });
      await base44.entities.SupportTicketMessage.create({
        ticket_id: ticket.id,
        parish_id: user.parish_id,
        author_id: user.id,
        author_email: user.email,
        author_name: user.full_name || user.email,
        author_role: "tenant",
        body: form.description.trim(),
        is_internal_note: false,
      });
      // Aviso en tiempo real a ACACIA Mission Control (no bloquea la UI). CateqHub
      // no hospeda una función propia para esto; Mission Control lee el ticket real
      // vía el puente acaciaControl antes de confiar en este aviso.
      fetch("https://control.acaciaco.com.mx/api/ingest/ticket-pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app: "cateqhub", ticketId: ticket.id }),
      }).catch(() => {});
      toast({ title: "Ticket enviado", description: "Te responderemos pronto." });
      setForm(emptyForm);
      setView("list");
      await loadTickets();
    } catch (e) {
      toast({ title: "No se pudo enviar el ticket", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await base44.entities.SupportTicketMessage.create({
        ticket_id: active.id,
        parish_id: user.parish_id,
        author_id: user.id,
        author_email: user.email,
        author_name: user.full_name || user.email,
        author_role: "tenant",
        body: reply.trim(),
        is_internal_note: false,
      });
      await base44.entities.SupportTicket.update(active.id, {
        last_message_at: now,
        last_message_by_role: "tenant",
        unread_for_owner: true,
        messages_count: (active.messages_count || 0) + 1,
        status: active.status === "resolved" || active.status === "closed" ? "open" : active.status,
      });
      setReply("");
      const updated = { ...active, messages_count: (active.messages_count || 0) + 1 };
      await openThread(updated);
      await loadTickets();
    } catch (e) {
      toast({ title: "No se pudo enviar la respuesta", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (d) => (d ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: es }) : "");

  if (view === "new") {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />Volver
        </button>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><LifeBuoy className="w-6 h-6 text-gold" />Nuevo ticket de soporte</h1>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-1.5">
              <Label>Asunto</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Resumen del problema" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Cuéntanos qué ocurre…" />
            </div>
            <div className="flex justify-end">
              <Button onClick={createTicket} disabled={busy}>{busy ? "Enviando…" : "Enviar ticket"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "thread" && active) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <button onClick={() => { setView("list"); loadTickets(); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />Volver
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-heading font-semibold truncate">{active.subject}</h1>
          <Badge className={STATUS_CLASS[active.status]}>{STATUS_LABEL[active.status] || active.status}</Badge>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3 max-h-[50vh] overflow-y-auto">
            {messages === null ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mensajes.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.author_role === "owner" ? "bg-primary/5 border border-primary/15" : "bg-muted"}`}>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                    <span className="font-medium">{m.author_role === "owner" ? "Soporte CateqHub" : (m.author_name || "Tú")}</span>
                    <span>{fmt(m.created_date)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        {active.status !== "closed" && (
          <div className="space-y-2">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe tu respuesta…" />
            <div className="flex justify-end">
              <Button onClick={sendReply} disabled={busy || !reply.trim()}><Send className="w-4 h-4 mr-2" />{busy ? "Enviando…" : "Responder"}</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><LifeBuoy className="w-6 h-6 text-gold" />Soporte</h1>
          <p className="text-muted-foreground text-sm">Tickets de tu parroquia con el equipo de CateqHub.</p>
        </div>
        <Button onClick={() => setView("new")}><Plus className="w-4 h-4 mr-2" />Nuevo ticket</Button>
      </div>

      {tickets === null ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Aún no has abierto ningún ticket.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openThread(t)}>
              <CardContent className="pt-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate flex items-center gap-2">
                    {t.subject}
                    {t.unread_for_tenant && <span className="w-2 h-2 rounded-full bg-stamp shrink-0" aria-label="Sin leer" />}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(t.last_message_at || t.created_date)}</p>
                </div>
                <Badge className={STATUS_CLASS[t.status]}>{STATUS_LABEL[t.status] || t.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
