import { pgTable, serial, text, integer, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "quoted",
  "reserved",
  "confirmed",
  "paid",
  "issued",
  "cancelled",
  "refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "partially_paid",
  "paid",
  "refunded",
]);

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  employeeId: integer("employee_id"),
  flightRoute: text("flight_route"),
  airline: text("airline"),
  flightNumber: text("flight_number"),
  departureDatetime: timestamp("departure_datetime"),
  arrivalDatetime: timestamp("arrival_datetime"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
  price: numeric("price", { precision: 12, scale: 2 }),
  currency: text("currency").default("KWD"),
  pnr: text("pnr"),
  ticketStatus: ticketStatusEnum("ticket_status").default("quoted").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("unpaid").notNull(),
  baggageDetails: text("baggage_details"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTicketSchema = insertTicketSchema.partial().extend({
  customerId: z.number().optional(),
});

export type Ticket = typeof ticketsTable.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
