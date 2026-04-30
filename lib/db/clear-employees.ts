import { db, employeesTable } from "./src/index";
import { sql } from "drizzle-orm";

async function clearEmployees() {
  console.log("Clearing employees table...");
  await db.delete(employeesTable);
  console.log("Done.");
  process.exit(0);
}

clearEmployees().catch(err => {
  console.error(err);
  process.exit(1);
});
