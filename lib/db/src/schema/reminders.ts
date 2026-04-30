import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { customersTable } from "./customers";

export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "done",
  "missed",
]);

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id, {
    onDelete: "cascade",
  }),
  employeeId: integer("employee_id"),
  noteId: integer("note_id"),
  reminderDate: timestamp("reminder_date").notNull(),
  status: reminderStatusEnum("status").default("pending").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReminderSchema = (createInsertSchema(remindersTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateReminderSchema = insertReminderSchema.partial();

export type Reminder = typeof remindersTable.$inferSelect;
export type InsertReminder = z.infer<typeof insertReminderSchema>;
