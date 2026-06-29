import type { Response } from "express";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface ActiveConnection {
  employeeId: number;
  res: Response;
}

const activeConnections = new Set<ActiveConnection>();

export function getOnlineEmployeeIds(): number[] {
  return [...new Set([...activeConnections].map(c => c.employeeId))];
}

export async function registerNotificationConnection(employeeId: number, res: Response) {
  const connection = { employeeId, res };
  activeConnections.add(connection);

  // Set up headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Mark employee as online in DB
  await db.update(employeesTable).set({
    isOnline: true,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(employeesTable.id, employeeId));

  // Send an initial handshake/ok event
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  // Heartbeat to keep connection alive and update lastSeenAt every 30s
  const interval = setInterval(async () => {
    try {
      res.write(":\n\n");
      // Update lastSeenAt as a heartbeat
      await db.update(employeesTable).set({ lastSeenAt: new Date() }).where(eq(employeesTable.id, employeeId));
    } catch {
      // connection may be closed
    }
  }, 30000);

  res.on("close", async () => {
    clearInterval(interval);
    activeConnections.delete(connection);

    // If no more connections for this employee, mark offline
    const remaining = [...activeConnections].filter(c => c.employeeId === employeeId);
    if (remaining.length === 0) {
      try {
        await db.update(employeesTable).set({
          isOnline: false,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(employeesTable.id, employeeId));
      } catch {
        // best effort
      }
    }
  });
}

export function sendRealTimeNotification(receiverId: number, data: any) {
  let sentCount = 0;
  for (const conn of activeConnections) {
    if (conn.employeeId === receiverId) {
      conn.res.write(`data: ${JSON.stringify({ type: "notification", payload: data })}\n\n`);
      sentCount++;
    }
  }
  return sentCount > 0;
}
