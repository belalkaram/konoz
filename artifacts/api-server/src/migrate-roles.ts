import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Updating Agent roles to Employee...");
  const result = await db.update(employeesTable)
    .set({ role: "Employee" })
    .where(eq(employeesTable.role, "Agent"));
  console.log("Migration completed.");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
