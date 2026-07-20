import { Outlet, NavLink } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { QrCode, Users, ClipboardList, ScanLine, Home, Church, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/escanear", label: "Escanear", icon: ScanLine },
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/ninos", label: "Niños", icon: ClipboardList },
  { to: "/reportes", label: "Reportes", icon: QrCode },
  { to: "/parroquia", label: "Parroquia", icon: Church, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
];

export default function Layout() {
  const { user } = useAuth();

  const items = navItems.filter((i) => !i.adminOnly || user?.role === "admin");

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };



  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r bg-card">
        <div className="h-16 flex items-center gap-2 px-6 border-b">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">C</div>
          <div>
            <p className="font-heading font-semibold leading-tight">CatequesisQR</p>
            <p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrador" : "Catequista"}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">C</div>
          <span className="font-heading font-semibold">CatequesisQR</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-muted-foreground"><LogOut className="w-5 h-5" /></button>
      </header>

      {/* Content */}
      <main className="md:pl-60 pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet context={{ user }} />
        </div>
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 flex items-center justify-around border-t bg-card">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium flex-1 h-full",
                isActive ? "text-primary" : "text-muted-foreground"
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