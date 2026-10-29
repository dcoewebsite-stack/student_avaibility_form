const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sqlCreateMasterView = `
CREATE OR REPLACE VIEW v_master_registrations AS
WITH user_latest_response AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    answer,
    submitted_at
  FROM responses
  ORDER BY user_id, submitted_at DESC
),
module_lookup AS (
  SELECT * FROM (VALUES
    ('1', 'Industry 4.0 Technologies'),
    ('2', 'Design Thinking & Methodology'),
    ('3', 'Ergonomics & Human Factors'),
    ('4', 'Aesthetics & Semiotics'),
    ('5', 'Design Prototyping'),
    ('6', 'Mechanical Prototyping'),
    ('7', 'Electronic Prototyping'),
    ('8', 'Business Development & Entrepreneurship')
  ) AS m(id, title)
),
parsed_responses AS (
  SELECT 
    r.user_id,
    -- Already completed / done modules
    (
      SELECT COALESCE(string_agg(m.title, ', '), 'None')
      FROM jsonb_each_text(COALESCE(r.answer->'module_selections', '{}'::jsonb)) kv
      JOIN module_lookup m ON m.id = kv.key
      WHERE kv.value = 'completed'
    ) AS already_done_modules,
    -- Interested modules with preferred and alternative dates
    (
      SELECT COALESCE(
        string_agg(
          m.title || ' [Pref: ' || COALESCE(NULLIF(r.answer->'preferred_dates'->kv.key->>0, ''), 'None') 
                  || ' | Alt: ' || COALESCE(NULLIF(r.answer->'preferred_dates'->kv.key->>1, ''), 'None') || ']',
          E'\n'
        ),
        'None'
      )
      FROM jsonb_each_text(COALESCE(r.answer->'module_selections', '{}'::jsonb)) kv
      JOIN module_lookup m ON m.id = kv.key
      WHERE kv.value = 'interested'
    ) AS interested_modules_and_dates
  FROM user_latest_response r
),
user_rewards_agg AS (
  SELECT 
    ur.user_id,
    string_agg(rew.name || ' (Code: ' || ur.claim_code || ')', ', ') AS rewards_redeemed
  FROM user_rewards ur
  JOIN rewards rew ON ur.reward_id = rew.id
  GROUP BY ur.user_id
)
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')) AS full_name,
  p.email,
  p.phone,
  p.organization,
  p.designation,
  p.city,
  p.attendance_preference,
  p.total_points,
  COALESCE(ura.rewards_redeemed, 'None') AS rewards_redeemed,
  COALESCE(pr.already_done_modules, 'None') AS already_done_modules,
  COALESCE(pr.interested_modules_and_dates, 'None') AS interested_modules_and_dates,
  p.created_at
FROM profiles p
LEFT JOIN parsed_responses pr ON p.id = pr.user_id
LEFT JOIN user_rewards_agg ura ON p.id = ura.user_id
ORDER BY p.created_at DESC;
`;

const sqlCreateModulePreferencesView = `
CREATE OR REPLACE VIEW v_module_preferences AS
WITH user_latest_response AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    answer,
    submitted_at
  FROM responses
  ORDER BY user_id, submitted_at DESC
),
module_lookup AS (
  SELECT * FROM (VALUES
    ('1', 'Industry 4.0 Technologies'),
    ('2', 'Design Thinking & Methodology'),
    ('3', 'Ergonomics & Human Factors'),
    ('4', 'Aesthetics & Semiotics'),
    ('5', 'Design Prototyping'),
    ('6', 'Mechanical Prototyping'),
    ('7', 'Electronic Prototyping'),
    ('8', 'Business Development & Entrepreneurship')
  ) AS m(id, title)
)
SELECT 
  m.id::int AS module_id,
  m.title AS module_name,
  TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')) AS student_name,
  NULLIF(r.answer->'preferred_dates'->m.id->>0, '') AS preferred_date,
  NULLIF(r.answer->'preferred_dates'->m.id->>1, '') AS alternative_date,
  p.email,
  p.phone,
  p.organization,
  p.attendance_preference,
  p.id AS user_id,
  p.created_at AS registered_at
FROM user_latest_response r
JOIN profiles p ON r.user_id = p.id
CROSS JOIN module_lookup m
WHERE (r.answer->'module_selections'->>m.id) = 'interested'
  AND (r.answer->'preferred_dates'->m.id->>0) IS NOT NULL
  AND (r.answer->'preferred_dates'->m.id->>0) != ''
ORDER BY m.id::int ASC, preferred_date ASC, p.first_name ASC;
`;

async function main() {
  console.log('🔌 Connecting to Neon PostgreSQL...');
  try {
    console.log('1️⃣ Creating view: v_master_registrations...');
    await pool.query(sqlCreateMasterView);
    console.log('   ✅ v_master_registrations created successfully!');

    console.log('2️⃣ Creating view: v_module_preferences...');
    await pool.query(sqlCreateModulePreferencesView);
    console.log('   ✅ v_module_preferences created successfully!');

    console.log('\n🔍 Verifying v_master_registrations...');
    const masterRes = await pool.query('SELECT * FROM v_master_registrations LIMIT 2');
    console.log(`   Found ${masterRes.rowCount} rows. Sample:`);
    console.log(masterRes.rows);

    console.log('\n🔍 Verifying v_module_preferences...');
    const modRes = await pool.query('SELECT * FROM v_module_preferences LIMIT 3');
    console.log(`   Found ${modRes.rowCount} rows. Sample:`);
    console.log(modRes.rows);

    console.log('\n🎉 Step 1 Complete: Both Views are active in Neon DB!');
  } catch (err) {
    console.error('❌ Error creating views:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

