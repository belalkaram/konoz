import { pgTable, serial, text, timestamp, boolean, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  role: text("role").notNull().default("Employee"),
  username: text("username").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
  supervisorId: integer("supervisor_id").references((): AnyPgColumn => employeesTable.id),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  baseSalary: integer("base_salary").notNull().default(0),
  commissionPercentage: integer("commission_percentage").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = (createInsertSchema(employeesTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
