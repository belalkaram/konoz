import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

export const payrollsTable = pgTable("payrolls", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  baseSalary: integer("base_salary").notNull().default(0),
  commissionPercentage: integer("commission_percentage").notNull().default(0), // Out of 100
  commissionEarned: integer("commission_earned").notNull().default(0),
  deductions: integer("deductions").notNull().default(0),
  netSalary: integer("net_salary").notNull().default(0),
  status: text("status").notNull().default("pending"), // 'pending', 'paid'
  currency: text("currency").notNull().default("KWD"),
  paymentDate: timestamp("payment_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
