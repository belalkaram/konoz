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
  status: text("status").notNull().default("pending"), // pending, sent, delivered, read, failed
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),    // When message was delivered
  readAt: timestamp("read_at"),              // When message was read
});

export const insertWhatsappCampaignRecipientSchema = (createInsertSchema(whatsappCampaignRecipientsTable) as any).omit({
  id: true,
});

export type WhatsappCampaignRecipient = typeof whatsappCampaignRecipientsTable.$inferSelect;
export type InsertWhatsappCampaignRecipient = z.infer<typeof insertWhatsappCampaignRecipientSchema>;

