-- PostgreSQL Schema for Gamified Forms Platform
-- Compatible with standard PostgreSQL 12+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles / Users Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    organization VARCHAR(255),
    designation VARCHAR(255),
    city VARCHAR(100),
    attendance_preference VARCHAR(50) DEFAULT 'in-person', -- 'in-person' or 'online'
    total_points INTEGER DEFAULT 0 CHECK (total_points >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 2. Forms Table
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- DRAFT, ACTIVE, CLOSED, ARCHIVED
    version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL, -- single_choice, multiple_choice, text, rating, module_preference
    position INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    points INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Question Options Table
CREATE TABLE IF NOT EXISTS question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    is_correct BOOLEAN DEFAULT false
);

-- 5. Form Responses Table
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    answer JSONB NOT NULL,
    is_correct BOOLEAN,
    points_awarded INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_form ON responses(form_id);

-- 6. Missions Table
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mission_type VARCHAR(100) NOT NULL, -- form_start, select_module, complete_dates, complete_profile, refer_friend
    points INTEGER NOT NULL DEFAULT 0,
    max_completions INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Mission Completions Table
CREATE TABLE IF NOT EXISTS mission_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    points_awarded INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_user_mission UNIQUE (mission_id, user_id)
);

-- 8. Point Transactions Ledger
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
    source_type VARCHAR(100) NOT NULL, -- signup, mission, bonus, referral, reward_redemption
    source_id VARCHAR(255),
    points INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id);

-- 9. Rewards Inventory Table
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reward_type VARCHAR(100) DEFAULT 'perk',
    points_threshold INTEGER NOT NULL,
    inventory INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),
    claim_limit INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. User Claimed Rewards Table
CREATE TABLE IF NOT EXISTS user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'ELIGIBLE', -- LOCKED, ELIGIBLE, CLAIMED, FULFILLED, CANCELLED
    claim_code VARCHAR(100) UNIQUE NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
    referrer_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    referral_code VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'CREATED', -- CREATED, CLICKED, REGISTERED, VERIFIED, REWARDED
    points_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Zoho CRM Contacts Relationship Table
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    zoho_contact_id VARCHAR(255),
    sync_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SYNCED, FAILED
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Integration Queue Jobs Table (Resilient Zoho CRM Background Sync)
CREATE TABLE IF NOT EXISTS integration_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(100) NOT NULL DEFAULT 'ZOHO_CRM_SYNC',
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON integration_jobs(status);

-- ============================================================================
-- 14. Master Consolidated Registrations View
-- ============================================================================
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
    (
      SELECT COALESCE(string_agg(m.title, ', '), 'None')
      FROM jsonb_each_text(COALESCE(r.answer->'module_selections', '{}'::jsonb)) kv
      JOIN module_lookup m ON m.id = kv.key
      WHERE kv.value = 'completed'
    ) AS already_done_modules,
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

-- ============================================================================
-- 15. Module Preferences View (Students & Preferred Dates per Module)
-- ============================================================================
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
