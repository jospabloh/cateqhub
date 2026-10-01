import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { verifyOtpMessage, resendOtpMessage } from "@/lib/authErrors";

// Paso "escribe el código que te enviamos": lo usan Register (justo después de
// crear la cuenta) y Login (cuando la cuenta existe pero nunca se verificó).
// Antes vivía sólo dentro de Register, así que quien intentaba entrar con una
// cuenta sin verificar veía el error crudo y ningún lugar donde escribir el
// código.
//
// Tras verificar intenta el login con la contraseña que la persona ya escribió,
// para no pedírsela otra vez. Si ese login falla (poco probable, pero es red),
// la cuenta ya quedó verificada: se manda a /login en vez de dejarla atorada.
export default function VerifyEmailStep({ email, password, onCancel }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (busy || code.length < 6) return;
    setError("");
    setBusy(true);
    try {
      await base44.auth.verifyOtp({ email, otpCode: code });
    } catch (err) {
      setError(verifyOtpMessage(err));
      setBusy(false);
      return;
    }
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch {
      toast({ title: "Correo verificado", description: "Ahora inicia sesión con tu contraseña." });
      window.location.href = "/login";
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Código enviado", description: "Revisa tu correo para ver el código nuevo." });
    } catch (err) {
      setError(resendOtpMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4 text-center">
        Enviamos un código a <strong className="text-foreground">{email}</strong>. Escríbelo para activar tu cuenta.
      </p>
      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-center mb-6">
        <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus autoComplete="one-time-code">
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={busy || code.length < 6}>
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          "Verificar"
        )}
      </Button>
      <div className="flex justify-between text-sm mt-4">
        <button type="button" onClick={handleResend} disabled={resending} className="text-primary font-medium hover:underline disabled:opacity-60">
          {resending ? "Enviando..." : "Reenviar código"}
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          Usar otro correo
        </button>
      </div>
    </div>
  );
}
