import { randomBytes } from "crypto";
import { eq, lt, gt, desc } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

export interface Session {
  employeeId: number;
  name: string;
  role: string;
  companyId: number | null;
  expiresAt: number;
  csrfToken: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function prune(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, Date.now()));
}

export async function createSession(employeeId: number, role: string, name: string, companyId: number | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await db.insert(sessionsTable).values({ token, employeeId, name, role, csrfToken, expiresAt, companyId });

  prune().catch(() => {});

  return token;
}

export async function validateSession(token: string): Promise<Session | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    return null;
  }
  return { employeeId: row.employeeId, name: row.name, role: row.role, companyId: row.companyId, expiresAt: row.expiresAt, csrfToken: row.csrfToken };
}

export async function getCsrfToken(sessionToken: string): Promise<string | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, sessionToken));
  if (!row || row.expiresAt < Date.now()) return null;
  return row.csrfToken;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export interface ActiveSessionRow {
  token: string;
  employeeId: number;
  name: string;
  role: string;
  companyId: number | null;
  createdAt: Date;
  expiresAt: number;
}

export async function getAllActiveSessions(): Promise<ActiveSessionRow[]> {
  const rows = await db
    .select({
      token: sessionsTable.token,
      employeeId: sessionsTable.employeeId,
      name: sessionsTable.name,
      role: sessionsTable.role,
      companyId: sessionsTable.companyId,
      createdAt: sessionsTable.createdAt,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .where(gt(sessionsTable.expiresAt, Date.now()))
    .orderBy(desc(sessionsTable.createdAt));
  return rows;
}

export const SESSION_COOKIE_NAME = "aeroops_sid";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  signed: true,
  maxAge: SESSION_TTL_MS,
  path: "/",
};

export const CSRF_COOKIE_NAME = "aeroops_csrf";

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS,
  path: "/",
};
