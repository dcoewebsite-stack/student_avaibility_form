import { Pool } from 'pg';

// Supports Cloud-hosted Serverless PostgreSQL (Neon.tech, Supabase Postgres, Render, Railway, Vercel Postgres, etc.)
// Check multiple common environment variable names used by Vercel and hosting providers
function resolveConnectionString(): string {
  const possibleKeys = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'NEON_DATABASE_URL',
  ];

  for (const key of possibleKeys) {
    let val = (process.env[key] || '').trim();
    if (val) {
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1).trim();
      }
      return val;
    }
  }

  return '';
}

const connectionString = resolveConnectionString();

const isCloudPostgres = connectionString.includes('neon.tech') ||
  connectionString.includes('supabase.com') ||
  connectionString.includes('render.com') ||
  connectionString.includes('railway.app') ||
  connectionString.includes('aws.neon.tech') ||
  connectionString.includes('sslmode=require');

export const pool = new Pool({
  connectionString: connectionString || undefined,
  // Enable SSL automatically for cloud-hosted PostgreSQL providers
  ssl: isCloudPostgres || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function query(text: string, params?: any[]) {
  const activeConn = resolveConnectionString() || connectionString;
  if (!activeConn) {
    console.error('DATABASE_URL is not configured in environment variables.');
    throw new Error('DATABASE_URL is missing. Please add it to your environment variables in Vercel (Project Settings -> Environment Variables) and redeploy.');
  }

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
