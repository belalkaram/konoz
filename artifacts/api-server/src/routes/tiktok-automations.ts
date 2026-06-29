import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, tiktokAutomationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const AutomationSchema = z.object({
  type: z.enum(["dm_welcome", "comment_reply"]),
  isActive: z.boolean().optional(),
  keywords: z.string().optional().nullable(),
  messageTemplate: z.string().min(1),
});

/**
 * GET /api/tiktok/automations
 * Retrieves all TikTok automations for the employee.
 */
router.get("/tiktok/automations", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const automations = await db
      .select()
      .from(tiktokAutomationsTable)
      .where(eq(tiktokAutomationsTable.employeeId, employeeId))
      .orderBy(desc(tiktokAutomationsTable.createdAt));
      
    res.json(automations);
  } catch (err) {
    req.log.error({ err }, "Error fetching TikTok automations");
    res.status(500).json({ error: "server_error", message: "Failed to fetch TikTok automations" });
  }
});

/**
 * POST /api/tiktok/automations
 * Creates a new TikTok automation.
 */
router.post("/tiktok/automations", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const parsed = AutomationSchema.safeParse(req.body);
  
  if (!parsed.success) return res.status(400).json({ error: "validation_error", message: parsed.error.message });
  
  try {
    const [automation] = await db.insert(tiktokAutomationsTable).values({
      employeeId,
      type: parsed.data.type,
      isActive: parsed.data.isActive ?? true,
      keywords: parsed.data.keywords || null,
      messageTemplate: parsed.data.messageTemplate,
    }).returning();
    
    res.status(201).json(automation);
  } catch (err) {
    req.log.error({ err }, "Error creating TikTok automation");
    res.status(500).json({ error: "server_error", message: "Failed to create TikTok automation" });
  }
});

/**
 * PATCH /api/tiktok/automations/:id
 * Updates an existing TikTok automation.
 */
router.patch("/tiktok/automations/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const employeeId = req.employee!.employeeId;
  const parsed = AutomationSchema.partial().safeParse(req.body);
  
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });
  if (!parsed.success) return res.status(400).json({ error: "validation_error", message: parsed.error.message });
  
  try {
    const [automation] = await db.update(tiktokAutomationsTable)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(tiktokAutomationsTable.id, id),
        eq(tiktokAutomationsTable.employeeId, employeeId)
      ))
      .returning();
      
    if (!automation) return res.status(404).json({ error: "not_found", message: "Automation not found" });
    
    res.json(automation);
  } catch (err) {
    req.log.error({ err }, "Error updating TikTok automation");
    res.status(500).json({ error: "server_error", message: "Failed to update TikTok automation" });
  }
});

/**
 * DELETE /api/tiktok/automations/:id
 * Deletes a TikTok automation.
 */
router.delete("/tiktok/automations/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const employeeId = req.employee!.employeeId;
  
  if (isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });
  
  try {
    await db.delete(tiktokAutomationsTable).where(and(
      eq(tiktokAutomationsTable.id, id),
      eq(tiktokAutomationsTable.employeeId, employeeId)
    ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting TikTok automation");
    res.status(500).json({ error: "server_error", message: "Failed to delete TikTok automation" });
  }
});

export default router;
