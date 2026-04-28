import { useState } from "react";
import { useLocation } from "wouter";
import { Plane, Search, ListFilter, LayoutDashboard, Menu, X } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/search", label: "Flight Search", icon: Search },
    { href: "/orders", label: "Orders", icon: ListFilter },
  ];

  const NavLinks = () => (
    <nav className="p-4 space-y-1">
      {navItems.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center px-3 py-2.5 rounded-md transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
          <Plane className="h-6 w-6 text-sidebar-primary mr-3" />
          <span className="font-bold text-lg tracking-tight">AeroOps</span>
        </div>
        <NavLinks />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground transform transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
          <div className="flex items-center">
            <Plane className="h-6 w-6 text-sidebar-primary mr-3" />
            <span className="font-bold text-lg tracking-tight">AeroOps</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              className="md:hidden p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="font-medium text-sm text-muted-foreground hidden sm:block">
              Duffel Production Environment
            </div>
            {/* Show brand on mobile header */}
            <div className="flex items-center md:hidden">
              <Plane className="h-5 w-5 text-primary mr-2" />
              <span className="font-bold tracking-tight">AeroOps</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
              JS
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
