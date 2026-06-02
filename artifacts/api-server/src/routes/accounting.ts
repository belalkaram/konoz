import { Router } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  expensesTable,
  expenseCategoriesTable,
  payrollsTable,
  employeesTable,
} from "@workspace/db";
import { requireSupervisorOrAdmin, getSessionFromRequest } from "../middlewares/auth.js";

const router = Router();

// ================= Expenses =================

const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().default("general"),
});

const CreateExpenseSchema = z.object({
  categoryId: z.number(),
  amount: z.number().min(0),
  currency: z.string().default("KWD"),
  date: z.string().transform((str) => new Date(str)),
  description: z.string().optional(),
});

router.get("/accounting/expense-categories", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const session = req.employee!;
    // If you have company scoping, filter by it. Assuming session has companyId
    const conditions = [];
    if (session.companyId) {
      conditions.push(eq(expenseCategoriesTable.companyId, session.companyId));
    }
    const categories = await db
      .select()
      .from(expenseCategoriesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(expenseCategoriesTable.name));

    res.json({ expenseCategories: categories });
  } catch (err) {
    req.log.error({ err }, "Error listing expense categories");
    res.status(500).json({ error: "server_error", message: "Failed to list expense categories" });
  }
});

router.post("/accounting/expense-categories", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const parsed = CreateExpenseCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message });
    }
    const session = req.employee!;
    const [category] = await db
      .insert(expenseCategoriesTable)
      .values({
        name: parsed.data.name,
        type: parsed.data.type,
        companyId: session.companyId ?? null,
      })
      .returning();

    res.status(201).json({ expenseCategory: category });
  } catch (err) {
    req.log.error({ err }, "Error creating expense category");
    res.status(500).json({ error: "server_error", message: "Failed to create expense category" });
  }
});

router.get("/accounting/expenses", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const session = req.employee!;
    const conditions = [];
    if (session.companyId) {
      conditions.push(eq(expensesTable.companyId, session.companyId));
    }

    const expenses = await db
      .select({
        id: expensesTable.id,
        amount: expensesTable.amount,
        currency: expensesTable.currency,
        date: expensesTable.date,
        description: expensesTable.description,
        categoryId: expensesTable.categoryId,
        categoryName: expenseCategoriesTable.name,
        createdBy: expensesTable.createdBy,
        creatorName: employeesTable.name,
        createdAt: expensesTable.createdAt,
      })
      .from(expensesTable)
      .leftJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
      .leftJoin(employeesTable, eq(expensesTable.createdBy, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expensesTable.date));

    res.json({ expenses });
  } catch (err) {
    req.log.error({ err }, "Error listing expenses");
    res.status(500).json({ error: "server_error", message: "Failed to list expenses" });
  }
});

router.post("/accounting/expenses", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const parsed = CreateExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message });
    }
    const session = req.employee!;
    const [expense] = await db
      .insert(expensesTable)
      .values({
        categoryId: parsed.data.categoryId,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        date: parsed.data.date,
        description: parsed.data.description,
        createdBy: session.employeeId,
        companyId: session.companyId ?? null,
      })
      .returning();

    res.status(201).json({ expense });
  } catch (err) {
    req.log.error({ err }, "Error creating expense");
    res.status(500).json({ error: "server_error", message: "Failed to create expense" });
  }
});

// ================= Payrolls =================

const CreatePayrollSchema = z.object({
  employeeId: z.number(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
  baseSalary: z.number().min(0),
  commissionPercentage: z.number().min(0).max(100),
  commissionEarned: z.number().min(0),
  deductions: z.number().min(0),
  netSalary: z.number().min(0),
  status: z.string().default("pending"),
  currency: z.string().default("KWD"),
  paymentDate: z.string().optional().nullable().transform(str => str ? new Date(str) : null),
  notes: z.string().optional(),
});

router.get("/accounting/payrolls", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const session = req.employee!;
    
    const conditions = [];
    if (session.companyId) {
      conditions.push(eq(payrollsTable.companyId, session.companyId));
    }
    if (month) conditions.push(eq(payrollsTable.month, parseInt(month)));
    if (year) conditions.push(eq(payrollsTable.year, parseInt(year)));

    const payrolls = await db
      .select({
        id: payrollsTable.id,
        employeeId: payrollsTable.employeeId,
        employeeName: employeesTable.name,
        month: payrollsTable.month,
        year: payrollsTable.year,
        baseSalary: payrollsTable.baseSalary,
        commissionPercentage: payrollsTable.commissionPercentage,
        commissionEarned: payrollsTable.commissionEarned,
        deductions: payrollsTable.deductions,
        netSalary: payrollsTable.netSalary,
        status: payrollsTable.status,
        currency: payrollsTable.currency,
        paymentDate: payrollsTable.paymentDate,
        notes: payrollsTable.notes,
      })
      .from(payrollsTable)
      .innerJoin(employeesTable, eq(payrollsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payrollsTable.year), desc(payrollsTable.month), asc(employeesTable.name));

    res.json({ payrolls });
  } catch (err) {
    req.log.error({ err }, "Error listing payrolls");
    res.status(500).json({ error: "server_error", message: "Failed to list payrolls" });
  }
});

router.post("/accounting/payrolls", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const parsed = CreatePayrollSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message });
    }
    const session = req.employee!;
    
    // Check if payroll already exists for this employee for this month/year
    const [existing] = await db.select().from(payrollsTable).where(
      and(
        eq(payrollsTable.employeeId, parsed.data.employeeId),
        eq(payrollsTable.month, parsed.data.month),
        eq(payrollsTable.year, parsed.data.year)
      )
    );

    if (existing) {
      // Update existing
      const [updated] = await db.update(payrollsTable)
        .set({
          baseSalary: parsed.data.baseSalary,
          commissionPercentage: parsed.data.commissionPercentage,
          commissionEarned: parsed.data.commissionEarned,
          deductions: parsed.data.deductions,
          netSalary: parsed.data.netSalary,
          status: parsed.data.status,
          currency: parsed.data.currency,
          paymentDate: parsed.data.paymentDate,
          notes: parsed.data.notes,
          updatedAt: new Date(),
        })
        .where(eq(payrollsTable.id, existing.id))
        .returning();
      return res.json({ payroll: updated });
    }

    const [payroll] = await db
      .insert(payrollsTable)
      .values({
        employeeId: parsed.data.employeeId,
        month: parsed.data.month,
        year: parsed.data.year,
        baseSalary: parsed.data.baseSalary,
        commissionPercentage: parsed.data.commissionPercentage,
        commissionEarned: parsed.data.commissionEarned,
        deductions: parsed.data.deductions,
        netSalary: parsed.data.netSalary,
        status: parsed.data.status,
        currency: parsed.data.currency,
        paymentDate: parsed.data.paymentDate,
        notes: parsed.data.notes,
        companyId: session.companyId ?? null,
      })
      .returning();

    res.status(201).json({ payroll });
  } catch (err) {
    req.log.error({ err }, "Error creating/updating payroll");
    res.status(500).json({ error: "server_error", message: "Failed to process payroll" });
  }
});

export default router;
