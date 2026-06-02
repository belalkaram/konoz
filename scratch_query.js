const { Client } = require('pg');

const dbUrl = "postgresql://postgres.kitvbnegjhmygfhzpmgq:Konooz%40Konooz@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const query = `
    SELECT 
      "id",
      "full_name",
      (
          SELECT t.departure_datetime::text FROM tickets t 
          WHERE t.customer_id = customers.id 
          ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      ) as travel_date,
      (
          SELECT t.pnr FROM tickets t 
          WHERE t.customer_id = customers.id 
          ORDER BY t.created_at DESC, t.id DESC LIMIT 1
      ) as pnr
    FROM customers
    ORDER BY "id" DESC
    LIMIT 10;
  `;

  try {
    const res = await client.query(query);
    console.log("Raw SQL:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
