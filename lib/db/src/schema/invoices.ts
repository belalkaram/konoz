import { pgTable, serial, text, integer, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ticketsTable } from "./tickets";
import { customersTable } from "./customers";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "cancelled",
  "refunded",
]);

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  
  // Financial Details
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  
  // Internal Details (Hidden from customer)
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
  profit: numeric("profit", { precision: 12, scale: 2 }),
  
  status: invoiceStatusEnum("status").default("draft").notNull(),
  notes: text("notes"), // Public notes for customer
  internalNotes: text("internal_notes"), // Private notes for admin
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = (createInsertSchema(invoicesTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
