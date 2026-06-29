import { pgTable, text, timestamp, boolean, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { employeesTable } from "./employees";

export const systemSettingsTable = pgTable("system_settings", {
  key: text("key").notNull(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.key, table.employeeId] }),
  };
});

export const insertSystemSettingSchema = createInsertSchema(systemSettingsTable) as any;
export type SystemSetting = typeof systemSettingsTable.$inferSelect;
