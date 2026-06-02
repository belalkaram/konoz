import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

export const expenseCategoriesTable = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("general"), // 'general', 'marketing', 'operations', etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => expenseCategoriesTable.id, { onDelete: "restrict" }).notNull(),
  amount: integer("amount").notNull(), // in cents/fils to avoid floating point issues, or just integer if they use whole currency
  currency: text("currency").notNull().default("KWD"),
  date: timestamp("date").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => employeesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
