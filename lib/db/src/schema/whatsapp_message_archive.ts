import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

/**
 * Tracks metadata for archived (old) message sync jobs.
 * The actual messages are stored as JSON files on the server filesystem
 * to avoid overloading the main PostgreSQL database.
 */
export const whatsappMessageArchiveTable = pgTable("whatsapp_message_archive", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id)
    .notNull(),
  instanceName: text("instance_name").notNull(),
  archivePath: text("archive_path").notNull(),    // Path to JSON file on server
  totalMessages: integer("total_messages").default(0),
  totalChats: integer("total_chats").default(0),
  status: text("status").notNull().default("pending"), // pending, syncing, completed, failed
  errorMessage: text("error_message"),
  syncStartedAt: timestamp("sync_started_at"),
  syncCompletedAt: timestamp("sync_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWhatsappMessageArchiveSchema = (createInsertSchema(whatsappMessageArchiveTable) as any).omit({
  id: true,
  createdAt: true,
});

export type WhatsappMessageArchive = typeof whatsappMessageArchiveTable.$inferSelect;
export type InsertWhatsappMessageArchive = z.infer<typeof insertWhatsappMessageArchiveSchema>;
