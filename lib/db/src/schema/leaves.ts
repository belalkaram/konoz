import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const leavesTable = pgTable("leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  type: text("type").notNull(), // Annual, Sick, Emergency, Unpaid
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  reason: text("reason"),
  status: text("status").notNull().default("Approved"), // For manual entry, default to Approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLeaveSchema = createInsertSchema(leavesTable);
export const selectLeaveSchema = createSelectSchema(leavesTable);

export type Leave = typeof leavesTable.$inferSelect;
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
