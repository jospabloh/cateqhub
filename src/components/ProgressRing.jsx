// Anillo de progreso circular — el mismo lenguaje visual que ya usa el
// Dashboard para "asistencia de hoy". Reutilizado aquí como indicador de
// qué tan permisivo es el perfil de catequista, para que Permisos se sienta
// parte de la misma familia visual en vez de una pantalla aparte.
export default function ProgressRing({ value, total, size = 112, stroke = "hsl(var(--chart-2))", label, sublabel }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth="9" fill="none" className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth="9"
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center px-2">
        <div>
          <p className="text-2xl font-heading font-semibold leading-none">{label ?? `${pct}%`}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}
