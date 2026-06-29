import { Router } from "express";
import { eq, desc, sql, asc } from "drizzle-orm";
import { db, notificationsTable, employeesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { registerNotificationConnection, sendRealTimeNotification, getOnlineEmployeeIds } from "../lib/notifications.js";

const router = Router();

// SSE Stream for the logged-in employee
router.get("/notifications/stream", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  await registerNotificationConnection(employeeId, res);
});

// Send a notification (Admin only)
router.post("/notifications", requireAdmin, async (req, res) => {
  const { receiverId, message, button1Label, button2Label } = req.body;

  if (!receiverId || !message || !button1Label || !button2Label) {
    res.status(400).json({ error: "validation_error", message: "Missing required fields" });
    return;
  }

  const senderId = req.employee!.employeeId;

  try {
    // 1. Save to database
    const [notification] = await db
      .insert(notificationsTable)
      .values({
        senderId,
        receiverId: Number(receiverId),
        message,
        button1Label,
        button2Label,
        status: "pending",
      })
      .returning();

    // 2. Fetch names
    const [receiver] = await db
      .select({ name: employeesTable.name })
      .from(employeesTable)
      .where(eq(employeesTable.id, Number(receiverId)));

    const notificationWithNames = {
      ...notification,
      receiverName: receiver?.name || "Unknown",
      senderName: req.employee!.name,
    };

    // 3. Trigger SSE real-time send
    const isOnline = sendRealTimeNotification(Number(receiverId), notificationWithNames);

    res.status(201).json({ success: true, notification: notificationWithNames, isOnline });
  } catch (err) {
    req.log.error({ err }, "Error sending notification");
    res.status(500).json({ error: "server_error", message: "Failed to send notification" });
  }
});

// Respond to a notification
router.post("/notifications/:id/respond", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { buttonClicked } = req.body;

  if (isNaN(id)) {
    res.status(400).json({ error: "validation_error", message: "Invalid notification ID" });
    return;
  }

  if (!buttonClicked) {
    res.status(400).json({ error: "validation_error", message: "buttonClicked is required" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Notification not found" });
      return;
    }

    // Verify the logged in employee is the receiver of the notification
    if (existing.receiverId !== req.employee!.employeeId) {
      res.status(403).json({ error: "forbidden", message: "You are not the receiver of this notification" });
      return;
    }

    const status = buttonClicked === "dismissed" ? "dismissed" : "responded";

    const [updated] = await db
      .update(notificationsTable)
      .set({
        clickedButton: buttonClicked,
        status,
        respondedAt: new Date(),
      })
      .where(eq(notificationsTable.id, id))
      .returning();

    res.json({ success: true, notification: updated });
  } catch (err) {
    req.log.error({ err }, "Error responding to notification");
    res.status(500).json({ error: "server_error", message: "Failed to submit response" });
  }
});

// Get history of notifications
router.get("/notifications/history", requireAuth, async (req, res) => {
  const { role, employeeId } = req.employee!;

  try {
    let query = db
      .select({
        id: notificationsTable.id,
        senderId: notificationsTable.senderId,
        receiverId: notificationsTable.receiverId,
        message: notificationsTable.message,
        button1Label: notificationsTable.button1Label,
        button2Label: notificationsTable.button2Label,
        clickedButton: notificationsTable.clickedButton,
        status: notificationsTable.status,
        createdAt: notificationsTable.createdAt,
        respondedAt: notificationsTable.respondedAt,
        senderName: sql<string>`(SELECT name FROM ${employeesTable} WHERE id = ${notificationsTable.senderId})`,
        receiverName: sql<string>`(SELECT name FROM ${employeesTable} WHERE id = ${notificationsTable.receiverId})`,
      })
      .from(notificationsTable);

    // If not Admin, show only notifications they received
    if (role !== "Administrator") {
      query = query.where(eq(notificationsTable.receiverId, employeeId)) as any;
    }

    const history = await query.orderBy(desc(notificationsTable.createdAt));
    res.json({ success: true, history });
  } catch (err) {
    req.log.error({ err }, "Error fetching notification history");
    res.status(500).json({ error: "server_error", message: "Failed to fetch notification history" });
  }
});

// Get online/offline status for all employees (Admin only)
router.get("/notifications/online-status", requireAdmin, async (req, res) => {
  try {
    const employees = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        role: employeesTable.role,
        isOnline: employeesTable.isOnline,
        lastSeenAt: employeesTable.lastSeenAt,
      })
      .from(employeesTable)
      .where(eq(employeesTable.isActive, true))
      .orderBy(asc(employeesTable.name));

    // Cross-check with live in-memory SSE connections for real-time accuracy
    const liveIds = new Set(getOnlineEmployeeIds());
    const enriched = employees.map(emp => ({
      ...emp,
      isOnline: liveIds.has(emp.id) || emp.isOnline,
    }));

    res.json({ success: true, employees: enriched });
  } catch (err) {
    req.log.error({ err }, "Error fetching online status");
    res.status(500).json({ error: "server_error", message: "Failed to fetch online status" });
  }
});

export default router;
