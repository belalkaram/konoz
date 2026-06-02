import { Router } from "express";
import {
  eq, gte, lte, and, count, sql, inArray, desc, asc, ilike, or, isNotNull,
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
import { requireSupervisorOrAdmin, getTeamEmployeeIds } from "../middlewares/auth.js";

const router = Router();

/* ────────── helper: parse date range from query ────────── */
function parseDateRange(query: Record<string, unknown>) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  let startDate = defaultStart;
  let endDate = now;

  if (query.startDate) startDate = new Date(query.startDate as string);
  if (query.endDate) endDate = new Date(query.endDate as string);

  // Month/year filter
  if (query.month && query.year) {
    const m = Number(query.month) - 1;
    const y = Number(query.year);
    startDate = new Date(y, m, 1);
    endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
  } else if (query.year && !query.month) {
    const y = Number(query.year);
    startDate = new Date(y, 0, 1);
    endDate = new Date(y, 11, 31, 23, 59, 59, 999);
  }

  return { startDate, endDate };
}

/* ────────── helper: build allowed employee IDs ────────── */
async function getAllowedEmployeeIds(
  role: string,
  myId: number,
  filterEmployeeId: number | null
): Promise<number[] | null> {
  let allowedEmployeeIds: number[] | null = null;

  if (role === "Supervisor") {
    allowedEmployeeIds = await getTeamEmployeeIds(myId);
    if (filterEmployeeId && !allowedEmployeeIds.includes(filterEmployeeId)) {
      allowedEmployeeIds = [];
    } else if (filterEmployeeId) {
      allowedEmployeeIds = [filterEmployeeId];
    }
  } else if (role === "Administrator") {
    if (filterEmployeeId) {
      allowedEmployeeIds = [filterEmployeeId];
    }
  }

  return allowedEmployeeIds;
}

/* ══════════════════════════════════════════════════════════
   GET /supervisor/dashboard — Comprehensive performance stats
   ══════════════════════════════════════════════════════════ */
