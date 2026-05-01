import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  checkIn: text("check_in"), // HH:mm
  checkOut: text("check_out"), // HH:mm
  status: text("status").notNull().default("Present"), // Present, Absent, Late, Half Day
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable);
export const selectAttendanceSchema = createSelectSchema(attendanceTable);

export type Attendance = typeof attendanceTable.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
