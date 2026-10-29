-- Seed script for D-CoE Preferred Module Dates Gamified Form

-- 1. Insert D-CoE Form
INSERT INTO forms (id, title, slug, description, status, version, is_public)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'D-CoE Preferred Module Dates',
    'dcoe-preferred-dates',
    'Tell D-CoE at IISc when you are free and which modules interest you. Takes 2 minutes. Earn points and redeem real perks.',
    'ACTIVE',
    1,
    true
) ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Missions & Points Config
INSERT INTO missions (id, form_id, name, description, mission_type, points, max_completions, status)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Start Form', 'Earned for opening and starting the preference form', 'form_start', 10, 1, 'ACTIVE'),
    ('a1000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'First Module Selection', 'Selected your first interested or completed module', 'select_module', 5, 1, 'ACTIVE'),
    ('a1000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Complete Preferred Dates', 'Provided preferred start dates for your modules', 'complete_dates', 15, 1, 'ACTIVE'),
    ('a1000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Complete Profile Details', 'Filled out contact and profile details', 'complete_profile', 10, 1, 'ACTIVE'),
    ('a1000000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Refer a Friend', 'Brought another learner into the D-CoE community', 'refer_friend', 25, 100, 'ACTIVE')
ON CONFLICT DO NOTHING;

-- 3. Insert Rewards Ladder
INSERT INTO rewards (id, form_id, name, description, reward_type, points_threshold, inventory, claim_limit, status)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Priority Registration', 'Guaranteed priority seating for selected D-CoE workshops', 'perk', 50, 500, 1, 'ACTIVE'),
    ('b1000000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'D-CoE Key Ring', 'Free official D-CoE collectible key ring (Collect manually in-person at D-CoE campus)', 'physical', 125, 300, 1, 'ACTIVE'),
    ('b1000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'D-CoE Merchandise Kit', 'Official IISc D-CoE design notebook & swag pack', 'physical', 150, 100, 1, 'ACTIVE'),
    ('b1000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Free 1-Day Workshop', '100% coupon for one complete 1-day workshop at IISc D-CoE', 'scholarship', 200, 50, 1, 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    points_threshold = EXCLUDED.points_threshold,
    reward_type = EXCLUDED.reward_type;

-- Remove ₹500 Workshop Fee Waiver
DELETE FROM rewards WHERE id = 'b1000000-0000-0000-0000-000000000002' OR name LIKE '%Fee Waiver%';

-- 4. View for Neon DB: Easily view all students who claimed the D-CoE Key Ring for manual collection
CREATE OR REPLACE VIEW v_keyring_manual_collections AS
SELECT 
    p.id AS student_id,
    p.first_name || ' ' || COALESCE(p.last_name, '') AS student_name,
    p.email,
    p.phone,
    p.organization AS college_or_organization,
    p.city,
    p.attendance_preference,
    ur.claim_code,
    ur.status AS claim_status,
    ur.claimed_at,
    r.name AS reward_name
FROM user_rewards ur
JOIN profiles p ON ur.user_id = p.id
JOIN rewards r ON ur.reward_id = r.id
WHERE r.id = 'b1000000-0000-0000-0000-000000000005' OR r.name ILIKE '%key ring%'
ORDER BY ur.claimed_at DESC;

-- View for Neon DB: View all claimed rewards across all tiers
CREATE OR REPLACE VIEW v_all_claimed_rewards AS
SELECT 
    p.id AS student_id,
    p.first_name || ' ' || COALESCE(p.last_name, '') AS student_name,
    p.email,
    p.phone,
    p.organization,
    p.city,
    r.name AS reward_name,
    r.points_threshold,
    ur.claim_code,
    ur.status,
    ur.claimed_at
FROM user_rewards ur
JOIN profiles p ON ur.user_id = p.id
JOIN rewards r ON ur.reward_id = r.id
ORDER BY ur.claimed_at DESC;

