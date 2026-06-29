import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";
import { customersTable } from "./customers";

export const whatsappFollowupSequencesTable = pgTable("whatsapp_followup_sequences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappFollowupStepsTable = pgTable("whatsapp_followup_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").references(() => whatsappFollowupSequencesTable.id, { onDelete: 'cascade' }).notNull(),
  delayHours: integer("delay_hours").notNull(),
  messageTemplate: text("message_template").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  stepOrder: integer("step_order").notNull(), // 1, 2, 3...
});

export const whatsappActiveFollowupsTable = pgTable("whatsapp_active_followups", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  customerId: integer("customer_id").references(() => customersTable.id).notNull(),
  customerPhone: text("customer_phone").notNull(),
  sequenceId: integer("sequence_id").references(() => whatsappFollowupSequencesTable.id).notNull(),
  currentStepId: integer("current_step_id").references(() => whatsappFollowupStepsTable.id).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").default("pending"), // pending, cancelled, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas
export const insertSequenceSchema = (createInsertSchema(whatsappFollowupSequencesTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStepSchema = (createInsertSchema(whatsappFollowupStepsTable) as any).omit({
  id: true,
});

export const insertActiveFollowupSchema = (createInsertSchema(whatsappActiveFollowupsTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappSequence = typeof whatsappFollowupSequencesTable.$inferSelect;
export type WhatsappStep = typeof whatsappFollowupStepsTable.$inferSelect;
export type WhatsappActiveFollowup = typeof whatsappActiveFollowupsTable.$inferSelect;
