import type { Request, RequestHandler } from "express";
import { validateSession, SESSION_COOKIE_NAME } from "../lib/sessions.js";

export interface EmployeeSession {
  employeeId: number;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      employee?: EmployeeSession;
    }
  }
}

export function getSessionFromRequest(req: Request): EmployeeSession | null {
  const token = req.signedCookies?.[SESSION_COOKIE_NAME] as string | undefined | false;
  if (!token) return null;
  const session = validateSession(token);
  if (!session) return null;
  return { employeeId: session.employeeId, name: session.name, role: session.role };
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    req.log?.warn({ ip: req.ip, route: req.path }, "security:unauthorized_access");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  req.employee = session;
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const session = getSessionFromRequest(req);
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
  req.employee = session;
  next();
};
