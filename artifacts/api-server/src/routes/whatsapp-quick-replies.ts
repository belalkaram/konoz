import { Router } from "express";
import { eq, desc, asc, ilike, and, or } from "drizzle-orm";
import { db, whatsappQuickRepliesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const QuickReplySchema = z.object({
  shortcut: z.string().min(1),
  messageBody: z.string().min(1),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  keywords: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/whatsapp/quick-replies
 * Get all quick replies for an employee
 */
router.get("/whatsapp/quick-replies", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const replies = await db
      .select()
      .from(whatsappQuickRepliesTable)
      .where(eq(whatsappQuickRepliesTable.employeeId, employeeId))
      .orderBy(desc(whatsappQuickRepliesTable.createdAt));
      
    res.json(replies);
  } catch (err) {
    req.log.error({ err }, "Error fetching quick replies");
    res.status(500).json({ error: "server_error", message: "Failed to fetch quick replies" });
  }
});

/**
 * POST /api/whatsapp/quick-replies
 * Create a new quick reply
 */
router.post("/whatsapp/quick-replies", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const parsed = QuickReplySchema.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", message: parsed.error.message });
  }
  
  try {
    const [reply] = await db.insert(whatsappQuickRepliesTable).values({
      employeeId,
      shortcut: parsed.data.shortcut,
      messageBody: parsed.data.messageBody,
      mediaUrl: parsed.data.mediaUrl || null,
      mediaType: parsed.data.mediaType || null,
      keywords: parsed.data.keywords || null,
      category: parsed.data.category || "general",
      isActive: parsed.data.isActive ?? true,
    }).returning();
    
    res.status(201).json(reply);
  } catch (err) {
    req.log.error({ err }, "Error creating quick reply");
    res.status(500).json({ error: "server_error", message: "Failed to create quick reply" });
  }
});

/**
 * PUT /api/whatsapp/quick-replies/:id
 * Update a quick reply
 */
router.put("/whatsapp/quick-replies/:id", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const replyId = parseInt(req.params.id);
  const parsed = QuickReplySchema.safeParse(req.body);
  
  if (isNaN(replyId)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });
  if (!parsed.success) return res.status(400).json({ error: "validation_error", message: parsed.error.message });
  
  try {
    const [reply] = await db.update(whatsappQuickRepliesTable).set({
      shortcut: parsed.data.shortcut,
      messageBody: parsed.data.messageBody,
      mediaUrl: parsed.data.mediaUrl || null,
      mediaType: parsed.data.mediaType || null,
      keywords: parsed.data.keywords || null,
      category: parsed.data.category || "general",
      isActive: parsed.data.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(and(
      eq(whatsappQuickRepliesTable.id, replyId),
      eq(whatsappQuickRepliesTable.employeeId, employeeId)
    ))
    .returning();
    
    if (!reply) return res.status(404).json({ error: "not_found", message: "Quick reply not found" });
    
    res.json(reply);
  } catch (err) {
    req.log.error({ err }, "Error updating quick reply");
    res.status(500).json({ error: "server_error", message: "Failed to update quick reply" });
  }
});

/**
 * DELETE /api/whatsapp/quick-replies/:id
 * Delete a quick reply
 */
router.delete("/whatsapp/quick-replies/:id", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const replyId = parseInt(req.params.id);
  
  if (isNaN(replyId)) return res.status(400).json({ error: "validation_error", message: "Invalid ID" });
  
  try {
    await db.delete(whatsappQuickRepliesTable).where(and(
      eq(whatsappQuickRepliesTable.id, replyId),
      eq(whatsappQuickRepliesTable.employeeId, employeeId)
    ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting quick reply");
    res.status(500).json({ error: "server_error", message: "Failed to delete quick reply" });
  }
});

export default router;
