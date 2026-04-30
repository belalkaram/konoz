import bcrypt from "bcryptjs";
import { db, employeesTable, companiesTable, branchesTable, customersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_EMPLOYEES = [
  { name: "James Smith", initials: "JS", role: "Administrator", username: "james", pin: "1234" },
  { name: "Sara Ahmed", initials: "SA", role: "Supervisor", username: "sara", pin: "2345" },
  { name: "Belal Karam", initials: "BK", role: "Administrator", username: "belalkaram", pin: "123456" },
];

const AGENTS = [
  { name: "Mohamed Ali", initials: "MA", role: "Employee", username: "mohamed", pin: "3456", supervisorUsername: "sara" },
  { name: "Nadia Hassan", initials: "NH", role: "Employee", username: "nadia", pin: "4567", supervisorUsername: "sara" },
];

export async function seedEmployees() {
  try {
    const existing = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeesTable);

    const count = existing[0]?.count ?? 0;
    if (count > 0) {
      logger.info({ count }, "Employees already exist, ensuring company and branch exist");
      
      let [company] = await db.select().from(companiesTable).limit(1);
      if (!company) {
        [company] = await db.insert(companiesTable).values({ name: "Default Company" }).returning();
      }
      
      let [branch] = await db.select().from(branchesTable).where(eq(branchesTable.companyId, company.id)).limit(1);
      if (!branch) {
        [branch] = await db.insert(branchesTable).values({ name: "Main Branch", companyId: company.id }).returning();
      }
      
      // Assign existing employees to this company if they don't have one
      await db.update(employeesTable).set({ companyId: company.id, branchId: branch.id }).where(sql`company_id IS NULL`);

      // Assign existing customers to this company based on their assigned employee
      await db.execute(sql`
        UPDATE ${customersTable}
        SET company_id = e.company_id
        FROM ${employeesTable} e
        WHERE ${customersTable.assignedEmployeeId} = e.id
        AND ${customersTable.companyId} IS NULL
      `);

      return;
    }

    // 0. Create Company and Branch
    const [company] = await db.insert(companiesTable).values({ name: "Default Company" }).returning();
    const [branch] = await db.insert(branchesTable).values({ name: "Main Branch", companyId: company.id }).returning();

    // 1. Insert Admins and Supervisors
    const topLevelValues = await Promise.all(
      DEFAULT_EMPLOYEES.map(async (e) => ({
        name: e.name,
        initials: e.initials,
        role: e.role,
        username: e.username,
        pinHash: await bcrypt.hash(e.pin, 12),
        companyId: company.id,
        branchId: branch.id,
      }))
    );

    const insertedTopLevel = await db.insert(employeesTable).values(topLevelValues).returning();
    const supervisorMap = new Map(insertedTopLevel.map(e => [e.username, e.id]));

    // 2. Insert Employees linked to Supervisors
    const agentValues = await Promise.all(
      AGENTS.map(async (e) => ({
        name: e.name,
        initials: e.initials,
        role: e.role,
        username: e.username,
        pinHash: await bcrypt.hash(e.pin, 12),
        supervisorId: supervisorMap.get(e.supervisorUsername),
        companyId: company.id,
        branchId: branch.id,
      }))
    );

    await db.insert(employeesTable).values(agentValues);
    logger.info("Seeded default employees with hierarchical roles and company assignment");
  } catch (err) {
    logger.error({ err }, "Failed to seed employees");
  }
}
