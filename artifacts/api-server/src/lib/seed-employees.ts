import bcrypt from "bcryptjs";
import { db, employeesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_EMPLOYEES = [
  { name: "James Smith", initials: "JS", role: "Administrator", username: "james", pin: "1234" },
  { name: "Sara Ahmed", initials: "SA", role: "Agent", username: "sara", pin: "2345" },
  { name: "Mohamed Ali", initials: "MA", role: "Agent", username: "mohamed", pin: "3456" },
  { name: "Nadia Hassan", initials: "NH", role: "Agent", username: "nadia", pin: "4567" },
];

export async function seedEmployees() {
  try {
    const existing = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeesTable);

    const count = existing[0]?.count ?? 0;
    if (count > 0) {
      logger.info({ count }, "Employees already seeded, skipping");
      return;
    }

    const values = await Promise.all(
      DEFAULT_EMPLOYEES.map(async (e) => ({
        name: e.name,
        initials: e.initials,
        role: e.role,
        username: e.username,
        pinHash: await bcrypt.hash(e.pin, 12),
      }))
    );

    await db.insert(employeesTable).values(values);
    logger.info("Seeded default employees with bcrypt hashed PINs");
  } catch (err) {
    logger.error({ err }, "Failed to seed employees");
  }
}
