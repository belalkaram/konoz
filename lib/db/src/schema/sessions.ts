import { pgTable, text, integer, bigint, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const sessionsTable = pgTable("sessions", {
  token: text("token").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  csrfToken: text("csrf_token").notNull(),
  companyId: integer("company_id"),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessionsTable.$inferSelect;
