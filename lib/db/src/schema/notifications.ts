import { pgTable, serial, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => employeesTable.id, { onDelete: "cascade" }).notNull(),
  receiverId: integer("receiver_id").references(() => employeesTable.id, { onDelete: "cascade" }).notNull(),
  message: text("message").notNull(),
  button1Label: varchar("button1_label", { length: 50 }).notNull(),
  button2Label: varchar("button2_label", { length: 50 }).notNull(),
  clickedButton: varchar("clicked_button", { length: 50 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'responded', 'dismissed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
