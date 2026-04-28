import { Router } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, employeesTable, customersTable, ticketsTable } from "@workspace/db";
import { requireAdmin, getSessionFromRequest } from "../middlewares/auth.js";

const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  initials: z.string().min(1, "Initials are required").max(5),
  role: z.enum(["Administrator", "Agent"], { errorMap: () => ({ message: "Role must be Administrator or Agent" }) }),
  username: z
    .string()
    .min(1, "Username is required")
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Username must be lowercase alphanumeric or underscore"),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, "PIN must be 4–8 digits"),
});

const UpdateEmployeeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    initials: z.string().min(1).max(5).optional(),
    role: z
      .enum(["Administrator", "Agent"], { errorMap: () => ({ message: "Role must be Administrator or Agent" }) })
      .optional(),
    username: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9_]+$/, "Username must be lowercase alphanumeric or underscore")
      .optional(),
    pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits").optional(),
  })
  .strict();

const router = Router();

router.get("/employees", async (req, res) => {
  try {
    const { includeInactive } = req.query as Record<string, string | undefined>;

    if (includeInactive === "true") {
      const session = getSessionFromRequest(req);
      if (!session) {
        res.status(401).json({ error: "unauthorized", message: "Authentication required" });
        return;
      }
      if (session.role !== "Administrator") {
        res.status(403).json({ error: "forbidden", message: "Administrator access required" });
        return;
      }

      const rows = await db
        .select({
          id: employeesTable.id,
          name: employeesTable.name,
          initials: employeesTable.initials,
          role: employeesTable.role,
          username: employeesTable.username,
          isActive: employeesTable.isActive,
          createdAt: employeesTable.createdAt,
          activeCustomers: sql<number>`(
            SELECT COUNT(*)::int FROM ${customersTable}
            WHERE ${customersTable.assignedEmployeeId} = ${employeesTable.id}
          )`,
          openTickets: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketsTable}
            WHERE ${ticketsTable.employeeId} = ${employeesTable.id}
          )`,
        })
        .from(employeesTable)
        .orderBy(asc(employeesTable.name));

      res.json({ employees: rows });
      return;
    }

    const rows = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
      })
      .from(employeesTable)
      .where(eq(employeesTable.isActive, true))
      .orderBy(asc(employeesTable.name));

    res.json({ employees: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing employees");
    res.status(500).json({ error: "server_error", message: "Failed to list employees" });
  }
});

router.post("/employees", requireAdmin, async (req, res) => {
  const parsed = CreateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const { name, initials, role, username, pin } = parsed.data;

  try {
    const [existing] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.username, username.toLowerCase().trim()));

    if (existing) {
      res.status(409).json({ error: "conflict", message: "Username already exists" });
      return;
    }

    const pinHashValue = await bcrypt.hash(pin, 12);

    const [employee] = await db
      .insert(employeesTable)
      .values({
        name,
        initials: initials.toUpperCase(),
        role,
        username: username.toLowerCase().trim(),
        pinHash: pinHashValue,
        isActive: true,
      })
      .returning({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
        username: employeesTable.username,
        isActive: employeesTable.isActive,
        createdAt: employeesTable.createdAt,
      });

    req.log.info({ event: "security:employee_created", actorId: req.employee?.employeeId, targetId: employee?.id, ip: req.ip }, "Employee created");
    res.status(201).json({ employee });
  } catch (err) {
    req.log.error({ err }, "Error creating employee");
    res.status(500).json({ error: "server_error", message: "Failed to create employee" });
  }
});

router.put("/employees/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid employee ID" });
    return;
  }

  const parsed = UpdateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { pin, username, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };

  if (pin) {
    updates.pinHash = await bcrypt.hash(pin, 12);
  }

  if (username) {
    const [existing] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.username, username.toLowerCase().trim()));

    if (existing && existing.id !== id) {
      res.status(409).json({ error: "conflict", message: "Username already taken" });
      return;
    }
    updates.username = username.toLowerCase().trim();
  }

  try {
    const [employee] = await db
      .update(employeesTable)
      .set(updates)
      .where(eq(employeesTable.id, id))
      .returning({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
        username: employeesTable.username,
        isActive: employeesTable.isActive,
        createdAt: employeesTable.createdAt,
      });

    if (!employee) {
      res.status(404).json({ error: "not_found", message: "Employee not found" });
      return;
    }

    req.log.info({ event: "security:employee_updated", actorId: req.employee?.employeeId, targetId: id, ip: req.ip }, "Employee updated");
    res.json({ employee });
  } catch (err) {
    req.log.error({ err }, "Error updating employee");
    res.status(500).json({ error: "server_error", message: "Failed to update employee" });
  }
});

router.patch("/employees/:id/deactivate", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid employee ID" });
    return;
  }

  try {
    const [employee] = await db
      .update(employeesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(employeesTable.id, id))
      .returning({ id: employeesTable.id, name: employeesTable.name, isActive: employeesTable.isActive });

    if (!employee) {
      res.status(404).json({ error: "not_found", message: "Employee not found" });
      return;
    }

    req.log.info({ event: "security:employee_deactivated", actorId: req.employee?.employeeId, targetId: id, ip: req.ip }, "Employee deactivated");
    res.json({ employee });
  } catch (err) {
    req.log.error({ err }, "Error deactivating employee");
    res.status(500).json({ error: "server_error", message: "Failed to deactivate employee" });
  }
});

router.patch("/employees/:id/activate", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid employee ID" });
    return;
  }

  try {
    const [employee] = await db
      .update(employeesTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(employeesTable.id, id))
      .returning({ id: employeesTable.id, name: employeesTable.name, isActive: employeesTable.isActive });

    if (!employee) {
      res.status(404).json({ error: "not_found", message: "Employee not found" });
      return;
    }

    res.json({ employee });
  } catch (err) {
    req.log.error({ err }, "Error activating employee");
    res.status(500).json({ error: "server_error", message: "Failed to activate employee" });
  }
});

export default router;
