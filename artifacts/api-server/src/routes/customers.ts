import { Router } from "express";
import { eq, ilike, or, sql, and, desc, inArray } from "drizzle-orm";
import { db, customersTable, ticketsTable, insertCustomerSchema, insertTicketSchema, updateCustomerSchema } from "@workspace/db";
import { requireAuth, requireAdmin, getSessionFromRequest, getTeamEmployeeIds } from "../middlewares/auth.js";

const router = Router();

function getRole(req: import("express").Request): string {
  return req.employee?.role || "Employee";
}

router.get("/customers", requireAuth, async (req, res) => {
  try {
    const { search, status, assignedEmployeeId } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(customersTable.fullName, `%${search}%`),
          ilike(customersTable.phone ?? sql`''`, `%${search}%`),
          ilike(customersTable.email ?? sql`''`, `%${search}%`),
        )
      );
    }
    if (status) {
      conditions.push(eq(customersTable.status, status as typeof customersTable.status._.data));
    }
    
    const role = getRole(req);
    const myId = req.employee!.employeeId;

    if (role === "Administrator") {
      if (assignedEmployeeId) {
        conditions.push(eq(customersTable.assignedEmployeeId, Number(assignedEmployeeId)));
      }
    } else if (role === "Supervisor") {
      conditions.push(eq(customersTable.companyId, req.employee!.companyId!));
      if (assignedEmployeeId) {
        conditions.push(eq(customersTable.assignedEmployeeId, Number(assignedEmployeeId)));
      }
    } else {
      // Employee
      conditions.push(eq(customersTable.companyId, req.employee!.companyId!));
      conditions.push(
        or(
          eq(customersTable.assignedEmployeeId, myId),
          eq(customersTable.createdByEmployeeId, myId)
        )!
      );
    }

    const baseQuery = db
      .select({
        id: customersTable.id,
        fullName: customersTable.fullName,
        phone: customersTable.phone,
        whatsapp: customersTable.whatsapp,
        email: customersTable.email,
        nationality: customersTable.nationality,
        passportNumber: customersTable.passportNumber,
        nationalId: customersTable.nationalId,
        address: customersTable.address,
        source: customersTable.source,
        status: customersTable.status,
        assignedEmployeeId: customersTable.assignedEmployeeId,
        lastContactedAt: customersTable.lastContactedAt,
        createdAt: customersTable.createdAt,
        updatedAt: customersTable.updatedAt,
        latestTicketId: sql<number | null>`(
          SELECT id FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        pnr: sql<string | null>`(
          SELECT pnr FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        bookingDate: sql<string | null>`(
          SELECT COALESCE(booking_date::text, created_at::text) FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        costPrice: sql<string | null>`(
          SELECT cost_price FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        sellingPrice: sql<string | null>`(
          SELECT price FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        ticketCurrency: sql<string | null>`(
          SELECT currency FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        travelDate: sql<string | null>`(
          SELECT departure_datetime::text FROM tickets WHERE customer_id = ${customersTable.id}
          ORDER BY created_at DESC, id DESC LIMIT 1
        )`,
        uploadedByName: sql<string | null>`(
          SELECT name FROM employees WHERE id = ${customersTable.createdByEmployeeId}
        )`,
      })
      .from(customersTable);

    const customers = conditions.length
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0]! : and(...(conditions as [ReturnType<typeof eq>])))
          .orderBy(desc(customersTable.createdAt))
      : await baseQuery.orderBy(desc(customersTable.createdAt));

    res.json({ customers });
  } catch (err) {
    req.log.error({ err }, "Error listing customers");
    res.status(500).json({ error: "server_error", message: "Failed to list customers" });
  }
});

