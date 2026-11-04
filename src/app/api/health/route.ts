import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const detectedEnvVar = 
    process.env.DATABASE_URL ? 'DATABASE_URL' :
    process.env.POSTGRES_URL ? 'POSTGRES_URL' :
    process.env.POSTGRES_PRISMA_URL ? 'POSTGRES_PRISMA_URL' :
    process.env.POSTGRES_URL_NON_POOLING ? 'POSTGRES_URL_NON_POOLING' :
    process.env.NEON_DATABASE_URL ? 'NEON_DATABASE_URL' :
    'NONE_CONFIGURED';

  const hasDbEnv = detectedEnvVar !== 'NONE_CONFIGURED';

  if (!hasDbEnv) {
    return NextResponse.json(
      {
        status: 'error',
        databaseConnected: false,
        message: 'DATABASE_URL is not set in Vercel environment variables.',
        detectedEnvVar: 'NONE',
        fixInstructions: [
          '1. Go to your Vercel Dashboard -> Select this project.',
          '2. Navigate to Settings -> Environment Variables.',
          '3. Add a new variable: Key = DATABASE_URL, Value = your Neon connection string (postgresql://...).',
          '4. Check all environments (Production, Preview, Development) and click Save.',
          '5. Go to Deployments -> Redeploy the latest commit for changes to take effect.'
        ]
      },
      { status: 503 }
    );
  }

  const start = Date.now();
  try {
    const res = await query('SELECT count(*) as total_registered FROM profiles');
    const duration = Date.now() - start;

    return NextResponse.json({
      status: 'healthy',
      databaseConnected: true,
      detectedEnvVar,
      latencyMs: duration,
      totalRegisteredStudents: parseInt(res.rows[0]?.total_registered || '0', 10),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        databaseConnected: false,
        detectedEnvVar,
        error: err.message || 'Failed to connect to PostgreSQL',
        fixInstructions: [
          'Verify that your Neon database is active (not deleted or paused).',
          'Confirm your connection string has ?sslmode=require at the end.',
          'In Vercel -> Settings -> Environment Variables, ensure DATABASE_URL matches your Neon connection string and redeploy.'
        ]
      },
      { status: 500 }
    );
  }
}
