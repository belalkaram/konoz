import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const whatsappInstancesTable = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id)
    .notNull()
    .unique(), // Each employee has one instance
  instanceName: text("instance_name").notNull().unique(), // E.g., emp_123
  connectionStatus: text("connection_status").notNull().default("disconnected"),
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWhatsappInstanceSchema = (createInsertSchema(whatsappInstancesTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappInstance = typeof whatsappInstancesTable.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;
