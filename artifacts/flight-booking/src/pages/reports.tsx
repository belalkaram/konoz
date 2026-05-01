import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import { useCurrentEmployee } from "@/contexts/employee-context";
import { authFetch, BASE } from "@/lib/api";
import {
  BarChart3, TrendingUp, Users, Tag, DollarSign, Target,
  CheckCircle2, XCircle, Download, Calendar, ChevronRight, Award,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLORS } from "@/lib/ticket-constants";

/* ─── Types ─── */
interface ReportsData {
  role: string;
  dateRange: { start: string; end: string };
  filterableEmployees: Array<{ id: number; name: string; initials: string }>;
  kpis: {
    totalRevenue: string; totalTickets: number; totalCustomers: number;
    avgTicketValue: string; conversionRate: number;
    issuedTickets: number; cancelledTickets: number; totalProfit: string;
  };
  revenueTrend: Array<{ month: string; revenue: number; tickets: number }>;
  ticketsByStatus: Array<{ status: string; count: number }>;
  paymentMethodBreakdown: Array<{ method: string; amount: number; count: number }>;
  customersBySource: Array<{ source: string; count: number }>;
  topRoutes: Array<{ route: string; count: number; revenue: number }>;
  topCustomers: Array<{ id: number; name: string; tickets: number; revenue: number }>;
  employeePerformance: Array<{
    id: number; name: string; initials: string;
    tickets: number; revenue: number; customers: number;
  }>;
}

/* ─── Constants ─── */
const CHART_COLORS = [
  "#059669", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];
const PIE_COLORS = ["#059669", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b", "#ec4899"];
const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook", whatsapp: "WhatsApp", walk_in: "Walk-in",
  referral: "Referral", other: "Other",
};
const PM_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card", bank_transfer: "Bank Transfer",
  online: "Online", other: "Other",
};

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

