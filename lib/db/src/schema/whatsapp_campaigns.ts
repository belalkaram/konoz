import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const whatsappCampaignsTable = pgTable("whatsapp_campaigns", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id)
    .notNull(),
  name: text("name").notNull(),
  messageTemplate: text("message_template").notNull(),
  timeGapMin: integer("time_gap_min").notNull().default(5),
  timeGapMax: integer("time_gap_max").notNull().default(10),
  batchSize: integer("batch_size").notNull().default(10),
  status: text("status").notNull().default("pending"), // pending, running, paused, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWhatsappCampaignSchema = (createInsertSchema(whatsappCampaignsTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappCampaign = typeof whatsappCampaignsTable.$inferSelect;
export type InsertWhatsappCampaign = z.infer<typeof insertWhatsappCampaignSchema>;
