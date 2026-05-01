import { Router } from "express";
import {
  eq, gte, lt, lte, and, count, sql, inArray,
  type SQL,
} from "drizzle-orm";
import {
  db,
  customersTable,
  ticketsTable,
  paymentsTable,
  employeesTable,
  invoicesTable,
} from "@workspace/db";
import { requireAuth, getTeamEmployeeIds } from "../middlewares/auth.js";

const router = Router();

/* ────────── helper: build role-based WHERE conditions ────────── */
async function buildFilters(req: import("express").Request, startDate: Date, endDate: Date) {
  const role = req.employee?.role || "Employee";
  const myId = req.employee!.employeeId;
  const companyId = req.employee!.companyId;

  // Optional employeeId filter from query
  const filterEmployeeId = req.query.employeeId ? Number(req.query.employeeId) : null;

  let allowedEmployeeIds: number[] | null = null; // null = no restriction (admin)

  if (role === "Employee") {
    allowedEmployeeIds = [myId];
  } else if (role === "Supervisor") {
    allowedEmployeeIds = await getTeamEmployeeIds(myId);
    // If filtering by a specific employee, ensure they are in the team
    if (filterEmployeeId && !allowedEmployeeIds.includes(filterEmployeeId)) {
      allowedEmployeeIds = []; // no results
    } else if (filterEmployeeId) {
      allowedEmployeeIds = [filterEmployeeId];
    }
  } else if (role === "Administrator") {
    if (filterEmployeeId) {
      allowedEmployeeIds = [filterEmployeeId];
    }
    // else null → no restriction
  }

  const dateFilter = (col: any) => and(gte(col, startDate), lte(col, endDate));

  const ticketFilter = (extraConditions?: SQL) => {
    const parts: (SQL | undefined)[] = [dateFilter(ticketsTable.createdAt)];
    if (allowedEmployeeIds) parts.push(inArray(ticketsTable.employeeId, allowedEmployeeIds));
    if (extraConditions) parts.push(extraConditions);
    return and(...parts);
  };

  const customerFilter = (extraConditions?: SQL) => {
    const parts: (SQL | undefined)[] = [dateFilter(customersTable.createdAt)];
    if (allowedEmployeeIds) parts.push(inArray(customersTable.assignedEmployeeId, allowedEmployeeIds));
    if (extraConditions) parts.push(extraConditions);
    return and(...parts);
  };

  const paymentFilter = (extraConditions?: SQL) => {
    const parts: (SQL | undefined)[] = [dateFilter(paymentsTable.createdAt)];
    if (extraConditions) parts.push(extraConditions);
    return and(...parts);
  };

  return {
    role,
    myId,
    companyId,
    allowedEmployeeIds,
    ticketFilter,
    customerFilter,
    paymentFilter,
    dateFilter,
    startDate,
    endDate,
  };
}

