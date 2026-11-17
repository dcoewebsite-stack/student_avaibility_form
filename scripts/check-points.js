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

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT p.id, p.first_name, p.last_name, p.email, p.total_points,
        COALESCE((SELECT SUM(pt.points) FROM point_transactions pt WHERE pt.user_id = p.id), 0) AS ledger_sum,
        COALESCE((SELECT string_agg(rew.name || ' (' || ur.claim_code || ')', ', ')
          FROM user_rewards ur JOIN rewards rew ON ur.reward_id = rew.id
          WHERE ur.user_id = p.id), 'None') AS rewards
      FROM profiles p
      ORDER BY p.created_at
    `);
    console.log('=== All Users ===');
    console.log('Name | Email | Profile Pts | Ledger Sum | Rewards');
    console.log('-'.repeat(100));
    res.rows.forEach((r) => {
      const match = r.total_points === Number(r.ledger_sum) ? 'OK' : `MISMATCH (ledger=${r.ledger_sum})`;
      console.log(`${r.first_name} ${r.last_name || ''} | ${r.email} | ${r.total_points} | ${match} | ${r.rewards}`);
    });
    console.log(`\nTotal users: ${res.rows.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
