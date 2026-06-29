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
  messageType: text("message_type").notNull().default("text"), // text, image, video, audio, document, sticker, contact, location
  isFromMe: boolean("is_from_me").notNull(),
  timestamp: timestamp("timestamp").notNull(),

  // Media fields
  mediaUrl: text("media_url"),           // URL to download media from Evolution API
  mediaBase64: text("media_base64"),     // Base64 encoded media data
  mimeType: text("mime_type"),           // e.g. image/jpeg, audio/ogg, video/mp4
  fileName: text("file_name"),           // Original file name for documents
  caption: text("caption"),              // Caption for images/videos/documents

  // Reply / Quote
  quotedMessageId: text("quoted_message_id"), // ID of the message being replied to

  // Status tracking: sent, delivered, read, failed
  status: text("status").default("sent"),

  // Forward
  isForwarded: boolean("is_forwarded").default(false),

  // Structured data (JSON strings)
  contactInfo: text("contact_info"),     // JSON: { name, phones[] } for contact messages
  locationData: text("location_data"),   // JSON: { lat, lng, name, address } for location messages

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWhatsappMessageSchema = (createInsertSchema(whatsappMessagesTable) as any).omit({
  id: true,
  createdAt: true,
});

export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
