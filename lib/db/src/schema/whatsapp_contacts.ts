import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const whatsappContactsTable = pgTable("whatsapp_contacts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employeesTable.id)
    .notNull(),
  phone: text("phone").notNull(),
  name: text("name"),
  profilePictureUrl: text("profile_picture_url"),
  pushName: text("push_name"), // Sometimes WhatsApp provides pushName
  lastSeen: timestamp("last_seen"),
  isBusiness: boolean("is_business").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWhatsappContactSchema = (createInsertSchema(whatsappContactsTable) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WhatsappContact = typeof whatsappContactsTable.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;