router.get("/supervisor/dashboard", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const role = req.employee?.role || "Employee";
    const myId = req.employee!.employeeId;
    const query = req.query as Record<string, unknown>;

    const { startDate, endDate } = parseDateRange(query);
    const filterEmployeeId = query.employeeId ? Number(query.employeeId) : null;
    const filterTicketStatus = query.ticketStatus ? String(query.ticketStatus) : null;

    const allowedEmployeeIds = await getAllowedEmployeeIds(role, myId, filterEmployeeId);

    // Base ticket conditions
    const ticketConditions = (extra?: SQL): SQL | undefined => {
      const parts: (SQL | undefined)[] = [
        gte(ticketsTable.createdAt, startDate),
        lte(ticketsTable.createdAt, endDate),
      ];
      if (allowedEmployeeIds) parts.push(inArray(ticketsTable.employeeId, allowedEmployeeIds));
      if (filterTicketStatus) parts.push(eq(ticketsTable.ticketStatus, filterTicketStatus as any));
      if (extra) parts.push(extra);
      return and(...parts);
    };

    const customerConditions = (): SQL | undefined => {
      const parts: (SQL | undefined)[] = [
        gte(customersTable.createdAt, startDate),
        lte(customersTable.createdAt, endDate),
      ];
      if (allowedEmployeeIds) parts.push(inArray(customersTable.assignedEmployeeId, allowedEmployeeIds));
      return and(...parts);
    };

    // ── KPIs (Single Query Aggregation) ──
    const [kpiStats] = await db
      .select({
        totalTickets: count(ticketsTable.id),
        totalSales: sql<string>`COALESCE(SUM(COALESCE(${ticketsTable.price}, 0)), 0)::text`,
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${ticketsTable.ticketStatus} IN ('confirmed', 'paid', 'issued') THEN COALESCE(${ticketsTable.price}, 0) ELSE 0 END), 0)::text`,
        netProfit: sql<string>`COALESCE(SUM(CASE WHEN ${ticketsTable.ticketStatus} IN ('confirmed', 'paid', 'issued') THEN COALESCE(${ticketsTable.price}, 0) - COALESCE(${ticketsTable.costPrice}, 0) ELSE 0 END), 0)::text`,
        confirmedTickets: sql<number>`COUNT(CASE WHEN ${ticketsTable.ticketStatus} = 'confirmed' THEN 1 END)::int`,
        cancelledTickets: sql<number>`COUNT(CASE WHEN ${ticketsTable.ticketStatus} = 'cancelled' THEN 1 END)::int`,
        issuedTickets: sql<number>`COUNT(CASE WHEN ${ticketsTable.ticketStatus} = 'issued' THEN 1 END)::int`,
      })
      .from(ticketsTable)
      .where(ticketConditions());

    const [totalCustomersResult] = await db
      .select({ count: count() })
      .from(customersTable)
      .where(customerConditions());

    const totalSales = kpiStats?.totalSales ?? "0";
    const totalRevenue = kpiStats?.totalRevenue ?? "0";
    const netProfit = kpiStats?.netProfit ?? "0";

    // ── Ticket Status Distribution ──
    const ticketsByStatus = await db
      .select({ status: ticketsTable.ticketStatus, count: count() })
      .from(ticketsTable)
      .where(ticketConditions())
      .groupBy(ticketsTable.ticketStatus);

    // ── Revenue & Profit Trend (monthly) ──
    const trendWhere: (SQL | undefined)[] = [
      gte(ticketsTable.createdAt, startDate),
      lte(ticketsTable.createdAt, endDate),
    ];
    if (allowedEmployeeIds) {
      trendWhere.push(inArray(ticketsTable.employeeId, allowedEmployeeIds));
    }

    const revenueTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${ticketsTable.createdAt}, 'YYYY-MM')`,
        sales: sql<number>`COALESCE(SUM(${ticketsTable.price}), 0)::float`,
        cost: sql<number>`COALESCE(SUM(${ticketsTable.costPrice}), 0)::float`,
        tickets: count(),
      })
      .from(ticketsTable)
      .where(and(...trendWhere))
      .groupBy(sql`TO_CHAR(${ticketsTable.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${ticketsTable.createdAt}, 'YYYY-MM')`);

    // Add profit to trend
    const trendWithProfit = revenueTrend.map(t => ({
      ...t,
      profit: t.sales - t.cost,
    }));

    // ── Employee Performance (Optimized Map-Merge) ──
    const empPerfIds = role === "Supervisor" ? await getTeamEmployeeIds(myId) : null;
    const empPerfWhere: (SQL | undefined)[] = [eq(employeesTable.isActive, true)];
    if (empPerfIds) empPerfWhere.push(inArray(employeesTable.id, empPerfIds));

    const employees = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
      })
      .from(employeesTable)
      .where(and(...empPerfWhere));

    const ticketStats = await db
      .select({
        employeeId: ticketsTable.employeeId,
        ticketsCount: count(ticketsTable.id),
        revenue: sql<number>`COALESCE(SUM(CASE WHEN ${ticketsTable.ticketStatus} IN ('confirmed', 'paid', 'issued') THEN COALESCE(${ticketsTable.price}, 0) ELSE 0 END), 0)::float`,
        profit: sql<number>`COALESCE(SUM(CASE WHEN ${ticketsTable.ticketStatus} IN ('confirmed', 'paid', 'issued') THEN COALESCE(${ticketsTable.price}, 0) - COALESCE(${ticketsTable.costPrice}, 0) ELSE 0 END), 0)::float`,
        confirmedCount: sql<number>`COUNT(CASE WHEN ${ticketsTable.ticketStatus} = 'confirmed' THEN 1 END)::int`,
        cancelledCount: sql<number>`COUNT(CASE WHEN ${ticketsTable.ticketStatus} = 'cancelled' THEN 1 END)::int`,
      })
      .from(ticketsTable)
      .where(and(
        gte(ticketsTable.createdAt, startDate),
        lte(ticketsTable.createdAt, endDate),
        isNotNull(ticketsTable.employeeId)
      ))
      .groupBy(ticketsTable.employeeId);

    const customerStats = await db
      .select({
        employeeId: customersTable.assignedEmployeeId,
        customersCount: count(customersTable.id),
      })
      .from(customersTable)
      .where(and(
        gte(customersTable.createdAt, startDate),
        lte(customersTable.createdAt, endDate),
        isNotNull(customersTable.assignedEmployeeId)
      ))
      .groupBy(customersTable.assignedEmployeeId);

    const ticketStatsMap = new Map(ticketStats.map(s => [s.employeeId, s]));
    const customerStatsMap = new Map(customerStats.map(s => [s.employeeId, s]));

    const employeePerformance = employees.map(emp => {
      const tStat = ticketStatsMap.get(emp.id);
      const cStat = customerStatsMap.get(emp.id);
      return {
        id: emp.id,
        name: emp.name,
        initials: emp.initials,
        role: emp.role,
        tickets: tStat?.ticketsCount ?? 0,
        revenue: tStat?.revenue ?? 0,
        profit: tStat?.profit ?? 0,
        customers: cStat?.customersCount ?? 0,
        confirmedTickets: tStat?.confirmedCount ?? 0,
        cancelledTickets: tStat?.cancelledCount ?? 0,
      };
    });

    // Sort by revenue descending
    employeePerformance.sort((a, b) => b.revenue - a.revenue);

    // ── Filterable employees list ──
    let filterableEmployees: Array<{ id: number; name: string; initials: string }> = [];
    if (role === "Supervisor") {
      const teamIds = await getTeamEmployeeIds(myId);
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

    // ── Travel Date Distribution (upcoming travel dates) ──
    const travelDateWhere: (SQL | undefined)[] = [
      gte(ticketsTable.departureDatetime, new Date()),
    ];
    if (allowedEmployeeIds) {
      travelDateWhere.push(inArray(ticketsTable.employeeId, allowedEmployeeIds));
    }
    const upcomingTravels = await db
      .select({
        month: sql<string>`TO_CHAR(${ticketsTable.departureDatetime}, 'YYYY-MM')`,
        count: count(),
      })
      .from(ticketsTable)
      .where(and(...travelDateWhere))
      .groupBy(sql`TO_CHAR(${ticketsTable.departureDatetime}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${ticketsTable.departureDatetime}, 'YYYY-MM')`)
      .limit(12);

    res.json({
      role,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      filterableEmployees,
      kpis: {
        totalSales,
        totalRevenue,
        netProfit,
        totalTickets: kpiStats?.totalTickets ?? 0,
        totalCustomers: totalCustomersResult?.count ?? 0,
        confirmedTickets: kpiStats?.confirmedTickets ?? 0,
        cancelledTickets: kpiStats?.cancelledTickets ?? 0,
        issuedTickets: kpiStats?.issuedTickets ?? 0,
      },
      revenueTrend: trendWithProfit,
      ticketsByStatus: ticketsByStatus.map(r => ({ status: r.status, count: r.count })),
      employeePerformance,
      upcomingTravels: upcomingTravels.map(r => ({ month: r.month, count: r.count })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting supervisor dashboard");
    res.status(500).json({ error: "server_error", message: "Failed to get supervisor dashboard" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /supervisor/bookings — Detailed bookings with pagination
   ══════════════════════════════════════════════════════════ */
router.get("/supervisor/bookings", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const role = req.employee?.role || "Employee";
    const myId = req.employee!.employeeId;
    const query = req.query as Record<string, unknown>;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(query.limit) || 50));
    const offset = (page - 1) * limit;

    const { startDate, endDate } = parseDateRange(query);
    const filterEmployeeId = query.employeeId ? Number(query.employeeId) : null;
    const filterTicketStatus = query.ticketStatus ? String(query.ticketStatus) : null;
    const search = query.search ? String(query.search) : null;
    const travelStartDate = query.travelStartDate ? new Date(query.travelStartDate as string) : null;
    const travelEndDate = query.travelEndDate ? new Date(query.travelEndDate as string) : null;
    const sortBy = (query.sortBy as string) || "bookingDate";
    const sortOrder = (query.sortOrder as string) || "desc";

    const allowedEmployeeIds = await getAllowedEmployeeIds(role, myId, filterEmployeeId);

    // Build WHERE conditions
    const conditions: (SQL | undefined)[] = [
      gte(ticketsTable.createdAt, startDate),
      lte(ticketsTable.createdAt, endDate),
    ];
    if (allowedEmployeeIds) conditions.push(inArray(ticketsTable.employeeId, allowedEmployeeIds));
    if (filterTicketStatus) conditions.push(eq(ticketsTable.ticketStatus, filterTicketStatus as any));
    if (search) {
      conditions.push(ilike(customersTable.fullName, `%${search}%`));
    }
    if (travelStartDate) conditions.push(gte(ticketsTable.departureDatetime, travelStartDate));
    if (travelEndDate) conditions.push(lte(ticketsTable.departureDatetime, travelEndDate));

    const whereClause = and(...conditions);

    // Count total
    const [totalResult] = await db
      .select({ count: count() })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    // Sort mapping
    const sortMap: Record<string, any> = {
      bookingDate: ticketsTable.createdAt,
      travelDate: ticketsTable.departureDatetime,
      price: ticketsTable.price,
      employee: employeesTable.name,
    };
    const sortColumn = sortMap[sortBy] || ticketsTable.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    // Fetch bookings
    const bookings = await db
      .select({
        id: ticketsTable.id,
        customerName: customersTable.fullName,
        customerPhone: customersTable.phone,
        customerEmail: customersTable.email,
        flightRoute: ticketsTable.flightRoute,
        airline: ticketsTable.airline,
        flightNumber: ticketsTable.flightNumber,
        departureDatetime: ticketsTable.departureDatetime,
        arrivalDatetime: ticketsTable.arrivalDatetime,
        bookingDate: ticketsTable.bookingDate,
        costPrice: ticketsTable.costPrice,
        price: ticketsTable.price,
        currency: ticketsTable.currency,
        pnr: ticketsTable.pnr,
        ticketStatus: ticketsTable.ticketStatus,
        paymentStatus: ticketsTable.paymentStatus,
        baggageDetails: ticketsTable.baggageDetails,
        notes: ticketsTable.notes,
        createdAt: ticketsTable.createdAt,
        employeeId: ticketsTable.employeeId,
        employeeName: employeesTable.name,
        employeeInitials: employeesTable.initials,
        invoiceProfit: sql<string>`(
          SELECT COALESCE(
            (SELECT i.profit FROM ${invoicesTable} i WHERE i.ticket_id = ${ticketsTable.id} LIMIT 1),
            COALESCE(${ticketsTable.price} - ${ticketsTable.costPrice}, 0)
          )::text
        )`,
      })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .leftJoin(employeesTable, eq(ticketsTable.employeeId, employeesTable.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    res.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error getting supervisor bookings");
    res.status(500).json({ error: "server_error", message: "Failed to get supervisor bookings" });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /supervisor/export — Export data for reports
   ══════════════════════════════════════════════════════════ */
router.get("/supervisor/export", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const role = req.employee?.role || "Employee";
    const myId = req.employee!.employeeId;
    const query = req.query as Record<string, unknown>;

    const { startDate, endDate } = parseDateRange(query);
    const filterEmployeeId = query.employeeId ? Number(query.employeeId) : null;
    const reportType = (query.type as string) || "all";

    const allowedEmployeeIds = await getAllowedEmployeeIds(role, myId, filterEmployeeId);

    // Build conditions
    const conditions: (SQL | undefined)[] = [
      gte(ticketsTable.createdAt, startDate),
      lte(ticketsTable.createdAt, endDate),
    ];
    if (allowedEmployeeIds) conditions.push(inArray(ticketsTable.employeeId, allowedEmployeeIds));

    const whereClause = and(...conditions);

    // Fetch all bookings for export (no pagination)
    const bookings = await db
      .select({
        id: ticketsTable.id,
        customerName: customersTable.fullName,
        customerPhone: customersTable.phone,
        flightRoute: ticketsTable.flightRoute,
        airline: ticketsTable.airline,
        flightNumber: ticketsTable.flightNumber,
        departureDatetime: ticketsTable.departureDatetime,
        arrivalDatetime: ticketsTable.arrivalDatetime,
        bookingDate: ticketsTable.bookingDate,
        costPrice: ticketsTable.costPrice,
        price: ticketsTable.price,
        currency: ticketsTable.currency,
        pnr: ticketsTable.pnr,
        ticketStatus: ticketsTable.ticketStatus,
        paymentStatus: ticketsTable.paymentStatus,
        createdAt: ticketsTable.createdAt,
        employeeName: employeesTable.name,
        invoiceProfit: sql<string>`(
          SELECT COALESCE(
            (SELECT i.profit FROM ${invoicesTable} i WHERE i.ticket_id = ${ticketsTable.id} LIMIT 1),
            COALESCE(${ticketsTable.price} - ${ticketsTable.costPrice}, 0)
          )::text
        )`,
      })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .leftJoin(employeesTable, eq(ticketsTable.employeeId, employeesTable.id))
      .where(whereClause)
      .orderBy(desc(ticketsTable.createdAt));

    // Employee performance for summary exports
    const empPerfIds = role === "Supervisor" ? await getTeamEmployeeIds(myId) : null;
    const empPerfWhere: (SQL | undefined)[] = [eq(employeesTable.isActive, true)];
    if (empPerfIds) empPerfWhere.push(inArray(employeesTable.id, empPerfIds));
    if (filterEmployeeId) empPerfWhere.push(eq(employeesTable.id, filterEmployeeId));

    const employeePerformance = await db
      .select({
        name: employeesTable.name,
        tickets: sql<number>`(
          SELECT COUNT(*)::int FROM tickets t2
          WHERE t2.employee_id = "employees"."id"
          AND t2.created_at >= ${startDate}
          AND t2.created_at <= ${endDate}
        )`,
        revenue: sql<number>`(
          SELECT COALESCE(SUM(COALESCE(t2.price, 0)), 0)::float FROM tickets t2
          WHERE t2.employee_id = "employees"."id"
          AND t2.ticket_status IN ('confirmed', 'paid', 'issued')
          AND t2.created_at >= ${startDate}
          AND t2.created_at <= ${endDate}
        )`,
        profit: sql<number>`(
          SELECT COALESCE(SUM(COALESCE(t2.price, 0) - COALESCE(t2.cost_price, 0)), 0)::float FROM tickets t2
          WHERE t2.employee_id = "employees"."id"
          AND t2.ticket_status IN ('confirmed', 'paid', 'issued')
          AND t2.created_at >= ${startDate}
          AND t2.created_at <= ${endDate}
        )`,
        customers: sql<number>`(
          SELECT COUNT(*)::int FROM customers c2
          WHERE c2.assigned_employee_id = "employees"."id"
          AND c2.created_at >= ${startDate}
          AND c2.created_at <= ${endDate}
        )`,
      })
      .from(employeesTable)
      .where(and(...empPerfWhere))
      .orderBy(employeesTable.name);

    // Return raw data — client will format to CSV/Excel/PDF
    res.json({
      reportType,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      bookings,
      employeePerformance,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting supervisor export data");
    res.status(500).json({ error: "server_error", message: "Failed to get export data" });
  }
});

export default router;
