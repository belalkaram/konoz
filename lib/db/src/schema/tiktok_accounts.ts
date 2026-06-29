import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const tiktokAccountsTable = pgTable("tiktok_accounts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id)
    .notNull()
    .unique(), // Each employee has one connected account
  tiktokUserId: text("tiktok_user_id"),
  username: text("username"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  connectionStatus: text("connection_status").notNull().default("disconnected"), // "connected" | "disconnected" | "expired"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTiktokAccountSchema = (createInsertSchema(tiktokAccountsTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TiktokAccount = typeof tiktokAccountsTable.$inferSelect;
export type InsertTiktokAccount = z.infer<typeof insertTiktokAccountSchema>;