/* ────────── GET /reports ────────── */
router.get("/reports", requireAuth, async (req, res) => {
  try {
    const role = req.employee?.role || "Employee";

    // HR can't access CRM reports
    if (role === "HR") {
      res.json({ hrOnly: true });
      return;
    }

    // Parse date range (default: last 12 months)
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

    const filters = await buildFilters(req, startDate, endDate);

    // ── Filterable employees list ──
    let filterableEmployees: Array<{ id: number; name: string; initials: string }> = [];
    if (role === "Supervisor") {
      const teamIds = await getTeamEmployeeIds(filters.myId);
      filterableEmployees = await db
        .select({ id: employeesTable.id, name: employeesTable.name, initials: employeesTable.initials })
        .from(employeesTable)
        .where(inArray(employeesTable.id, teamIds))
        .orderBy(employeesTable.name);
    } else if (role === "Administrator") {
      filterableEmployees = await db
        .select({ id: employeesTable.id, name: employeesTable.name, initials: employeesTable.initials })
        .from(employeesTable)
        .where(eq(employeesTable.isActive, true))
        .orderBy(employeesTable.name);
    }

    // ── KPI: Tickets ──
    const [totalTicketsResult] = await db
      .select({ count: count() })
      .from(ticketsTable)
      .where(filters.ticketFilter());

    const [issuedTicketsResult] = await db
      .select({ count: count() })
      .from(ticketsTable)
      .where(filters.ticketFilter(eq(ticketsTable.ticketStatus, "issued")));

    const [cancelledTicketsResult] = await db
      .select({ count: count() })
      .from(ticketsTable)
      .where(filters.ticketFilter(eq(ticketsTable.ticketStatus, "cancelled")));

    // ── KPI: Customers ──
    const [totalCustomersResult] = await db
      .select({ count: count() })
      .from(customersTable)
      .where(filters.customerFilter());

    const [bookedCustomersResult] = await db
      .select({ count: count() })
      .from(customersTable)
      .where(filters.customerFilter(eq(customersTable.status, "booked")));

    // ── KPI: Revenue ──
    const revenueJoinConditions: (SQL | undefined)[] = [
      eq(paymentsTable.ticketId, ticketsTable.id),
    ];
    const revWhere: (SQL | undefined)[] = [
      filters.dateFilter(paymentsTable.createdAt),
      eq(paymentsTable.paymentStatus, "paid"),
    ];
    if (filters.allowedEmployeeIds) {
      revWhere.push(inArray(ticketsTable.employeeId, filters.allowedEmployeeIds));
    }

    const revenueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${paymentsTable.amount}), 0)::text` })
      .from(paymentsTable)
      .innerJoin(ticketsTable, and(...revenueJoinConditions))
      .where(and(...revWhere));

    const totalRevenue = revenueResult[0]?.total ?? "0";

    // ── KPI: Profit (from invoices) ──
    const profitWhere: (SQL | undefined)[] = [
      filters.dateFilter(invoicesTable.createdAt),
    ];
    if (filters.allowedEmployeeIds) {
      profitWhere.push(
        sql`EXISTS (
          SELECT 1 FROM ${ticketsTable}
          WHERE ${ticketsTable.id} = ${invoicesTable.ticketId}
          AND ${inArray(ticketsTable.employeeId, filters.allowedEmployeeIds!)}
        )`
      );
    }
    const profitResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoicesTable.profit}), 0)::text` })
      .from(invoicesTable)
      .where(and(...profitWhere));
    const totalProfit = profitResult[0]?.total ?? "0";

    // ── Avg ticket value ──
    const avgResult = await db
      .select({ avg: sql<string>`COALESCE(AVG(${ticketsTable.price}), 0)::text` })
      .from(ticketsTable)
      .where(filters.ticketFilter());
    const avgTicketValue = avgResult[0]?.avg ?? "0";

    // ── Conversion rate ──
    const totalCust = totalCustomersResult?.count ?? 0;
    const bookedCust = bookedCustomersResult?.count ?? 0;
    const conversionRate = totalCust > 0 ? Math.round((bookedCust / totalCust) * 100) : 0;

    // ── Revenue Trend (monthly, last 12 months) ──
    const trendWhere: (SQL | undefined)[] = [
      gte(ticketsTable.createdAt, startDate),
      lte(ticketsTable.createdAt, endDate),
    ];
    if (filters.allowedEmployeeIds) {
      trendWhere.push(inArray(ticketsTable.employeeId, filters.allowedEmployeeIds));
    }

    const revenueTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${ticketsTable.createdAt}, 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(${ticketsTable.price}), 0)::float`,
        tickets: count(),
      })
      .from(ticketsTable)
      .where(and(...trendWhere))
      .groupBy(sql`TO_CHAR(${ticketsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${ticketsTable.createdAt}, 'YYYY-MM')`);

    // ── Tickets by status ──
    const ticketsByStatus = await db
      .select({ status: ticketsTable.ticketStatus, count: count() })
      .from(ticketsTable)
      .where(filters.ticketFilter())
      .groupBy(ticketsTable.ticketStatus);

    // ── Payment method breakdown ──
    const pmWhere: (SQL | undefined)[] = [
      filters.dateFilter(paymentsTable.createdAt),
    ];
    if (filters.allowedEmployeeIds) {
      pmWhere.push(
        sql`EXISTS (
          SELECT 1 FROM ${ticketsTable}
          WHERE ${ticketsTable.id} = ${paymentsTable.ticketId}
          AND ${inArray(ticketsTable.employeeId, filters.allowedEmployeeIds!)}
        )`
      );
    }
    const paymentMethodBreakdown = await db
      .select({
        method: paymentsTable.paymentMethod,
        amount: sql<number>`COALESCE(SUM(${paymentsTable.amount}), 0)::float`,
        count: count(),
      })
      .from(paymentsTable)
      .where(and(...pmWhere))
      .groupBy(paymentsTable.paymentMethod);

    // ── Customers by source ──
    const customersBySource = await db
      .select({ source: customersTable.source, count: count() })
      .from(customersTable)
      .where(filters.customerFilter())
      .groupBy(customersTable.source);

    // ── Top Routes ──
    const topRoutes = await db
      .select({
        route: ticketsTable.flightRoute,
        count: count(),
        revenue: sql<number>`COALESCE(SUM(${ticketsTable.price}), 0)::float`,
      })
      .from(ticketsTable)
      .where(and(
        filters.ticketFilter(),
        sql`${ticketsTable.flightRoute} IS NOT NULL AND ${ticketsTable.flightRoute} != ''`
      ))
      .groupBy(ticketsTable.flightRoute)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    // ── Top Customers ──
    const topCustWhere: (SQL | undefined)[] = [
      filters.dateFilter(ticketsTable.createdAt),
    ];
    if (filters.allowedEmployeeIds) {
      topCustWhere.push(inArray(ticketsTable.employeeId, filters.allowedEmployeeIds));
    }
    const topCustomers = await db
      .select({
        id: customersTable.id,
        name: customersTable.fullName,
        tickets: count(),
        revenue: sql<number>`COALESCE(SUM(${ticketsTable.price}), 0)::float`,
      })
      .from(ticketsTable)
      .innerJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .where(and(...topCustWhere))
      .groupBy(customersTable.id, customersTable.fullName)
      .orderBy(sql`COALESCE(SUM(${ticketsTable.price}), 0) DESC`)
      .limit(10);

    // ── Employee Performance (supervisor/admin only) ──
    let employeePerformance: Array<{
      id: number;
      name: string;
      initials: string;
      tickets: number;
      revenue: number;
      customers: number;
    }> = [];

    if (role === "Supervisor" || role === "Administrator") {
      const empPerfIds = role === "Supervisor"
        ? await getTeamEmployeeIds(filters.myId)
        : null;

      const empPerfWhere: (SQL | undefined)[] = [];
      if (empPerfIds) {
        empPerfWhere.push(inArray(employeesTable.id, empPerfIds));
      }
      empPerfWhere.push(eq(employeesTable.isActive, true));

      employeePerformance = await db
        .select({
          id: employeesTable.id,
          name: employeesTable.name,
          initials: employeesTable.initials,
          tickets: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketsTable}
            WHERE ${ticketsTable.employeeId} = ${employeesTable.id}
            AND ${ticketsTable.createdAt} >= ${startDate}
            AND ${ticketsTable.createdAt} <= ${endDate}
          )`,
          revenue: sql<number>`(
            SELECT COALESCE(SUM(${ticketsTable.price}), 0)::float FROM ${ticketsTable}
            WHERE ${ticketsTable.employeeId} = ${employeesTable.id}
            AND ${ticketsTable.createdAt} >= ${startDate}
            AND ${ticketsTable.createdAt} <= ${endDate}
          )`,
          customers: sql<number>`(
            SELECT COUNT(*)::int FROM ${customersTable}
            WHERE ${customersTable.assignedEmployeeId} = ${employeesTable.id}
            AND ${customersTable.createdAt} >= ${startDate}
            AND ${customersTable.createdAt} <= ${endDate}
          )`,
        })
        .from(employeesTable)
        .where(and(...empPerfWhere))
        .orderBy(sql`(
          SELECT COALESCE(SUM(${ticketsTable.price}), 0)::float FROM ${ticketsTable}
          WHERE ${ticketsTable.employeeId} = ${employeesTable.id}
          AND ${ticketsTable.createdAt} >= ${startDate}
          AND ${ticketsTable.createdAt} <= ${endDate}
        ) DESC`);
    }

    res.json({
      role,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      filterableEmployees,
      kpis: {
        totalRevenue,
        totalTickets: totalTicketsResult?.count ?? 0,
        totalCustomers: totalCust,
        avgTicketValue,
        conversionRate,
        issuedTickets: issuedTicketsResult?.count ?? 0,
        cancelledTickets: cancelledTicketsResult?.count ?? 0,
        totalProfit,
      },
      revenueTrend,
      ticketsByStatus: ticketsByStatus.map((r) => ({ status: r.status, count: r.count })),
      paymentMethodBreakdown: paymentMethodBreakdown.map((r) => ({
        method: r.method,
        amount: r.amount,
        count: r.count,
      })),
      customersBySource: customersBySource.map((r) => ({ source: r.source ?? "other", count: r.count })),
      topRoutes: topRoutes.map((r) => ({ route: r.route ?? "Unknown", count: r.count, revenue: r.revenue })),
      topCustomers,
      employeePerformance,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting reports data");
    res.status(500).json({ error: "server_error", message: "Failed to get reports data" });
  }
});

export default router;
