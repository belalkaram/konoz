import { Router } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import { db, whatsappFollowupSequencesTable, whatsappFollowupStepsTable, whatsappActiveFollowupsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

const router = Router();

const SequenceSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});

const StepSchema = z.object({
  delayHours: z.number().min(0),
  messageTemplate: z.string().min(1),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  stepOrder: z.number().min(1),
});

/**
 * GET /api/whatsapp/automations/sequences
 */
router.get("/whatsapp/automations/sequences", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  
  try {
    const sequences = await db
      .select()
      .from(whatsappFollowupSequencesTable)
      .where(eq(whatsappFollowupSequencesTable.employeeId, employeeId))
      .orderBy(desc(whatsappFollowupSequencesTable.createdAt));
      
    // Fetch steps for each sequence
    const sequencesWithSteps = await Promise.all(sequences.map(async (seq) => {
      const steps = await db
        .select()
        .from(whatsappFollowupStepsTable)
        .where(eq(whatsappFollowupStepsTable.sequenceId, seq.id))
        .orderBy(asc(whatsappFollowupStepsTable.stepOrder));
      return { ...seq, steps };
    }));
      
    res.json(sequencesWithSteps);
  } catch (err) {
    req.log.error({ err }, "Error fetching sequences");
    res.status(500).json({ error: "server_error", message: "Failed to fetch sequences" });
  }
});

/**
 * POST /api/whatsapp/automations/sequences
 */
router.post("/whatsapp/automations/sequences", requireAuth, async (req, res) => {
  const employeeId = req.employee!.employeeId;
  const parsed = SequenceSchema.safeParse(req.body);
  
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  
  try {
    const [sequence] = await db.insert(whatsappFollowupSequencesTable).values({
      employeeId,
      name: parsed.data.name,
      isActive: parsed.data.isActive ?? true,
    }).returning();
    
    res.status(201).json({ ...sequence, steps: [] });
  } catch (err) {
    req.log.error({ err }, "Error creating sequence");
    res.status(500).json({ error: "server_error", message: "Failed to create sequence" });
  }
});

/**
 * POST /api/whatsapp/automations/sequences/:id/steps
 */
router.post("/whatsapp/automations/sequences/:id/steps", requireAuth, async (req, res) => {
  const sequenceId = parseInt(req.params.id as string);
  const parsed = StepSchema.safeParse(req.body);
  
  if (isNaN(sequenceId)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ID" });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  
  try {
    const [step] = await db.insert(whatsappFollowupStepsTable).values({
      sequenceId,
      delayHours: parsed.data.delayHours,
      messageTemplate: parsed.data.messageTemplate,
      mediaUrl: parsed.data.mediaUrl || null,
      mediaType: parsed.data.mediaType || null,
      stepOrder: parsed.data.stepOrder,
    }).returning();
    
    res.status(201).json(step);
  } catch (err) {
    req.log.error({ err }, "Error creating step");
    res.status(500).json({ error: "server_error", message: "Failed to create step" });
  }
});

/**
 * DELETE /api/whatsapp/automations/sequences/:id
 */
router.delete("/whatsapp/automations/sequences/:id", requireAuth, async (req, res) => {
  const sequenceId = parseInt(req.params.id as string);
  const employeeId = req.employee!.employeeId;
  
  if (isNaN(sequenceId)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ID" });
    return;
  }
  
  try {
    await db.delete(whatsappFollowupSequencesTable).where(and(
      eq(whatsappFollowupSequencesTable.id, sequenceId),
      eq(whatsappFollowupSequencesTable.employeeId, employeeId)
    ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting sequence");
    res.status(500).json({ error: "server_error", message: "Failed to delete sequence" });
  }
});

/**
 * DELETE /api/whatsapp/automations/steps/:id
 */
router.delete("/whatsapp/automations/steps/:id", requireAuth, async (req, res) => {
  const stepId = parseInt(req.params.id as string);
  
  if (isNaN(stepId)) {
    res.status(400).json({ error: "validation_error", message: "Invalid ID" });
    return;
  }
  
  try {
    await db.delete(whatsappFollowupStepsTable).where(eq(whatsappFollowupStepsTable.id, stepId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting step");
    res.status(500).json({ error: "server_error", message: "Failed to delete step" });
  }
});

export default router;
