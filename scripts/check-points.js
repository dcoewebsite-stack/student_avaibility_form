const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_yeKOXv7LnW0h@ep-icy-cloud-b3f5rtn2-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
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
    res.rows.forEach(r => {
      const match = r.total_points === Number(r.ledger_sum) ? '✓' : `⚠ MISMATCH (ledger=${r.ledger_sum})`;
      console.log(`${r.first_name} ${r.last_name || ''} | ${r.email} | ${r.total_points} | ${match} | ${r.rewards}`);
    });
    console.log(`\nTotal users: ${res.rows.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
