import { eq, and, lte } from "drizzle-orm";
import { db, whatsappActiveFollowupsTable, whatsappFollowupStepsTable, whatsappFollowupSequencesTable, customersTable, remindersTable, systemSettingsTable } from "@workspace/db";
import { WhatsappService } from "./whatsapp.js";
import { logger } from "./logger.js";

// Check every 5 minutes
const INTERVAL_MS = 5 * 60 * 1000;

export function startAutomationCron() {
  logger.info("Starting WhatsApp Automation Cron Job...");
  setInterval(processAutomations, INTERVAL_MS);
  
  // Run once immediately
  setTimeout(processAutomations, 10000);
}

async function processAutomations() {
  try {
    const now = new Date();
    
    // Find all pending active follow-ups that are due
    const dueFollowups = await db.select()
      .from(whatsappActiveFollowupsTable)
      .where(and(
        eq(whatsappActiveFollowupsTable.status, "pending"),
        lte(whatsappActiveFollowupsTable.scheduledAt, now)
      ));
      
    if (dueFollowups.length === 0) return;
    
    logger.info(`Processing ${dueFollowups.length} due automations`);
    
    for (const followup of dueFollowups) {
      try {
        // Get the current step
        const [step] = await db.select()
          .from(whatsappFollowupStepsTable)
          .where(eq(whatsappFollowupStepsTable.id, followup.currentStepId));
          
        if (!step) {
          await markFollowupStatus(followup.id, "failed");
          continue;
        }
        
        // Get customer
        const [customer] = await db.select()
          .from(customersTable)
          .where(eq(customersTable.id, followup.customerId));
          
        if (!customer) {
          await markFollowupStatus(followup.id, "failed");
          continue;
        }

        // Send WhatsApp message
        let messageText = step.messageTemplate;
        messageText = messageText.replace(/\{\{customer_name\}\}/g, customer.fullName || "عميلنا العزيز");
        messageText = messageText.replace(/\{\{phone\}\}/g, followup.customerPhone);
        
        // Find instance for employee
        const [mainInstanceSetting] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "MAIN_WHATSAPP_INSTANCE_NAME"));
        const instanceName = mainInstanceSetting?.value || `emp_${followup.employeeId}`;
        
        await WhatsappService.sendTextMessage(instanceName, followup.customerPhone, messageText);
        
        // Mark as completed
        await markFollowupStatus(followup.id, "completed");
        
        // Find next step in sequence
        const [nextStep] = await db.select()
          .from(whatsappFollowupStepsTable)
          .where(and(
            eq(whatsappFollowupStepsTable.sequenceId, followup.sequenceId),
            eq(whatsappFollowupStepsTable.stepOrder, step.stepOrder + 1)
          ));
          
        if (nextStep) {
          // Schedule next step
          const nextScheduledAt = new Date(now.getTime() + nextStep.delayHours * 60 * 60 * 1000);
          
          const [newActiveFollowup] = await db.insert(whatsappActiveFollowupsTable).values({
            employeeId: followup.employeeId,
            customerId: followup.customerId,
            customerPhone: followup.customerPhone,
            sequenceId: followup.sequenceId,
            currentStepId: nextStep.id,
            scheduledAt: nextScheduledAt,
            status: "pending",
          }).returning();
          
          // Create reminder so it shows in the Followups section
          await db.insert(remindersTable).values({
            customerId: customer.id,
            employeeId: followup.employeeId,
            title: `متابعة آلية للعميل ${customer.fullName}`,
            description: `رسالة أوتوماتيكية: التسلسل رقم ${step.stepOrder + 1}`,
            reminderDate: nextScheduledAt,
            status: "pending",
            isAutoFollowup: true,
            activeFollowupId: newActiveFollowup.id,
          });
        }
        
      } catch (err) {
        logger.error({ err, followupId: followup.id }, "Failed to process active follow-up");
        await markFollowupStatus(followup.id, "failed");
      }
    }
  } catch (error) {
    logger.error({ error }, "Error in automation cron job");
  }
}

async function markFollowupStatus(id: number, status: string) {
  await db.update(whatsappActiveFollowupsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(whatsappActiveFollowupsTable.id, id));
    
  // Also update the reminder if it exists
  if (status === "completed" || status === "failed") {
    await db.update(remindersTable)
      .set({ status: status === "completed" ? "done" : "missed", updatedAt: new Date() })
      .where(eq(remindersTable.activeFollowupId, id));
  }
}
