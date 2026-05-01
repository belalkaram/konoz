import { useQuery } from "@tanstack/react-query";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { formatCurrency, formatShortDate, formatDateTime } from "@/lib/formatters";
import {
  Users, Tag, TrendingUp, Plane, CheckCircle2, XCircle, AlertCircle,
  Bell, Clock, ChevronRight, CreditCard, UserCheck,
} from "lucide-react";
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "@/lib/ticket-constants";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/customer-constants";
import { useCurrentEmployee } from "@/contexts/employee-context";
import { authFetch, BASE } from "@/lib/api";

interface DashboardStats {
  customers: {
    total: number;
    newToday: number;
    followUpsToday: number;
    missedFollowUps: number;
    byStatus: Record<string, number>;
  };
  totalRevenue: string;
  tickets: {
    total: number;
    quoted: number;
    reserved: number;
    confirmed: number;
    paid: number;
    issued: number;
    cancelled: number;
    refunded: number;
    unpaid: number;
    partiallyPaid: number;
  };
  recentCustomers: Array<{
    id: number;
    fullName: string;
    status: string;
    source: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  recentTickets: Array<{
    id: number;
    customerId: number;
    customerName: string | null;
    flightRoute: string | null;
    ticketStatus: string;
    paymentStatus: string;
    price: string | null;
    currency: string | null;
    updatedAt: string;
  }>;
  todayFollowUps: Array<{
    id: number;
    customerId: number | null;
    customerName: string | null;
    note: string;
    followUpDate: string | null;
    followUpStatus: string | null;
    employeeId: number | null;
  }>;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await authFetch(`${BASE}/api/dashboard/stats`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

function StatCard({
  title,
  value,
  icon,
  color,
  href,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
  href?: string;
}) {
  const inner = (
    <Card className={href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <span className={`${color ?? "text-muted-foreground"}`}>{icon}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function SectionSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const currentEmployee = useCurrentEmployee();
  const isHR = currentEmployee.role === "HR";

  const { data: crmData, isLoading: crmLoading, isError: crmError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
    enabled: !isHR,
  });

  const { data: flightStats, isLoading: flightLoading, isError: flightError } = useGetStatsSummary();

  const myFollowUpsToday = crmData?.todayFollowUps.filter(
    (f) => f.employeeId === currentEmployee.id
  ) ?? [];

  // ── HR-only dashboard ──────────────────────────────────────────────────────
  if (isHR) {
    return (
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome, {currentEmployee.name}.</p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <UserCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">HR Management Portal</h2>
              <p className="text-muted-foreground mt-1 text-sm max-w-md">
                Your dedicated workspace for managing employee attendance, leaves, and HR records.
              </p>
            </div>
            <button
              onClick={() => navigate("/hr")}
              className="mt-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Open HR Section
            </button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Attendance Records</div>
                <div className="text-xs text-muted-foreground">Log check-in / check-out</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Leave Requests</div>
                <div className="text-xs text-muted-foreground">Manage employee leave</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-medium">HR Reports</div>
                <div className="text-xs text-muted-foreground">Export attendance &amp; leave logs</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Standard dashboard (Employee / Supervisor / Administrator) ─────────────
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">CRM and flight booking overview.</p>
      </div>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> CRM Stats
        </h2>

        {crmLoading && <SectionSkeleton />}
        {crmError && <div className="text-destructive text-sm">Failed to load CRM stats.</div>}

        {crmData && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="Total Customers" value={crmData.customers.total} icon={<Users className="h-4 w-4" />} color="text-primary" href="/customers" />
              <StatCard title="New Today" value={crmData.customers.newToday} icon={<Users className="h-4 w-4" />} color="text-blue-500" href="/customers" />
              <StatCard title="CRM Revenue" value={formatCurrency(crmData.totalRevenue, "USD")} icon={<TrendingUp className="h-4 w-4" />} color="text-green-600" />
              <StatCard title="Follow-ups Today" value={crmData.customers.followUpsToday} icon={<Bell className="h-4 w-4" />} color="text-yellow-500" href="/reminders" />
              <StatCard title="Missed Follow-ups" value={crmData.customers.missedFollowUps} icon={<AlertCircle className="h-4 w-4" />} color="text-destructive" href="/reminders" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="Total Tickets" value={crmData.tickets.total} icon={<Tag className="h-4 w-4" />} color="text-primary" href="/tickets" />
              <StatCard title="Confirmed" value={crmData.tickets.confirmed} icon={<CheckCircle2 className="h-4 w-4" />} color="text-green-500" href="/tickets" />
              <StatCard title="Issued" value={crmData.tickets.issued} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-500" href="/tickets" />
              <StatCard title="Cancelled" value={crmData.tickets.cancelled} icon={<XCircle className="h-4 w-4" />} color="text-destructive" href="/tickets" />
              <StatCard title="Unpaid" value={crmData.tickets.unpaid} icon={<CreditCard className="h-4 w-4" />} color="text-yellow-600" href="/tickets" />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    My Follow-ups Today
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{currentEmployee.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {myFollowUpsToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">No follow-ups assigned to you today.</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myFollowUpsToday.map((f) => (
                            <TableRow key={f.id}>
                              <TableCell className="text-sm font-medium truncate max-w-[80px]">
                                {f.customerName ?? "Unknown"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground line-clamp-1 max-w-[100px]">{f.note}</TableCell>
                              <TableCell className="text-xs text-muted-foreground text-right whitespace-nowrap">
                                {f.followUpDate ? formatDateTime(f.followUpDate).split(",")[1]?.trim() ?? "" : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {f.customerId ? (
                                  <Link href={`/customers/${f.customerId}`}>
                                    <span className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5 cursor-pointer">
                                      View <ChevronRight className="h-3 w-3" />
                                    </span>
                                  </Link>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-6 py-2 border-t">
                        <Link href="/reminders" className="text-xs text-primary hover:underline">View all reminders →</Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" /> Today's Follow-ups
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {crmData.todayFollowUps.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">No follow-ups due today.</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crmData.todayFollowUps.map((f) => (
                            <TableRow key={f.id}>
                              <TableCell className="text-sm font-medium truncate max-w-[80px]">
                                {f.customerName ?? "Unknown"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground line-clamp-1 max-w-[100px]">{f.note}</TableCell>
                              <TableCell className="text-xs text-muted-foreground text-right whitespace-nowrap">
                                {f.followUpDate ? formatDateTime(f.followUpDate).split(",")[1]?.trim() ?? "" : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {f.customerId ? (
                                  <Link href={`/customers/${f.customerId}`}>
                                    <span className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5 cursor-pointer">
                                      View <ChevronRight className="h-3 w-3" />
                                    </span>
                                  </Link>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-6 py-2 border-t">
                        <Link href="/reminders" className="text-xs text-primary hover:underline">View all reminders →</Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" /> Recent Customers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {crmData.recentCustomers.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">No customers yet.</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Added</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crmData.recentCustomers.map((c) => (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/customers/${c.id}`)}>
                              <TableCell className="font-medium text-sm truncate max-w-[120px]">{c.fullName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatShortDate(c.createdAt)}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                                  {STATUS_LABELS[c.status] ?? c.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-6 py-2 border-t">
                        <Link href="/customers" className="text-xs text-primary hover:underline">View all customers →</Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" /> Recent Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {crmData.recentTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-6 pb-4">No tickets yet.</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Ticket Status</TableHead>
                          <TableHead>Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {crmData.recentTickets.map((t) => (
                          <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tickets/${t.id}`)}>
                            <TableCell className="font-medium text-sm truncate max-w-[110px]">{t.customerName ?? `#${t.id}`}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{t.flightRoute ?? "—"}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${TICKET_STATUS_COLORS[t.ticketStatus] ?? ""}`}>
                                {TICKET_STATUS_LABELS[t.ticketStatus] ?? t.ticketStatus}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[t.paymentStatus] ?? ""}`}>
                                {PAYMENT_STATUS_LABELS[t.paymentStatus] ?? t.paymentStatus}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-6 py-2 border-t">
                      <Link href="/tickets" className="text-xs text-primary hover:underline">View all tickets →</Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>

      {currentEmployee.role === "Administrator" && (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Plane className="h-5 w-5 text-blue-500" /> Flight Booking Stats
          </h2>

          {flightLoading && <SectionSkeleton />}
          {flightError && <div className="text-destructive text-sm">Failed to load flight booking stats.</div>}

          {flightStats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Revenue"
                  value={formatCurrency(flightStats.totalRevenue, flightStats.currency)}
                  icon={<TrendingUp className="h-4 w-4" />}
                  color="text-primary"
                />
                <StatCard
                  title="Total Bookings"
                  value={flightStats.totalOrders}
                  icon={<Plane className="h-4 w-4" />}
                  color="text-blue-500"
                />
                <StatCard
                  title="Confirmed Bookings"
                  value={flightStats.confirmedOrders}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  color="text-green-500"
                />
                <StatCard
                  title="Cancellations"
                  value={flightStats.cancelledOrders}
                  icon={<XCircle className="h-4 w-4" />}
                  color="text-destructive"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="md:col-span-1 lg:col-span-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {flightStats.recentOrders?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between border-b border-border pb-3 last:pb-0 last:border-0">
                          <div>
                            <div className="font-medium text-sm">{order.bookingReference}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.slices?.[0]?.origin.iataCode} → {order.slices?.[0]?.destination.iataCode}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-sm">{formatCurrency(order.totalAmount, order.totalCurrency)}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              order.status === "confirmed" ? "bg-green-100 text-green-800" :
                              order.status === "cancelled" ? "bg-red-100 text-red-800" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Link href="/orders" className="text-sm text-primary hover:underline font-medium">
                        View all orders →
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-1 lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top Routes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {flightStats.topRoutes?.map((route, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium">{route.origin} → {route.destination}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{route.count} bookings</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
