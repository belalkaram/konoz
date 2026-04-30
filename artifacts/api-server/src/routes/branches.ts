import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, branchesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth.js";
import { insertBranchSchema, updateBranchSchema } from "@workspace/db/schema";

const router = Router();

router.get("/branches", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(branchesTable).orderBy(asc(branchesTable.name));
    res.json({ branches: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing branches");
    res.status(500).json({ error: "server_error", message: "Failed to list branches" });
  }
});

router.post("/branches", requireAdmin, async (req, res) => {
  const parsed = insertBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [branch] = await db.insert(branchesTable).values(parsed.data).returning();
    res.status(201).json({ branch });
  } catch (err) {
    req.log.error({ err }, "Error creating branch");
    res.status(500).json({ error: "server_error", message: "Failed to create branch" });
  }
});

router.put("/branches/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [branch] = await db
      .update(branchesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(branchesTable.id, id))
      .returning();
    if (!branch) {
      res.status(404).json({ error: "not_found", message: "Branch not found" });
      return;
    }
    res.json({ branch });
  } catch (err) {
    req.log.error({ err }, "Error updating branch");
    res.status(500).json({ error: "server_error", message: "Failed to update branch" });
  }
});

export default router;
