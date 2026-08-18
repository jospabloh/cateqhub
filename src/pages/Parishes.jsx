import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isParishAdmin } from "@/lib/roles";
import RestrictedNotice from "@/components/RestrictedNotice";
import ConsentDialog from "@/components/ConsentDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DATA_PROCESSING_ACCEPTANCE_TEXT } from "@/lib/legal";
import { useToast } from "@/components/ui/use-toast";
import { Church, Check, Download, AlertTriangle } from "lucide-react";

export default function Parishes() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [parish, setParish] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [requestingDelete, setRequestingDelete] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);

  const load = async () => {
    if (!user?.parish_id) return;
    const p = await base44.entities.Parish.get(user.parish_id).catch(() => null);
    setParish(p);
    setName(p?.name || "");
    setContact(p?.admin_contact || "");
  };
  useEffect(() => { load(); }, [user?.parish_id]);

  if (!isParishAdmin(user)) return <RestrictedNotice />;

  // Descargar mis datos — módulo 7 (cuenta y zona de peligro).
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke("export_parish_data", {});
      if (!res.data?.success) {
        toast({ title: "No se pudo exportar", description: res.data?.error || "Intenta de nuevo", variant: "destructive" });
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cateqhub-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Datos exportados" });
    } catch (e) {
      toast({ title: "Error al exportar", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Solicitar eliminación de la parroquia — vía soporte, no un borrado
  // instantáneo: eliminar el registro de Parish no borra en cascada Child/
  // Group/Guardian/Attendance/ChildGuardian, así que un humano debe limpiar
  // esos datos primero (mismo criterio que el resto del portafolio para
  // operaciones irreversibles y de alto impacto sobre todo un tenant).
  const handleRequestDeletion = async () => {
    setRequestingDelete(true);
    try {
      const now = new Date().toISOString();
      const ticket = await base44.entities.SupportTicket.create({
        parish_id: user.parish_id,
        parish_name: parish?.name || "",
        subject: `Solicitud de eliminación de parroquia: ${parish?.name || user.parish_id}`,
        description: `${user.full_name || user.email} (${user.email}) solicitó eliminar permanentemente la parroquia "${parish?.name}" (${user.parish_id}) y todos sus datos (niños, grupos, tutores, asistencias). Verificar identidad y confirmar antes de proceder — esta acción es irreversible.`,
        category: "account",
        priority: "high",
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
        body: `Solicitud de eliminación permanente de la parroquia "${parish?.name}".`,
        is_internal_note: false,
      });
      fetch("https://control.acaciaco.com.mx/api/ingest/ticket-pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app: "cateqhub", ticketId: ticket.id }),
      }).catch(() => {});
      setDeleteRequested(true);
      setConfirmDelete(false);
    } catch (e) {
      toast({ title: "No se pudo enviar la solicitud", description: e.message, variant: "destructive" });
    } finally {
      setRequestingDelete(false);
    }
  };

  const save = async () => {
    if (!name) return;
    setLoading(true);
    setError("");
    try {
      if (user?.parish_id && parish) {
        await base44.entities.Parish.update(parish.id, { name, admin_contact: contact });
      } else {
        // parish_id/parish_role solo se pueden escribir con rol de servicio (ver
        // User.jsonc) — create_parish es el único camino para reclamar una
        // primera parroquia como administrador.
        const res = await base44.functions.invoke("create_parish", { name, admin_contact: contact, data_processing_accepted: accepted });
        if (res?.data?.error) throw new Error(res.data.error);
        await checkUserAuth();
      }
      await load();
    } catch (e) {
      setError(e.message || "No se pudo guardar la parroquia.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Church className="w-6 h-6 text-gold" />Parroquia</h1>
        <p className="text-muted-foreground text-sm">Datos de tu parroquia. Puede tener varios administradores (invítalos desde Usuarios).</p>
      </div>

      {user?.parish_id && parish && (
        <Card>
          <CardContent className="pt-5 flex items-center gap-2 text-moss">
            <Check className="w-5 h-5" />
            <span className="font-medium">{parish.name}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{user?.parish_id ? "Editar parroquia" : "Crear parroquia"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parroquia San Juan" /></div>
          <div className="space-y-1.5"><Label>Contacto del administrador</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nombre o email" /></div>
          {!user?.parish_id && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <Checkbox id="consent" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <label htmlFor="consent" className="text-sm text-muted-foreground">
                {DATA_PROCESSING_ACCEPTANCE_TEXT}{" "}
                <button type="button" onClick={() => setShowNotice(true)} className="text-primary hover:underline">
                  Leer aviso completo
                </button>
              </label>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={loading || !name || (!user?.parish_id && !accepted)}>{loading ? "Guardando…" : user?.parish_id ? "Guardar cambios" : "Crear y asignar"}</Button>
        </CardContent>
      </Card>

      {user?.parish_id && parish && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4" />Descargar mis datos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Exporta niños, grupos/libros, tutores y asistencias de tu parroquia en formato JSON.</p>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />{exporting ? "Exportando…" : "Descargar datos"}
            </Button>
          </CardContent>
        </Card>
      )}

      {user?.parish_id && parish && (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle className="w-4 h-4" />Zona de peligro</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Eliminar la parroquia es permanente. Enviamos tu solicitud a soporte para verificar tu identidad y limpiar los datos antes de proceder — no es un borrado instantáneo.
            </p>
            {deleteRequested ? (
              <p className="text-sm text-moss">Solicitud enviada. Soporte te contactará para confirmar.</p>
            ) : !confirmDelete ? (
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                Solicitar eliminación de la parroquia
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-destructive font-medium">¿Seguro? Esto inicia el proceso de eliminación permanente.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={requestingDelete}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleRequestDeletion} disabled={requestingDelete}>
                    {requestingDelete ? "Enviando…" : "Sí, solicitar"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ConsentDialog open={showNotice} onOpenChange={setShowNotice} />
    </div>
  );
}