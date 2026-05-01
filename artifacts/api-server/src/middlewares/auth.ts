import type { Request, RequestHandler } from "express";
import { validateSession, SESSION_COOKIE_NAME } from "../lib/sessions.js";

import { db, employeesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

export interface EmployeeSession {
  employeeId: number;
  name: string;
  role: string;
  companyId: number | null;
  isDeactivated?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      employee?: EmployeeSession;
    }
  }
}

export async function getSessionFromRequest(req: Request): Promise<EmployeeSession | null> {
  const token = req.signedCookies?.[SESSION_COOKIE_NAME] as string | undefined | false;
  if (!token) return null;
  const session = await validateSession(token);
  if (!session) return null;

  // Real-time check if employee is still active and get current role
  const [dbEmployee] = await db
    .select({ isActive: employeesTable.isActive, role: employeesTable.role, companyId: employeesTable.companyId })
    .from(employeesTable)
    .where(eq(employeesTable.id, session.employeeId));

  if (!dbEmployee || !dbEmployee.isActive) {
    return { ...session, isDeactivated: true };
  }

  return { employeeId: session.employeeId, name: session.name, role: dbEmployee.role, companyId: dbEmployee.companyId };
}

/**
 * Returns an array of employee IDs that a given employee is authorized to see.
 * For a Supervisor, this includes themselves and their team.
 */
export async function getTeamEmployeeIds(employeeId: number): Promise<number[]> {
  const team = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(or(
      eq(employeesTable.id, employeeId),
      eq(employeesTable.supervisorId, employeeId)
    ));
  
  return team.map(t => t.id);
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    req.log?.warn({ ip: req.ip, route: req.path }, "security:unauthorized_access");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  if (session.isDeactivated) {
    req.log?.warn({ actorId: session.employeeId, ip: req.ip }, "security:deactivated_access_attempt");
    res.status(403).json({ 
      error: "forbidden", 
      message: "Your account has been deactivated. Please contact your supervisor to reactivate your account." 
    });
    return;
  }
  req.employee = session;
  next();
};

export const requireSupervisorOrAdmin: RequestHandler = async (req, res, next) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    req.log?.warn({ ip: req.ip, route: req.path }, "security:unauthorized_access");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  if (session.role !== "Administrator" && session.role !== "Supervisor") {
    console.error(`[requireSupervisorOrAdmin] User ${session.username || session.employeeId} denied. Role is: "${session.role}"`);
    req.log?.warn({ actorId: session.employeeId, role: session.role, ip: req.ip, route: req.path, result: "forbidden" }, "security:forbidden_access");
    res.status(403).json({ error: "forbidden", message: "Supervisor or Administrator access required" });
    return;
  }
  if (session.isDeactivated) {
    req.log?.warn({ actorId: session.employeeId, ip: req.ip }, "security:deactivated_access_attempt");
    res.status(403).json({ 
      error: "forbidden", 
      message: "Your account has been deactivated. Please contact your supervisor to reactivate your account." 
    });
    return;
  }
  req.employee = session;
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    req.log?.warn({ ip: req.ip, route: req.path }, "security:unauthorized_access");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  if (session.role !== "Administrator") {
    req.log?.warn({ actorId: session.employeeId, ip: req.ip, route: req.path, result: "forbidden" }, "security:forbidden_access");
    res.status(403).json({ error: "forbidden", message: "Administrator access required" });
    return;
  }
  if (session.isDeactivated) {
    req.log?.warn({ actorId: session.employeeId, ip: req.ip }, "security:deactivated_access_attempt");
    res.status(403).json({ 
      error: "forbidden", 
      message: "Your account has been deactivated. Please contact your supervisor to reactivate your account." 
    });
    return;
  }
  req.employee = session;
  next();
};
export const requireHR: RequestHandler = async (req, res, next) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    req.log?.warn({ ip: req.ip, route: req.path }, "security:unauthorized_access");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  if (session.role !== "Administrator" && session.role !== "HR") {
    req.log?.warn({ actorId: session.employeeId, ip: req.ip, route: req.path, result: "forbidden" }, "security:forbidden_access");
    res.status(403).json({ error: "forbidden", message: "HR or Administrator access required" });
    return;
  }
  if (session.isDeactivated) {
    req.log?.warn({ actorId: session.employeeId, ip: req.ip }, "security:deactivated_access_attempt");
    res.status(403).json({ 
      error: "forbidden", 
      message: "Your account has been deactivated. Please contact your supervisor to reactivate your account." 
    });
    return;
  }
  req.employee = session;
  next();
};
