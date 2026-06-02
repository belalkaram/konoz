import { pgTable, serial, text, integer, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ticketsTable, paymentStatusEnum } from "./tickets";
import { customersTable } from "./customers";

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "bank_transfer",
  "online",
  "other",
]);

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("KWD"),
  paymentMethod: paymentMethodEnum("payment_method").default("cash"),
  paymentStatus: paymentStatusEnum("payment_status").default("paid"),
  paymentDate: timestamp("payment_date").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymentSchema = (createInsertSchema(paymentsTable) as any).omit({
  id: true,
  createdAt: true,
});

export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
