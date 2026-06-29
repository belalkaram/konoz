import type { Response } from "express";

interface ActiveConnection {
  employeeId: number;
  res: Response;
}

const activeConnections = new Set<ActiveConnection>();

export function registerNotificationConnection(employeeId: number, res: Response) {
  const connection = { employeeId, res };
  activeConnections.add(connection);

  // Set up headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial handshake/ok event
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  // Heartbeat to keep connection alive
  const interval = setInterval(() => {
    res.write(":\n\n");
  }, 20000);

  res.on("close", () => {
    clearInterval(interval);
    activeConnections.delete(connection);
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
