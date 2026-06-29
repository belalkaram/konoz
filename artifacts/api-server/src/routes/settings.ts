import { Router } from "express";
import { eq, inArray, gte, lte, and, sql } from "drizzle-orm";
import { db, systemSettingsTable, ticketsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

// ── Gemini API Key Settings ───────────────────────────────────────────────────

router.get("/settings/gemini", requireAdmin, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  try {
    const [row] = await db
      .select()
      .from(systemSettingsTable)
      .where(and(eq(systemSettingsTable.key, "gemini_api_key"), eq(systemSettingsTable.employeeId, employeeId)));
    // hasKey is true if stored in DB OR set via environment variable
    const hasKey = !!(row?.value) || !!(process.env.GEMINI_API_KEY);
    const source = row?.value ? "db" : (process.env.GEMINI_API_KEY ? "env" : null);
    res.json({ hasKey, source });
  } catch (err) {
    req.log.error({ err }, "Error fetching Gemini settings");
    res.status(500).json({ error: "server_error", message: "Failed to fetch Gemini settings" });
  }
});

router.put("/settings/gemini", requireAdmin, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    res.status(400).json({ error: "validation_error", message: "A valid Gemini API key is required" });
    return;
  }
  try {
    await db
      .insert(systemSettingsTable)
      .values({ key: "gemini_api_key", employeeId, value: apiKey.trim(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [systemSettingsTable.key, systemSettingsTable.employeeId],
        set: { value: apiKey.trim(), updatedAt: new Date() },
      });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error saving Gemini API key");
    res.status(500).json({ error: "server_error", message: "Failed to save Gemini API key" });
  }
});


const SmtpSettingsSchema = z.object({
  host: z.string().min(1),
  port: z.number(),
  user: z.string().min(1),
  pass: z.string().optional(),
  fromName: z.string().min(1),
});

router.get("/settings/email", requireAdmin, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  try {
    const keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_from_name"];
    const rows = await db.select().from(systemSettingsTable).where(and(inArray(systemSettingsTable.key, keys), eq(systemSettingsTable.employeeId, employeeId)));
    
    const settings: Record<string, string> = {};
    rows.forEach((r: any) => {
      settings[r.key] = r.value;
    });

    res.json({
      host: settings.smtp_host || process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(settings.smtp_port || process.env.SMTP_PORT || "587"),
      user: settings.smtp_user || process.env.SMTP_USER || "",
      fromName: settings.smtp_from_name || process.env.SMTP_FROM_NAME || "Konoz System",
      hasPass: !!(process.env.SMTP_PASS || (await db.select().from(systemSettingsTable).where(and(eq(systemSettingsTable.key, "smtp_pass"), eq(systemSettingsTable.employeeId, employeeId))))[0]),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching email settings");
    res.status(500).json({ error: "server_error", message: "Failed to fetch settings" });
  }
});

router.put("/settings/email", requireAdmin, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const parsed = SmtpSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  try {
    const updates = [
      { key: "smtp_host", value: parsed.data.host },
      { key: "smtp_port", value: parsed.data.port.toString() },
      { key: "smtp_user", value: parsed.data.user },
      { key: "smtp_from_name", value: parsed.data.fromName },
    ];

    if (parsed.data.pass) {
      updates.push({ key: "smtp_pass", value: parsed.data.pass });
    }

    for (const item of updates) {
      await db
        .insert(systemSettingsTable)
        .values({ ...item, employeeId, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [systemSettingsTable.key, systemSettingsTable.employeeId],
          set: { value: item.value, updatedAt: new Date() },
        });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error saving email settings");
    res.status(500).json({ error: "server_error", message: "Failed to save settings" });
  }
});

// ── WhatsApp Notification and Target Settings ─────────────────────────────────

const WhatsappNotificationSettingsSchema = z.object({
  enabledCustomer: z.boolean(),
  enabledTicket: z.boolean(),
  recipientType: z.enum(["main", "custom"]),
  customNumber: z.string().optional(),
  monthlyTarget: z.number().nonnegative(),
});

router.get("/settings/whatsapp-notifications", requireAdmin, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  try {
    const keys = [
      "whatsapp_notification_enabled_customer",
      "whatsapp_notification_enabled_ticket",
      "whatsapp_notification_recipient_type",
      "whatsapp_notification_custom_number",
      "whatsapp_monthly_profit_target",
    ];
    const rows = await db.select().from(systemSettingsTable).where(and(inArray(systemSettingsTable.key, keys), eq(systemSettingsTable.employeeId, employeeId)));
    
    const settings: Record<string, string> = {};
    rows.forEach((r: any) => {
      settings[r.key] = r.value;
    });

    res.json({
      enabledCustomer: settings.whatsapp_notification_enabled_customer === "true",
      enabledTicket: settings.whatsapp_notification_enabled_ticket === "true",
      recipientType: settings.whatsapp_notification_recipient_type || "main",
      customNumber: settings.whatsapp_notification_custom_number || "",
      monthlyTarget: parseFloat(settings.whatsapp_monthly_profit_target || "0"),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching WhatsApp notification settings");
    res.status(500).json({ error: "server_error", message: "Failed to fetch settings" });
  }
});

router.put("/settings/whatsapp-notifications", requireAdmin, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const parsed = WhatsappNotificationSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  try {
    const updates = [
      { key: "whatsapp_notification_enabled_customer", value: parsed.data.enabledCustomer ? "true" : "false" },
      { key: "whatsapp_notification_enabled_ticket", value: parsed.data.enabledTicket ? "true" : "false" },
      { key: "whatsapp_notification_recipient_type", value: parsed.data.recipientType },
      { key: "whatsapp_notification_custom_number", value: parsed.data.customNumber || "" },
      { key: "whatsapp_monthly_profit_target", value: parsed.data.monthlyTarget.toString() },
    ];

    for (const item of updates) {
      await db
        .insert(systemSettingsTable)
        .values({ ...item, employeeId, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [systemSettingsTable.key, systemSettingsTable.employeeId],
          set: { value: item.value, updatedAt: new Date() },
        });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error saving WhatsApp notification settings");
    res.status(500).json({ error: "server_error", message: "Failed to save settings" });
  }
});

router.get("/settings/target-progress", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  try {
    const [targetRow] = await db
      .select()
      .from(systemSettingsTable)
      .where(and(eq(systemSettingsTable.key, "whatsapp_monthly_profit_target"), eq(systemSettingsTable.employeeId, employeeId)));
    const monthlyTarget = parseFloat(targetRow?.value || "0");

    if (monthlyTarget <= 0) {
      res.json({ monthlyTarget: 0, totalAchieved: 0, percentage: 0, remaining: 0 });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const activeStatuses = ["quoted", "reserved", "confirmed", "paid", "issued"];
    const [profitSumResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(COALESCE(${ticketsTable.price}, 0) - COALESCE(${ticketsTable.costPrice}, 0)), 0)::text` })
      .from(ticketsTable)
      .where(
        and(
          gte(ticketsTable.createdAt, startOfMonth),
          lte(ticketsTable.createdAt, endOfMonth),
          inArray(ticketsTable.ticketStatus, activeStatuses as any)
        )
      );

    const totalAchieved = parseFloat(profitSumResult?.total || "0");
    const percentage = parseFloat(((totalAchieved / monthlyTarget) * 100).toFixed(1));
    const remaining = Math.max(0, monthlyTarget - totalAchieved);

    res.json({
      monthlyTarget,
      totalAchieved,
      percentage,
      remaining,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching target progress");
    res.status(500).json({ error: "server_error", message: "Failed to fetch target progress" });
  }
});

export default router;
