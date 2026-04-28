import { randomBytes } from "crypto";

interface Session {
  employeeId: number;
  name: string;
  role: string;
  expiresAt: number;
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
  store.set(token, { employeeId, name, role, expiresAt: Date.now() + SESSION_TTL_MS });
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
