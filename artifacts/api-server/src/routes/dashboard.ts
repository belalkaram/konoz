import { Router } from "express";
import { eq, gte, lt, and, isNotNull, count, sql } from "drizzle-orm";
import { db, customersTable, customerNotesTable, ticketsTable, paymentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [totalCustomersResult] = await db
      .select({ count: count() })
      .from(customersTable);

    const [newTodayResult] = await db
      .select({ count: count() })
      .from(customersTable)
      .where(and(gte(customersTable.createdAt, todayStart), lt(customersTable.createdAt, todayEnd)));

    const followUpsToday = await db
      .select({ count: count() })
      .from(customerNotesTable)
      .where(
        and(
          isNotNull(customerNotesTable.followUpDate),
          gte(customerNotesTable.followUpDate, todayStart),
          lt(customerNotesTable.followUpDate, todayEnd),
          eq(customerNotesTable.followUpStatus, "pending"),
        )
      );

    const missedFollowUps = await db
      .select({ count: count() })
      .from(customerNotesTable)
      .where(
        and(
          isNotNull(customerNotesTable.followUpDate),
          lt(customerNotesTable.followUpDate, todayStart),
          eq(customerNotesTable.followUpStatus, "pending"),
        )
      );

    const [totalTicketsResult] = await db
      .select({ count: count() })
      .from(ticketsTable);

    const ticketsByStatus = await db
      .select({
        status: ticketsTable.ticketStatus,
        count: count(),
      })
      .from(ticketsTable)
      .groupBy(ticketsTable.ticketStatus);

    const ticketsByPayment = await db
      .select({
        status: ticketsTable.paymentStatus,
        count: count(),
      })
      .from(ticketsTable)
      .groupBy(ticketsTable.paymentStatus);

    const customersByStatus = await db
      .select({
        status: customersTable.status,
        count: count(),
      })
      .from(customersTable)
      .groupBy(customersTable.status);

    const revenueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${paymentsTable.amount}), 0)::text` })
      .from(paymentsTable)
      .where(eq(paymentsTable.paymentStatus, "paid"));

    const totalRevenue = revenueResult[0]?.total ?? "0";

    const recentCustomers = await db
      .select()
      .from(customersTable)
      .orderBy(sql`${customersTable.createdAt} desc`)
      .limit(5);

    const recentTickets = await db
      .select({
        ticket: ticketsTable,
        customerName: customersTable.fullName,
      })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .orderBy(sql`${ticketsTable.updatedAt} desc`)
      .limit(5);

    const todayFollowUpsDetail = await db
      .select({
        note: customerNotesTable,
        customerName: customersTable.fullName,
        customerId: customersTable.id,
      })
      .from(customerNotesTable)
      .leftJoin(customersTable, eq(customerNotesTable.customerId, customersTable.id))
      .where(
        and(
          isNotNull(customerNotesTable.followUpDate),
          gte(customerNotesTable.followUpDate, todayStart),
          lt(customerNotesTable.followUpDate, todayEnd),
        )
      )
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
      recentTickets: recentTickets.map((r) => ({
        ...r.ticket,
        customerName: r.customerName,
      })),
      todayFollowUps: todayFollowUpsDetail.map((r) => ({
        ...r.note,
        customerName: r.customerName,
        customerId: r.customerId,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard stats");
    res.status(500).json({ error: "server_error", message: "Failed to get dashboard stats" });
  }
});

export default router;
