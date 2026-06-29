import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, whatsappRoutingAgentsTable, whatsappRoutingCustomersTable, employeesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Get all agents participating in routing
router.get("/whatsapp/routing/agents", requireAuth, async (req, res) => {
  try {
    const agents = await db
      .select({
        id: whatsappRoutingAgentsTable.id,
        employeeId: whatsappRoutingAgentsTable.employeeId,
        agentPhone: whatsappRoutingAgentsTable.agentPhone,
        isActive: whatsappRoutingAgentsTable.isActive,
        lastAssignedAt: whatsappRoutingAgentsTable.lastAssignedAt,
        totalAssigned: whatsappRoutingAgentsTable.totalAssigned,
        employeeName: employeesTable.name,
      })
      .from(whatsappRoutingAgentsTable)
      .innerJoin(employeesTable, eq(whatsappRoutingAgentsTable.employeeId, employeesTable.id))
      .orderBy(desc(whatsappRoutingAgentsTable.createdAt));

    return res.json({ agents });
  } catch (err) {
    req.log.error({ err }, "Error getting routing agents");
    return res.status(500).json({ error: "server_error" });
  }
});

// Add an agent to routing
router.post("/whatsapp/routing/agents", requireAuth, async (req, res) => {
  const { employeeId, agentPhone } = req.body;
  if (!employeeId || !agentPhone) {
    return res.status(400).json({ error: "bad_request", message: "employeeId and agentPhone are required" });
  }

  try {
    const [existing] = await db
      .select()
      .from(whatsappRoutingAgentsTable)
      .where(eq(whatsappRoutingAgentsTable.employeeId, employeeId));

    if (existing) {
      return res.status(400).json({ error: "already_exists", message: "Agent is already in the routing list" });
    }

    const [agent] = await db.insert(whatsappRoutingAgentsTable).values({
      employeeId,
      agentPhone,
      isActive: true,
    }).returning();

    return res.json({ agent });
  } catch (err) {
    req.log.error({ err }, "Error adding routing agent");
    return res.status(500).json({ error: "server_error" });
  }
});

// Toggle agent status or delete
router.patch("/whatsapp/routing/agents/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { isActive } = req.body;

  try {
    const [agent] = await db
      .update(whatsappRoutingAgentsTable)
      .set({ isActive })
      .where(eq(whatsappRoutingAgentsTable.id, id))
      .returning();

    return res.json({ agent });
  } catch (err) {
    req.log.error({ err }, "Error updating routing agent");
    return res.status(500).json({ error: "server_error" });
  }
});

router.delete("/whatsapp/routing/agents/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string);
  try {
    await db.delete(whatsappRoutingAgentsTable).where(eq(whatsappRoutingAgentsTable.id, id));
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting routing agent");
    return res.status(500).json({ error: "server_error" });
  }
});

// Get routed customers
router.get("/whatsapp/routing/customers", requireAuth, async (req, res) => {
  try {
    const customers = await db
      .select({
        id: whatsappRoutingCustomersTable.id,
        customerPhone: whatsappRoutingCustomersTable.customerPhone,
        firstMessageDate: whatsappRoutingCustomersTable.firstMessageDate,
        assignedAgentId: whatsappRoutingCustomersTable.assignedAgentId,
        agentEmployeeId: whatsappRoutingAgentsTable.employeeId,
        agentName: employeesTable.name,
      })
      .from(whatsappRoutingCustomersTable)
      .innerJoin(whatsappRoutingAgentsTable, eq(whatsappRoutingCustomersTable.assignedAgentId, whatsappRoutingAgentsTable.id))
      .innerJoin(employeesTable, eq(whatsappRoutingAgentsTable.employeeId, employeesTable.id))
      .orderBy(desc(whatsappRoutingCustomersTable.firstMessageDate));

    return res.json({ customers });
  } catch (err) {
    req.log.error({ err }, "Error getting routed customers");
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
