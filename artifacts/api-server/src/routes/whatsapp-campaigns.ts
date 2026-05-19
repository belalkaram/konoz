import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, whatsappCampaignsTable, whatsappCampaignRecipientsTable, whatsappInstancesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { WhatsappService } from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

const router = Router();

const getInstanceName = (employeeId: number) => `emp_${employeeId}`;

/**
 * Create a new campaign and start sending
 */
router.post("/whatsapp/campaigns", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const { name, messageTemplate, numbers, timeGapMin, timeGapMax, batchSize, scheduledAt } = req.body;

  if (!name || !messageTemplate || !numbers || !Array.isArray(numbers)) {
    return res.status(400).json({ error: "validation_error", message: "Name, template, and numbers array are required" });
  }

  const instanceName = getInstanceName(employeeId);

  try {
    const state = await WhatsappService.getConnectionState(instanceName);
    if (state?.instance?.state !== "open") {
      return res.status(400).json({ error: "not_connected", message: "WhatsApp instance is not connected" });
    }

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

    // 1. Create Campaign
    const [campaign] = await db.insert(whatsappCampaignsTable).values({
      employeeId,
      name,
      messageTemplate,
      timeGapMin: timeGapMin || 5,
      timeGapMax: timeGapMax || 10,
      batchSize: batchSize || 10,
      status: initialStatus,
      scheduledAt: parsedDate,
    }).returning();

    // 2. Create Recipients
    const recipientsData = numbers.map((phone: string) => ({
      campaignId: campaign.id,
      phoneNumber: phone,
      status: "pending",
    }));

    await db.insert(whatsappCampaignRecipientsTable).values(recipientsData);

    // 3. Trigger async sending loop
    if (initialStatus === "running") {
      triggerCampaign(campaign.id, employeeId);
    }

    return res.json({ campaign });
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
      .where(eq(whatsappCampaignsTable.id, campaignId));

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
      .where(eq(whatsappCampaignsTable.id, campaignId));

    return res.json({ success: true, message: "Campaign paused" });
  } catch (err) {
    req.log.error({ err }, "Error pausing campaign");
    return res.status(500).json({ error: "server_error", message: "Failed to pause campaign" });
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
      .where(eq(whatsappCampaignsTable.id, campaignId));
      
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
        .where(eq(whatsappCampaignsTable.id, campaignId));
        
      if (!currentCampaign || currentCampaign.status !== "running") {
        logger.info(`Campaign ${campaignId} stopped or paused.`);
        break;
      }

      const recipient = recipients[i];
      
      try {
        await WhatsappService.sendTextMessage(instanceName, recipient.phoneNumber, campaign.messageTemplate);
        
        await db.update(whatsappCampaignRecipientsTable)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(whatsappCampaignRecipientsTable.id, recipient.id));
          
      } catch (error: any) {
        logger.error(`Failed to send to ${recipient.phoneNumber}:`, error.message);
        await db.update(whatsappCampaignRecipientsTable)
          .set({ status: "failed", errorMessage: error.message })
          .where(eq(whatsappCampaignRecipientsTable.id, recipient.id));
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
        .set({ status: "completed" })
        .where(eq(whatsappCampaignsTable.id, campaignId));
      logger.info(`Campaign ${campaignId} completed.`);
    }

  } catch (error) {
    logger.error(error as any, `Error in campaign ${campaignId} loop`);
  }
}

export default router;
