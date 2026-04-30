import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { customersTable } from "./customers";

export const followUpStatusEnum = pgEnum("follow_up_status", [
  "pending",
  "done",
  "missed",
]);

export const customerNotesTable = pgTable("customer_notes", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id"),
  ticketId: integer("ticket_id"),
  note: text("note").notNull(),
  followUpDate: timestamp("follow_up_date"),
  followUpStatus: followUpStatusEnum("follow_up_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerNoteSchema = (createInsertSchema(customerNotesTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerNoteSchema = insertCustomerNoteSchema.partial();

export type CustomerNote = typeof customerNotesTable.$inferSelect;
export type InsertCustomerNote = z.infer<typeof insertCustomerNoteSchema>;
