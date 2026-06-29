import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const whatsappQuickRepliesTable = pgTable("whatsapp_quick_replies", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  shortcut: text("shortcut").notNull(), // e.g. "welcome"
  messageBody: text("message_body").notNull(),
  mediaUrl: text("media_url"), // Optional media
  mediaType: text("media_type"), // image, video, document, audio
  keywords: text("keywords"), // comma separated keywords for auto-reply e.g. "السعر,بكام"
  category: text("category").default("general"),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWhatsappQuickReplySchema = (createInsertSchema(whatsappQuickRepliesTable) as any).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappQuickReply = typeof whatsappQuickRepliesTable.$inferSelect;
export type InsertWhatsappQuickReply = z.infer<typeof insertWhatsappQuickReplySchema>;
