import { useState } from "react";
import { useLocation } from "wouter";
import { Plane, Search, ListFilter, LayoutDashboard, Menu, X } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const SIDEBAR_GRADIENT = "linear-gradient(180deg, #011a13 0%, #022c22 40%, #064e3b 100%)";
const GOLD_GRADIENT = "linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%)";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/search", label: "Flight Search", icon: Search },
    { href: "/orders", label: "Orders", icon: ListFilter },
  ];

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-20 items-center px-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: GOLD_GRADIENT }}>
            <Plane className="h-4 w-4 rotate-45" style={{ color: "#022c22" }} />
          </div>
          <div>
            <div className="text-white font-bold text-base tracking-wide" style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}>
              AeroOps
            </div>
            <div className="text-xs tracking-widest uppercase font-medium" style={{ color: "#86efac" }}>
              Premium
            </div>
          </div>
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
              className="flex items-center px-4 py-3 rounded-full transition-all text-sm font-semibold"
              style={active
                ? { background: GOLD_GRADIENT, color: "#022c22" }
                : { color: "rgba(255,255,255,0.65)" }
              }
            >
              <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: GOLD_GRADIENT, color: "#022c22" }}>
            JS
          </div>
          <div>
            <div className="text-white text-sm font-semibold">James Smith</div>
            <div className="text-xs" style={{ color: "#86efac" }}>Administrator</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0fdf4" }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col"
        style={{ background: SIDEBAR_GRADIENT }}>
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
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: SIDEBAR_GRADIENT }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full transition-colors"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 flex-shrink-0 bg-white border-b" style={{ borderColor: "#d1fae5" }}>
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              className="md:hidden p-2 rounded-full transition-colors"
              style={{ background: "#f0fdf4", color: "#047857" }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: GOLD_GRADIENT }}>
                <Plane className="h-3.5 w-3.5 rotate-45" style={{ color: "#022c22" }} />
              </div>
              <span className="font-bold tracking-wide text-sm" style={{ color: "#022c22", fontFamily: "'Playfair Display', 'Georgia', serif" }}>AeroOps</span>
            </div>

            {/* Desktop env label */}
            <div className="hidden md:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium" style={{ color: "#047857" }}>Duffel Live Environment</span>
            </div>
          </div>

          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: GOLD_GRADIENT, color: "#022c22" }}>
            JS
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
