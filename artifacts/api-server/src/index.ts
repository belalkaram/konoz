import express from "express";
import app from "./app";
import { logger } from "./lib/logger";
import { seedEmployees } from "./lib/seed-employees";

const rawPort = process.env.API_PORT || process.env.PORT || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(port, async (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    await seedEmployees();
  });
}

export default app;
