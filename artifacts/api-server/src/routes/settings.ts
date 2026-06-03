import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, systemSettingsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const SmtpSettingsSchema = z.object({
  host: z.string().min(1),
  port: z.number(),
  user: z.string().min(1),
  pass: z.string().optional(),
  fromName: z.string().min(1),
});

router.get("/settings/email", requireAdmin, async (req, res) => {
  try {
    const keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_from_name"];
    const rows = await db.select().from(systemSettingsTable).where(inArray(systemSettingsTable.key, keys));
    
    const settings: Record<string, string> = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    res.json({
      host: settings.smtp_host || process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(settings.smtp_port || process.env.SMTP_PORT || "587"),
      user: settings.smtp_user || process.env.SMTP_USER || "",
      fromName: settings.smtp_from_name || process.env.SMTP_FROM_NAME || "Konoz System",
      hasPass: !!(process.env.SMTP_PASS || (await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "smtp_pass")))[0]),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching email settings");
    res.status(500).json({ error: "server_error", message: "Failed to fetch settings" });
  }
});

router.put("/settings/email", requireAdmin, async (req, res) => {
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
        .values({ ...item, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: systemSettingsTable.key,
          set: { value: item.value, updatedAt: new Date() },
        });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error saving email settings");
    res.status(500).json({ error: "server_error", message: "Failed to save settings" });
  }
});

export default router;
