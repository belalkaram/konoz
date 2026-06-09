import { Router } from "express";
import { eq, desc, asc, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  expensesTable,
  expenseCategoriesTable,
  payrollsTable,
  employeesTable,
  ticketsTable,
  paymentsTable,
  customersTable,
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
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message });
      return;
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
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message });
      return;
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
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message });
      return;
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
      res.json({ payroll: updated });
      return;
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

router.get("/accounting/report", requireSupervisorOrAdmin, async (req, res) => {
  try {
    const session = req.employee!;
    const { startDate: qStart, endDate: qEnd } = req.query as Record<string, string | undefined>;

    const now = new Date();
    const startDate = qStart ? new Date(qStart) : new Date(now.getTime() - 30 * 86400000);
    const endDate = qEnd ? new Date(qEnd) : now;

    const companyId = session.companyId;

    // 1. Fetch Expenses
    const expenseConditions: any[] = [
      gte(expensesTable.date, startDate),
      lte(expensesTable.date, endDate),
    ];
    if (companyId) {
      expenseConditions.push(eq(expensesTable.companyId, companyId));
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
      })
      .from(expensesTable)
      .leftJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
      .where(and(...expenseConditions))
      .orderBy(desc(expensesTable.date));

    // 2. Fetch Payrolls
    const payrollConditions: any[] = [];
    if (companyId) {
      payrollConditions.push(eq(payrollsTable.companyId, companyId));
    }
    payrollConditions.push(
      sql`(
        (${payrollsTable.paymentDate} IS NOT NULL AND ${payrollsTable.paymentDate} >= ${startDate} AND ${payrollsTable.paymentDate} <= ${endDate})
        OR
        (${payrollsTable.paymentDate} IS NULL AND ${payrollsTable.createdAt} >= ${startDate} AND ${payrollsTable.createdAt} <= ${endDate})
      )`
    );
    const payrolls = await db
      .select({
        id: payrollsTable.id,
        employeeName: employeesTable.name,
        month: payrollsTable.month,
        year: payrollsTable.year,
        baseSalary: payrollsTable.baseSalary,
        commissionEarned: payrollsTable.commissionEarned,
        deductions: payrollsTable.deductions,
        netSalary: payrollsTable.netSalary,
        status: payrollsTable.status,
        currency: payrollsTable.currency,
        paymentDate: payrollsTable.paymentDate,
      })
      .from(payrollsTable)
      .innerJoin(employeesTable, eq(payrollsTable.employeeId, employeesTable.id))
      .where(and(...payrollConditions))
      .orderBy(desc(payrollsTable.year), desc(payrollsTable.month));

    // 3. Fetch Tickets
    const ticketConditions: any[] = [
      gte(ticketsTable.createdAt, startDate),
      lte(ticketsTable.createdAt, endDate),
    ];

    if (companyId) {
      const tickets = await db
        .select({
          id: ticketsTable.id,
          customerName: customersTable.fullName,
          employeeName: employeesTable.name,
          flightRoute: ticketsTable.flightRoute,
          price: ticketsTable.price,
          costPrice: ticketsTable.costPrice,
          currency: ticketsTable.currency,
          ticketStatus: ticketsTable.ticketStatus,
          createdAt: ticketsTable.createdAt,
        })
        .from(ticketsTable)
        .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
        .innerJoin(employeesTable, and(
          eq(ticketsTable.employeeId, employeesTable.id),
          eq(employeesTable.companyId, companyId)
        ))
        .where(and(...ticketConditions))
        .orderBy(desc(ticketsTable.createdAt));

      const paymentConditions: any[] = [
        gte(paymentsTable.paymentDate, startDate),
        lte(paymentsTable.paymentDate, endDate),
      ];
      const payments = await db
        .select({
          id: paymentsTable.id,
          amount: paymentsTable.amount,
          currency: paymentsTable.currency,
          paymentMethod: paymentsTable.paymentMethod,
          paymentDate: paymentsTable.paymentDate,
          customerName: customersTable.fullName,
          flightRoute: ticketsTable.flightRoute,
        })
        .from(paymentsTable)
        .leftJoin(ticketsTable, eq(paymentsTable.ticketId, ticketsTable.id))
        .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
        .innerJoin(employeesTable, and(
          eq(ticketsTable.employeeId, employeesTable.id),
          eq(employeesTable.companyId, companyId)
        ))
        .where(and(...paymentConditions))
        .orderBy(desc(paymentsTable.paymentDate));

      return res.json(buildReport(startDate, endDate, expenses, payrolls, tickets, payments));
    }

    const tickets = await db
      .select({
        id: ticketsTable.id,
        customerName: customersTable.fullName,
        employeeName: employeesTable.name,
        flightRoute: ticketsTable.flightRoute,
        price: ticketsTable.price,
        costPrice: ticketsTable.costPrice,
        currency: ticketsTable.currency,
        ticketStatus: ticketsTable.ticketStatus,
        createdAt: ticketsTable.createdAt,
      })
      .from(ticketsTable)
      .leftJoin(customersTable, eq(ticketsTable.customerId, customersTable.id))
      .leftJoin(employeesTable, eq(ticketsTable.employeeId, employeesTable.id))
      .where(and(...ticketConditions))
      .orderBy(desc(ticketsTable.createdAt));

    const paymentConditions: any[] = [
      gte(paymentsTable.paymentDate, startDate),
      lte(paymentsTable.paymentDate, endDate),
    ];
    const payments = await db
      .select({
        id: paymentsTable.id,
        amount: paymentsTable.amount,
        currency: paymentsTable.currency,
        paymentMethod: paymentsTable.paymentMethod,
        paymentDate: paymentsTable.paymentDate,
        customerName: customersTable.fullName,
        flightRoute: ticketsTable.flightRoute,
      })
      .from(paymentsTable)
      .leftJoin(ticketsTable, eq(paymentsTable.ticketId, ticketsTable.id))
      .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
      .leftJoin(employeesTable, eq(ticketsTable.employeeId, employeesTable.id))
      .where(and(...paymentConditions))
      .orderBy(desc(paymentsTable.paymentDate));

    return res.json(buildReport(startDate, endDate, expenses, payrolls, tickets, payments));
  } catch (err) {
    req.log.error({ err }, "Error generating accounting report");
    return res.status(500).json({ error: "server_error", message: "Failed to generate accounting report" });
  }
});

