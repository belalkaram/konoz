import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { whatsappCampaignsTable } from "./whatsapp_campaigns";

export const whatsappCampaignRecipientsTable = pgTable("whatsapp_campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .references(() => whatsappCampaignsTable.id)
    .notNull(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
});

export const insertWhatsappCampaignRecipientSchema = (createInsertSchema(whatsappCampaignRecipientsTable) as any).omit({
  id: true,
});

export type WhatsappCampaignRecipient = typeof whatsappCampaignRecipientsTable.$inferSelect;
export type InsertWhatsappCampaignRecipient = z.infer<typeof insertWhatsappCampaignRecipientSchema>;
