import { useQuery } from "@tanstack/react-query";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { formatCurrency, formatShortDate, formatDateTime } from "@/lib/formatters";
import {
  Users, Tag, TrendingUp, Plane, CheckCircle2, XCircle, AlertCircle,
  Bell, Clock, ChevronRight, CreditCard, UserCheck, LayoutDashboard,
} from "lucide-react";
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "@/lib/ticket-constants";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/customer-constants";
import { useCurrentEmployee } from "@/contexts/employee-context";
import { authFetch, BASE } from "@/lib/api";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

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
  const { t, language, isRtl } = useLanguage();
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
        <PageHeader 
          title={t("dashboard.title")}
          description={`${t("dashboard.welcome")} ${currentEmployee.name}.`}
          icon={LayoutDashboard}
        />

        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <UserCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{t("dashboard.hrPortal")}</h2>
              <p className="text-muted-foreground mt-1 text-sm max-w-md">
                {t("dashboard.hrSubtitle")}
              </p>
            </div>
            <button
              onClick={() => navigate("/hr")}
              className="mt-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              {t("dashboard.openHr")}
            </button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t("dashboard.attendanceRecords")}</div>
                <div className="text-xs text-muted-foreground truncate">{t("dashboard.attendanceSub")}</div>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground", isRtl ? "rotate-180 mr-auto ml-0" : "ml-auto")} />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t("dashboard.leaveRequests")}</div>
                <div className="text-xs text-muted-foreground truncate">{t("dashboard.leaveSub")}</div>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground", isRtl ? "rotate-180 mr-auto ml-0" : "ml-auto")} />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t("dashboard.hrReports")}</div>
                <div className="text-xs text-muted-foreground truncate">{t("dashboard.hrReportsSub")}</div>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground", isRtl ? "rotate-180 mr-auto ml-0" : "ml-auto")} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Standard dashboard (Employee / Supervisor / Administrator) ─────────────
  return (
    <div className="space-y-10">
      <PageHeader 
        title={t("dashboard.title")}
        description={language === "ar" ? "نظرة عامة على إدارة العملاء وحجوزات الطيران." : "CRM and flight booking overview."}
        icon={LayoutDashboard}
      />

      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> {language === "ar" ? "إحصائيات إدارة العملاء" : "CRM Stats"}
        </h2>

        {crmLoading && <SectionSkeleton />}
        {crmError && <div className="text-destructive text-sm">{t("common.failedToLoad")}</div>}

        {crmData && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title={t("supervisor.kpis.totalCustomers")} value={crmData.customers.total} icon={<Users className="h-4 w-4" />} color="text-primary" href="/customers" />
              <StatCard title={t("dashboard.newCustomersToday")} value={crmData.customers.newToday} icon={<Users className="h-4 w-4" />} color="text-blue-500" href="/customers" />
              <StatCard title={t("supervisor.kpis.totalRevenue")} value={formatCurrency(crmData.totalRevenue, "USD")} icon={<TrendingUp className="h-4 w-4" />} color="text-green-600" />
              <StatCard title={t("dashboard.pendingFollowups")} value={crmData.customers.followUpsToday} icon={<Bell className="h-4 w-4" />} color="text-yellow-500" href="/reminders" />
              <StatCard title={t("dashboard.missedFollowups")} value={crmData.customers.missedFollowUps} icon={<AlertCircle className="h-4 w-4" />} color="text-destructive" href="/reminders" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title={t("supervisor.kpis.totalTickets")} value={crmData.tickets.total} icon={<Tag className="h-4 w-4" />} color="text-primary" href="/tickets" />
              <StatCard title={t("supervisor.kpis.confirmedTickets")} value={crmData.tickets.confirmed} icon={<CheckCircle2 className="h-4 w-4" />} color="text-green-500" href="/tickets" />
              <StatCard title={t("supervisor.kpis.issuedTickets")} value={crmData.tickets.issued} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-500" href="/tickets" />
              <StatCard title={t("supervisor.kpis.cancelledTickets")} value={crmData.tickets.cancelled} icon={<XCircle className="h-4 w-4" />} color="text-destructive" href="/tickets" />
              <StatCard title={t("statuses.unpaid")} value={crmData.tickets.unpaid} icon={<CreditCard className="h-4 w-4" />} color="text-yellow-600" href="/tickets" />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span>{t("dashboard.myFollowups")}</span>
                    <span className={cn("text-xs font-normal text-muted-foreground", isRtl ? "mr-auto ml-0" : "ml-auto")}>{currentEmployee.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {myFollowUpsToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">
                      {language === "ar" ? "لا توجد متابعات مسندة إليك اليوم." : "No follow-ups assigned to you today."}
                    </p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead>{language === "ar" ? "الملاحظة" : "Note"}</TableHead>
                            <TableHead className="text-end">{language === "ar" ? "الوقت" : "Time"}</TableHead>
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
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap text-end">
                                {f.followUpDate ? formatDateTime(f.followUpDate).split(",")[1]?.trim() ?? "" : "—"}
                              </TableCell>
                              <TableCell className="text-end">
                                {f.customerId ? (
                                  <Link href={`/customers/${f.customerId}`}>
                                    <span className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5 cursor-pointer">
                                      {t("common.view")} <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                                    </span>
                                  </Link>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-6 py-2 border-t">
                        <Link href="/reminders" className="text-xs text-primary hover:underline">
                          {language === "ar" ? "عرض جميع التذكيرات ←" : "View all reminders →"}
                        </Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" /> {t("dashboard.pendingFollowups")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {crmData.todayFollowUps.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">{t("dashboard.noFollowups")}</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead>{language === "ar" ? "الملاحظة" : "Note"}</TableHead>
                            <TableHead className="text-end">{language === "ar" ? "الوقت" : "Time"}</TableHead>
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
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap text-end">
                                {f.followUpDate ? formatDateTime(f.followUpDate).split(",")[1]?.trim() ?? "" : "—"}
                              </TableCell>
                              <TableCell className="text-end">
                                {f.customerId ? (
                                  <Link href={`/customers/${f.customerId}`}>
                                    <span className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5 cursor-pointer">
                                      {t("common.view")} <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                                    </span>
                                  </Link>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-6 py-2 border-t">
                        <Link href="/reminders" className="text-xs text-primary hover:underline">
                          {language === "ar" ? "عرض جميع التذكيرات ←" : "View all reminders →"}
                        </Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" /> {t("dashboard.recentCustomers")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {crmData.recentCustomers.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-6 pb-4">{t("dashboard.noCustomers")}</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead>{language === "ar" ? "تاريخ الإضافة" : "Added"}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {crmData.recentCustomers.map((c) => (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/customers/${c.id}`)}>
                              <TableCell className="font-medium text-sm truncate max-w-[120px]">{c.fullName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatShortDate(c.createdAt)}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                                  {t(`statuses.${c.status}`)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="px-6 py-2 border-t">
                        <Link href="/customers" className="text-xs text-primary hover:underline">
                          {language === "ar" ? "عرض جميع العملاء ←" : "View all customers →"}
                        </Link>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" /> {t("dashboard.recentTickets")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {crmData.recentTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-6 pb-4">{t("dashboard.noTickets")}</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.name")}</TableHead>
                          <TableHead>{t("common.route")}</TableHead>
                          <TableHead>{t("common.ticketStatus")}</TableHead>
                          <TableHead>{t("common.paymentStatus")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {crmData.recentTickets.map((tRow) => (
                          <TableRow key={tRow.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tickets/${tRow.id}`)}>
                            <TableCell className="font-medium text-sm truncate max-w-[110px]">{tRow.customerName ?? `#${tRow.id}`}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{tRow.flightRoute ?? "—"}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${TICKET_STATUS_COLORS[tRow.ticketStatus] ?? ""}`}>
                                {t(`statuses.${tRow.ticketStatus}`)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[tRow.paymentStatus] ?? ""}`}>
                                {t(`statuses.${tRow.paymentStatus}`)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-6 py-2 border-t">
                      <Link href="/tickets" className="text-xs text-primary hover:underline">
                        {language === "ar" ? "عرض جميع التذاكر ←" : "View all tickets →"}
                      </Link>
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
            <Plane className="h-5 w-5 text-blue-500" /> {t("dashboard.flightBookingStats")}
          </h2>

          {flightLoading && <SectionSkeleton />}
          {flightError && <div className="text-destructive text-sm">{language === "ar" ? "فشل تحميل إحصائيات حجوزات الطيران." : "Failed to load flight booking stats."}</div>}

          {flightStats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title={t("dashboard.totalRevenue")}
                  value={formatCurrency(flightStats.totalRevenue, flightStats.currency)}
                  icon={<TrendingUp className="h-4 w-4" />}
                  color="text-primary"
                />
                <StatCard
                  title={t("dashboard.totalBookings")}
                  value={flightStats.totalOrders}
                  icon={<Plane className="h-4 w-4" />}
                  color="text-blue-500"
                />
                <StatCard
                  title={t("dashboard.confirmedBookings")}
                  value={flightStats.confirmedOrders}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  color="text-green-500"
                />
                <StatCard
                  title={t("dashboard.cancelledBookings")}
                  value={flightStats.cancelledOrders}
                  icon={<XCircle className="h-4 w-4" />}
                  color="text-destructive"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="md:col-span-1 lg:col-span-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("common.orders")}</CardTitle>
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
                          <div className="text-end">
                            <div className="font-medium text-sm">{formatCurrency(order.totalAmount, order.totalCurrency)}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              order.status === "confirmed" ? "bg-green-100 text-green-800" :
                              order.status === "cancelled" ? "bg-red-100 text-red-800" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {language === "ar" ? t(`statuses.${order.status}`) : order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Link href="/orders" className="text-sm text-primary hover:underline font-medium">
                        {language === "ar" ? "عرض جميع الطلبات ←" : "View all orders →"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-1 lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{language === "ar" ? "أهم مسارات الرحلات" : "Top Routes"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {flightStats.topRoutes?.map((route, i) => (
                        <div key={i} className="flex items-center justify-between animate-in fade-in duration-300">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium">{route.origin} → {route.destination}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {route.count} {language === "ar" ? "حجز" : "bookings"}
                          </span>
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
