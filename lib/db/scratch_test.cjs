const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.kitvbnegjhmygfhzpmgq:Konooz%40Konooz@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true' });

client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
  .then(res => {
    console.log(res.rows);
    client.end();
  })
  .catch(console.error);