router.post("/customers", requireAuth, async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const role = getRole(req);
  const myId = req.employee!.employeeId;

  const serverControlled = {
    ...body,
    createdByEmployeeId: myId,
    assignedEmployeeId: body.assignedEmployeeId ?? myId,
    companyId: req.employee!.companyId,
  };

  const parsed = insertCustomerSchema.safeParse(serverControlled);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const customer = await db.transaction(async (tx) => {
      const [newCustomer] = await tx
        .insert(customersTable)
        .values(parsed.data as any)
        .returning();

      const { pnr, bookingDate, travelDate, costPrice, ticketPrice } = body;
      if (pnr || ticketPrice || travelDate) {
        await (tx.insert(ticketsTable) as any).values({
          customerId: newCustomer.id,
          employeeId: newCustomer.assignedEmployeeId,
          pnr: (pnr as string) || null,
          bookingDate: bookingDate ? new Date(bookingDate as string) : null,
          departureDatetime: travelDate ? new Date(travelDate as string) : null,
          price: (ticketPrice as string) || "0",
          costPrice: (costPrice as string) || "0",
          ticketStatus: "quoted",
          paymentStatus: "unpaid",
          currency: "USD",
        });
      }
      return newCustomer;
    });

    res.status(201).json({ customer });
  } catch (err) {
    req.log.error({ err }, "Error creating customer");
    res.status(500).json({ error: "server_error", message: "Failed to create customer" });
  }
});

router.post("/customers/import", requireAuth, async (req, res) => {
  const rows = req.body as Array<{
    fullName: string;
    phone?: string;
    passportNumber?: string;
    flightRoute?: string;
    travelDate?: string;
    pnr?: string;
    airline?: string;
    costPrice?: number;
    price?: number;
    paymentMethod?: string;
    bookingDate?: string;
  }>;

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "validation_error", message: "No rows provided" });
    return;
  }

  const session = await getSessionFromRequest(req);
  const importerEmployeeId = session?.employeeId ?? null;

  const results: Array<{ customerName: string; success: boolean; error?: string }> = [];

  for (const row of rows) {
    try {
      if (!row.fullName?.trim()) {
        results.push({ customerName: row.fullName || "(blank)", success: false, error: "Customer name is required" });
        continue;
      }

      let customerId: number;
      const passportNumber = row.passportNumber?.trim() || undefined;

      if (row.phone?.trim()) {
        const existing = await db
          .select({ id: customersTable.id, assignedEmployeeId: customersTable.assignedEmployeeId })
          .from(customersTable)
          .where(eq(customersTable.phone, row.phone.trim()))
          .limit(1);
        if (existing.length > 0) {
          customerId = existing[0]!.id;
          const updates: Record<string, unknown> = {};
          if (passportNumber) updates.passportNumber = passportNumber;
          if (importerEmployeeId && !existing[0]!.assignedEmployeeId) {
            updates.assignedEmployeeId = importerEmployeeId;
          }
          if (Object.keys(updates).length > 0) {
            await db.update(customersTable).set(updates).where(eq(customersTable.id, customerId));
          }
        } else {
          const [newCustomer] = await db
            .insert(customersTable)
            .values({
              fullName: row.fullName.trim(),
              phone: row.phone.trim(),
              passportNumber,
              status: "booked",
              ...(importerEmployeeId ? { assignedEmployeeId: importerEmployeeId } : {}),
            })
            .returning({ id: customersTable.id });
          customerId = newCustomer!.id;
        }
      } else {
        const [newCustomer] = await db
          .insert(customersTable)
          .values({
            fullName: row.fullName.trim(),
            passportNumber,
            status: "booked",
            ...(importerEmployeeId ? { assignedEmployeeId: importerEmployeeId } : {}),
          })
          .returning({ id: customersTable.id });
        customerId = newCustomer!.id;
      }

      const ticketData: Record<string, unknown> = {
        customerId,
        ticketStatus: "issued",
        paymentStatus: row.price != null ? "paid" : "unpaid",
        currency: "KWD",
        ...(importerEmployeeId ? { employeeId: importerEmployeeId } : {}),
      };
      if (row.flightRoute) ticketData.flightRoute = row.flightRoute;
      if (row.pnr) ticketData.pnr = row.pnr;
      if (row.airline) ticketData.airline = row.airline;
      if (row.costPrice != null) ticketData.costPrice = String(row.costPrice);
      if (row.price != null) ticketData.price = String(row.price);
      if (row.travelDate) {
        const d = new Date(row.travelDate);
        if (!isNaN(d.getTime())) ticketData.departureDatetime = d;
      }
      if (row.bookingDate) ticketData.bookingDate = row.bookingDate;
      if (row.paymentMethod) ticketData.notes = `Payment method: ${row.paymentMethod}`;

      let ticketParsed = insertTicketSchema.safeParse(ticketData);
      if (!ticketParsed.success) {
        const { bookingDate: _bd, departureDatetime: _dep, ...minimalData } = ticketData;
        const fallback1 = insertTicketSchema.safeParse({ ...minimalData, ...(typeof _dep !== "undefined" ? { departureDatetime: _dep } : {}) });
        if (fallback1.success) {
          const inserted = await db.insert(ticketsTable).values(fallback1.data as any).returning({ id: ticketsTable.id });
          if (inserted[0]) {
            if (typeof _bd === "string" && _bd) {
              await db.update(ticketsTable).set({ bookingDate: _bd }).where(eq(ticketsTable.id, inserted[0].id));
            }
          }
          results.push({ customerName: row.fullName, success: true });
          continue;
        }
        const fallback2 = insertTicketSchema.safeParse(minimalData);
        if (fallback2.success) {
          const inserted = await db.insert(ticketsTable).values(fallback2.data as any).returning({ id: ticketsTable.id });
          if (inserted[0]) {
            if (typeof _bd === "string" && _bd) {
              await db.update(ticketsTable).set({ bookingDate: _bd }).where(eq(ticketsTable.id, inserted[0].id));
            }
          }
          results.push({ customerName: row.fullName, success: true });
          continue;
        }
      }
      if (ticketParsed.success) {
        await db.insert(ticketsTable).values(ticketParsed.data as any);
      }

      results.push({ customerName: row.fullName, success: true });
    } catch (err: unknown) {
      results.push({ customerName: row.fullName, success: false, error: String(err) });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  res.json({ results, succeeded, total: rows.length });
});

