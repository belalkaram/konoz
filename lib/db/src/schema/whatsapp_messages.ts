import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id)
    .notNull(),
  customerPhone: text("customer_phone").notNull(),
  messageId: text("message_id"), // The ID from Evolution API
  messageBody: text("message_body").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, image, document, etc.
  isFromMe: boolean("is_from_me").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWhatsappMessageSchema = (createInsertSchema(whatsappMessagesTable) as any).omit({
  id: true,
  createdAt: true,
});

export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
