import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customerSourceEnum = pgEnum("customer_source", [
  "facebook",
  "whatsapp",
  "walk_in",
  "referral",
  "other",
]);

export const customerStatusEnum = pgEnum("customer_status", [
  "new",
  "interested",
  "follow_up",
  "booked",
  "cancelled",
  "lost",
]);

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  nationality: text("nationality"),
  passportNumber: text("passport_number"),
  nationalId: text("national_id"),
  address: text("address"),
  source: customerSourceEnum("source").default("other"),
  status: customerStatusEnum("status").default("new").notNull(),
  companyId: integer("company_id"),
  assignedEmployeeId: integer("assigned_employee_id"),
  createdByEmployeeId: integer("created_by_employee_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastContactedAt: timestamp("last_contacted_at"),
});

export const insertCustomerSchema = (createInsertSchema(customersTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerSchema = insertCustomerSchema.partial();

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
