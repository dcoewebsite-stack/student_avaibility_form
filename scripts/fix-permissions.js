const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envLocalPath = path.join(__dirname, '../.env.local');
  const envPath = path.join(__dirname, '../.env');
  const targetEnv = fs.existsSync(envLocalPath) ? envLocalPath : (fs.existsSync(envPath) ? envPath : null);
  if (!targetEnv) return;

  const content = fs.readFileSync(targetEnv, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in environment or .env/.env.local.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixPermissions() {
  const client = await pool.connect();
  try {
    console.log('Granting permissions on database schema to PUBLIC...');
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC`);
    await client.query(`GRANT USAGE ON SCHEMA public TO PUBLIC`);
    console.log('Database permissions verified and granted cleanly.');
  } finally {
    client.release();
    await pool.end();
  }
}

fixPermissions().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
