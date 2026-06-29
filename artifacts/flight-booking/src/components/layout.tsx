import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plane, Search, ListFilter, LayoutDashboard, Menu, X, Users, Tag, Bell, LogOut, UserCog, Building2, ShieldCheck, FileText, BarChart3, MessageSquare, QrCode, Layers, Sun, Moon, ChevronLeft, ChevronRight, Wallet, Server, Play } from "lucide-react";
import { useTheme } from "next-themes";

import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useEmployee } from "@/contexts/employee-context";
import { EmployeeSettingsDialog } from "./employee-settings-dialog";
import { ConnectivityBanner } from "./connectivity-banner";
import { useLanguage } from "@/contexts/language-context";

const SIDEBAR_GRADIENT = "linear-gradient(180deg, #070f2e 0%, #0f172a 50%, #1e293b 100%)";
const BRAND_GRADIENT = "linear-gradient(135deg, #1e40af 0%, #3b82f6 75%, #10b981 100%)";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentEmployee, logout } = useEmployee();
  const role = currentEmployee?.role;

  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t, isRtl } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  const [activeNotification, setActiveNotification] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!currentEmployee) return;

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const eventSource = new EventSource(`${base}/api/notifications/stream`, {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          setActiveNotification(data.payload);
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [currentEmployee]);

  const handleResponse = async (buttonLabel: string) => {
    if (!activeNotification) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      await fetch(`${base}/api/notifications/${activeNotification.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buttonClicked: buttonLabel }),
      });
    } catch (err) {
      console.error("Error sending response:", err);
    }
    setActiveNotification(null);
  };

  const sidebarBackground = mounted && theme === "dark"
    ? "linear-gradient(180deg, #020617 0%, #090d16 50%, #0f172a 100%)"
    : "linear-gradient(180deg, #070f2e 0%, #0f172a 50%, #1e293b 100%)";

  const isSupervisorOrAdmin = role === "Administrator" || role === "Supervisor";
  const isAdmin = role === "Administrator";
  const isHR = role === "HR" || isAdmin;

  const navItems = [
    { href: "/", label: t("common.dashboard"), icon: LayoutDashboard },
    ...(isSupervisorOrAdmin ? [{ href: "/supervisor", label: t("common.performance"), icon: FileText }] : []),
    { href: "/customers", label: t("common.customers"), icon: Users },
    { href: "/tickets", label: t("common.tickets"), icon: Tag },
    { href: "/reminders", label: t("common.reminders"), icon: Bell },
    { href: "/search", label: t("common.flightSearch"), icon: Search },
    { href: "/orders", label: t("common.orders"), icon: ListFilter },
    { href: "/chat", label: t("common.whatsappChat"), icon: MessageSquare },
    { href: "/whatsapp-controls", label: t("common.whatsappControls"), icon: Layers },
    { href: "/tiktok-controls", label: language === "ar" ? "تيك توك" : "TikTok Controls", icon: Play },
    ...(!isHR ? [{ href: "/reports", label: t("common.reports"), icon: BarChart3 }] : []),
    ...(isHR ? [{ href: "/hr", label: t("common.hrManagement"), icon: ShieldCheck }] : []),
    ...(isSupervisorOrAdmin ? [{ href: "/employees", label: t("common.employees"), icon: UserCog }] : []),
    ...(isSupervisorOrAdmin ? [{ href: "/accounting", label: language === "ar" ? "الحسابات" : "Accounting", icon: Wallet }] : []),
    ...(isAdmin ? [{ href: "/whatsapp-admin", label: language === "ar" ? "سيرفرات الواتساب" : "WhatsApp Admin", icon: Server }] : []),
    ...(isAdmin ? [{ href: "/instant-notifications", label: language === "ar" ? "التنبيهات اللحظية" : "Instant Alerts", icon: Bell }] : []),
    ...(isAdmin ? [{ href: "/companies", label: t("common.companies"), icon: Building2 }] : []),
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
              style={{ background: BRAND_GRADIENT }}>
              <Plane className={cn("h-4 w-4", isRtl ? "-rotate-45" : "rotate-45")} style={{ color: "#ffffff" }} />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <div className="text-white font-bold text-base tracking-wide" style={isRtl ? undefined : { fontFamily: "'Playfair Display', 'Georgia', serif" }}>
                  {t("common.aeroOps")}
                </div>
                <div className="text-xs tracking-widest uppercase font-medium" style={{ color: "#86efac" }}>
                  {t("common.premium")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 sidebar-scroll">
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
                    ? "shadow-sm shadow-blue-500/10"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={active
                  ? { background: BRAND_GRADIENT, color: "#ffffff" }
                  : undefined
                }
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className={cn("h-4 w-4 flex-shrink-0", !isCollapsed && "me-3")} />
                {!isCollapsed && <span className="animate-in fade-in duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className={cn("flex items-center transition-all duration-300", isCollapsed ? "flex-col justify-center gap-2" : "gap-3 px-2")}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: BRAND_GRADIENT, color: "#ffffff" }}>
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
                title={t("common.signOut")}
                className="p-1.5 rounded-full transition-colors flex-shrink-0 text-white/40 hover:text-white/80 hover:bg-white/5"
              >
                <LogOut className="h-4 w-4 animate-flip-x" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col flex-shrink-0 transition-all duration-300 border-e border-slate-700/10 dark:border-border/30",
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
          "fixed inset-y-0 start-0 z-50 w-64 flex flex-col transform transition-transform duration-300 md:hidden border-e border-slate-700/10 dark:border-border/30",
          mobileOpen 
            ? "translate-x-0" 
            : (isRtl ? "translate-x-full" : "-translate-x-full")
        )}
        style={{ background: sidebarBackground }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 end-4 p-1.5 rounded-full transition-colors"
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
        <header className="h-16 flex items-center justify-between px-4 md:px-8 flex-shrink-0 bg-white dark:bg-card border-b border-slate-100 dark:border-border">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              className="md:hidden p-2 rounded-full transition-colors bg-blue-50/50 dark:bg-muted text-primary dark:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 rounded-full transition-all hover:bg-blue-50 dark:hover:bg-muted text-primary dark:text-muted-foreground me-2"
              title={collapsed ? t("common.expandSidebar") : t("common.collapseSidebar")}
            >
              {collapsed ? (
                isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />
              ) : (
                isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />
              )}
            </button>

            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: BRAND_GRADIENT }}>
                <Plane className={cn("h-3.5 w-3.5", isRtl ? "-rotate-45" : "rotate-45")} style={{ color: "#ffffff" }} />
              </div>
              <span className="font-bold tracking-wide text-sm text-primary dark:text-foreground" style={isRtl ? undefined : { fontFamily: "'Playfair Display', 'Georgia', serif" }}>{t("common.aeroOps")}</span>
            </div>

            {/* Desktop env label */}
            <div className="hidden md:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-[#047857] dark:text-[#86efac]">{t("common.konoozLive")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="px-2.5 py-1.5 rounded-full border border-blue-100 dark:border-border transition-all text-xs font-bold flex items-center justify-center hover:bg-blue-50 dark:hover:bg-muted text-primary dark:text-muted-foreground gap-1"
              title={language === "ar" ? "Switch to English" : "تغيير إلى العربية"}
            >
              <span className="text-sm">🌐</span>
              <span>{language === "ar" ? "EN" : "عربي"}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full transition-all text-sm font-semibold flex items-center justify-center hover:bg-blue-50 dark:hover:bg-muted text-primary dark:text-muted-foreground"
              title={mounted && theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {mounted && theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-emerald-800 dark:text-muted-foreground" />
              )}
            </button>

            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: BRAND_GRADIENT, color: "#ffffff" }}>
              {currentEmployee?.initials ?? "?"}
            </div>
            <button
              onClick={logout}
              title={t("common.signOut")}
              className="hidden md:flex p-2 rounded-full transition-colors items-center gap-1.5 text-xs font-medium text-primary dark:text-muted-foreground hover:bg-blue-50 dark:hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {t("common.signOut")}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Real-time Notification Modal */}
      {activeNotification && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 relative animate-in fade-in zoom-in-95 duration-200 text-left">
            <button 
              onClick={() => handleResponse("dismissed")}
              className="absolute top-4 end-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mb-4 text-blue-500 animate-bounce">
                <Bell className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-1">
                {language === "ar" ? "تنبيه إداري عاجل" : "Urgent Admin Alert"}
              </span>
              <span className="text-xs text-slate-400 mb-4">
                {language === "ar" ? `مرسل من: ${activeNotification.senderName}` : `From: ${activeNotification.senderName}`}
              </span>
              <p className="text-slate-800 dark:text-slate-100 text-base font-medium mb-6 whitespace-pre-line leading-relaxed">
                {activeNotification.message}
              </p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => handleResponse(activeNotification.button1Label)}
                  className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer"
                >
                  {activeNotification.button1Label}
                </button>
                <button
                  onClick={() => handleResponse(activeNotification.button2Label)}
                  className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  {activeNotification.button2Label}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
