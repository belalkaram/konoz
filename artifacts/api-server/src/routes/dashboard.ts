import { Router } from "express";
import { eq, gte, lt, and, isNotNull, count, sql, inArray, type SQL } from "drizzle-orm";
import { db, customersTable, customerNotesTable, ticketsTable, paymentsTable, employeesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function getRole(req: import("express").Request): string {
  return req.employee?.role || "Employee";
}

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const role = getRole(req);

    // HR employees have no access to CRM/business stats — they use the /hr section instead
    if (role === "HR") {
      res.json({
        hrOnly: true,
        customers: { total: 0, newToday: 0, followUpsToday: 0, missedFollowUps: 0, byStatus: {} },
        totalRevenue: "0",
        tickets: { total: 0, quoted: 0, reserved: 0, confirmed: 0, paid: 0, issued: 0, cancelled: 0, refunded: 0, unpaid: 0, partiallyPaid: 0 },
        recentCustomers: [],
        recentTickets: [],
        todayFollowUps: [],
      });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const myId = req.employee!.employeeId;

    let customerFilter: SQL | undefined;
    let noteFilter: SQL | undefined;
    let ticketFilter: SQL | undefined;

    if (role === "Supervisor") {
      const myCompanyId = req.employee!.companyId!;
      customerFilter = eq(customersTable.companyId, myCompanyId);
      noteFilter = sql`EXISTS (
        SELECT 1 FROM ${employeesTable} 
        WHERE ${employeesTable.id} = ${customerNotesTable.employeeId} 
        AND ${employeesTable.companyId} = ${myCompanyId}
      )`;
      ticketFilter = sql`EXISTS (
        SELECT 1 FROM ${employeesTable} 
        WHERE ${employeesTable.id} = ${ticketsTable.employeeId} 
        AND ${employeesTable.companyId} = ${myCompanyId}
      )`;
    } else if (role === "Employee") {
      customerFilter = eq(customersTable.assignedEmployeeId, myId);
      noteFilter = eq(customerNotesTable.employeeId, myId);
      ticketFilter = eq(ticketsTable.employeeId, myId);
    }
    // Administrator → no filter (sees everything)

    const [totalCustomersResult] = await db
      .select({ count: count() })
      .from(customersTable)
      .where(customerFilter);

    const [newTodayResult] = await db
      .select({ count: count() })
      .from(customersTable)
      .where(and(
        customerFilter,
        gte(customersTable.createdAt, todayStart),
        lt(customersTable.createdAt, todayEnd)
      ));

    const followUpsToday = await db
      .select({ count: count() })
      .from(customerNotesTable)
      .where(and(
        noteFilter,
        isNotNull(customerNotesTable.followUpDate),
        gte(customerNotesTable.followUpDate, todayStart),
        lt(customerNotesTable.followUpDate, todayEnd),
        eq(customerNotesTable.followUpStatus, "pending"),
      ));

    const missedFollowUps = await db
      .select({ count: count() })
      .from(customerNotesTable)
      .where(and(
        noteFilter,
        isNotNull(customerNotesTable.followUpDate),
        lt(customerNotesTable.followUpDate, todayStart),
        eq(customerNotesTable.followUpStatus, "pending"),
      ));

    const [totalTicketsResult] = await db
      .select({ count: count() })
      .from(ticketsTable)
      .where(ticketFilter);

    const ticketsByStatus = await db
      .select({ status: ticketsTable.ticketStatus, count: count() })
      .from(ticketsTable)
      .where(ticketFilter)
      .groupBy(ticketsTable.ticketStatus);

    const ticketsByPayment = await db
      .select({ status: ticketsTable.paymentStatus, count: count() })
      .from(ticketsTable)
      .where(ticketFilter)
      .groupBy(ticketsTable.paymentStatus);

    const customersByStatus = await db
      .select({ status: customersTable.status, count: count() })
      .from(customersTable)
      .where(customerFilter)
      .groupBy(customersTable.status);

    const revenueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(COALESCE(${ticketsTable.price}, 0)), 0)::text` })
      .from(ticketsTable)
      .where(and(
        ticketFilter,
        inArray(ticketsTable.ticketStatus, ["confirmed", "paid", "issued"])
      ));

    const totalRevenue = revenueResult[0]?.total ?? "0";

    const recentCustomers = await db
      .select()
      .from(customersTable)
      .where(customerFilter)
      .orderBy(sql`${customersTable.createdAt} desc`)
      .limit(5);

    const recentTickets = await db
      .select({ ticket: ticketsTable, customerName: customersTable.fullName })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .where(ticketFilter)
      .orderBy(sql`${ticketsTable.updatedAt} desc`)
      .limit(5);

    const todayFollowUpsDetail = await db
      .select({ note: customerNotesTable, customerName: customersTable.fullName, customerId: customersTable.id })
      .from(customerNotesTable)
      .leftJoin(customersTable, eq(customerNotesTable.customerId, customersTable.id))
      .where(and(
        noteFilter,
        isNotNull(customerNotesTable.followUpDate),
        gte(customerNotesTable.followUpDate, todayStart),
        lt(customerNotesTable.followUpDate, todayEnd),
      ))
      .orderBy(customerNotesTable.followUpDate)
      .limit(10);

    const statusMap = Object.fromEntries(ticketsByStatus.map((r) => [r.status, r.count]));
    const paymentMap = Object.fromEntries(ticketsByPayment.map((r) => [r.status, r.count]));
    const customerStatusMap = Object.fromEntries(customersByStatus.map((r) => [r.status, r.count]));

    res.json({
      customers: {
        total: totalCustomersResult?.count ?? 0,
        newToday: newTodayResult?.count ?? 0,
        followUpsToday: followUpsToday[0]?.count ?? 0,
        missedFollowUps: missedFollowUps[0]?.count ?? 0,
        byStatus: customerStatusMap,
      },
      totalRevenue,
      tickets: {
        total: totalTicketsResult?.count ?? 0,
        quoted: statusMap["quoted"] ?? 0,
        reserved: statusMap["reserved"] ?? 0,
        confirmed: statusMap["confirmed"] ?? 0,
        paid: statusMap["paid"] ?? 0,
        issued: statusMap["issued"] ?? 0,
        cancelled: statusMap["cancelled"] ?? 0,
        refunded: statusMap["refunded"] ?? 0,
        unpaid: paymentMap["unpaid"] ?? 0,
        partiallyPaid: paymentMap["partially_paid"] ?? 0,
      },
      recentCustomers,
      recentTickets: recentTickets.map((r) => ({ ...r.ticket, customerName: r.customerName })),
      todayFollowUps: todayFollowUpsDetail.map((r) => ({ ...r.note, customerName: r.customerName, customerId: r.customerId })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard stats");
    res.status(500).json({ error: "server_error", message: "Failed to get dashboard stats" });
  }
});

export default router;
