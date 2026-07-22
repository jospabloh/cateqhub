import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import jsQR from "jsqr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Camera, CameraOff } from "lucide-react";
import { isParishAdmin, isCatechist } from "@/lib/roles";

export default function Scan() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cooldownRef = useRef(false);

  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(user?.group_id || "");
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ kind: "idle", childName: "", message: "" });

  // Load groups for this parish (admin: all; user: own group)
  useEffect(() => {
    if (!user?.parish_id) return;
    base44.entities.Group.filter({ parish_id: user.parish_id }).then((g) => {
      setGroups(g);
      if (isCatechist(user) && user.group_id) setGroupId(user.group_id);
      else if (g.length === 1) setGroupId(g[0].id);
    });
  }, [user]);

  const start = async () => {
    setError("");
    if (!groupId) {
      setError("Selecciona un grupo antes de escanear.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setError("No se pudo acceder a la cámara. Verifica permisos del navegador.");
      setActive(false);
    }
  };

  const stop = () => {
    setActive(false);
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    let raf;
    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && !cooldownRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) handleToken(code.data);
      }
      raf = requestAnimationFrame(loop);
    };
    if (active) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, groupId]);

  const handleToken = async (token) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    // Extract token: QR may contain just the UUID or a URL ending in it
    const clean = token.split("/").pop();

    try {
      const found = await base44.entities.Child.filter({
        parish_id: user.parish_id,
        qr_token: clean,
      });
      const child = found[0];

      if (!child) {
        setStatus({ kind: "error", message: "QR no reconocido en esta parroquia" });
        setTimeout(() => setStatus({ kind: "idle" }), 2500);
        return;
      }
      if (!child.active) {
        setStatus({ kind: "error", childName: child.name, message: "Niño inactivo — no se registra asistencia" });
        setTimeout(() => setStatus({ kind: "idle" }), 3000);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const existing = await base44.entities.Attendance.filter({
        child_id: child.id,
        date: today,
      });
      if (existing.length > 0) {
        setStatus({ kind: "duplicate", childName: child.name, message: "Ya registrado hoy" });
        setTimeout(() => setStatus({ kind: "idle" }), 2500);
        return;
      }

      await base44.entities.Attendance.create({
        parish_id: user.parish_id,
        group_id: groupId,
        child_id: child.id,
        date: today,
        recorded_by: user.id,
      });
      setStatus({ kind: "success", childName: child.name, message: "Asistencia registrada" });
      setTimeout(() => setStatus({ kind: "idle" }), 2500);
    } catch (e) {
      setStatus({ kind: "error", message: "Error al registrar. Intenta de nuevo." });
      setTimeout(() => setStatus({ kind: "idle" }), 2500);
    } finally {
      setTimeout(() => { cooldownRef.current = false; }, 1800);
    }
  };

  useEffect(() => () => stop(), []);

  const statusStyles = {
    idle: "bg-muted text-muted-foreground",
    success: "bg-moss text-moss-foreground",
    duplicate: "bg-gold text-gold-foreground",
    error: "bg-stamp text-stamp-foreground",
  };
  const StatusIcon = status.kind === "success" ? CheckCircle2 : status.kind === "duplicate" ? AlertTriangle : status.kind === "error" ? XCircle : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><ScanLine className="w-6 h-6 text-gold" />Escanear asistencia</h1>
        <p className="text-muted-foreground text-sm">Apunta la cámara al código QR del niño.</p>
      </div>

      {isParishAdmin(user) && (
        <div className="space-y-1.5">
          <Label>Grupo</Label>
          <Select value={groupId} onValueChange={setGroupId} disabled={active}>
            <SelectTrigger><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger>
            <SelectContent>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden">
          <div className="relative aspect-square max-w-md mx-auto bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {!active && (
              <div className="absolute inset-0 grid place-items-center text-white/70">
                <div className="text-center">
                  <CameraOff className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Cámara apagada</p>
                </div>
              </div>
            )}
            {active && (
              <div className="absolute inset-8 border-2 border-white/60 rounded-xl pointer-events-none" />
            )}

            {status.kind === "success" && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="animate-confirm rounded-full bg-moss text-moss-foreground w-20 h-20 grid place-items-center shadow-lg">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              </div>
            )}

            {status.kind !== "idle" && (
              <div className={`absolute inset-x-0 bottom-0 p-4 flex items-center gap-3 ${statusStyles[status.kind]}`}>
                {StatusIcon && <StatusIcon className="w-6 h-6 shrink-0" />}
                <div>
                  {status.childName && <p className="font-semibold leading-tight">{status.childName}</p>}
                  <p className="text-sm leading-tight">{status.message}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        {!active ? (
          <Button onClick={start} size="lg" className="w-full"><Camera className="w-4 h-4 mr-2" />Activar cámara</Button>
        ) : (
          <Button onClick={stop} size="lg" variant="destructive" className="w-full">Detener</Button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}