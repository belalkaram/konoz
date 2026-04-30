import { Router } from "express";
import { eq, desc, and, sum, inArray } from "drizzle-orm";
import { db, ticketsTable, ticketStatusHistoryTable, paymentsTable, customersTable, insertTicketSchema, updateTicketSchema, insertPaymentSchema } from "@workspace/db";
import { requireAuth, requireAdmin, getTeamEmployeeIds } from "../middlewares/auth.js";

const router = Router();

function getRole(req: import("express").Request): string {
  return req.employee?.role || "Employee";
}

function coerceDates(body: Record<string, unknown>, ...fields: string[]) {
  const result = { ...body };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = new Date(result[field] as string);
    }
  }
  return result;
}

router.get("/tickets", requireAuth, async (req, res) => {
  try {
    const { customerId, ticketStatus, paymentStatus, employeeId } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (customerId) conditions.push(eq(ticketsTable.customerId, Number(customerId)));
    if (ticketStatus) conditions.push(eq(ticketsTable.ticketStatus, ticketStatus as typeof ticketsTable.ticketStatus._.data));
    if (paymentStatus) conditions.push(eq(ticketsTable.paymentStatus, paymentStatus as typeof ticketsTable.paymentStatus._.data));
    const role = getRole(req);
    const myId = req.employee!.employeeId;

    if (role === "Administrator") {
      if (employeeId) {
        conditions.push(eq(ticketsTable.employeeId, Number(employeeId)));
      }
    } else if (role === "Supervisor") {
      const teamIds = await getTeamEmployeeIds(myId);
      if (employeeId) {
        const targetId = Number(employeeId);
        if (teamIds.includes(targetId)) {
          conditions.push(eq(ticketsTable.employeeId, targetId));
        } else {
          conditions.push(inArray(ticketsTable.employeeId, teamIds));
        }
      } else {
        conditions.push(inArray(ticketsTable.employeeId, teamIds));
      }
    } else {
      // Employee
      conditions.push(eq(ticketsTable.employeeId, myId));
    }

    const rows = await db
      .select({
        ticket: ticketsTable,
        customerName: customersTable.fullName,
        customerPhone: customersTable.phone,
      })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .where(conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>])) : undefined)
      .orderBy(desc(ticketsTable.createdAt));

    const tickets = rows.map((r) => ({
      ...r.ticket,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
    }));

    res.json({ tickets });
  } catch (err) {
    req.log.error({ err }, "Error listing tickets");
    res.status(500).json({ error: "server_error", message: "Failed to list tickets" });
  }
});

router.post("/tickets", requireAuth, async (req, res) => {
  const body = coerceDates(req.body as Record<string, unknown>, "departureDatetime", "arrivalDatetime");
  const role = getRole(req);
  const serverControlled = (role === "Administrator" || role === "Supervisor")
    ? body
    : { ...body, employeeId: req.employee!.employeeId };
  const parsed = insertTicketSchema.safeParse(serverControlled);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [ticket] = await db.insert(ticketsTable).values(parsed.data as any).returning();

    await db.insert(ticketStatusHistoryTable).values({
      ticketId: ticket!.id,
      oldStatus: null,
      newStatus: ticket!.ticketStatus,
      changedBy: req.employee?.name ?? "system",
    });

    req.log.info({ event: "security:ticket_created", actorId: req.employee?.employeeId, targetId: ticket?.id, ip: req.ip }, "Ticket created");
    res.status(201).json({ ticket });
  } catch (err) {
    req.log.error({ err }, "Error creating ticket");
    res.status(500).json({ error: "server_error", message: "Failed to create ticket" });
  }
});

router.get("/tickets/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ticket ID" });
    return;
  }
  try {
    const [row] = await db
      .select({
        ticket: ticketsTable,
        customerName: customersTable.fullName,
        customerPhone: customersTable.phone,
        customerEmail: customersTable.email,
      })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .where(eq(ticketsTable.id, id));

    if (!row) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }

    const role = getRole(req);
    const myId = req.employee!.employeeId;
    let isAuthorized = role === "Administrator";
    
    if (!isAuthorized) {
      const teamIds = await getTeamEmployeeIds(myId);
      isAuthorized = teamIds.includes(row.ticket.employeeId!);
    }

    if (!isAuthorized) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }

    const history = await db
      .select()
      .from(ticketStatusHistoryTable)
      .where(eq(ticketStatusHistoryTable.ticketId, id))
      .orderBy(ticketStatusHistoryTable.createdAt);

    const payments = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.ticketId, id))
      .orderBy(paymentsTable.createdAt);

    res.json({
      ticket: {
        ...row.ticket,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
      },
      history,
      payments,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting ticket");
    res.status(500).json({ error: "server_error", message: "Failed to get ticket" });
  }
});

