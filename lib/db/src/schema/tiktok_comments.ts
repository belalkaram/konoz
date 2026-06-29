import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tiktokAccountsTable } from "./tiktok_accounts";
import { customersTable } from "./customers";

export const tiktokCommentsTable = pgTable("tiktok_comments", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => tiktokAccountsTable.id).notNull(),
  customerId: integer("customer_id").references(() => customersTable.id), // Link to CRM
  tiktokCommentId: text("tiktok_comment_id").unique(),
  videoId: text("video_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name"),
  content: text("content").notNull(),
  repliedToCommentId: text("replied_to_comment_id"),
  isFromMe: boolean("is_from_me").default(false).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTiktokCommentSchema = (createInsertSchema(tiktokCommentsTable) as any).omit({
  id: true,
  createdAt: true,
});

export type TiktokComment = typeof tiktokCommentsTable.$inferSelect;
export type InsertTiktokComment = z.infer<typeof insertTiktokCommentSchema>;
