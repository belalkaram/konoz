const { Client } = require('pg');
const client = new Client("postgresql://postgres.kitvbnegjhmygfhzpmgq:Konooz%40Konooz@aws-0-eu-west-1.pooler.supabase.com:6543/postgres");

async function run() {
  await client.connect();
  console.log("Updating roles and hierarchy...");
  
  // 1. Update Sara to Supervisor
  await client.query("UPDATE employees SET role = 'Supervisor' WHERE username = 'sara';");
  
  // 2. Get Sara's ID
  const res = await client.query("SELECT id FROM employees WHERE username = 'sara';");
  const supervisorId = res.rows[0]?.id;
  
  if (supervisorId) {
    console.log(`Sara's ID is ${supervisorId}. Linking agents...`);
    // 3. Link mohamed and nadia to sara
    await client.query(`UPDATE employees SET supervisor_id = ${supervisorId} WHERE username IN ('mohamed', 'nadia');`);
    console.log("Agents linked.");
  } else {
    console.log("Sara not found.");
  }
  
  await client.end();
}

run().catch(console.error);