router.put("/tickets/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ticket ID" });
    return;
  }
  const parsed = updateTicketSchema.safeParse(coerceDates(req.body as Record<string, unknown>, "departureDatetime", "arrivalDatetime"));
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }

    const role = getRole(req);
    const myId = req.employee!.employeeId;
    let isAuthorized = role === "Administrator";

    if (!isAuthorized) {
      const teamIds = await getTeamEmployeeIds(myId);
      isAuthorized = teamIds.includes(existing.employeeId!);
    }

    if (!isAuthorized) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }

    const updateData = (role === "Administrator" || role === "Supervisor")
      ? parsed.data
      : (({ employeeId: _eid, ...rest }) => rest)(parsed.data as Record<string, unknown>) as typeof parsed.data;
    const [ticket] = await db
      .update(ticketsTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(ticketsTable.id, id))
      .returning();

    if (parsed.data.ticketStatus && parsed.data.ticketStatus !== existing.ticketStatus) {
      await db.insert(ticketStatusHistoryTable).values({
        ticketId: id,
        oldStatus: existing.ticketStatus,
        newStatus: parsed.data.ticketStatus,
        changedBy: req.employee?.name ?? "employee",
      });
    }

    res.json({ ticket });
  } catch (err) {
    req.log.error({ err }, "Error updating ticket");
    res.status(500).json({ error: "server_error", message: "Failed to update ticket" });
  }
});

router.delete("/tickets/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ticket ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(ticketsTable)
      .where(eq(ticketsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }
    req.log.info({ event: "security:ticket_deleted", actorId: req.employee?.employeeId, targetId: id, ip: req.ip }, "Ticket deleted");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting ticket");
    res.status(500).json({ error: "server_error", message: "Failed to delete ticket" });
  }
});

async function handleAddPayment(
  ticketId: number,
  body: Record<string, unknown>,
  req: import("express").Request,
  res: import("express").Response,
  log: import("pino").Logger
) {
  const parsed = insertPaymentSchema.safeParse({ ...body, ticketId });
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [existing] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }

    if (getRole(req) !== "Administrator" && existing.employeeId !== req.employee!.employeeId) {
      res.status(404).json({ error: "not_found", message: "Ticket not found" });
      return;
    }

    const [payment] = await db.insert(paymentsTable).values(parsed.data as any).returning();

    const [totals] = await db
      .select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(eq(paymentsTable.ticketId, ticketId));

    const totalPaid = parseFloat(totals?.total ?? "0");
    const ticketPrice = parseFloat(existing.price ?? "0");

    let newPaymentStatus: "unpaid" | "partially_paid" | "paid" | "refunded" = "unpaid";
    if (totalPaid <= 0) {
      newPaymentStatus = "unpaid";
    } else if (ticketPrice > 0 && totalPaid >= ticketPrice) {
      newPaymentStatus = "paid";
    } else {
      newPaymentStatus = "partially_paid";
    }

    await db
      .update(ticketsTable)
      .set({ paymentStatus: newPaymentStatus, updatedAt: new Date() })
      .where(eq(ticketsTable.id, ticketId));

    log.info({ event: "security:payment_created", actorId: req.employee?.employeeId, ticketId, ip: req.ip }, "Payment created");
    res.status(201).json({ payment, paymentStatus: newPaymentStatus });
  } catch (err) {
    log.error({ err }, "Error adding payment");
    res.status(500).json({ error: "server_error", message: "Failed to add payment" });
  }
}

router.post("/payments", requireAuth, async (req, res) => {
  const ticketId = Number((req.body as Record<string, unknown>).ticketId);
  if (isNaN(ticketId)) {
    res.status(400).json({ error: "validation_error", message: "ticketId is required" });
    return;
  }
  await handleAddPayment(ticketId, req.body as Record<string, unknown>, req, res, req.log);
});

router.post("/tickets/:id/payments", requireAuth, async (req, res) => {
  const ticketId = Number(req.params.id);
  if (isNaN(ticketId)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ticket ID" });
    return;
  }
  await handleAddPayment(ticketId, req.body as Record<string, unknown>, req, res, req.log);
});


export default router;
