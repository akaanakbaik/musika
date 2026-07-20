const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error('✗ DATABASE_URL environment variable is required.');
  process.exit(1);
}

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  
  const tables = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('Tables:', tables.rows.map(r => r.table_name));
  
  const users = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
  );
  console.log('users columns:', JSON.stringify(users.rows, null, 2));
  
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
