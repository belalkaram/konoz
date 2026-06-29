import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, whatsappCampaignsTable, whatsappCampaignRecipientsTable, whatsappInstancesTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { WhatsappService } from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_RECIPIENTS = 150;
const AI_DAILY_LIMIT = 2;

// Arabic spam keywords that WhatsApp/SMS policies flag as potential spam
const SPAM_KEYWORDS = [
  "ربح مضمون", "عرض لن يتكرر", "اربح الآن", "مجاني تماماً",
  "مجاني تمامًا", "اضغط الآن", "فرصة ذهبية", "مضمون 100%",
  "كسب سريع", "دخل إضافي مضمون"
];
const OPT_OUT_PHRASES = ["للإلغاء", "لإيقاف الرسائل", "لإلغاء الاشتراك", "رد بـ إيقاف"];
const OPT_OUT_SUFFIX = "\n\nللإلغاء أرسل كلمة (إيقاف)";

function sanitizeVariant(text: string): { ok: boolean; cleaned: string; reason?: string } {
  const lowerText = text.toLowerCase();
  for (const kw of SPAM_KEYWORDS) {
    if (text.includes(kw)) {
      return { ok: false, cleaned: text, reason: `يحتوي على كلمة ممنوعة: "${kw}"` };
    }
  }
  const hasOptOut = OPT_OUT_PHRASES.some(p => text.includes(p));
  return { ok: true, cleaned: hasOptOut ? text : text + OPT_OUT_SUFFIX };
}

