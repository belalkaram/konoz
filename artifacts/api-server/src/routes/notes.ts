import { Router } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, customerNotesTable, customersTable, insertCustomerNoteSchema, updateCustomerNoteSchema } from "@workspace/db";
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

router.get("/customers/:customerId/notes", requireAuth, async (req, res) => {
  const customerId = Number(req.params.customerId);
  if (isNaN(customerId)) {
    res.status(400).json({ error: "validation_error", message: "Invalid customer ID" });
    return;
  }
  try {
    const role = getRole(req);
    const myId = req.employee!.employeeId;
    let isAuthorized = role === "Administrator";

    if (!isAuthorized) {
      const [customer] = await db
        .select({ assignedEmployeeId: customersTable.assignedEmployeeId })
        .from(customersTable)
        .where(eq(customersTable.id, customerId));
      
      if (customer) {
        if (role === "Supervisor") {
          const teamIds = await getTeamEmployeeIds(myId);
          isAuthorized = teamIds.includes(customer.assignedEmployeeId!);
        } else {
          isAuthorized = customer.assignedEmployeeId === myId;
        }
      }
    }

    if (!isAuthorized) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }

    const notes = await db
      .select()
      .from(customerNotesTable)
      .where(eq(customerNotesTable.customerId, customerId))
      .orderBy(desc(customerNotesTable.createdAt));

    const now = new Date();
    const notesWithStatus = notes.map((note) => ({
      ...note,
      followUpStatus:
        note.followUpDate &&
        note.followUpDate < now &&
        note.followUpStatus === "pending"
          ? "missed"
          : note.followUpStatus,
    }));

    res.json({ notes: notesWithStatus });
  } catch (err) {
    req.log.error({ err }, "Error listing notes");
    res.status(500).json({ error: "server_error", message: "Failed to list notes" });
  }
});

router.post("/customers/:customerId/notes", requireAuth, async (req, res) => {
  const customerId = Number(req.params.customerId);
  if (isNaN(customerId)) {
    res.status(400).json({ error: "validation_error", message: "Invalid customer ID" });
    return;
  }

  const role = getRole(req);
  const myId = req.employee!.employeeId;
  let isAuthorized = role === "Administrator";

  if (!isAuthorized) {
    const [customer] = await db
      .select({ assignedEmployeeId: customersTable.assignedEmployeeId })
      .from(customersTable)
      .where(eq(customersTable.id, customerId));
    
    if (customer) {
      if (role === "Supervisor") {
        const teamIds = await getTeamEmployeeIds(myId);
        isAuthorized = teamIds.includes(customer.assignedEmployeeId!);
      } else {
        isAuthorized = customer.assignedEmployeeId === myId;
      }
    }
  }

  if (!isAuthorized) {
    res.status(404).json({ error: "not_found", message: "Customer not found" });
    return;
  }

  const employeeId = req.employee!.employeeId;
  const body = coerceDates({ ...req.body, customerId, employeeId }, "followUpDate");
  const parsed = insertCustomerNoteSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [note] = await db
      .insert(customerNotesTable)
      .values(parsed.data)
      .returning();

    await db
      .update(customersTable)
      .set({ lastContactedAt: new Date(), updatedAt: new Date() })
      .where(eq(customersTable.id, customerId));

    res.status(201).json({ note });
  } catch (err) {
    req.log.error({ err }, "Error creating note");
    res.status(500).json({ error: "server_error", message: "Failed to create note" });
  }
});

router.put("/notes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid note ID" });
    return;
  }

  const [existing] = await db
    .select({ employeeId: customerNotesTable.employeeId })
    .from(customerNotesTable)
    .where(eq(customerNotesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Note not found" });
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
    res.status(404).json({ error: "not_found", message: "Note not found" });
    return;
  }

  const parsed = updateCustomerNoteSchema.safeParse(coerceDates(req.body as Record<string, unknown>, "followUpDate"));
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [note] = await db
      .update(customerNotesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(customerNotesTable.id, id))
      .returning();
    if (!note) {
      res.status(404).json({ error: "not_found", message: "Note not found" });
      return;
    }
    res.json({ note });
  } catch (err) {
    req.log.error({ err }, "Error updating note");
    res.status(500).json({ error: "server_error", message: "Failed to update note" });
  }
});

router.delete("/notes/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid note ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(customerNotesTable)
      .where(eq(customerNotesTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Note not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting note");
    res.status(500).json({ error: "server_error", message: "Failed to delete note" });
  }
});

export default router;
