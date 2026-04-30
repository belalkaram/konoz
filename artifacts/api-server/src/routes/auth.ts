import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, employeesTable } from "@workspace/db";
import { createSession, deleteSession, SESSION_COOKIE_NAME, COOKIE_OPTIONS, CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS, getCsrfToken } from "../lib/sessions.js";
import { requireAuth } from "../middlewares/auth.js";

const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  pin: z.string().min(1, "PIN is required"),
});

const router = Router();

router.post("/auth/login", async (req, res) => {
  const ip = req.ip ?? "unknown";
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const { username, pin } = parsed.data;
  const normalizedUsername = username.toLowerCase().trim();

  try {
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.username, normalizedUsername));

    if (!employee || !employee.isActive) {
      req.log.warn({ event: "security:login_failure", username: normalizedUsername, ip, reason: employee ? "inactive" : "not_found" }, "Login failed");
      res.status(401).json({ error: "unauthorized", message: "Invalid username or PIN" });
      return;
    }

    const pinHash = employee.pinHash;
    let valid = false;

    if (pinHash.startsWith("$2")) {
      valid = await bcrypt.compare(pin, pinHash);
    } else {
      const { createHash } = await import("crypto");
      const sha256Hash = createHash("sha256").update(pin).digest("hex");
      if (sha256Hash === pinHash) {
        valid = true;
        const newHash = await bcrypt.hash(pin, 12);
        await db.update(employeesTable).set({ pinHash: newHash }).where(eq(employeesTable.id, employee.id));
        req.log.info({ event: "security:pin_upgraded", actorId: employee.id }, "Upgraded PIN hash from SHA-256 to bcrypt");
      }
    }

    if (!valid) {
      req.log.warn({ event: "security:login_failure", username: normalizedUsername, ip, reason: "wrong_pin" }, "Login failed");
      res.status(401).json({ error: "unauthorized", message: "Invalid username or PIN" });
      return;
    }

    const sessionToken = await createSession(employee.id, employee.role, employee.name, employee.companyId);
    const csrfToken = (await getCsrfToken(sessionToken))!;

    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

    req.log.info({ event: "security:login_success", actorId: employee.id, ip }, "Login successful");

    res.json({
      employee: {
        id: employee.id,
        name: employee.name,
        initials: employee.initials,
        role: employee.role,
        username: employee.username,
        companyId: employee.companyId,
      },
      csrfToken,
    });
  } catch (err) {
    req.log.error({ err }, "Error during login");
    res.status(500).json({ error: "server_error", message: "Failed to log in" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const token = req.signedCookies?.[SESSION_COOKIE_NAME] as string | undefined | false;
  if (token) {
    await deleteSession(token);
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
  req.log.info({ event: "security:logout", ip: req.ip }, "User logged out");
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const [employee] = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
        username: employeesTable.username,
      })
      .from(employeesTable)
      .where(eq(employeesTable.id, req.employee!.employeeId));

    if (!employee) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "unauthorized", message: "Session invalid" });
      return;
    }

    const sessionToken = req.signedCookies?.[SESSION_COOKIE_NAME] as string;
    const csrfToken = await getCsrfToken(sessionToken);
    if (csrfToken) {
      res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);
    }

    res.json({ employee, csrfToken });
  } catch (err) {
    req.log.error({ err }, "Error fetching /auth/me");
    res.status(500).json({ error: "server_error", message: "Failed to get session" });
  }
});

router.get("/auth/employees", async (req, res) => {
  try {
    const employees = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        initials: employeesTable.initials,
        role: employeesTable.role,
        username: employeesTable.username,
      })
      .from(employeesTable)
      .orderBy(employeesTable.name);

    res.json({ employees });
  } catch (err) {
    req.log.error({ err }, "Error listing employees");
    res.status(500).json({ error: "server_error", message: "Failed to list employees" });
  }
});

export default router;
