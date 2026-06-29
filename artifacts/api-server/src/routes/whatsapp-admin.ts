import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, whatsappInstancesTable, employeesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { WhatsappService } from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Helper: check if employee is admin
function requireAdmin(req: any, res: any, next: any) {
  if (req.employee?.role !== "Administrator") {
    return res.status(403).json({ error: "forbidden", message: "Admin access required" });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Instance Management (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/whatsapp/admin/instances — List all instances with their status
 */
router.get("/whatsapp/admin/instances", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Fetch from both our DB and Evolution API
    const [dbInstances, evoInstances] = await Promise.all([
      db.select({
        id: whatsappInstancesTable.id,
        employeeId: whatsappInstancesTable.employeeId,
        instanceName: whatsappInstancesTable.instanceName,
        connectionStatus: whatsappInstancesTable.connectionStatus,
        createdAt: whatsappInstancesTable.createdAt,
        employeeName: employeesTable.name,
      })
        .from(whatsappInstancesTable)
        .leftJoin(employeesTable, eq(whatsappInstancesTable.employeeId, employeesTable.id)),
      WhatsappService.getInstances().catch(() => []),
    ]);

    // Merge Evolution API status into our DB records
    const evoMap = new Map<string, any>();
    if (Array.isArray(evoInstances)) {
      for (const evo of evoInstances) {
        const name = evo.instance?.instanceName || evo.instanceName;
        if (name) evoMap.set(name, evo);
      }
    }

    const instances = dbInstances.map((inst: any) => {
      const evo = evoMap.get(inst.instanceName);
      const liveStatus = evo?.instance?.state || evo?.instance?.status || inst.connectionStatus;
      return {
        ...inst,
        liveStatus,
        phoneNumber: evo?.instance?.owner || null,
        profileName: evo?.instance?.profileName || null,
        profilePicUrl: evo?.instance?.profilePictureUrl || null,
      };
    });

    return res.json({ instances });
  } catch (err) {
    req.log.error({ err }, "Error listing admin instances");
    return res.status(500).json({ error: "server_error", message: "Failed to list instances" });
  }
});

/**
 * POST /api/whatsapp/admin/instances — Create a new instance
 */
router.post("/whatsapp/admin/instances", requireAuth, requireAdmin, async (req, res) => {
  const { instanceName, employeeId } = req.body;

  if (!instanceName || !employeeId) {
    return res.status(400).json({ error: "validation_error", message: "instanceName and employeeId are required" });
  }

  try {
    // Create in Evolution API
    const evoResult = await WhatsappService.createInstance(instanceName);

    // Save to our DB
    const [instance] = await db.insert(whatsappInstancesTable).values({
      employeeId,
      instanceName,
      connectionStatus: evoResult.instance?.status || "disconnected",
      qrCode: evoResult.qrcode?.base64 || null,
    }).returning();

    return res.json({ instance, evolution: evoResult });
  } catch (err: any) {
    req.log.error({ err }, "Error creating admin instance");
    const errMsg = err?.response?.data?.response?.message || err.message || "Failed to create instance";
    return res.status(500).json({ error: "server_error", message: errMsg });
  }
});

/**
 * DELETE /api/whatsapp/admin/instances/:name — Delete an instance
 */
router.delete("/whatsapp/admin/instances/:name", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;

  try {
    // Try to logout and delete from Evolution API
    await WhatsappService.logoutInstance(instanceName).catch(() => {});
    await WhatsappService.deleteInstance(instanceName).catch(() => {});

    // Remove from our DB
    await db.delete(whatsappInstancesTable)
      .where(eq(whatsappInstancesTable.instanceName, instanceName));

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting admin instance");
    return res.status(500).json({ error: "server_error", message: "Failed to delete instance" });
  }
});

/**
 * POST /api/whatsapp/admin/instances/:name/restart — Restart an instance
 */
router.post("/whatsapp/admin/instances/:name/restart", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;

  try {
    const result = await WhatsappService.restartInstance(instanceName);
    return res.json({ success: true, result });
  } catch (err: any) {
    req.log.error({ err }, "Error restarting instance");
    return res.status(500).json({ error: "server_error", message: err?.response?.data?.response?.message || "Failed to restart" });
  }
});

/**
 * POST /api/whatsapp/admin/instances/:name/connect — Connect (generate QR)
 */
router.post("/whatsapp/admin/instances/:name/connect", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;

  try {
    const result = await WhatsappService.connectInstance(instanceName);

    // Update QR in DB
    if (result?.qrcode?.base64) {
      await db.update(whatsappInstancesTable)
        .set({ qrCode: result.qrcode.base64, connectionStatus: "connecting" })
        .where(eq(whatsappInstancesTable.instanceName, instanceName));
    }

    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Error connecting admin instance");
    return res.status(500).json({ error: "server_error", message: "Failed to connect" });
  }
});

/**
 * POST /api/whatsapp/admin/instances/:name/disconnect — Logout an instance
 */
router.post("/whatsapp/admin/instances/:name/disconnect", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;

  try {
    await WhatsappService.logoutInstance(instanceName).catch(() => {});

    await db.update(whatsappInstancesTable)
      .set({ connectionStatus: "disconnected", qrCode: null })
      .where(eq(whatsappInstancesTable.instanceName, instanceName));

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting instance");
    return res.status(500).json({ error: "server_error", message: "Failed to disconnect" });
  }
});

/**
 * GET /api/whatsapp/admin/instances/:name/webhook — Get webhook settings
 */
router.get("/whatsapp/admin/instances/:name/webhook", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;

  try {
    const webhook = await WhatsappService.getWebhook(instanceName);
    return res.json({ webhook });
  } catch (err) {
    req.log.error({ err }, "Error getting webhook");
    return res.status(500).json({ error: "server_error", message: "Failed to get webhook settings" });
  }
});

/**
 * PUT /api/whatsapp/admin/instances/:name/webhook — Update webhook settings
 */
router.put("/whatsapp/admin/instances/:name/webhook", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;
  const { url, events } = req.body;

  if (!url) {
    return res.status(400).json({ error: "validation_error", message: "Webhook URL is required" });
  }

  try {
    const result = await WhatsappService.setWebhook(instanceName, url);
    return res.json({ success: true, result });
  } catch (err) {
    req.log.error({ err }, "Error updating webhook");
    return res.status(500).json({ error: "server_error", message: "Failed to update webhook" });
  }
});

/**
 * GET /api/whatsapp/admin/instances/:name/qrcode — Get QR code for an instance
 */
router.get("/whatsapp/admin/instances/:name/qrcode", requireAuth, requireAdmin, async (req, res) => {
  const instanceName = req.params.name as string;

  try {
    const [instance] = await db.select()
      .from(whatsappInstancesTable)
      .where(eq(whatsappInstancesTable.instanceName, instanceName));

    return res.json({ qrCode: instance?.qrCode || null });
  } catch (err) {
    req.log.error({ err }, "Error getting QR code");
    return res.status(500).json({ error: "server_error", message: "Failed to get QR code" });
  }
});

export default router;