router.get("/customers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid customer ID" });
    return;
  }
  try {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, id));
    if (!customer) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    const role = getRole(req);
    const myId = req.employee!.employeeId;
    const myCompanyId = req.employee!.companyId;
    let isAuthorized = role === "Administrator";
    
    if (!isAuthorized) {
      if (role === "Supervisor") {
        isAuthorized = customer.companyId === myCompanyId;
      } else {
        isAuthorized = (customer.assignedEmployeeId === myId || customer.createdByEmployeeId === myId) && customer.companyId === myCompanyId;
      }
    }

    if (!isAuthorized) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    res.json({ customer });
  } catch (err) {
    req.log.error({ err }, "Error getting customer");
    res.status(500).json({ error: "server_error", message: "Failed to get customer" });
  }
});

router.put("/customers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid customer ID" });
    return;
  }
  const parsed = updateCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [existing] = await db
      .select({ id: customersTable.id, assignedEmployeeId: customersTable.assignedEmployeeId })
      .from(customersTable)
      .where(eq(customersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    const role = getRole(req);
    const myId = req.employee!.employeeId;
    let isAuthorized = role === "Administrator";

    if (!isAuthorized) {
      const teamIds = await getTeamEmployeeIds(myId);
      isAuthorized = teamIds.includes(existing.assignedEmployeeId!);
    }

    if (!isAuthorized) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    const updateData = (role === "Administrator" || role === "Supervisor")
      ? parsed.data
      : (({ assignedEmployeeId: _aei, ...rest }) => rest)(parsed.data as Record<string, unknown>) as typeof parsed.data;
    const [customer] = await db
      .update(customersTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(customersTable.id, id))
      .returning();
    if (!customer) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    res.json({ customer });
  } catch (err) {
    req.log.error({ err }, "Error updating customer");
    res.status(500).json({ error: "server_error", message: "Failed to update customer" });
  }
});

router.delete("/customers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid customer ID" });
    return;
  }
  try {
    const linked = await db
      .select({ id: ticketsTable.id })
      .from(ticketsTable)
      .where(eq(ticketsTable.customerId, id))
      .limit(1);
    if (linked.length > 0) {
      res.status(409).json({
        error: "conflict",
        message: "Cannot delete customer with existing tickets. Remove tickets first.",
      });
      return;
    }
    const [deleted] = await db
      .delete(customersTable)
      .where(eq(customersTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting customer");
    res.status(500).json({ error: "server_error", message: "Failed to delete customer" });
  }
});

export default router;
