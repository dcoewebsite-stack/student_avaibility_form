import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { pool } from '@/lib/db';
import { syncLeadToZoho } from '@/lib/zoho';

const VALID_MODULE_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);
const VALID_HEARD_FROM = new Set(['whatsapp', 'linkedin', 'instagram']);

export async function POST(req: Request) {
  let client: PoolClient | null = null;
  let inTransaction = false;

  try {
    const body = await req.json();
    const {
      first_name,
      last_name,
      email,
      phone,
      organization,
      designation,
      city,
      attendance_preference = 'in-person',
      referral_source,
      heard_from,
      module_selections = {},
      preferred_dates = {},
      referral_code,
    } = body;

    const rawSource = (heard_from || referral_source || 'whatsapp').toString().trim().toLowerCase();
    const chosenSource = VALID_HEARD_FROM.has(rawSource) ? rawSource : 'whatsapp';
    const normalizedAttendance = attendance_preference === 'online' ? 'online' : 'in-person';

    if (
      !email?.trim() ||
      !first_name?.trim() ||
      !phone?.trim() ||
      !organization?.trim() ||
      !city?.trim()
    ) {
      return NextResponse.json(
        { error: 'First name, email, WhatsApp phone number, college/organization, and city are mandatory fields.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Sanitize module_selections & preferred_dates (exploit-proof & consistent with UI)
    const sanitizedSelections: Record<string, 'interested' | 'completed'> = {};
    if (module_selections && typeof module_selections === 'object') {
      for (const [modId, status] of Object.entries(module_selections)) {
        if (VALID_MODULE_IDS.has(String(modId)) && (status === 'interested' || status === 'completed')) {
          sanitizedSelections[String(modId)] = status;
        }
      }
    }

    const sanitizedDates: Record<string, string[]> = {};
    if (preferred_dates && typeof preferred_dates === 'object') {
      for (const [modId, datesList] of Object.entries(preferred_dates)) {
        const key = String(modId);
        if (sanitizedSelections[key] === 'interested' && Array.isArray(datesList)) {
          const uniqueDates = Array.from(
            new Set(
              datesList
                .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
                .map((d) => d.trim())
            )
          ).slice(0, 2);
          if (uniqueDates.length > 0) {
            sanitizedDates[key] = uniqueDates;
          }
        }
      }
    }

    client = await pool.connect();

    // 1. Strict 1-submission-per-email check
    const existingUser = await client.query(
      `SELECT id, first_name, total_points FROM profiles WHERE LOWER(TRIM(email)) = $1`,
      [normalizedEmail]
    );

    if (existingUser.rows && existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          error: `The email "${normalizedEmail}" has already submitted this form and claimed points (${existingUser.rows[0].total_points} pts). Submissions are strictly limited to 1 per participant.`,
          alreadySubmitted: true,
          existingPoints: existingUser.rows[0].total_points,
        },
        { status: 409 }
      );
    }

    // 2. Verify referral code against registered profiles if provided
    const cleanReferralCode = typeof referral_code === 'string' ? referral_code.trim().toUpperCase() : '';
    let referrerId: string | null = null;
    if (cleanReferralCode) {
      if (!/^DCOE-[A-F0-9]{6}$/.test(cleanReferralCode)) {
        return NextResponse.json(
          { error: `Invalid referral code format "${cleanReferralCode}". Expected format: DCOE-XXXXXX (or leave it blank).` },
          { status: 400 }
        );
      }

      const referrerIdPrefix = cleanReferralCode.substring(5).toLowerCase();
      const refLookup = await client.query(
        `SELECT id FROM profiles WHERE substring(id::text, 1, 6) = $1 AND LOWER(TRIM(email)) != $2 LIMIT 1`,
        [referrerIdPrefix, normalizedEmail]
      );

      if (refLookup.rows.length === 0) {
        return NextResponse.json(
          { error: `Referral code "${cleanReferralCode}" was not found. Please double-check the code or leave the field blank.` },
          { status: 400 }
        );
      }
      referrerId = refLookup.rows[0].id;
    }

    // 3. Calculate Points Server-Side (Exploit-Proof)
    let pointsAwarded = 0;
    const pointBreakdown: { reason: string; points: number }[] = [];

    // Form start mission
    pointsAwarded += 10;
    pointBreakdown.push({ reason: 'Started Form & Initialized Session', points: 10 });

    let interestedCount = 0;
    let completedCount = 0;

    Object.values(sanitizedSelections).forEach((status) => {
      if (status === 'interested') {
        interestedCount++;
        pointsAwarded += 5;
      } else if (status === 'completed') {
        completedCount++;
        pointsAwarded += 10;
      }
    });

    if (interestedCount > 0) {
      pointBreakdown.push({ reason: `Selected ${interestedCount} Interested Module(s)`, points: interestedCount * 5 });
    }
    if (completedCount > 0) {
      pointBreakdown.push({ reason: `Marked ${completedCount} Completed Module(s)`, points: completedCount * 10 });
    }

    let datesCount = 0;
    Object.values(sanitizedDates).forEach((datesList) => {
      datesCount += datesList.length;
    });

    if (datesCount > 0) {
      const datePoints = datesCount * 5;
      pointsAwarded += datePoints;
      pointBreakdown.push({ reason: `Provided ${datesCount} Preferred Date(s)`, points: datePoints });
    }

    if (normalizedAttendance === 'in-person') {
      pointsAwarded += 5;
      pointBreakdown.push({ reason: 'In-Person Attendance Preference Bonus', points: 5 });
    }

    pointsAwarded += 10;
    pointBreakdown.push({ reason: 'Completed Contact Details', points: 10 });

    if (referrerId && cleanReferralCode) {
      pointsAwarded += 25;
      pointBreakdown.push({ reason: `Referral Welcome Bonus (${cleanReferralCode})`, points: 25 });
    }

    // 4. Begin Isolated Transaction
    await client.query('BEGIN');
    inTransaction = true;

    // 4.1 Insert Profile
    const userResult = await client.query(
      `INSERT INTO profiles (first_name, last_name, email, phone, organization, designation, city, attendance_preference, heard_from, total_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, total_points`,
      [
        first_name.trim(),
        last_name ? last_name.trim() : '',
        normalizedEmail,
        phone.trim(),
        organization.trim(),
        designation ? designation.trim() : '',
        city.trim(),
        normalizedAttendance,
        chosenSource,
        pointsAwarded,
      ]
    );

    const userId = userResult.rows[0].id;
    const finalTotalPoints = userResult.rows[0].total_points;

    // 4.2 Log Point Transaction Ledger
    await client.query(
      `INSERT INTO point_transactions (user_id, source_type, points, description)
       VALUES ($1, 'form_submission', $2, $3)`,
      [userId, pointsAwarded, `D-CoE Form Submission: ${pointBreakdown.map((p) => p.reason).join(', ')}`]
    );

    // 4.3 Save Form Response Payload
    await client.query(
      `INSERT INTO responses (user_id, answer, points_awarded)
       VALUES ($1, $2, $3)`,
      [userId, JSON.stringify({ module_selections: sanitizedSelections, preferred_dates: sanitizedDates }), pointsAwarded]
    );

    // 4.4 Award Referrer Bonus if valid referral code used
    if (referrerId && cleanReferralCode) {
      await client.query(
        `UPDATE profiles 
         SET total_points = total_points + 25, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [referrerId]
      );

      await client.query(
        `INSERT INTO point_transactions (user_id, source_type, points, description)
         VALUES ($1, 'referral_bonus', 25, $2)`,
        [referrerId, `Referral bonus for inviting ${first_name.trim()} (${normalizedEmail})`]
      );

      await client.query(
        `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, points_awarded)
         VALUES ($1, $2, $3, 'VERIFIED', 25)`,
        [referrerId, userId, cleanReferralCode]
      );
    }

    await client.query('COMMIT');
    inTransaction = false;

    // 5. Trigger Zoho CRM Sync (non-fatal if Zoho fails)
    const interestedModulesList = Object.entries(sanitizedSelections)
      .filter(([, val]) => val === 'interested')
      .map(([id]) => `Module #${id}`);

    const completedModulesList = Object.entries(sanitizedSelections)
      .filter(([, val]) => val === 'completed')
      .map(([id]) => `Module #${id}`);

    const zohoResult = await syncLeadToZoho({
      first_name: first_name.trim(),
      last_name: last_name ? last_name.trim() : '',
      email: normalizedEmail,
      phone: phone.trim(),
      organization: organization.trim(),
      designation: designation ? designation.trim() : '',
      city: city.trim(),
      attendance_preference: normalizedAttendance,
      referral_source: chosenSource,
      total_points: finalTotalPoints,
      modules_interested: interestedModulesList,
      modules_completed: completedModulesList,
    });

    // 6. Badges Unlocked Logic
    const badges = [
      {
        id: 'explorer',
        title: 'Explorer',
        description: 'You started building your D-CoE learning path.',
        icon: '🧭',
        unlocked: true,
      },
      {
        id: 'pathfinder',
        title: 'Pathfinder',
        description: 'You told D-CoE when your learning journey could begin.',
        icon: '🎯',
        unlocked: datesCount > 0,
      },
      {
        id: 'community_builder',
        title: 'Community Builder',
        description: 'Refer a friend to unlock this badge.',
        icon: '🤝',
        unlocked: false,
      },
    ];

    const userReferralCode = `DCOE-${userId.toString().substring(0, 6).toUpperCase()}`;

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : 'https://dcoeiisc.com');
    const referralUrl = `${baseUrl.replace(/\/$/, '')}?ref=${userReferralCode}`;

    return NextResponse.json({
      success: true,
      userId,
      pointsEarned: pointsAwarded,
      totalPoints: finalTotalPoints,
      pointBreakdown,
      badges,
      referralCode: userReferralCode,
      referralUrl,
      zohoSync: zohoResult,
    });
  } catch (error: any) {
    if (client && inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
    }
    console.error('Submit API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
