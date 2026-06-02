import { db } from "./src/lib/db.js"; // Wait, db is from @workspace/db?

import { db as dbWorkspace, customersTable, ticketsTable, employeesTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";

async function run() {
  const baseQuery = dbWorkspace
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      pnr: sql<string | null>`(
        SELECT t.pnr FROM tickets t 
        WHERE t.customer_id = customers.id 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`
    })
    .from(customersTable)
    .orderBy(desc(customersTable.id));

  console.log("SQL:", baseQuery.toSQL());
  process.exit(0);
}

run().catch(console.error);
