import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Church, KeyRound, Clock, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Lo que ve quien todavía no pertenece a ninguna parroquia: crear la suya
// (queda como administrador) o pedir acceso a una existente con su código.
//
// El código NO da acceso, sólo abre una solicitud que un administrador de esa
// parroquia aprueba desde Usuarios. Por eso el estado "esperando aprobación" se
// lee del servidor (join_status) y no de un estado local: sobrevive a recargar,
// a cerrar la pestaña y a cambiar de dispositivo.
export default function JoinParish() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("assign_parish_user", { action: "join_status" });
      if (res.data?.joined) {
        // Aprobada mientras estaba aquí. checkUserAuth()/auth.me() puede
        // devolver una vista vieja del usuario (sin parish_id todavía), así que
        // no basta con volver a leerla: se recarga la app completa para que la
        // sesión relea el registro guardado y el Dashboard pase a la parroquia.
        // Una sola vez por sesión: si el registro aún no refleja la aprobación,
        // no se entra en un bucle de recargas.
        let already = false;
        try { already = sessionStorage.getItem("cq-join-reloaded") === "1"; sessionStorage.setItem("cq-join-reloaded", "1"); } catch { /* sin storage: se recarga igual una vez por montaje */ }
        if (!already) {
          window.location.assign("/");
          return;
        }
      }
      setRequest(res.data?.request || null);
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const send = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await base44.functions.invoke("assign_parish_user", { action: "join", code });
      if (res.data?.error) throw new Error(res.data.error);
      setRequest(res.data.request);
      setCode("");
    } catch (err) {
      // Los errores de la función traen el motivo en español en el cuerpo; el
      // mensaje de axios ("Request failed with status code 404") no le sirve a nadie.
      setError(err?.response?.data?.error || err.message || "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke("assign_parish_user", { action: "cancel_join_request" });
      setRequest(null);
    } catch (err) {
      toast({ title: "No se pudo cancelar", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center mt-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (request?.status === "pending") {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-gold/15 grid place-items-center"><Clock className="w-6 h-6 text-gold" /></div>
            <div>
              <h2 className="text-xl font-semibold">Solicitud enviada</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Esperando la aprobación de un administrador de {request.parish_name ? <strong className="text-foreground">{request.parish_name}</strong> : "la parroquia"}.
                Mientras tanto no verás datos de la parroquia. Puedes cerrar esta página: cuando te aprueben, entra de nuevo.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={busy}>Revisar ahora</Button>
              <Button variant="ghost" onClick={cancel} disabled={busy}>Cancelar solicitud</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 space-y-4">
      {request?.status === "rejected" && (
        <Card className="border-destructive/30">
          <CardContent className="pt-5 flex gap-3 text-sm">
            <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Tu solicitud no fue aprobada</p>
              {request.reject_reason && <p className="text-muted-foreground mt-0.5">Motivo: {request.reject_reason}</p>}
              <p className="text-muted-foreground mt-0.5">Puedes pedir el código correcto a tu administrador y volver a intentar.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold">Unirme con un código</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Pídele a un administrador de tu parroquia su código (está en Usuarios). Al enviarlo, él aprobará tu solicitud y elegirá tu rol.
          </p>
          <form onSubmit={send} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="join-code">Código de la parroquia</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD-EFGH"
                autoComplete="off"
                autoCapitalize="characters"
                className="tracking-widest font-mono"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || code.replace(/[\s-]/g, "").length < 8}>
              {busy ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Church className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold">Crear mi parroquia</h2>
          </div>
          <p className="text-sm text-muted-foreground">Si tu parroquia aún no usa CateqHub, créala: quedas como su administrador y podrás invitar a tus catequistas.</p>
          <Button asChild variant="outline" className="w-full"><Link to="/parroquia">Crear parroquia</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