function exportCSV(data: ReportsData) {
  const rows = [
    ["Metric", "Value"],
    ["Total Revenue", data.kpis.totalRevenue],
    ["Total Tickets", String(data.kpis.totalTickets)],
    ["Issued Tickets", String(data.kpis.issuedTickets)],
    ["Cancelled Tickets", String(data.kpis.cancelledTickets)],
    ["Total Customers", String(data.kpis.totalCustomers)],
    ["Conversion Rate", data.kpis.conversionRate + "%"],
    ["Avg Ticket Value", data.kpis.avgTicketValue],
    ["Total Profit", data.kpis.totalProfit],
    [],
    ["Top Routes"],
    ["Route", "Count", "Revenue"],
    ...data.topRoutes.map(r => [r.route, String(r.count), String(r.revenue)]),
    [],
    ["Top Customers"],
    ["Name", "Tickets", "Revenue"],
    ...data.topCustomers.map(c => [c.name, String(c.tickets), String(c.revenue)]),
  ];
  if (data.employeePerformance.length > 0) {
    rows.push([], ["Employee Performance"], ["Name", "Tickets", "Revenue", "Customers"]);
    data.employeePerformance.forEach(e => rows.push([e.name, String(e.tickets), String(e.revenue), String(e.customers)]));
  }
  const csv = rows.map(r => (r as string[]).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "report.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ─── KPI Card ─── */
function KPICard({ title, value, icon, color, sub }: {
  title: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" style={{ background: color }} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + "18", color }}>{icon}</div>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─── */
export default function Reports() {
  const employee = useCurrentEmployee();
  const isHR = employee.role === "HR";
  const isSupervisorOrAdmin = employee.role === "Administrator" || employee.role === "Supervisor";

  const [period, setPeriod] = useState("1y");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const { data, isLoading, isError } = useQuery<ReportsData>({
    queryKey: ["reports", period, employeeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (employeeFilter !== "all") params.set("employeeId", employeeFilter);
      const res = await authFetch(`${BASE}/api/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
    staleTime: 60_000,
    enabled: !isHR,
  });

  if (isHR) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center">
          <CardContent className="p-10">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Reports Not Available</h2>
            <p className="text-muted-foreground text-sm">HR users can access attendance and leave reports from the HR Management section.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trendData = useMemo(() =>
    (data?.revenueTrend ?? []).map(t => ({
      ...t,
      monthLabel: new Date(t.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    })),
    [data?.revenueTrend]
  );

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #059669 0%, #0ea5e9 100%)" }}>
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Business intelligence dashboard</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-9 text-sm" id="reports-date-range">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="1y">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>

          {/* Employee filter (supervisor/admin only) */}
          {isSupervisorOrAdmin && data?.filterableEmployees && data.filterableEmployees.length > 0 && (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm" id="reports-employee-filter">
                <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {data.filterableEmployees.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {data && (
            <button
              onClick={() => exportCSV(data)}
              className="h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 hover:bg-muted transition-colors"
              id="reports-export-csv"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
      )}

      {isError && <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-lg">Failed to load reports data. Please try again.</div>}

      {data && (
        <>
          {/* ─── KPI Cards ─── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Total Revenue" value={formatCurrency(data.kpis.totalRevenue, "KWD")} icon={<DollarSign className="h-4 w-4" />} color="#059669" />
            <KPICard title="Total Tickets" value={data.kpis.totalTickets} icon={<Tag className="h-4 w-4" />} color="#0ea5e9" sub={`${data.kpis.issuedTickets} issued`} />
            <KPICard title="Total Customers" value={data.kpis.totalCustomers} icon={<Users className="h-4 w-4" />} color="#8b5cf6" />
            <KPICard title="Conversion Rate" value={`${data.kpis.conversionRate}%`} icon={<Target className="h-4 w-4" />} color="#f59e0b" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Avg Ticket Value" value={formatCurrency(data.kpis.avgTicketValue, "KWD")} icon={<TrendingUp className="h-4 w-4" />} color="#14b8a6" />
            <KPICard title="Issued Tickets" value={data.kpis.issuedTickets} icon={<CheckCircle2 className="h-4 w-4" />} color="#059669" />
            <KPICard title="Cancelled Tickets" value={data.kpis.cancelledTickets} icon={<XCircle className="h-4 w-4" />} color="#ef4444" />
            <KPICard title="Total Profit" value={formatCurrency(data.kpis.totalProfit, "KWD")} icon={<Award className="h-4 w-4" />} color="#d4af37" />
          </div>

          {/* ─── Revenue Trend ─── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Revenue & Ticket Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="rev" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="tkt" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Legend />
                    <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" fill="url(#revGrad)" strokeWidth={2} />
                    <Bar yAxisId="tkt" dataKey="tickets" name="Tickets" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ─── Charts Row ─── */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Ticket Status */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Ticket Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.ticketsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                        {data.ticketsByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number, name: string) => [val, TICKET_STATUS_LABELS[name] ?? name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {data.ticketsByStatus.map((t, i) => (
                    <span key={t.status} className="text-xs flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {TICKET_STATUS_LABELS[t.status] ?? t.status} ({t.count})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.paymentMethodBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="method" tick={{ fontSize: 11 }} tickFormatter={(v: string) => PM_LABELS[v] ?? v} width={90} />
                      <Tooltip formatter={(val: number) => [formatCurrency(val, "KWD"), "Amount"]} labelFormatter={(l: string) => PM_LABELS[l] ?? l} />
                      <Bar dataKey="amount" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Customer Sources */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Customer Sources</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.customersBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                        {data.customersBySource.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number, name: string) => [val, SOURCE_LABELS[name] ?? name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {data.customersBySource.map((s, i) => (
                    <span key={s.source} className="text-xs flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {SOURCE_LABELS[s.source] ?? s.source} ({s.count})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Tables Row ─── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Routes */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /> Top Routes</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.topRoutes.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-6 py-4">No route data.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Route</TableHead><TableHead className="text-right">Tickets</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.topRoutes.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{r.route}</TableCell>
                          <TableCell className="text-right text-sm">{r.count}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.revenue, "KWD")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Top Customers</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.topCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-6 py-4">No customer data.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Tickets</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {data.topCustomers.map(c => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium text-sm">{c.name}</TableCell>
                          <TableCell className="text-right text-sm">{c.tickets}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(c.revenue, "KWD")}</TableCell>
                          <TableCell className="text-right">
                            <Link href={`/customers/${c.id}`}>
                              <span className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5 cursor-pointer">
                                View <ChevronRight className="h-3 w-3" />
                              </span>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Employee Performance (supervisor/admin only) ─── */}
          {isSupervisorOrAdmin && data.employeePerformance.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" /> Employee Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Tickets</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Customers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.employeePerformance.map((e, i) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{
                                background: i === 0 ? "linear-gradient(135deg, #d4af37 0%, #f5d76e 100%)" : "#f1f5f9",
                                color: i === 0 ? "#022c22" : "#475569",
                              }}
                            >
                              {e.initials}
                            </div>
                            <span className="text-sm font-medium">{e.name}</span>
                            {i === 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">Top</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{e.tickets}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(e.revenue, "KWD")}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{e.customers}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
