import { db, employeesTable } from "./lib/db/src/index.ts";
import { eq } from "drizzle-orm";

async function check() {
  const all = await db.select().from(employeesTable);
  console.log(JSON.stringify(all, null, 2));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
