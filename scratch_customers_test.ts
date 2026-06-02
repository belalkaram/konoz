import { db, customersTable, ticketsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";

async function main() {
  const baseQuery = db
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      pnr: sql<string | null>`(
        SELECT t.pnr FROM tickets t 
        WHERE t.customer_id = ${customersTable.id} 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      bookingDate: sql<string | null>`(
        SELECT COALESCE(t.booking_date::text, t.created_at::text) FROM tickets t 
        WHERE t.customer_id = ${customersTable.id} 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      travelDate: sql<string | null>`(
        SELECT t.departure_datetime::text FROM tickets t 
        WHERE t.customer_id = ${customersTable.id} 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      costPrice: sql<string | null>`(
        SELECT t.cost_price FROM tickets t 
        WHERE t.customer_id = ${customersTable.id} 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      sellingPrice: sql<string | null>`(
        SELECT t.price FROM tickets t 
        WHERE t.customer_id = ${customersTable.id} 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
    })
    .from(customersTable)
    .orderBy(desc(customersTable.id))
    .limit(10);

  console.log("SQL:", baseQuery.toSQL());

  const customers = await baseQuery;
  console.log(JSON.stringify(customers, null, 2));
  process.exit(0);
}

main().catch(console.error);
