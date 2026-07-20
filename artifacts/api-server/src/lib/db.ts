import pkg from 'pg';
const { Pool } = pkg;

const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.SUPABASE_DB_URL;

// Neon API key (for management API, not for database connections)
// Get it from https://console.neon.tech -> API Keys
const NEON_API_KEY = process.env.NEON_API_KEY;

if (!DB_URL) {
  console.error('[DB] FATAL: DATABASE_URL environment variable is not set.');
  console.error('  Set DATABASE_URL to your NeonDB connection string.');
  console.error('  Example: postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
