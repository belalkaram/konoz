import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ticketsTable } from "./tickets";

export const ticketStatusHistoryTable = pgTable("ticket_status_history", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTicketStatusHistorySchema = (createInsertSchema(ticketStatusHistoryTable) as any).omit({
  id: true,
  createdAt: true,
});

export type TicketStatusHistory = typeof ticketStatusHistoryTable.$inferSelect;
export type InsertTicketStatusHistory = z.infer<typeof insertTicketStatusHistorySchema>;
