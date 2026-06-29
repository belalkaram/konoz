import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const tiktokAutomationsTable = pgTable("tiktok_automations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  type: text("type").notNull(), // "dm_welcome", "comment_reply"
  isActive: boolean("is_active").default(true).notNull(),
  keywords: text("keywords"), // Comma separated keywords for comment replies
  messageTemplate: text("message_template").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTiktokAutomationSchema = (createInsertSchema(tiktokAutomationsTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TiktokAutomation = typeof tiktokAutomationsTable.$inferSelect;
export type InsertTiktokAutomation = z.infer<typeof insertTiktokAutomationSchema>;
