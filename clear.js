const { Client } = require('pg');
const client = new Client("postgresql://postgres.kitvbnegjhmygfhzpmgq:Konooz%40Konooz@aws-0-eu-west-1.pooler.supabase.com:6543/postgres");

async function run() {
  await client.connect();
  console.log("Deleting employees...");
  await client.query("DELETE FROM employees CASCADE;");
  console.log("Deleted.");
  await client.end();
}

run().catch(console.error);
