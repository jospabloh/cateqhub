import { Outlet, NavLink } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { QrCode, Users, ClipboardList, ScanLine, Home, Church, LogOut, UserCog, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/escanear", label: "Escanear", icon: ScanLine },
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/ninos", label: "Niños", icon: ClipboardList },
  { to: "/reportes", label: "Reportes", icon: QrCode },
  { to: "/parroquia", label: "Parroquia", icon: Church, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { to: "/premium", label: "Premium", icon: Sparkles, adminOnly: true },
];

export default function Layout() {
  const { user } = useAuth();

  const items = navItems.filter((i) => !i.adminOnly || user?.role === "admin");

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-heading font-semibold text-sm">
            C
          </div>
          <div>
            <p className="font-heading font-semibold leading-tight tracking-tight text-sm">CatequesisQR</p>
            <p className="text-xs text-sidebar-foreground/55">{user?.role === "admin" ? "Administrador" : "Catequista"}</p>
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
      <header className="md:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-heading font-semibold text-xs">C</div>
          <span className="font-heading font-semibold text-sm tracking-tight">CatequesisQR</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-sidebar-foreground/65"><LogOut className="w-5 h-5" /></button>
      </header>

      {/* Content */}
      <main className="md:pl-60 pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet context={{ user }} />
        </div>
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 flex items-center justify-around bg-sidebar text-sidebar-foreground border-t border-sidebar-border overflow-x-auto">
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