function buildReport(
  startDate: Date,
  endDate: Date,
  expenses: any[],
  payrolls: any[],
  tickets: any[],
  payments: any[]
) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalExpenses = 0;
  let rentExpenses = 0;
  let generalExpenses = 0;
  let totalSalaries = 0;
  let totalPayments = 0;

  tickets.forEach((t) => {
    const price = parseFloat(String(t.price ?? "0")) || 0;
    const cost = parseFloat(String(t.costPrice ?? "0")) || 0;
    if (["confirmed", "paid", "issued"].includes(t.ticketStatus)) {
      totalRevenue += price;
      totalCost += cost;
    }
  });

  expenses.forEach((e) => {
    const amt = parseFloat(String(e.amount ?? "0")) || 0;
    totalExpenses += amt;
    const catName = (e.categoryName || "").toLowerCase();
    if (catName.includes("rent") || catName.includes("إيجار") || catName.includes("ايجار")) {
      rentExpenses += amt;
    } else {
      generalExpenses += amt;
    }
  });

  payrolls.forEach((p) => {
    const sal = parseFloat(String(p.netSalary ?? "0")) || 0;
    totalSalaries += sal;
  });

  payments.forEach((p) => {
    const amt = parseFloat(String(p.amount ?? "0")) || 0;
    totalPayments += amt;
  });

  // Net profit = revenue minus ticket cost, general expenses, and salaries
  const netProfit = totalRevenue - totalCost - totalExpenses - totalSalaries;

  return {
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    expenses,
    payrolls,
    tickets,
    payments,
    stats: {
      totalRevenue,
      totalCost,
      netProfit,
      totalExpenses,
      rentExpenses,
      generalExpenses,
      totalSalaries,
      totalPayments,
    },
  };
}

export default router;
