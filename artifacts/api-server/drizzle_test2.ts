import { db } from "@workspace/db";
import { customersTable, ticketsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";

async function run() {
  const baseQuery = db
    .select({
      id: customersTable.id,
      fullName: customersTable.fullName,
      pnr: sql<string | null>`(
        SELECT t.pnr FROM tickets t 
        WHERE t.customer_id = "customers"."id" 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      bookingDate: sql<string | null>`(
        SELECT COALESCE(t.booking_date::text, t.created_at::text) FROM tickets t 
        WHERE t.customer_id = "customers"."id" 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      travelDate: sql<string | null>`(
        SELECT t.departure_datetime::text FROM tickets t 
        WHERE t.customer_id = "customers"."id" 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      costPrice: sql<string | null>`(
        SELECT t.cost_price FROM tickets t 
        WHERE t.customer_id = "customers"."id" 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`,
      sellingPrice: sql<string | null>`(
        SELECT t.price FROM tickets t 
        WHERE t.customer_id = "customers"."id" 
        ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      )`
    })
    .from(customersTable)
    .orderBy(desc(customersTable.id))
    .limit(5);

  const res = await baseQuery;
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

run().catch(console.error);
