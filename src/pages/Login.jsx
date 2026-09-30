import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import VerifyEmailStep from "@/components/VerifyEmailStep";
import { needsEmailVerification } from "@/lib/authErrors";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      window.location.href = "/";
    } catch (err) {
      // Cuenta creada pero nunca verificada: no es una contraseña mala. Se abre
      // el paso del código (con reenvío) en vez del error crudo en inglés.
      if (needsEmailVerification(err)) {
        setVerifying(true);
      } else {
        setError(err.message || "Correo o contraseña inválidos");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  if (verifying) {
    return (
      <AuthLayout icon={Mail} title="Verifica tu correo" subtitle="Tu cuenta aún no está activada">
        <VerifyEmailStep email={email.trim()} password={password} onCancel={() => setVerifying(false)} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={LogIn}
      title="Bienvenido de nuevo"
      subtitle="Ingresa a tu cuenta"
      footer={
        <>
          ¿No tienes una cuenta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Crear una
          </Link>
          {/* Módulo 10 del estándar: el login enlaza a soporte y a la prueba.
              Quien no puede entrar es justo quien no tiene ninguna otra vía
              dentro del app para pedir ayuda —/soporte vive detrás de la
              sesión—, así que sin esto la única salida es adivinar un correo.
              Los dos van a acaciaco.com.mx porque el sitio es la superficie
              pública de esta app (módulo 9); `rel="noreferrer"` porque abren
              en pestaña nueva. */}
          <span className="block mt-3 text-xs text-muted-foreground">
            ¿Problemas para entrar?{" "}
            <a
              href="https://acaciaco.com.mx/soporte"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Soporte
            </a>
            {" · "}
            <a
              href="https://acaciaco.com.mx/apps/cateqhub"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Conoce CateqHub
            </a>
          </span>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continuar con Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-card px-3 text-muted-foreground">o</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Ingresando...
            </>
          ) : (
            "Ingresar"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
