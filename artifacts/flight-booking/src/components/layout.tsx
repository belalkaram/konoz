import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plane, Search, ListFilter, LayoutDashboard, Menu, X, Users, Tag, Bell, LogOut, UserCog, Building2, ShieldCheck, FileText, BarChart3, MessageSquare, QrCode, Layers, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";

import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useEmployee } from "@/contexts/employee-context";
import { EmployeeSettingsDialog } from "./employee-settings-dialog";
import { ConnectivityBanner } from "./connectivity-banner";

const SIDEBAR_GRADIENT = "linear-gradient(180deg, #011a13 0%, #022c22 40%, #064e3b 100%)";
const GOLD_GRADIENT = "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentEmployee, logout } = useEmployee();
  const role = currentEmployee?.role;

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sidebarBackground = mounted && theme === "dark"
    ? "linear-gradient(180deg, #070f0d 0%, #0a1411 50%, #0d1a16 100%)"
    : "linear-gradient(180deg, #011a13 0%, #022c22 40%, #064e3b 100%)";

  const isSupervisorOrAdmin = role === "Administrator" || role === "Supervisor";
  const isAdmin = role === "Administrator";
  const isHR = role === "HR" || isAdmin;


  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/tickets", label: "Tickets", icon: Tag },
    { href: "/reminders", label: "Reminders", icon: Bell },
    { href: "/search", label: "Flight Search", icon: Search },
    { href: "/orders", label: "Orders", icon: ListFilter },
    { href: "/chat", label: "WhatsApp Chat", icon: MessageSquare },
    { href: "/settings/whatsapp", label: "WhatsApp Settings", icon: QrCode },
    { href: "/whatsapp-controls", label: "WhatsApp Controls", icon: Layers },
    ...(!isHR ? [{ href: "/reports", label: "Reports", icon: BarChart3 }] : []),
    ...(isHR ? [{ href: "/hr", label: "HR Management", icon: ShieldCheck }] : []),
    ...(isSupervisorOrAdmin ? [{ href: "/employees", label: "Employees", icon: UserCog }] : []),
    ...(isAdmin ? [{ href: "/companies", label: "Companies", icon: Building2 }] : []),
  ];


  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <>
        {/* Logo */}
        <div className={cn("flex h-20 items-center border-b transition-all duration-300", isCollapsed ? "justify-center px-0" : "px-6")} style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: GOLD_GRADIENT }}>
              <Plane className="h-4 w-4 rotate-45" style={{ color: "#022c22" }} />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <div className="text-white font-bold text-base tracking-wide" style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}>
                  AeroOps
                </div>
                <div className="text-xs tracking-widest uppercase font-medium" style={{ color: "#86efac" }}>
                  Premium
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center transition-all text-sm font-semibold",
                  isCollapsed ? "justify-center h-12 w-12 mx-auto rounded-full" : "px-4 py-3 rounded-full",
                  active
                    ? "shadow-sm shadow-amber-500/10"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={active
                  ? { background: GOLD_GRADIENT, color: "#022c22" }
                  : undefined
                }
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className={cn("h-4 w-4 flex-shrink-0", !isCollapsed && "mr-3")} />
                {!isCollapsed && <span className="animate-in fade-in duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className={cn("flex items-center transition-all duration-300", isCollapsed ? "flex-col justify-center gap-2" : "gap-3 px-2")}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: GOLD_GRADIENT, color: "#022c22" }}>
              {currentEmployee?.initials ?? "?"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                <div className="text-white text-sm font-semibold truncate">{currentEmployee?.name ?? ""}</div>
                <div className="text-xs truncate" style={{ color: "#86efac" }}>{currentEmployee?.role ?? ""}</div>
              </div>
            )}
            <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2 mt-1" : "gap-1")}>
              {currentEmployee && <EmployeeSettingsDialog employee={currentEmployee} />}
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-full transition-colors flex-shrink-0 text-white/40 hover:text-white/80 hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0fdf4] dark:bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col flex-shrink-0 transition-all duration-300 border-r border-[#d1fae5]/10 dark:border-border/30",
        collapsed ? "w-20" : "w-64"
      )}
        style={{ background: sidebarBackground }}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform transition-transform duration-300 md:hidden border-r border-[#d1fae5]/10 dark:border-border/30",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: sidebarBackground }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full transition-colors"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent isMobile />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ConnectivityBanner />
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 flex-shrink-0 bg-white dark:bg-card border-b border-[#d1fae5] dark:border-border">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              className="md:hidden p-2 rounded-full transition-colors bg-[#f0fdf4] dark:bg-muted text-[#047857] dark:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 rounded-full transition-all hover:bg-[#f0fdf4] dark:hover:bg-muted text-[#047857] dark:text-muted-foreground mr-2"
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>

            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: GOLD_GRADIENT }}>
                <Plane className="h-3.5 w-3.5 rotate-45" style={{ color: "#022c22" }} />
              </div>
              <span className="font-bold tracking-wide text-sm text-[#022c22] dark:text-foreground" style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}>AeroOps</span>
            </div>

            {/* Desktop env label */}
            <div className="hidden md:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-[#047857] dark:text-[#86efac]">Konooz Live System</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full transition-all text-sm font-semibold flex items-center justify-center hover:bg-[#f0fdf4] dark:hover:bg-muted text-[#047857] dark:text-muted-foreground"
              title={mounted && theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {mounted && theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-emerald-800 dark:text-muted-foreground" />
              )}
            </button>

            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: GOLD_GRADIENT, color: "#022c22" }}>
              {currentEmployee?.initials ?? "?"}
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="hidden md:flex p-2 rounded-full transition-colors items-center gap-1.5 text-xs font-medium text-[#047857] dark:text-muted-foreground hover:bg-[#f0fdf4] dark:hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
