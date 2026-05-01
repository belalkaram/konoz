import { Router } from "express";
import { db, attendanceTable, leavesTable, employeesTable } from "@workspace/db";
import { eq, and, between, gte, lte, desc, inArray, notInArray } from "drizzle-orm";
import { requireHR } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

// Roles excluded from HR tracking
const EXCLUDED_ROLES = ["Administrator", "Supervisor"];

const AttendanceSchema = z.object({
  employeeId: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  status: z.string().default("Present"),
  notes: z.string().nullable().optional(),
});

const LeaveSchema = z.object({
  employeeId: z.number(),
  type: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().nullable().optional(),
  status: z.string().default("Approved"),
});

// GET /hr/employees — Employee + HR roles only (for dropdowns)
router.get("/hr/employees", requireHR, async (req, res) => {
  try {
    const employees = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
      })
      .from(employeesTable)
      .where(
        and(
          notInArray(employeesTable.role, EXCLUDED_ROLES),
          eq(employeesTable.isActive, true)
        )
      )
      .orderBy(employeesTable.name);

    res.json({ employees });
  } catch (err) {
    req.log.error({ err }, "Error fetching HR employees");
    res.status(500).json({ error: "server_error", message: "Failed to fetch employees" });
  }
});

// GET /hr/attendance
router.get("/hr/attendance", requireHR, async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    // Get eligible employee IDs (exclude admin/supervisor)
    const eligibleRows = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(notInArray(employeesTable.role, EXCLUDED_ROLES));
    const eligibleIds = eligibleRows.map((r) => r.id);

    if (eligibleIds.length === 0) {
      res.json({ attendance: [] });
      return;
    }

    const conditions: any[] = [inArray(attendanceTable.employeeId, eligibleIds)];

    if (startDate && endDate) {
      conditions.push(between(attendanceTable.date, startDate as string, endDate as string));
    } else if (startDate) {
      conditions.push(gte(attendanceTable.date, startDate as string));
    } else if (endDate) {
      conditions.push(lte(attendanceTable.date, endDate as string));
    }

    if (employeeId) {
      conditions.push(eq(attendanceTable.employeeId, parseInt(employeeId as string)));
    }

    const attendance = await db
      .select({
        id: attendanceTable.id,
        employeeId: attendanceTable.employeeId,
        employeeName: employeesTable.name,
        date: attendanceTable.date,
        checkIn: attendanceTable.checkIn,
        checkOut: attendanceTable.checkOut,
        status: attendanceTable.status,
        notes: attendanceTable.notes,
      })
      .from(attendanceTable)
      .innerJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceTable.date));

    res.json({ attendance });
  } catch (err) {
    req.log.error({ err }, "Error fetching attendance");
    res.status(500).json({ error: "server_error", message: "Failed to fetch attendance" });
  }
});

// POST /hr/attendance
router.post("/hr/attendance", requireHR, async (req, res) => {
  try {
    const parsed = AttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0].message });
      return;
    }

    const { employeeId, date } = parsed.data;

    // Verify target employee is not admin/supervisor
    const [target] = await db
      .select({ role: employeesTable.role })
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId));

    if (!target || EXCLUDED_ROLES.includes(target.role)) {
      res.status(403).json({ error: "forbidden", message: "Cannot log attendance for Administrator or Supervisor" });
      return;
    }

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, date)));

    if (existing) {
      const [updated] = await db
        .update(attendanceTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(attendanceTable.id, existing.id))
        .returning();
      res.json({ attendance: updated });
      return;
    }

    const [inserted] = await db.insert(attendanceTable).values(parsed.data).returning();
    res.json({ attendance: inserted });
  } catch (err) {
    req.log.error({ err }, "Error saving attendance");
    res.status(500).json({ error: "server_error", message: "Failed to save attendance" });
  }
});

// GET /hr/leaves
router.get("/hr/leaves", requireHR, async (req, res) => {
  try {
    const { employeeId } = req.query;

    const eligibleRows = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(notInArray(employeesTable.role, EXCLUDED_ROLES));
    const eligibleIds = eligibleRows.map((r) => r.id);

    if (eligibleIds.length === 0) {
      res.json({ leaves: [] });
      return;
    }

    const conditions: any[] = [inArray(leavesTable.employeeId, eligibleIds)];

    if (employeeId) {
      conditions.push(eq(leavesTable.employeeId, parseInt(employeeId as string)));
    }

    const leaves = await db
      .select({
        id: leavesTable.id,
        employeeId: leavesTable.employeeId,
        employeeName: employeesTable.name,
        type: leavesTable.type,
        startDate: leavesTable.startDate,
        endDate: leavesTable.endDate,
        status: leavesTable.status,
        reason: leavesTable.reason,
      })
      .from(leavesTable)
      .innerJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
      .where(and(...conditions))
      .orderBy(desc(leavesTable.startDate));

    res.json({ leaves });
  } catch (err) {
    req.log.error({ err }, "Error fetching leaves");
    res.status(500).json({ error: "server_error", message: "Failed to fetch leaves" });
  }
});

// POST /hr/leaves
router.post("/hr/leaves", requireHR, async (req, res) => {
  try {
    const parsed = LeaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0].message });
      return;
    }

    // Verify target employee is not admin/supervisor
    const [target] = await db
      .select({ role: employeesTable.role })
      .from(employeesTable)
      .where(eq(employeesTable.id, parsed.data.employeeId));

    if (!target || EXCLUDED_ROLES.includes(target.role)) {
      res.status(403).json({ error: "forbidden", message: "Cannot log leave for Administrator or Supervisor" });
      return;
    }

    const [inserted] = await db.insert(leavesTable).values(parsed.data).returning();
    res.json({ leave: inserted });
  } catch (err) {
    req.log.error({ err }, "Error saving leave");
    res.status(500).json({ error: "server_error", message: "Failed to save leave" });
  }
});

// DELETE /hr/attendance/:id
router.delete("/hr/attendance/:id", requireHR, async (req, res) => {
  try {
    await db.delete(attendanceTable).where(eq(attendanceTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting attendance");
    res.status(500).json({ error: "server_error", message: "Failed to delete attendance" });
  }
});

// DELETE /hr/leaves/:id
router.delete("/hr/leaves/:id", requireHR, async (req, res) => {
  try {
    await db.delete(leavesTable).where(eq(leavesTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting leave");
    res.status(500).json({ error: "server_error", message: "Failed to delete leave" });
  }
});

export default router;
