import express from "express";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import customersRouter from "./routes/customers.js";
import whatsappRoutingRouter from "./routes/whatsapp_routing.js";
import { seedEmployees } from "./lib/seed-employees.js";
import { startReminderCron } from "./lib/reminder-job.js";
import { startCampaignCron } from "./lib/campaign-job.js";
import { startAutomationCron } from "./lib/automation-job.js";

const rawPort = process.env.API_PORT || process.env.PORT || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Error handlers
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  (app as any).listen(port, async (err: any) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    await seedEmployees();
    startReminderCron();
    startCampaignCron();
    startAutomationCron();
  });
}

export default app;
