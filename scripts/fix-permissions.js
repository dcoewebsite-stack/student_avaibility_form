const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_yeKOXv7LnW0h@ep-icy-cloud-b3f5rtn2-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log('=== 1. Checking current table columns ===');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      ORDER BY ordinal_position
    `);
    console.log('profiles columns:', cols.rows.map(r => r.column_name).join(', '));

    // Check if referral_source still exists
    const hasRefSource = cols.rows.some(r => r.column_name === 'referral_source');
    console.log('Has referral_source column:', hasRefSource);

    console.log('\n=== 2. Checking views ===');
    const views = await client.query(`
      SELECT viewname FROM pg_views WHERE schemaname = 'public'
    `);
    console.log('Views:', views.rows.map(r => r.viewname).join(', '));

    // Check v_master_registrations definition
    const viewDef = await client.query(`
      SELECT definition FROM pg_views 
      WHERE viewname = 'v_master_registrations' AND schemaname = 'public'
    `);
    if (viewDef.rows.length > 0) {
      console.log('\nv_master_registrations definition:');
      console.log(viewDef.rows[0].definition);
    }

    console.log('\n=== 3. Granting permissions ===');
    
    // Grant on all tables
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC`);
    console.log('Granted ALL on tables to PUBLIC');
    
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC`);
    console.log('Granted ALL on sequences to PUBLIC');
    
    await client.query(`GRANT USAGE ON SCHEMA public TO PUBLIC`);
    console.log('Granted USAGE on schema to PUBLIC');

    // Grant to specific Neon roles
    const roles = ['authenticated', 'anonymous', 'neon_auth', 'neon_service'];
    for (const role of roles) {
      try {
        await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${role}"`);
        await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
        await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
        console.log(`Granted to ${role}`);
      } catch (e) {
        console.log(`Role ${role} doesn't exist, skipping`);
      }
    }

    // Set default privileges for future tables
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO PUBLIC`);
    console.log('Set default privileges for future objects');

    console.log('\n=== 4. Testing query as it runs on Vercel ===');
    const testUser = await client.query(`
      SELECT id, first_name, email, total_points 
      FROM profiles 
      LIMIT 3
    `);
    console.log('Test query returned', testUser.rows.length, 'rows');
    testUser.rows.forEach(r => console.log(`  ${r.first_name} - ${r.email} - ${r.total_points} pts`));

    // Check if referral_source is in the view and fix it
    if (viewDef.rows.length > 0 && viewDef.rows[0].definition.includes('referral_source')) {
      console.log('\n=== 5. Fixing v_master_registrations view (removing referral_source) ===');
      
      // Drop and recreate without referral_source
      await client.query(`DROP VIEW IF EXISTS v_master_registrations CASCADE`);
      console.log('Dropped old view');
      
      await client.query(`
        CREATE OR REPLACE VIEW v_master_registrations AS
        SELECT
          p.id,
          p.first_name,
          p.last_name,
          p.email,
          p.phone,
          p.organization,
          p.city,
          p.attendance_preference,
          p.heard_from,
          p.total_points,
          COALESCE(
            (SELECT string_agg(rew.name, ', ')
             FROM user_rewards ur
             JOIN rewards rew ON ur.reward_id = rew.id
             WHERE ur.user_id = p.id),
            'None'
          ) AS rewards_redeemed,
          p.created_at
        FROM profiles p
        ORDER BY p.created_at DESC
      `);
      console.log('Recreated v_master_registrations WITHOUT referral_source');
      
      // Re-grant permissions on the new view
      await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC`);
      console.log('Re-granted permissions on new view');
    } else {
      console.log('\n=== 5. View already clean (no referral_source) ===');
    }

    // Also check/recreate v_module_preferences
    const modViewDef = await client.query(`
      SELECT definition FROM pg_views 
      WHERE viewname = 'v_module_preferences' AND schemaname = 'public'
    `);
    if (modViewDef.rows.length > 0 && modViewDef.rows[0].definition.includes('referral_source')) {
      console.log('\n=== 6. Fixing v_module_preferences view ===');
      await client.query(`DROP VIEW IF EXISTS v_module_preferences CASCADE`);
      await client.query(`
        CREATE OR REPLACE VIEW v_module_preferences AS
        SELECT
          p.first_name,
          p.last_name,
          p.email,
          qo.option_text AS module_name,
          r_data.preferred_date,
          r_data.status
        FROM profiles p
        JOIN responses r ON r.user_id = p.id
        JOIN LATERAL (
          SELECT
            key AS module_id,
            value ->> 'date' AS preferred_date,
            value ->> 'status' AS status
          FROM jsonb_each(
            CASE WHEN jsonb_typeof(r.answer -> 'module_selections') = 'object'
              THEN r.answer -> 'module_selections'
              ELSE '{}'::jsonb
            END
          )
        ) r_data ON true
        JOIN question_options qo ON qo.id::text = r_data.module_id
        ORDER BY p.created_at DESC, qo.option_text
      `);
      console.log('Recreated v_module_preferences WITHOUT referral_source');
      await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC`);
    }

    console.log('\n=== ALL FIXES APPLIED SUCCESSFULLY ===');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