// Per-employee AI rate-limit: stored in system_settings as JSON
async function checkAndIncrementAiUsage(employeeId: number): Promise<{ allowed: boolean; remaining: number }> {
  const settingKey = `gemini_usage_${employeeId}`;
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;

  const [row] = await db
    .select()
    .from(systemSettingsTable)
    .where(and(eq(systemSettingsTable.key, settingKey), eq(systemSettingsTable.employeeId, employeeId)));

  let usage: { count: number; resetAt: number } = { count: 0, resetAt: now + windowMs };
  if (row) {
    try { usage = JSON.parse(row.value); } catch { /* corrupt, reset */ }
    if (now > usage.resetAt) {
      usage = { count: 0, resetAt: now + windowMs };
    }
  }

  if (usage.count >= AI_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  usage.count += 1;
  await db
    .insert(systemSettingsTable)
    .values({ key: settingKey, employeeId, value: JSON.stringify(usage), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [systemSettingsTable.key, systemSettingsTable.employeeId],
      set: { value: JSON.stringify(usage), updatedAt: new Date() },
    });

  return { allowed: true, remaining: AI_DAILY_LIMIT - usage.count };
}

// ── AI Message Generation ────────────────────────────────────────────────────
router.post("/whatsapp/generate-messages", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { prompt, count } = req.body as { prompt?: string; count?: number };

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return res.status(400).json({ error: "validation_error", message: "يجب إدخال برومبت أو فكرة الرسالة" });
  }
  const variantCount = Math.min(Math.max(parseInt(String(count ?? 5)), 5), 50);

  // Rate limit check
  const { allowed, remaining } = await checkAndIncrementAiUsage(employeeId);
  if (!allowed) {
    return res.status(429).json({
      error: "rate_limit",
      message: `لقد تجاوزت الحد اليومي (${AI_DAILY_LIMIT} طلبات/24 ساعة). يرجى المحاولة لاحقاً.`
    });
  }

  // Get Gemini API key — DB first, then env fallback
  const [keyRow] = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "gemini_api_key"));

  const geminiApiKey = keyRow?.value || process.env.GEMINI_API_KEY || "";

  if (!geminiApiKey) {
    return res.status(400).json({
      error: "no_api_key",
      message: "لم يتم إعداد مفتاح Gemini API. يرجى إضافته من إعدادات النظام أو ملف .env (GEMINI_API_KEY)."
    });
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const systemPrompt = `أنت مساعد تسويق متخصص في كتابة رسائل WhatsApp الاحترافية باللغة العربية.
اكتب بالضبط ${variantCount} صيغة مختلفة لرسالة WhatsApp بناءً على الفكرة التالية.
قواعد مهمة:
- كل رسالة يجب أن تكون طبيعية وصادقة ومناسبة للإرسال عبر واتساب
- لا تستخدم أبداً عبارات مبالغة مثل: "ربح مضمون"، "عرض لن يتكرر"، "اضغط الآن"، "مجاني تماماً"
- يجب أن تكون كل رسالة مختلفة في الأسلوب والتركيب
- الطول المناسب: 2-5 جمل لكل رسالة
- استجب بـ JSON array فقط من النصوص، مثال: ["رسالة 1", "رسالة 2"]

الفكرة: ${prompt.trim()}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, errText }, "Gemini API error");

      // Return specific Arabic error messages based on status code
      if (response.status === 429) {
        return res.status(502).json({
          error: "gemini_quota_exceeded",
          message: "⚠️ تجاوزت الحد المسموح به في مفتاح Gemini API المجاني. يرجى الانتظار أو الحصول على مفتاح جديد من aistudio.google.com"
        });
      } else if (response.status === 401 || response.status === 403) {
        return res.status(502).json({
          error: "gemini_invalid_key",
          message: "❌ مفتاح Gemini API غير صالح أو منتهي الصلاحية. يرجى تحديثه من إعدادات الواتساب."
        });
      } else if (response.status === 404) {
        return res.status(502).json({
          error: "gemini_model_not_found",
          message: "❌ موديل Gemini غير متاح مع هذا المفتاح. يرجى التأكد من أن المفتاح مفعّل على Google AI Studio."
        });
      }
      return res.status(502).json({
        error: "gemini_error",
        message: `❌ فشل الاتصال بـ Gemini API (${response.status}). تحقق من صحة المفتاح في aistudio.google.com`
      });
    }

    const geminiData = await response.json() as any;
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Try to parse JSON array from the response
    let variants: string[] = [];
    try {
      const jsonMatch = rawText.match(/\[.*\]/s);
      if (jsonMatch) {
        variants = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback: split by numbered list
      variants = rawText
        .split(/\n(?=\d+[.\-])/)  
        .map((s: string) => s.replace(/^\d+[.\-\s]+/, "").trim())
        .filter((s: string) => s.length > 10);
    }

    // Sanitize variants
    const sanitized = variants
      .slice(0, variantCount)
      .map(v => sanitizeVariant(v))
      .filter(r => r.ok)
      .map(r => r.cleaned);

    if (sanitized.length === 0) {
      return res.status(422).json({
        error: "no_valid_variants",
        message: "لم يتم توليد صيغ صالحة. يرجى تعديل البرومبت وإعادة المحاولة."
      });
    }

    return res.json({ variants: sanitized, usageLeft: remaining });
  } catch (err) {
    req.log.error({ err }, "Error calling Gemini API");
    return res.status(500).json({ error: "server_error", message: "حدث خطأ أثناء الاتصال بـ Gemini. يرجى المحاولة لاحقاً." });
  }
});


const getInstanceName = (employeeId: number) => `emp_${employeeId}`;

/**
 * Create a new campaign and start sending
 */
router.post("/whatsapp/campaigns", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { name, messageTemplate, numbers, timeGapMin, timeGapMax, batchSize, scheduledAt, maxMessages } = req.body;

  if (!name || !messageTemplate || !numbers || !Array.isArray(numbers)) {
    return res.status(400).json({ error: "validation_error", message: "Name, template, and numbers array are required" });
  }

  const instanceName = getInstanceName(employeeId);

  try {
    const state = await WhatsappService.getConnectionState(instanceName);
    if (state?.instance?.state !== "open") {
      return res.status(400).json({ error: "not_connected", message: "WhatsApp instance is not connected" });
    }

    // ── Custom recipient cap (max MAX_RECIPIENTS) ───────────────────────────
    const targetLimit = maxMessages && typeof maxMessages === "number" && maxMessages > 0
      ? Math.min(maxMessages, MAX_RECIPIENTS)
      : MAX_RECIPIENTS;
    const originalCount = numbers.length;
    const cappedNumbers: string[] = numbers.slice(0, targetLimit);
    const wasTruncated = originalCount > targetLimit;

    let initialStatus = "running";
    let parsedDate: Date | null = null;
    
    if (scheduledAt) {
      parsedDate = new Date(scheduledAt);
      if (parsedDate.getTime() > Date.now()) {
        initialStatus = "scheduled";
      } else {
        parsedDate = null;
      }
    }

    const templateDbValue = Array.isArray(messageTemplate)
      ? JSON.stringify(messageTemplate)
      : String(messageTemplate);

    // 1. Create Campaign
    const [campaign] = await db.insert(whatsappCampaignsTable).values({
      employeeId,
      name,
      messageTemplate: templateDbValue,
      timeGapMin: timeGapMin || 5,
      timeGapMax: timeGapMax || 10,
      batchSize: batchSize || 10,
      status: initialStatus,
      scheduledAt: parsedDate,
    }).returning();

    // 2. Create Recipients (capped)
    const recipientsData = cappedNumbers.map((phone: string) => ({
      campaignId: campaign.id,
      phoneNumber: phone,
      status: "pending",
    }));

    await db.insert(whatsappCampaignRecipientsTable).values(recipientsData);

    // 3. Trigger async sending loop
    if (initialStatus === "running") {
      triggerCampaign(campaign.id, employeeId);
    }

    return res.json({ campaign, truncated: wasTruncated, originalCount, acceptedCount: cappedNumbers.length });
  } catch (err) {
    req.log.error({ err }, "Error creating campaign");
    return res.status(500).json({ error: "server_error", message: "Failed to create campaign" });
  }
});

/**
 * List campaigns for the current employee
 */
router.get("/whatsapp/campaigns", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;

  try {
    const campaigns = await db
      .select({
        id: whatsappCampaignsTable.id,
        name: whatsappCampaignsTable.name,
        status: whatsappCampaignsTable.status,
        createdAt: whatsappCampaignsTable.createdAt,
        total: sql<number>`count(${whatsappCampaignRecipientsTable.id})`,
        sent: sql<number>`count(case when ${whatsappCampaignRecipientsTable.status} = 'sent' then 1 end)`,
        delivered: sql<number>`count(case when ${whatsappCampaignRecipientsTable.status} = 'delivered' then 1 end)`,
        read: sql<number>`count(case when ${whatsappCampaignRecipientsTable.status} = 'read' then 1 end)`,
        failed: sql<number>`count(case when ${whatsappCampaignRecipientsTable.status} = 'failed' then 1 end)`,
      })
      .from(whatsappCampaignsTable)
      .leftJoin(whatsappCampaignRecipientsTable, eq(whatsappCampaignsTable.id, whatsappCampaignRecipientsTable.campaignId))
      .where(eq(whatsappCampaignsTable.employeeId, employeeId))
      .groupBy(whatsappCampaignsTable.id)
      .orderBy(desc(whatsappCampaignsTable.createdAt));

    return res.json({ campaigns });
  } catch (err) {
    req.log.error({ err }, "Error listing campaigns");
    return res.status(500).json({ error: "server_error", message: "Failed to list campaigns" });
  }
});

/**
 * Resume a paused or stopped campaign
 */
router.post("/whatsapp/campaigns/:id/resume", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const campaignId = parseInt(req.params.id as string);

  try {
    const [campaign] = await db
      .select()
      .from(whatsappCampaignsTable)
      .where(
        and(
          eq(whatsappCampaignsTable.id, campaignId),
          eq(whatsappCampaignsTable.employeeId, employeeId)
        )
      );

    if (!campaign) {
      return res.status(404).json({ error: "not_found", message: "Campaign not found" });
    }

    if (campaign.status === "completed") {
      return res.status(400).json({ error: "bad_request", message: "Campaign already completed" });
    }

    await db.update(whatsappCampaignsTable)
      .set({ status: "running" })
      .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));

    triggerCampaign(campaignId, employeeId);

    return res.json({ success: true, message: "Campaign resumed" });
  } catch (err) {
    req.log.error({ err }, "Error resuming campaign");
    return res.status(500).json({ error: "server_error", message: "Failed to resume campaign" });
  }
});

/**
 * Pause a running campaign
 */
router.post("/whatsapp/campaigns/:id/pause", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const campaignId = parseInt(req.params.id as string);

  try {
    const [campaign] = await db
      .select()
      .from(whatsappCampaignsTable)
      .where(
        and(
          eq(whatsappCampaignsTable.id, campaignId),
          eq(whatsappCampaignsTable.employeeId, employeeId)
        )
      );

    if (!campaign) {
      return res.status(404).json({ error: "not_found", message: "Campaign not found" });
    }

    if (campaign.status === "completed") {
      return res.status(400).json({ error: "bad_request", message: "Campaign already completed" });
    }

    await db.update(whatsappCampaignsTable)
      .set({ status: "paused" })
      .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));

    return res.json({ success: true, message: "Campaign paused" });
  } catch (err) {
    req.log.error({ err }, "Error pausing campaign");
    return res.status(500).json({ error: "server_error", message: "Failed to pause campaign" });
  }
});

/**
 * Stop a campaign
 */
router.post("/whatsapp/campaigns/:id/stop", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const campaignId = parseInt(req.params.id as string);

  try {
    const [campaign] = await db
      .select()
      .from(whatsappCampaignsTable)
      .where(
        and(
          eq(whatsappCampaignsTable.id, campaignId),
          eq(whatsappCampaignsTable.employeeId, employeeId)
        )
      );

    if (!campaign) {
      return res.status(404).json({ error: "not_found", message: "Campaign not found" });
    }

    if (campaign.status === "completed") {
      return res.status(400).json({ error: "bad_request", message: "Campaign already completed" });
    }

    await db.update(whatsappCampaignsTable)
      .set({ status: "stopped", completedAt: new Date() })
      .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));

    return res.json({ success: true, message: "Campaign stopped" });
  } catch (err) {
    req.log.error({ err }, "Error stopping campaign");
    return res.status(500).json({ error: "server_error", message: "Failed to stop campaign" });
  }
});

/**
 * Get recipients for a specific campaign
 */
router.get("/whatsapp/campaigns/:id/recipients", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const campaignId = parseInt(req.params.id as string);

  try {
    const [campaign] = await db
      .select()
      .from(whatsappCampaignsTable)
      .where(
        and(
          eq(whatsappCampaignsTable.id, campaignId),
          eq(whatsappCampaignsTable.employeeId, employeeId)
        )
      );

    if (!campaign) {
      return res.status(404).json({ error: "not_found", message: "Campaign not found" });
    }

    const recipients = await db
      .select()
      .from(whatsappCampaignRecipientsTable)
      .where(eq(whatsappCampaignRecipientsTable.campaignId, campaignId));

    return res.json({ recipients });
  } catch (err) {
    req.log.error({ err }, "Error getting campaign recipients");
    return res.status(500).json({ error: "server_error", message: "Failed to get recipients" });
  }
});


/**
 * Check if numbers are on WhatsApp
 */
router.post("/whatsapp/check-numbers", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { numbers } = req.body;

  if (!numbers || !Array.isArray(numbers)) {
    return res.status(400).json({ error: "validation_error", message: "Numbers array is required" });
  }

  const instanceName = getInstanceName(employeeId);

  try {
    const state = await WhatsappService.getConnectionState(instanceName);
    if (state?.instance?.state !== "open") {
      return res.status(400).json({ error: "not_connected", message: "WhatsApp instance is not connected" });
    }
    const result = await WhatsappService.checkNumber(instanceName, numbers);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error checking numbers");
    return res.status(500).json({ error: "server_error", message: "Failed to check numbers" });
  }
});

/**
 * Get groups for the instance
 */
router.get("/whatsapp/groups", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const instanceName = getInstanceName(employeeId);

  try {
    const state = await WhatsappService.getConnectionState(instanceName);
    if (state?.instance?.state !== "open") {
      return res.json({ groups: [] }); // Return empty if not connected instead of 400 to avoid UI errors
    }
    
    try {
      const groups = await WhatsappService.getGroups(instanceName);
      return res.json({ groups: groups || [] });
    } catch (apiErr: any) {
      req.log.warn({ err: apiErr }, "Evolution API returned error for getGroups, returning empty array");
      return res.json({ groups: [] });
    }
  } catch (err) {
    req.log.error({ err }, "Error fetching groups");
    return res.status(500).json({ error: "server_error", message: "Failed to fetch groups" });
  }
});

// Helper function for background sending
export async function triggerCampaign(campaignId: number, employeeId: number) {
  const instanceName = getInstanceName(employeeId);
  
  try {
    const [campaign] = await db
      .select()
      .from(whatsappCampaignsTable)
      .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));
      
    if (!campaign || campaign.status !== "running") return;

    const recipients = await db
      .select()
      .from(whatsappCampaignRecipientsTable)
      .where(
        and(
          eq(whatsappCampaignRecipientsTable.campaignId, campaignId),
          eq(whatsappCampaignRecipientsTable.status, "pending")
        )
      );

    logger.info(`Starting campaign ${campaignId} with ${recipients.length} pending recipients`);

    for (let i = 0; i < recipients.length; i++) {
      // Check status again in case it was paused
      const [currentCampaign] = await db
        .select()
        .from(whatsappCampaignsTable)
        .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));
        
      if (!currentCampaign || currentCampaign.status !== "running") {
        logger.info(`Campaign ${campaignId} stopped or paused.`);
        break;
      }

      // Mark startedAt on first iteration
      if (i === 0 && !currentCampaign.startedAt) {
        await db.update(whatsappCampaignsTable)
          .set({ startedAt: new Date() })
          .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));
      }

      const recipient = recipients[i];
      
      try {
        let messageToSend = campaign.messageTemplate;
        try {
          if (campaign.messageTemplate.startsWith("[") && campaign.messageTemplate.endsWith("]")) {
            const parsed = JSON.parse(campaign.messageTemplate);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Rotate round-robin based on recipient index i
              const msgIdx = i % parsed.length;
              messageToSend = parsed[msgIdx];
            }
          }
        } catch (e) {
          messageToSend = campaign.messageTemplate;
        }

        await WhatsappService.sendTextMessage(instanceName, recipient.phoneNumber, messageToSend);
        
        await db.update(whatsappCampaignRecipientsTable)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(whatsappCampaignRecipientsTable.id, recipient.id));
          
      } catch (error: any) {
        const errMsg = error?.response?.data?.response?.message || error.message || "";
        logger.error(`Failed to send to ${recipient.phoneNumber}:`, errMsg);
        
        await db.update(whatsappCampaignRecipientsTable)
          .set({ status: "failed", errorMessage: errMsg })
          .where(eq(whatsappCampaignRecipientsTable.id, recipient.id));

        // Append to errorLog
        await db.update(whatsappCampaignsTable)
          .set({ errorLog: sql`COALESCE(${whatsappCampaignsTable.errorLog}, '') || ${`\nFailed ${recipient.phoneNumber}: ${errMsg}`}` })
          .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));

        if (errMsg.includes("Connection Closed") || errMsg.includes("not_connected")) {
          logger.warn(`WhatsApp connection closed during campaign ${campaignId}. Pausing campaign and resetting instance status.`);
          
          // Pause the campaign
          await db.update(whatsappCampaignsTable)
            .set({ status: "paused" })
            .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));
            
          // Reset instance connection status in DB
          await db.update(whatsappInstancesTable)
            .set({ connectionStatus: "disconnected", qrCode: null })
            .where(eq(whatsappInstancesTable.employeeId, employeeId));
            
          break; // Stop the loop immediately!
        }
      }

      // Time gap
      const gap = Math.floor(Math.random() * (campaign.timeGapMax - campaign.timeGapMin + 1) + campaign.timeGapMin);
      await new Promise(resolve => setTimeout(resolve, gap * 1000));
      
      // Batch pause if needed
      if (campaign.batchSize > 0 && (i + 1) % campaign.batchSize === 0 && i < recipients.length - 1) {
        logger.info(`Campaign ${campaignId}: Reached batch size. Pausing for 1 minute.`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    // Mark completed if all done
    const pendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappCampaignRecipientsTable)
      .where(
        and(
          eq(whatsappCampaignRecipientsTable.campaignId, campaignId),
          eq(whatsappCampaignRecipientsTable.status, "pending")
        )
      );

    if (pendingCount[0].count === 0) {
      await db.update(whatsappCampaignsTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(eq(whatsappCampaignsTable.id, campaignId), eq(whatsappCampaignsTable.employeeId, employeeId)));
      logger.info(`Campaign ${campaignId} completed.`);
    }

  } catch (error) {
    logger.error(error as any, `Error in campaign ${campaignId} loop`);
  }
}

export default router;
