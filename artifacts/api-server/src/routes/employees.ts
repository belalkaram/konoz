import { Router, type RequestHandler } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { db, employeesTable, customersTable, ticketsTable } from "@workspace/db";
import { validateSession } from "../lib/sessions.js";

const router = Router();

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

interface CreateEmployeeBody {
  name?: string;
  initials?: string;
  role?: string;
  username?: string;
  pin?: string;
}

interface UpdateEmployeeBody {
  name?: string;
  initials?: string;
  role?: string;
  username?: string;
  pin?: string;
}

function validateCreate(body: CreateEmployeeBody): string | null {
  if (!body.name?.trim()) return "Name is required";
  if (!body.initials?.trim()) return "Initials are required";
  if (!body.role?.trim()) return "Role is required";
  if (!body.username?.trim()) return "Username is required";
  if (!/^[a-z0-9_]+$/.test(body.username)) return "Username must be lowercase alphanumeric or underscore";
  if (!body.pin) return "PIN is required";
  if (!/^\d{4,8}$/.test(body.pin)) return "PIN must be 4–8 digits";
  return null;
}

function validateUpdate(body: UpdateEmployeeBody): string | null {
  if (body.username !== undefined && !/^[a-z0-9_]+$/.test(body.username)) return "Username must be lowercase alphanumeric or underscore";
  if (body.pin !== undefined && !/^\d{4,8}$/.test(body.pin)) return "PIN must be 4–8 digits";
  return null;
}

const requireAdmin: RequestHandler = async (req, res, next) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  const token = auth.slice(7);
  const session = validateSession(token);

  if (!session) {
    res.status(401).json({ error: "unauthorized", message: "Session expired or invalid. Please log in again." });
    return;
  }

  if (session.role !== "Administrator") {
    res.status(403).json({ error: "forbidden", message: "Administrator access required" });
    return;
  }

  next();
};

router.get("/employees", async (req, res) => {
  try {
    const { includeInactive } = req.query as Record<string, string | undefined>;

    if (includeInactive === "true") {
      const auth = req.headers["authorization"];
      if (!auth?.startsWith("Bearer ")) {
        res.status(401).json({ error: "unauthorized", message: "Authentication required" });
        return;
      }
      const session = validateSession(auth.slice(7));
      if (!session) {
        res.status(401).json({ error: "unauthorized", message: "Session expired or invalid. Please log in again." });
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
            AND ${customersTable.status} NOT IN ('cancelled', 'lost')
          )`,
          openTickets: sql<number>`(
            SELECT COUNT(*)::int FROM ${ticketsTable}
            WHERE ${ticketsTable.employeeId} = ${employeesTable.id}
            AND ${ticketsTable.ticketStatus} NOT IN ('cancelled', 'refunded', 'issued')
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
  const body = req.body as CreateEmployeeBody;
  const validationError = validateCreate(body);
  if (validationError) {
    res.status(400).json({ error: "validation_error", message: validationError });
    return;
  }

  const { name, initials, role, username, pin } = body as Required<CreateEmployeeBody>;

  try {
    const [existing] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.username, username.toLowerCase().trim()));

    if (existing) {
      res.status(409).json({ error: "conflict", message: "Username already exists" });
      return;
    }

    const [employee] = await db
      .insert(employeesTable)
      .values({
        name,
        initials: initials.toUpperCase(),
        role,
        username: username.toLowerCase().trim(),
        pinHash: hashPin(pin),
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

  const body = req.body as UpdateEmployeeBody;
  const validationError = validateUpdate(body);
  if (validationError) {
    res.status(400).json({ error: "validation_error", message: validationError });
    return;
  }

  const { pin, username, ...rest } = body;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };

  if (pin) {
    updates.pinHash = hashPin(pin);
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
