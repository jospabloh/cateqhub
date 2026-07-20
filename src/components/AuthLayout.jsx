import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Panel de marca — oculto en mobile */}
      <div className="hidden md:flex relative flex-col justify-between bg-primary text-primary-foreground p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1.5px)", backgroundSize: "22px 22px" }}
          aria-hidden="true"
        />
        {/* Motivo de esquinero QR — el único guiño decorativo del sistema */}
        <div className="absolute -bottom-12 -right-12 w-64 h-64 opacity-[0.12]" aria-hidden="true">
          <div className="absolute inset-0 border-[10px] border-current rounded-2xl" />
          <div className="absolute inset-[28px] border-[10px] border-current rounded-xl" />
        </div>

        <p className="relative font-heading font-semibold text-lg tracking-tight">CatequesisQR</p>

        <div className="relative max-w-sm">
          <p className="font-heading text-3xl font-semibold leading-tight tracking-tight">
            Asistencia de catecismo, sin listas de papel.
          </p>
          <p className="mt-3 text-primary-foreground/70 text-sm leading-relaxed">
            Cada niño con su propio QR. Cada catequista, una sesión. Cada domingo, un registro que no se pierde.
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/50">© {new Date().getFullYear()} CatequesisQR</p>
      </div>

      {/* Panel de formulario */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-heading font-semibold tracking-tight">CatequesisQR</span>
          </div>

          <div className="hidden md:flex w-10 h-10 rounded-md bg-primary/10 text-primary items-center justify-center mb-6">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <p className="text-center text-sm text-muted-foreground mt-8">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
