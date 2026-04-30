import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, companiesTable, branchesTable, employeesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth.js";
import { insertCompanySchema, updateCompanySchema } from "@workspace/db/schema";

const router = Router();

router.get("/companies", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(companiesTable).orderBy(asc(companiesTable.name));
    res.json({ companies: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing companies");
    res.status(500).json({ error: "server_error", message: "Failed to list companies" });
  }
});

router.post("/companies", requireAdmin, async (req, res) => {
  const parsed = insertCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [company] = await db.insert(companiesTable).values(parsed.data).returning();
    res.status(201).json({ company });
  } catch (err) {
    req.log.error({ err }, "Error creating company");
    res.status(500).json({ error: "server_error", message: "Failed to create company" });
  }
});

router.put("/companies/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  try {
    const [company] = await db
      .update(companiesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(companiesTable.id, id))
      .returning();
    if (!company) {
      res.status(404).json({ error: "not_found", message: "Company not found" });
      return;
    }
    res.json({ company });
  } catch (err) {
    req.log.error({ err }, "Error updating company");
    res.status(500).json({ error: "server_error", message: "Failed to update company" });
  }
});

router.get("/companies/:id/branches", requireAdmin, async (req, res) => {
  const companyId = Number(req.params.id);
  try {
    const rows = await db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId)).orderBy(asc(branchesTable.name));
    res.json({ branches: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing branches");
    res.status(500).json({ error: "server_error", message: "Failed to list branches" });
  }
});

export default router;
