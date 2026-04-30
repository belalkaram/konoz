import { Router } from "express";
import { eq, asc, sql, or, and } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, employeesTable, customersTable, ticketsTable } from "@workspace/db";
import { requireAdmin, requireSupervisorOrAdmin, getSessionFromRequest, getTeamEmployeeIds } from "../middlewares/auth.js";

const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  initials: z.string().min(1, "Initials are required").max(5),
  role: z.enum(["Administrator", "Employee", "Supervisor"], { errorMap: () => ({ message: "Role must be Administrator, Supervisor or Employee" }) }),
  username: z
    .string()
    .min(1, "Username is required")
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Username must be lowercase alphanumeric or underscore"),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, "PIN must be 4–8 digits"),
  supervisorId: z.number().nullable().optional(),
  companyId: z.number().nullable().optional(),
  branchId: z.number().nullable().optional(),
});

const UpdateEmployeeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    initials: z.string().min(1).max(5).optional(),
    role: z
      .enum(["Administrator", "Employee", "Supervisor"], { errorMap: () => ({ message: "Role must be Administrator, Supervisor or Employee" }) })
      .optional(),
    username: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9_]+$/, "Username must be lowercase alphanumeric or underscore")
      .optional(),
    pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits").optional(),
    supervisorId: z.number().nullable().optional(),
    companyId: z.number().nullable().optional(),
    branchId: z.number().nullable().optional(),
  })
  .strict();

const router = Router();

router.get("/employees", async (req, res) => {
  try {
    const { includeInactive } = req.query as Record<string, string | undefined>;
    const session = await getSessionFromRequest(req);
    const role = session?.role || "Employee";
    const myId = session?.employeeId;

    if (includeInactive === "true") {
      if (!session) {
        res.status(401).json({ error: "unauthorized", message: "Authentication required" });
        return;
      }
      if (role !== "Administrator" && role !== "Supervisor") {
        res.status(403).json({ error: "forbidden", message: "Supervisor or Administrator access required" });
        return;
      }

      const conditions = [];
      if (role === "Supervisor") {
        conditions.push(eq(employeesTable.companyId, session!.companyId!));
      } else if (role === "Administrator") {
        // No company filter for global admin
      } else {
        conditions.push(or(eq(employeesTable.id, myId!), eq(employeesTable.supervisorId, myId!)));
      }

      const rows = await db
        .select({
          id: employeesTable.id,
          name: employeesTable.name,
          initials: employeesTable.initials,
          role: employeesTable.role,
          username: employeesTable.username,
          isActive: employeesTable.isActive,
          supervisorId: employeesTable.supervisorId,
          createdAt: employeesTable.createdAt,
          activeCustomers: sql<number>`(
            SELECT COUNT(*)::int FROM ${customersTable}
            WHERE ${customersTable.assignedEmployeeId} = ${employeesTable.id}
            AND ${customersTable.status} NOT IN ('cancelled', 'lost')
          )`,
          openTickets: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketsTable}
            WHERE ${ticketsTable.employeeId} = ${employeesTable.id}
            AND ${ticketsTable.ticketStatus} NOT IN ('issued', 'cancelled', 'refunded')
          )`,
        })
        .from(employeesTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
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

router.post("/employees", requireSupervisorOrAdmin, async (req, res) => {
  const parsed = CreateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const { name, initials, role, username, pin, supervisorId, companyId, branchId } = parsed.data;
  const session = req.employee!;

  // If Supervisor, they can only create users in their own company
  const targetCompanyId = session.role === "Supervisor" ? session.companyId : companyId;

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
        supervisorId: supervisorId ?? null,
        companyId: targetCompanyId,
        branchId: branchId ?? null,
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

router.put("/employees/:id", requireSupervisorOrAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid employee ID" });
    return;
  }

  const [existingTarget] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existingTarget) {
    res.status(404).json({ error: "not_found", message: "Employee not found" });
    return;
  }

  const session = req.employee!;
  if (session.role === "Supervisor" && existingTarget.companyId !== session.companyId) {
    res.status(403).json({ error: "forbidden", message: "You can only manage employees in your own company" });
    return;
  }

  const parsed = UpdateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { pin, username, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };

  if (session.role === "Supervisor") {
    // Supervisor cannot change company
    delete updates.companyId;
  }

  if (pin) {
    updates.pinHash = await bcrypt.hash(pin, 12);
  }

  if (username) {
    const [existingUsername] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.username, username.toLowerCase().trim()));

    if (existingUsername && existingUsername.id !== id) {
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

router.patch("/employees/:id/deactivate", requireSupervisorOrAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid employee ID" });
    return;
  }

  const [existingTarget] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existingTarget) {
    res.status(404).json({ error: "not_found", message: "Employee not found" });
    return;
  }

  const session = req.employee!;
  if (session.role === "Supervisor" && existingTarget.companyId !== session.companyId) {
    res.status(403).json({ error: "forbidden", message: "You can only manage employees in your own company" });
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

router.patch("/employees/:id/activate", requireSupervisorOrAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid employee ID" });
    return;
  }

  const [existingTarget] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existingTarget) {
    res.status(404).json({ error: "not_found", message: "Employee not found" });
    return;
  }

  const session = req.employee!;
  if (session.role === "Supervisor" && existingTarget.companyId !== session.companyId) {
    res.status(403).json({ error: "forbidden", message: "You can only manage employees in your own company" });
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
