import { Router } from "express";
import { eq, and, desc, isNotNull, SQL, inArray } from "drizzle-orm";
import { db, remindersTable, customerNotesTable, customersTable, insertReminderSchema, updateReminderSchema } from "@workspace/db";
import { requireAuth, getTeamEmployeeIds } from "../middlewares/auth.js";

const router = Router();

function getRole(req: import("express").Request): string {
  return req.employee?.role || "Employee";
}

function coerceDates(body: Record<string, unknown>, ...fields: string[]) {
  const result = { ...body };
  for (const field of fields) {
    if (result[field] === "") {
      result[field] = null;
    } else if (result[field] && typeof result[field] === "string") {
      const d = new Date(result[field] as string);
      result[field] = isNaN(d.getTime()) ? null : d;
    }
  }
  return result;
}

router.get("/reminders", requireAuth, async (req, res) => {
  try {
    const { status, employeeId } = req.query as Record<string, string | undefined>;

    const conditions: SQL[] = [];
    if (status) conditions.push(eq(remindersTable.status, status as "pending" | "done" | "missed"));
    const role = getRole(req);
    const myId = req.employee!.employeeId;

    if (role === "Administrator") {
      if (employeeId) {
        conditions.push(eq(remindersTable.employeeId, Number(employeeId)));
      }
    } else if (role === "Supervisor") {
      const teamIds = await getTeamEmployeeIds(myId);
      conditions.push(inArray(remindersTable.employeeId, teamIds));
    } else {
      // Employee
      conditions.push(eq(remindersTable.employeeId, myId));
    }

    const rows = await db
      .select({
        reminder: remindersTable,
        customerName: customersTable.fullName,
        customerPhone: customersTable.phone,
      })
      .from(remindersTable)
      .leftJoin(customersTable, eq(remindersTable.customerId, customersTable.id))
      .where(conditions.length > 0 ? and(...(conditions as [SQL])) : undefined)
      .orderBy(desc(remindersTable.reminderDate));

    const reminders = rows.map((r) => ({
      ...r.reminder,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
    }));

    res.json({ reminders });
  } catch (err) {
    req.log.error({ err }, "Error listing reminders");
    res.status(500).json({ error: "server_error", message: "Failed to list reminders" });
  }
});

router.post("/reminders", requireAuth, async (req, res) => {
  const body = { ...req.body, employeeId: req.employee!.employeeId };
  const parsed = insertReminderSchema.safeParse(coerceDates(body as Record<string, unknown>, "reminderDate"));
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [reminder] = await db.insert(remindersTable).values(parsed.data as any).returning();
    res.status(201).json({ reminder });
  } catch (err) {
    req.log.error({ err }, "Error creating reminder");
    res.status(500).json({ error: "server_error", message: "Failed to create reminder" });
  }
});

router.put("/reminders/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid reminder ID" });
    return;
  }
  const parsed = updateReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const status = parsed.data.status;
  if (!status) {
    res.status(400).json({ error: "validation_error", message: "status is required" });
    return;
  }
  try {
    const [existing] = await db
      .select({ id: remindersTable.id, employeeId: remindersTable.employeeId })
      .from(remindersTable)
      .where(eq(remindersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Reminder not found" });
      return;
    }
    const role = getRole(req);
    const myId = req.employee!.employeeId;
    let isAuthorized = role === "Administrator";

    if (!isAuthorized) {
      if (role === "Supervisor") {
        const teamIds = await getTeamEmployeeIds(myId);
        isAuthorized = teamIds.includes(existing.employeeId!);
      } else {
        isAuthorized = existing.employeeId === myId;
      }
    }

    if (!isAuthorized) {
      res.status(404).json({ error: "not_found", message: "Reminder not found" });
      return;
    }
    const [reminder] = await db
      .update(remindersTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(remindersTable.id, id))
      .returning();
    if (!reminder) {
      res.status(404).json({ error: "not_found", message: "Reminder not found" });
      return;
    }
    res.json({ reminder });
  } catch (err) {
    req.log.error({ err }, "Error updating reminder status");
    res.status(500).json({ error: "server_error", message: "Failed to update reminder" });
  }
});

router.get("/followups", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const role = getRole(req);
    const myId = req.employee!.employeeId;

    const conditions: SQL[] = [isNotNull(customerNotesTable.followUpDate)];
    
    if (role === "Administrator") {
      // No extra condition
    } else if (role === "Supervisor") {
      const teamIds = await getTeamEmployeeIds(myId);
      conditions.push(inArray(customerNotesTable.employeeId, teamIds));
    } else {
      // Employee
      conditions.push(eq(customerNotesTable.employeeId, myId));
    }

    const notes = await db
      .select({
        note: customerNotesTable,
        customerName: customersTable.fullName,
        customerPhone: customersTable.phone,
        customerId: customersTable.id,
      })
      .from(customerNotesTable)
      .leftJoin(customersTable, eq(customerNotesTable.customerId, customersTable.id))
      .where(and(...(conditions as [SQL])))
      .orderBy(desc(customerNotesTable.followUpDate));

    const enriched = notes.map((r) => {
      const isOverdue =
        r.note.followUpDate &&
        r.note.followUpDate < now &&
        r.note.followUpStatus === "pending";
      return {
        ...r.note,
        followUpStatus: isOverdue ? "missed" : r.note.followUpStatus,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerId: r.customerId,
      };
    });

    const pending = enriched.filter((n) => n.followUpStatus === "pending");
    const missed = enriched.filter((n) => n.followUpStatus === "missed");
    const done = enriched.filter((n) => n.followUpStatus === "done");
    const today = enriched.filter(
      (n) => n.followUpDate && n.followUpDate >= todayStart && n.followUpDate < todayEnd
    );
    const upcoming = enriched.filter(
      (n) => n.followUpDate && n.followUpDate >= todayEnd && n.followUpStatus === "pending"
    );

    res.json({ pending, missed, done, today, upcoming, all: enriched });
  } catch (err) {
    req.log.error({ err }, "Error listing follow-ups");
    res.status(500).json({ error: "server_error", message: "Failed to list follow-ups" });
  }
});

export default router;
