import { randomBytes } from "crypto";

interface Session {
  employeeId: number;
  name: string;
  role: string;
  expiresAt: number;
  csrfToken: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const store = new Map<string, Session>();

function prune(): void {
  const now = Date.now();
  for (const [token, session] of store) {
    if (session.expiresAt < now) store.delete(token);
  }
}

export function createSession(employeeId: number, role: string, name: string): string {
  prune();
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  store.set(token, { employeeId, name, role, expiresAt: Date.now() + SESSION_TTL_MS, csrfToken });
  return token;
}

export function validateSession(token: string): Session | null {
  const session = store.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    store.delete(token);
    return null;
  }
  return session;
}

export function getCsrfToken(sessionToken: string): string | null {
  const session = store.get(sessionToken);
  if (!session || session.expiresAt < Date.now()) return null;
  return session.csrfToken;
}

export function deleteSession(token: string): void {
  store.delete(token);
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
