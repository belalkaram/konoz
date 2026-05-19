import { db, whatsappCampaignsTable } from "@workspace/db";
import { lte, eq, and } from "drizzle-orm";
import { logger } from "./logger.js";
import { triggerCampaign } from "../routes/whatsapp-campaigns.js";

export async function runCampaignJob() {
  try {
    const now = new Date();
    
    // Find all scheduled campaigns where the scheduled time has arrived or passed
    const campaignsToStart = await db
      .select()
      .from(whatsappCampaignsTable)
      .where(
        and(
          eq(whatsappCampaignsTable.status, "scheduled"),
          lte(whatsappCampaignsTable.scheduledAt, now)
        )
      );

    for (const campaign of campaignsToStart) {
      logger.info({ msg: "Starting scheduled campaign", campaignId: campaign.id });
      
      // Update status to running
      await db.update(whatsappCampaignsTable)
        .set({ status: "running" })
        .where(eq(whatsappCampaignsTable.id, campaign.id));
        
      // Trigger it asynchronously (do not await so we don't block the job)
      triggerCampaign(campaign.id, campaign.employeeId).catch(err => {
        logger.error({ msg: "Failed to trigger scheduled campaign", campaignId: campaign.id, error: err });
      });
    }
  } catch (err) {
    logger.error({ msg: "Error in campaign job", error: err });
  }
}

// Start the background job
export function startCampaignCron() {
  // Run every 1 minute to check for scheduled campaigns
  setInterval(runCampaignJob, 60 * 1000);
  runCampaignJob();
}
