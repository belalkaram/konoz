import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tiktokAccountsTable } from "./tiktok_accounts";
import { customersTable } from "./customers";

export const tiktokMessagesTable = pgTable("tiktok_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => tiktokAccountsTable.id).notNull(),
  customerId: integer("customer_id").references(() => customersTable.id), // Link to CRM
  tiktokMessageId: text("tiktok_message_id").unique(),
  conversationId: text("conversation_id"),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  content: text("content").notNull(),
  isFromMe: boolean("is_from_me").default(false).notNull(),
  status: text("status").default("sent"), // sent, delivered, read, failed
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTiktokMessageSchema = (createInsertSchema(tiktokMessagesTable) as any).omit({
  id: true,
  createdAt: true,
});

export type TiktokMessage = typeof tiktokMessagesTable.$inferSelect;
export type InsertTiktokMessage = z.infer<typeof insertTiktokMessageSchema>;
