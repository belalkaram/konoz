import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { useCurrentEmployee } from "@/contexts/employee-context";
import { authFetch, BASE } from "@/lib/api";
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/lib/ticket-constants";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";
import {
  BarChart3, TrendingUp, Users, Tag, DollarSign, Award,
  CheckCircle2, XCircle, Download, Calendar, ChevronRight,
  ChevronLeft, Plane, Search, FileText, FileSpreadsheet,
  File, Filter, ArrowUpDown, Eye, Activity,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ─── Types ─── */
interface SupervisorDashboardData {
  role: string;
  dateRange: { start: string; end: string };
  filterableEmployees: Array<{ id: number; name: string; initials: string }>;
  kpis: {
    totalSales: string;
    totalRevenue: string;
    netProfit: string;
    totalTickets: number;
    totalCustomers: number;
    confirmedTickets: number;
    cancelledTickets: number;
    issuedTickets: number;
  };
  revenueTrend: Array<{ month: string; sales: number; cost: number; profit: number; tickets: number }>;
  ticketsByStatus: Array<{ status: string; count: number }>;
  employeePerformance: Array<{
    id: number; name: string; initials: string; role: string;
    tickets: number; revenue: number; profit: number;
    customers: number; confirmedTickets: number; cancelledTickets: number;
  }>;
  upcomingTravels: Array<{ month: string; count: number }>;
}

interface BookingsData {
  bookings: Array<{
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    flightRoute: string | null;
    airline: string | null;
    flightNumber: string | null;
    departureDatetime: string | null;
    arrivalDatetime: string | null;
    bookingDate: string | null;
    costPrice: string | null;
    price: string | null;
    currency: string | null;
    pnr: string | null;
    ticketStatus: string;
    paymentStatus: string;
    baggageDetails: string | null;
    notes: string | null;
    createdAt: string;
    employeeId: number | null;
    employeeName: string | null;
    employeeInitials: string | null;
    customerId: number | null;
    invoiceProfit: string | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* ─── Constants ─── */
const CHART_COLORS = ["#2563eb", "#10b981", "#0ea5e9", "#059669", "#6366f1", "#14b8a6", "#8b5cf6"];
const PIE_COLORS = ["#2563eb", "#10b981", "#0ea5e9", "#059669", "#6366f1", "#64748b", "#8b5cf6"];
const BRAND_GRADIENT = "linear-gradient(135deg, #1e40af 0%, #3b82f6 75%, #10b981 100%)";

const TICKET_STATUSES_ALL = [
  { value: "all", label: "All Statuses" },
  { value: "quoted", label: "Quoted" },
  { value: "reserved", label: "Reserved" },
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" },
  { value: "issued", label: "Issued" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

/* ─── Helpers ─── */
function getDateRange(period: string) {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (period) {
    case "7d": start = new Date(now.getTime() - 7 * 86400000); break;
    case "30d": start = new Date(now.getTime() - 30 * 86400000); break;
    case "90d": start = new Date(now.getTime() - 90 * 86400000); break;
    case "6m": start = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
    case "1y": start = new Date(now.getFullYear(), now.getMonth() - 11, 1); break;
    case "ytd": start = new Date(now.getFullYear(), 0, 1); break;
    default: start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }
  return { startDate: start.toISOString(), endDate: end };
}

/* ─── KPI Card ─── */
function KPICard({ title, value, icon, gradient, sub }: {
  title: string; value: string | number; icon: React.ReactNode; gradient: string; sub?: string;
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-0" id={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500" style={{ background: gradient }} />
      <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500 rounded-bl-full" style={{ background: gradient }} />
      <CardContent className="p-5 relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: gradient }}>{icon}</div>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><Activity className="h-3 w-3" />{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ─── Export Helpers ─── */
function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join(","),
    ...data.map(row => headers.map(h => {
      const val = String(row[h] ?? "");
      return val.includes(",") ? `"${val}"` : val;
    }).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function exportToExcel(data: any[], filename: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

async function exportToPDF(data: any[], filename: string, title: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  if (!data.length) {
    doc.text("No data available", 14, 40);
    doc.save(`${filename}.pdf`);
    return;
  }

  const headers = Object.keys(data[0]);
  const colWidth = Math.min(40, (270) / headers.length);
  let y = 36;

  // Header
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    doc.text(h, 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
  });
  y += 6;
  doc.setFont("helvetica", "normal");

  // Rows
  for (const row of data) {
    if (y > 190) {
      doc.addPage();
      y = 20;
      doc.setFont("helvetica", "bold");
      headers.forEach((h, i) => {
        doc.text(h, 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
      });
      y += 6;
      doc.setFont("helvetica", "normal");
    }
    headers.forEach((h, i) => {
      const val = String(row[h] ?? "—").substring(0, 30);
      doc.text(val, 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
    });
    y += 5;
  }

  doc.save(`${filename}.pdf`);
}

/* ══════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════ */
export default function SupervisorDashboard() {
  const employee = useCurrentEmployee();
  const { t, language, isRtl } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");

  // ── Filters ──
  const [period, setPeriod] = useState("1y");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // ── Bookings Filters ──
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingEmployee, setBookingEmployee] = useState("all");
  const [bookingStatus, setBookingStatus] = useState("all");
  const [bookingSortBy, setBookingSortBy] = useState("bookingDate");
  const [bookingSortOrder, setBookingSortOrder] = useState("desc");

  // ── Export ──
  const [exportType, setExportType] = useState("all");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [isExporting, setIsExporting] = useState(false);

  const dateRange = useMemo(() => {
    if (period === "custom") {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    return getDateRange(period);
  }, [period, customStartDate, customEndDate]);

  // ═══ Dashboard Query ═══
  const { data: dashData, isLoading: dashLoading, isError: dashError } = useQuery<SupervisorDashboardData>({
    queryKey: ["supervisor-dashboard", period, dateRange.startDate, dateRange.endDate, employeeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (employeeFilter !== "all") params.set("employeeId", employeeFilter);
      if (statusFilter !== "all") params.set("ticketStatus", statusFilter);
      const res = await authFetch(`${BASE}/api/supervisor/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch supervisor dashboard");
      return res.json();
    },
    staleTime: 60_000,
  });

  // ═══ Bookings Query ═══
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery<BookingsData>({
    queryKey: ["supervisor-bookings", period, dateRange.startDate, dateRange.endDate, bookingPage, bookingSearch, bookingEmployee, bookingStatus, bookingSortBy, bookingSortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        page: String(bookingPage),
        limit: "30",
        sortBy: bookingSortBy,
        sortOrder: bookingSortOrder,
      });
      if (bookingEmployee !== "all") params.set("employeeId", bookingEmployee);
      if (bookingStatus !== "all") params.set("ticketStatus", bookingStatus);
      if (bookingSearch) params.set("search", bookingSearch);
      const res = await authFetch(`${BASE}/api/supervisor/bookings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return res.json();
    },
    staleTime: 30_000,
    enabled: activeTab === "bookings",
  });

  // ═══ Export Handler ═══
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        type: exportType,
      });
      if (employeeFilter !== "all") params.set("employeeId", employeeFilter);
      const res = await authFetch(`${BASE}/api/supervisor/export?${params}`);
      if (!res.ok) throw new Error("Failed to fetch export data");
      const exportData = await res.json();

      let rows: any[] = [];
      const filename = `report_${exportType}_${new Date().toISOString().slice(0, 10)}`;
      let title = "Performance Report";

      if (exportType === "bookings" || exportType === "all") {
        rows = (exportData.bookings || []).map((b: any) => ({
          "Customer": b.customerName || "—",
          "Phone": b.customerPhone || "—",
          "Route": b.flightRoute || "—",
          "Airline": b.airline || "—",
          "Flight": b.flightNumber || "—",
          "Booking Date": b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : "—",
          "Travel Date": b.departureDatetime ? new Date(b.departureDatetime).toLocaleDateString() : "—",
          "Price": b.price || "0",
          "Cost": b.costPrice || "0",
          "Profit": b.invoiceProfit || "0",
          "Status": b.ticketStatus || "—",
          "Payment": b.paymentStatus || "—",
          "Employee": b.employeeName || "—",
          "PNR": b.pnr || "—",
        }));
        title = "Bookings Report";
      }

      if (exportType === "employee" || exportType === "profit") {
        rows = (exportData.employeePerformance || []).map((e: any) => ({
          "Employee": e.name,
          "Tickets": e.tickets,
          "Revenue": e.revenue?.toFixed(2),
          "Profit": e.profit?.toFixed(2),
          "Customers": e.customers,
        }));
        title = exportType === "profit" ? "Profit & Sales Report" : "Employee Performance Report";
      }

      if (exportType === "monthly" || exportType === "yearly") {
        rows = (exportData.bookings || []).map((b: any) => ({
          "Customer": b.customerName || "—",
          "Route": b.flightRoute || "—",
          "Booking Date": b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : "—",
          "Price": b.price || "0",
          "Profit": b.invoiceProfit || "0",
          "Status": b.ticketStatus || "—",
          "Employee": b.employeeName || "—",
        }));
        title = exportType === "monthly" ? "Monthly Report" : "Yearly Report";
      }

      if (!rows.length) {
        rows = [{ "Info": "No data available for the selected filters" }];
      }

      switch (exportFormat) {
        case "csv": exportToCSV(rows, filename); break;
        case "xlsx": await exportToExcel(rows, filename); break;
        case "pdf": await exportToPDF(rows, filename, title); break;
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [dateRange, exportType, exportFormat, employeeFilter]);

  const trendData = useMemo(() =>
    (dashData?.revenueTrend ?? []).map(t => ({
      ...t,
      monthLabel: new Date(t.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    })),
    [dashData?.revenueTrend]
  );

  const toggleSort = (col: string) => {
    if (bookingSortBy === col) {
      setBookingSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setBookingSortBy(col);
      setBookingSortOrder("desc");
    }
    setBookingPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: BRAND_GRADIENT }}>
              <Plane className={cn("h-5 w-5", isRtl ? "-rotate-45" : "rotate-45")} style={{ color: "#ffffff" }} />
            </div>
            <span>{t("supervisor.title")}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {employee.role === "Administrator"
              ? t("supervisor.subtitleAdmin")
              : t("supervisor.subtitleSupervisor")}
          </p>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="h-10 bg-muted/50 p-1">
            <TabsTrigger value="dashboard" className="text-sm font-semibold gap-1.5 data-[state=active]:shadow-sm" id="tab-dashboard">
              <BarChart3 className="h-3.5 w-3.5" /> {t("supervisor.tabDashboard")}
            </TabsTrigger>
            <TabsTrigger value="bookings" className="text-sm font-semibold gap-1.5 data-[state=active]:shadow-sm" id="tab-bookings">
              <FileText className="h-3.5 w-3.5" /> {t("supervisor.tabBookings")}
            </TabsTrigger>
            <TabsTrigger value="export" className="text-sm font-semibold gap-1.5 data-[state=active]:shadow-sm" id="tab-export">
              <Download className="h-3.5 w-3.5" /> {t("supervisor.tabExport")}
            </TabsTrigger>
          </TabsList>

          {/* ── Shared Filters ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={(v) => { setPeriod(v); setBookingPage(1); }}>
              <SelectTrigger className="w-[140px] h-9 text-sm" id="supervisor-period">
                <Calendar className={cn("h-3.5 w-3.5 text-muted-foreground", isRtl ? "ml-1.5" : "mr-1.5")} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t("supervisor.last7Days")}</SelectItem>
                <SelectItem value="30d">{t("supervisor.last30Days")}</SelectItem>
                <SelectItem value="90d">{t("supervisor.last90Days")}</SelectItem>
                <SelectItem value="6m">{t("supervisor.last6Months")}</SelectItem>
                <SelectItem value="1y">{t("supervisor.last12Months")}</SelectItem>
                <SelectItem value="ytd">{t("supervisor.yearToDate")}</SelectItem>
                <SelectItem value="custom">{t("supervisor.customRange")}</SelectItem>
              </SelectContent>
            </Select>

            {period === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setBookingPage(1);
                  }}
                  className="w-[130px] h-9 text-sm"
                  id="supervisor-start-date"
                />
                <span className="text-xs text-muted-foreground">{language === "ar" ? "إلى" : "to"}</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setBookingPage(1);
                  }}
                  className="w-[130px] h-9 text-sm"
                  id="supervisor-end-date"
                />
              </div>
            )}

            {dashData?.filterableEmployees && dashData.filterableEmployees.length > 0 && (
              <Select value={employeeFilter} onValueChange={(v) => { setEmployeeFilter(v); setBookingPage(1); }}>
                <SelectTrigger className="w-[170px] h-9 text-sm" id="supervisor-employee-filter">
                  <Users className={cn("h-3.5 w-3.5 text-muted-foreground", isRtl ? "ml-1.5" : "mr-1.5")} />
                  <SelectValue placeholder={t("supervisor.allEmployees")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("supervisor.allEmployees")}</SelectItem>
                  {dashData.filterableEmployees.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            TAB 1: DASHBOARD
            ═══════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          {dashLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-20" /></CardContent></Card>
              ))}
            </div>
          )}

          {dashError && (
            <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-lg">
              Failed to load dashboard data. Please try again.
            </div>
          )}

          {dashData && (
            <>
              {/* ── Status Filter ── */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs" id="supervisor-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES_ALL.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── KPI Cards ── */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Total Sales"
                  value={formatCurrency(dashData.kpis.totalSales, "KWD")}
                  icon={<DollarSign className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
                />
                <KPICard
                  title="Total Revenue"
                  value={formatCurrency(dashData.kpis.totalRevenue, "KWD")}
                  icon={<TrendingUp className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)"
                />
                <KPICard
                  title="Net Profit"
                  value={formatCurrency(dashData.kpis.netProfit, "KWD")}
                  icon={<Award className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                  sub={`${dashData.kpis.issuedTickets} issued tickets`}
                />
                <KPICard
                  title="Total Customers"
                  value={dashData.kpis.totalCustomers}
                  icon={<Users className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Total Bookings"
                  value={dashData.kpis.totalTickets}
                  icon={<Tag className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)"
                />
                <KPICard
                  title="Confirmed"
                  value={dashData.kpis.confirmedTickets}
                  icon={<CheckCircle2 className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #22c55e 0%, #4ade80 100%)"
                />
                <KPICard
                  title="Cancelled"
                  value={dashData.kpis.cancelledTickets}
                  icon={<XCircle className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #ef4444 0%, #f87171 100%)"
                />
                <KPICard
                  title="Issued"
                  value={dashData.kpis.issuedTickets}
                  icon={<Plane className="h-4 w-4 text-white" />}
                  gradient="linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)"
                />
              </div>

              {/* ── Revenue & Profit Trend Chart ── */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" /> Sales, Revenue & Profit Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                          formatter={(val: number) => [formatCurrency(val, "KWD"), undefined]}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="sales" name="Sales" stroke="#059669" fill="url(#salesGrad)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#profitGrad)" strokeWidth={2} strokeDasharray="5 5" />
                        <Bar dataKey="tickets" name="Tickets" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={16} yAxisId={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* ── Charts Row: Status + Employee Bar ── */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Ticket Status Pie */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ticket Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={dashData.ticketsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3}>
                            {dashData.ticketsByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(val: number, name: string) => [val, TICKET_STATUS_LABELS[name] ?? name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {dashData.ticketsByStatus.map((t, i) => (
                        <span key={t.status} className="text-xs flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {TICKET_STATUS_LABELS[t.status] ?? t.status} ({t.count})
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Employee Comparison Bar Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" /> Employee Performance Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashData.employeePerformance.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                            formatter={(val: number, name: string) => {
                              if (name === "Revenue") return [formatCurrency(val, "KWD"), name];
                              return [val, name];
                            }}
                          />
                          <Legend />
                          <Bar dataKey="revenue" name="Revenue" fill="#059669" radius={[0, 4, 4, 0]} barSize={14} />
                          <Bar dataKey="tickets" name="Tickets" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Top Performers Badges ── */}
              {dashData.employeePerformance.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald-500" /> Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {dashData.employeePerformance.slice(0, 5).map((emp, i) => (
                        <div key={emp.id}
                          className="flex items-center gap-3 p-3 rounded-xl border hover:shadow-md transition-all duration-300 group"
                          style={i === 0 ? { borderColor: "#3b82f640", background: "linear-gradient(135deg, #eff6ff20, #dbeafe20)" } : undefined}>
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{
                                background: i === 0 ? BRAND_GRADIENT : i === 1 ? "linear-gradient(135deg, #3b82f6, #60a5fa)" : i === 2 ? "linear-gradient(135deg, #10b981, #34d399)" : "#f1f5f9",
                                color: i < 3 ? "#ffffff" : "#64748b",
                              }}>
                              {emp.initials}
                            </div>
                            {i < 3 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-white shadow-sm border" style={{ color: i === 0 ? "#1d4ed8" : i === 1 ? "#3b82f6" : "#10b981" }}>
                                {i + 1}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(emp.revenue, "KWD")} · {emp.tickets} tickets</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Full Employee Performance Table ── */}
              {dashData.employeePerformance.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> Detailed Employee Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Tickets</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Customers</TableHead>
                            <TableHead className="text-right">Confirmed</TableHead>
                            <TableHead className="text-right">Cancelled</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashData.employeePerformance.map((emp, i) => (
                            <TableRow key={emp.id} className="hover:bg-muted/30">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{
                                      background: i === 0 ? BRAND_GRADIENT : i === 1 ? "linear-gradient(135deg, #3b82f6, #60a5fa)" : i === 2 ? "linear-gradient(135deg, #10b981, #34d399)" : "#f1f5f9",
                                      color: i < 3 ? "#ffffff" : "#475569",
                                    }}>
                                    {emp.initials}
                                  </div>
                                  <span className="text-sm font-medium">{emp.name}</span>
                                  {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">Top</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{emp.role}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{emp.tickets}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatCurrency(emp.revenue, "KWD")}</TableCell>
                              <TableCell className="text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(emp.profit, "KWD")}</TableCell>
                              <TableCell className="text-right text-sm">{emp.customers}</TableCell>
                              <TableCell className="text-right text-sm text-emerald-600">{emp.confirmedTickets}</TableCell>
                              <TableCell className="text-right text-sm text-red-500">{emp.cancelledTickets}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 2: BOOKINGS
            ═══════════════════════════════════════════ */}
        <TabsContent value="bookings" className="space-y-4 mt-0">
          {/* ── Filters Bar ── */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    placeholder={t("customers.searchPlaceholder")}
                    value={bookingSearch}
                    onChange={(e) => { setBookingSearch(e.target.value); setBookingPage(1); }}
                    className="w-full h-9 px-3 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    id="booking-search"
                  />
                </div>

                {dashData?.filterableEmployees && dashData.filterableEmployees.length > 0 && (
                  <Select value={bookingEmployee} onValueChange={(v) => { setBookingEmployee(v); setBookingPage(1); }}>
                    <SelectTrigger className="w-[160px] h-9 text-sm" id="booking-employee-filter">
                      <SelectValue placeholder={t("supervisor.allEmployees")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("supervisor.allEmployees")}</SelectItem>
                      {dashData.filterableEmployees.map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={bookingStatus} onValueChange={(v) => { setBookingStatus(v); setBookingPage(1); }}>
                  <SelectTrigger className="w-[150px] h-9 text-sm" id="booking-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES_ALL.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value === "all" ? t("common.all") : (t(`statuses.${s.value}`) || s.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Results count ── */}
          {bookingsData && (
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>
                {language === "ar"
                  ? `عرض ${((bookingsData.pagination.page - 1) * bookingsData.pagination.limit) + 1}–${Math.min(bookingsData.pagination.page * bookingsData.pagination.limit, bookingsData.pagination.total)} من إجمالي ${bookingsData.pagination.total} حجز`
                  : `Showing ${((bookingsData.pagination.page - 1) * bookingsData.pagination.limit) + 1}–${Math.min(bookingsData.pagination.page * bookingsData.pagination.limit, bookingsData.pagination.total)} of ${bookingsData.pagination.total} bookings`
                }
              </span>
            </div>
          )}

          {/* ── Bookings Table ── */}
          <Card>
            <CardContent className="p-0">
              {bookingsLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : !bookingsData?.bookings.length ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {language === "ar" ? "لم يتم العثور على حجوزات للمرشحات المحددة." : "No bookings found for the selected filters."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t("supervisor.bookingsTable.customer")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("supervisor.bookingsTable.route")}</TableHead>
                        <TableHead className="whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => toggleSort("bookingDate")}>
                          <span className="flex items-center gap-1">{t("supervisor.bookingsTable.bookingDate")} <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead className="whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => toggleSort("travelDate")}>
                          <span className="flex items-center gap-1">{t("supervisor.bookingsTable.travelDate")} <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap cursor-pointer hover:text-foreground", isRtl && "text-left")} onClick={() => toggleSort("price")}>
                          <span className={cn("flex items-center gap-1 justify-end", isRtl && "justify-start")}>{t("supervisor.bookingsTable.sellingPrice")} <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead className={cn("text-right whitespace-nowrap", isRtl && "text-left")}>{t("supervisor.bookingsTable.netProfit")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("supervisor.bookingsTable.status")}</TableHead>
                        <TableHead className="whitespace-nowrap">{t("supervisor.bookingsTable.payment")}</TableHead>
                        <TableHead className="whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => toggleSort("employee")}>
                          <span className="flex items-center gap-1">{t("supervisor.bookingsTable.employee")} <ArrowUpDown className="h-3 w-3" /></span>
                        </TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookingsData.bookings.map((b) => (
                        <TableRow key={b.id} className="hover:bg-muted/30 cursor-pointer group">
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium truncate max-w-[140px]">{b.customerName ?? "Unknown"}</div>
                              <div className="text-[11px] text-muted-foreground">{b.customerPhone ?? ""}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium">{b.flightRoute ?? "—"}</div>
                              <div className="text-[11px] text-muted-foreground">{b.airline ?? ""} {b.flightNumber ?? ""}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(b.bookingDate || b.createdAt)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{b.departureDatetime ? formatDateTime(b.departureDatetime) : "—"}</TableCell>
                          <TableCell className={cn("text-right text-sm font-medium", isRtl && "text-left")}>{formatCurrency(b.price, b.currency || "KWD")}</TableCell>
                          <TableCell className={cn("text-right text-sm font-medium text-emerald-600 dark:text-emerald-400", isRtl && "text-left")}>
                            {formatCurrency(b.invoiceProfit, "KWD")}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${TICKET_STATUS_COLORS[b.ticketStatus] ?? ""}`}>
                              {t(`statuses.${b.ticketStatus}`) || b.ticketStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${PAYMENT_STATUS_COLORS[b.paymentStatus] ?? ""}`}>
                              {t(`statuses.${b.paymentStatus}`) || b.paymentStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {b.employeeInitials && (
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex-shrink-0">
                                  {b.employeeInitials}
                                </div>
                              )}
                              <span className="text-xs truncate max-w-[80px]">{b.employeeName ?? "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/tickets/${b.id}`}>
                              <span className="text-xs text-primary hover:underline flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="h-3 w-3" /> {t("common.view")}
                              </span>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Pagination ── */}
          {bookingsData && bookingsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setBookingPage(p => Math.max(1, p - 1))}
                disabled={bookingsData.pagination.page <= 1}
                className="h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className={cn("h-4 w-4", isRtl && "rotate-180")} /> {language === "ar" ? "السابق" : "Previous"}
              </button>
              <span className="text-sm text-muted-foreground px-3">
                {language === "ar"
                  ? `صفحة ${bookingsData.pagination.page} من ${bookingsData.pagination.totalPages}`
                  : `Page ${bookingsData.pagination.page} of ${bookingsData.pagination.totalPages}`
                }
              </span>
              <button
                onClick={() => setBookingPage(p => Math.min(bookingsData.pagination.totalPages, p + 1))}
                disabled={bookingsData.pagination.page >= bookingsData.pagination.totalPages}
                className="h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {language === "ar" ? "التالي" : "Next"} <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
              </button>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════
            TAB 3: EXPORT
            ═══════════════════════════════════════════ */}
        <TabsContent value="export" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Report Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> {t("supervisor.exportSec.reportType")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { value: "all", label: language === "ar" ? "تقرير جميع الحجوزات" : "All Bookings Report", desc: language === "ar" ? "بيانات الحجوزات الكاملة مع تفاصيل المسافرين والرحلات" : "Complete bookings data with customer and flight details", icon: FileText },
                  { value: "employee", label: language === "ar" ? "تقرير أداء الموظفين" : "Employee Performance Report", desc: language === "ar" ? "ملخص لتذاكر كل موظف وإيراداته وأرباحه" : "Summary of each employee's tickets, revenue, and profit", icon: Users },
                  { value: "monthly", label: language === "ar" ? "التقرير الشهري" : "Monthly Report", desc: language === "ar" ? "ملخص الحجوزات للفترة المحددة" : "Bookings summary for the selected period", icon: Calendar },
                  { value: "yearly", label: language === "ar" ? "التقرير السنوي" : "Yearly Report", desc: language === "ar" ? "نظرة عامة على الحجوزات والأداء السنوي" : "Annual bookings and performance overview", icon: BarChart3 },
                  { value: "profit", label: language === "ar" ? "تقرير المبيعات وصافي الأرباح" : "Profit & Sales Report", desc: language === "ar" ? "تفصيل الإيرادات والأرباح لكل موظف" : "Revenue and profit breakdown by employee", icon: DollarSign },
                  { value: "bookings", label: language === "ar" ? "تقرير الحجوزات والعملاء" : "Bookings & Customers Report", desc: language === "ar" ? "بيانات العملاء والحجوزات بالتفصيل" : "Detailed customer and booking information", icon: Tag },
                ].map(item => (
                  <button
                    key={item.value}
                    onClick={() => setExportType(item.value)}
                    className={cn(
                      "w-full p-3 rounded-xl border transition-all duration-200 flex items-start gap-3",
                      isRtl ? "text-right" : "text-left",
                      exportType === item.value
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm"
                        : "hover:border-muted-foreground/30 hover:bg-muted/50"
                    )}
                    id={`export-type-${item.value}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      exportType === item.value ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted"
                    }`}>
                      <item.icon className={`h-4 w-4 ${exportType === item.value ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${exportType === item.value ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                        {item.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Format Selection + Export Button */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" /> {t("supervisor.exportSec.format")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { value: "xlsx", label: "Excel (.xlsx)", desc: language === "ar" ? "الأفضل لتحليل البيانات والتعديل عليها" : "Best for data analysis and manipulation", icon: FileSpreadsheet, color: "#22c55e" },
                    { value: "csv", label: "CSV (.csv)", desc: language === "ar" ? "صيغة عامة متوافقة مع جميع البرامج" : "Universal format, compatible with all tools", icon: File, color: "#0ea5e9" },
                    { value: "pdf", label: "PDF (.pdf)", desc: language === "ar" ? "الأفضل لطباعة ومشاركة التقارير" : "Best for printing and sharing reports", icon: FileText, color: "#ef4444" },
                  ].map(item => (
                    <button
                      key={item.value}
                      onClick={() => setExportFormat(item.value)}
                      className={cn(
                        "w-full p-3 rounded-xl border transition-all duration-200 flex items-center gap-3",
                        isRtl ? "text-right" : "text-left",
                        exportFormat === item.value
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm"
                          : "hover:border-muted-foreground/30 hover:bg-muted/50"
                      )}
                      id={`export-format-${item.value}`}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.color + "15" }}>
                        <item.icon className="h-4 w-4" style={{ color: item.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.desc}</div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Export Summary */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">{t("supervisor.exportSec.summary")}</div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>{t("supervisor.exportSec.summaryType")}:</span>
                        <span className="font-medium text-foreground capitalize">
                          {language === "ar" 
                            ? (exportType === "all" ? "جميع الحجوزات" : exportType === "employee" ? "أداء الموظفين" : exportType === "monthly" ? "التقرير الشهري" : exportType === "yearly" ? "التقرير السنوي" : exportType === "profit" ? "الأرباح والمبيعات" : "الحجوزات والعملاء")
                            : exportType
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("supervisor.exportSec.summaryFormat")}:</span>
                        <span className="font-medium text-foreground uppercase">{exportFormat}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("supervisor.exportSec.summaryPeriod")}:</span>
                        <span className="font-medium text-foreground">
                          {language === "ar"
                            ? (period === "7d" ? "آخر 7 أيام" : period === "30d" ? "آخر 30 يوم" : period === "90d" ? "آخر 90 يوم" : period === "6m" ? "آخر 6 أشهر" : period === "1y" ? "آخر 12 شهر" : period === "ytd" ? "منذ بداية العام" : "تاريخ مخصص")
                            : period
                          }
                        </span>
                      </div>
                      {employeeFilter !== "all" && (
                        <div className="flex justify-between">
                          <span>{t("supervisor.exportSec.summaryEmployee")}:</span>
                          <span className="font-medium text-foreground">
                            {dashData?.filterableEmployees.find(e => String(e.id) === employeeFilter)?.name ?? employeeFilter}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleExport}
                      disabled={isExporting}
                      className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
                      id="export-button"
                    >
                      {isExporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t("supervisor.exportSec.exporting")}
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          {t("supervisor.exportSec.btnExport")}
                        </>
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
