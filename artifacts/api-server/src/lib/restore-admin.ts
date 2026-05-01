import { config } from "dotenv";
config({ path: "../../.env" });
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  await db.update(employeesTable).set({role: 'Administrator'}).where(eq(employeesTable.username, 'admin'));
  console.log("Admin user restored to Administrator role.");
  process.exit(0);
}

run();
