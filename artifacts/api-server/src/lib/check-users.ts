import { config } from "dotenv";
config({ path: "../../.env" });
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  const users = await db.select({username: employeesTable.username, role: employeesTable.role}).from(employeesTable);
  console.log(users);
  
  // also check the "admin" user specifically
  const [adminUser] = await db.select().from(employeesTable).where(eq(employeesTable.username, 'admin'));
  console.log("Admin user:", adminUser);
  process.exit(0);
}

run();
