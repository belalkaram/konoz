import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employeesTable } from "./employees";

export const whatsappRoutingAgentsTable = pgTable("whatsapp_routing_agents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employeesTable.id).notNull(),
  agentPhone: text("agent_phone").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastAssignedAt: timestamp("last_assigned_at").defaultNow().notNull(),
  totalAssigned: integer("total_assigned").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappRoutingCustomersTable = pgTable("whatsapp_routing_customers", {
  id: serial("id").primaryKey(),
  customerPhone: text("customer_phone").notNull().unique(),
  assignedAgentId: integer("assigned_agent_id").references(() => whatsappRoutingAgentsTable.id).notNull(),
  firstMessageDate: timestamp("first_message_date").defaultNow().notNull(),
});

export const insertWhatsappRoutingAgentSchema = createInsertSchema(whatsappRoutingAgentsTable);
export const insertWhatsappRoutingCustomerSchema = createInsertSchema(whatsappRoutingCustomersTable);

export type WhatsappRoutingAgent = typeof whatsappRoutingAgentsTable.$inferSelect;
export type WhatsappRoutingCustomer = typeof whatsappRoutingCustomersTable.$inferSelect;
