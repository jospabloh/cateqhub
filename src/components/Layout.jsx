import { useEffect, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { QrCode, Users, ClipboardList, ScanLine, Home, Church, LogOut, UserCog, Sparkles, ShieldCheck, BookOpen, LifeBuoy, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { isParishAdmin, parishRoleLabel } from "@/lib/roles";
import Logo from "@/components/Logo";

const navItems = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/escanear", label: "Escanear", icon: ScanLine },
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/ninos", label: "Niños", icon: ClipboardList },
  { to: "/reportes", label: "Reportes", icon: QrCode },
  { to: "/parroquia", label: "Parroquia", icon: Church, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { to: "/premium", label: "Premium", icon: Sparkles, adminOnly: true },
  { to: "/permisos", label: "Permisos", icon: ShieldCheck, adminOnly: true },
  { to: "/manual", label: "Manual", icon: BookOpen },
  { to: "/soporte", label: "Soporte", icon: LifeBuoy },
  { to: "/acerca-de", label: "Acerca de", icon: Info },
];

export default function Layout() {
  const { user } = useAuth();
  const [parishName, setParishName] = useState(null);

  const items = navItems.filter((i) => !i.adminOnly || isParishAdmin(user));

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  // Cada tenant (parroquia) muestra su propio nombre bajo la marca CateqHub.
  useEffect(() => {
    if (!user?.parish_id) { setParishName(null); return; }
    base44.entities.Parish.get(user.parish_id)
      .then((p) => setParishName(p?.name ?? null))
      .catch(() => setParishName(null));
  }, [user?.parish_id]);

  const subtitle = parishName ?? parishRoleLabel(user);

  return (
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex print:hidden fixed inset-y-0 left-0 w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-sidebar-border">
          <Logo className="w-8 h-8" />
          <div>
            <p className="font-heading font-semibold leading-tight tracking-tight text-sm">CateqHub</p>
            <p className="text-xs text-sidebar-foreground/55 truncate max-w-[9rem]">{subtitle}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 pl-3 pr-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-sidebar-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 pl-3 pr-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden print:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <Logo className="w-7 h-7" />
          <span className="font-heading font-semibold text-sm tracking-tight">CateqHub</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-sidebar-foreground/65"><LogOut className="w-5 h-5" /></button>
      </header>

      {/* Content */}
      <main className="md:pl-60 pb-20 md:pb-0 print:pl-0 print:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto print:p-0 print:max-w-none">
          <Outlet context={{ user }} />
        </div>
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-30 h-16 flex items-center justify-around bg-sidebar text-sidebar-foreground border-t border-sidebar-border overflow-x-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium flex-1 h-full shrink-0 min-w-[56px] transition-colors",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground/55"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
