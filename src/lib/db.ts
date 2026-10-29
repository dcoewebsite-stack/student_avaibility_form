import { Pool } from 'pg';

// Supports Cloud-hosted Serverless PostgreSQL (Neon.tech, Supabase Postgres, Render, Railway, etc.)
const connectionString = process.env.DATABASE_URL || '';

const isCloudPostgres = connectionString.includes('neon.tech') || 
                        connectionString.includes('supabase.com') || 
                        connectionString.includes('render.com') || 
                        connectionString.includes('railway.app') ||
                        connectionString.includes('aws.neon.tech') ||
                        connectionString.includes('sslmode=require');

export const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/gamyform',
  // Enable SSL automatically for cloud-hosted PostgreSQL providers
  ssl: isCloudPostgres || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error: any) {
    console.error('Database query error:', error.message);
    throw error;
  }
}
