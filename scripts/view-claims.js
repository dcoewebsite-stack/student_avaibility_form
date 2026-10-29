const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Automatically read .env.local or .env if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  const envLocalPath = path.join(__dirname, '../.env.local');
  const envPath = path.join(__dirname, '../.env');
  const targetEnv = fs.existsSync(envLocalPath) ? envLocalPath : (fs.existsSync(envPath) ? envPath : null);

  if (targetEnv) {
    const lines = fs.readFileSync(targetEnv, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('🔍 Fetching Claim Records from Neon Database...\n');
  try {
    // 1. D-CoE Key Ring Manual Collection List
    console.log('========================================================================');
    console.log('🔑 D-CoE KEY RING CLAIMS — MANUAL COLLECTION LIST FOR ORGANIZERS');
    console.log('========================================================================');
    const keyringRes = await pool.query(`SELECT * FROM v_keyring_manual_collections`);
    if (keyringRes.rows.length === 0) {
      console.log('No key ring claims yet. When students redeem at 125 pts, they will appear here.');
    } else {
      console.table(
        keyringRes.rows.map((r, i) => ({
          '#': i + 1,
          Student: r.student_name,
          Email: r.email,
          Phone: r.phone || 'N/A',
          College_Org: r.college_or_organization || 'N/A',
          City: r.city || 'N/A',
          Code: r.claim_code,
          ClaimedAt: new Date(r.claimed_at).toLocaleString('en-IN'),
        }))
      );
    }

    // 2. All Rewards Overview
    console.log('\n========================================================================');
    console.log('🎁 ALL CLAIMED REWARDS OVERVIEW');
    console.log('========================================================================');
    const allRes = await pool.query(`SELECT * FROM v_all_claimed_rewards`);
    if (allRes.rows.length === 0) {
      console.log('No reward claims yet.');
    } else {
      console.table(
        allRes.rows.map((r, i) => ({
          '#': i + 1,
          Student: r.student_name,
          Reward: r.reward_name,
          Points: r.points_threshold,
          Code: r.claim_code,
          Email: r.email,
          Date: new Date(r.claimed_at).toLocaleDateString('en-IN'),
        }))
      );
    }
  } catch (err) {
    console.error('Error fetching claims:', err.message);
  } finally {
    await pool.end();
  }
}

main();
