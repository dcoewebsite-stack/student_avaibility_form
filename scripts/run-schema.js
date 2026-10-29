const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Automatically read .env.local or .env if DATABASE_URL is not already in process.env
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

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set in process.env or .env.local.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function runFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`\n📄 Running: ${path.basename(filePath)}`);
  try {
    await pool.query(sql);
    console.log(`✅ Success: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`❌ Error in ${path.basename(filePath)}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('🔌 Connecting to Neon.tech database...');
  try {
    const res = await pool.query('SELECT current_database() as db');
    console.log(`✅ Connected! Database: ${res.rows[0].db}`);

    await runFile(path.join(__dirname, '../db/schema.sql'));
    console.log('\n🎉 Schema created/verified successfully!');

    const seedFile = path.join(__dirname, '../db/seed.sql');
    if (fs.existsSync(seedFile)) {
      await runFile(seedFile);
      console.log('🌱 Seed data applied successfully!');
    }

    // List tables created
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log('\n📋 Tables in your database:');
    tables.rows.forEach((row, i) => console.log(`   ${i + 1}. ${row.table_name}`));

    // Check rewards seeded
    const rewards = await pool.query(`SELECT name, points_threshold, inventory FROM rewards`);
    console.log('\n🎁 Available Rewards in database:');
    rewards.rows.forEach((r) => console.log(`   • ${r.name} (${r.points_threshold} pts, ${r.inventory} left)`));

  } catch (err) {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

