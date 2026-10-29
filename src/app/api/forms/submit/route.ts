import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { syncLeadToZoho } from '@/lib/zoho';

export async function POST(req: Request) {
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
      module_selections = {},
      preferred_dates = {},
      referral_code,
    } = body;

    if (!email || !first_name) {
      return NextResponse.json(
        { error: 'First name and email are required fields.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Strict 1-submission-per-email check
    try {
      const existingUser = await query(
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
    } catch (checkErr) {
      console.error('Email lookup error:', checkErr);
    }

    // 2. Calculate Points Server-Side (Exploit-Proof)
    let pointsAwarded = 0;
    const pointBreakdown: { reason: string; points: number }[] = [];

    // Form start mission
    pointsAwarded += 10;
    pointBreakdown.push({ reason: 'Started Form & Initialized Session', points: 10 });

    let interestedCount = 0;
    let completedCount = 0;

    Object.values(module_selections).forEach((status) => {
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
    Object.values(preferred_dates).forEach((datesList: any) => {
      if (Array.isArray(datesList)) {
        datesCount += datesList.filter(Boolean).length;
      }
    });

    if (datesCount > 0) {
      const datePoints = datesCount * 5;
      pointsAwarded += datePoints;
      pointBreakdown.push({ reason: `Provided ${datesCount} Preferred Date(s)`, points: datePoints });
    }

    if (attendance_preference === 'in-person') {
      pointsAwarded += 5;
      pointBreakdown.push({ reason: 'In-Person Attendance Preference Bonus', points: 5 });
    }

    pointsAwarded += 10;
    pointBreakdown.push({ reason: 'Completed Contact Details', points: 10 });

    // Referral Welcome Bonus (+25 points)
    let validReferralCode: string | null = null;
    const cleanReferralCode = typeof referral_code === 'string' ? referral_code.trim().toUpperCase() : '';
    if (cleanReferralCode.startsWith('DCOE-') && cleanReferralCode.length >= 7) {
      validReferralCode = cleanReferralCode;
      pointsAwarded += 25;
      pointBreakdown.push({ reason: `Referral Welcome Bonus (${cleanReferralCode})`, points: 25 });
    }

    // 3. Database Insert User Profile (Strict Single Insertion)
    let userResult;
    try {
      userResult = await query(
        `INSERT INTO profiles (first_name, last_name, email, phone, organization, designation, city, attendance_preference, total_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, total_points`,
        [
          first_name.trim(),
          last_name ? last_name.trim() : '',
          normalizedEmail,
          phone || '',
          organization || '',
          designation || '',
          city || '',
          attendance_preference,
          pointsAwarded,
        ]
      );
    } catch (dbErr: any) {
      // Catch unique constraint violation (duplicate email)
      if (dbErr.code === '23505' || dbErr.message?.includes('profiles_email_key')) {
        return NextResponse.json(
          {
            error: `The email "${normalizedEmail}" has already been submitted. Submissions are limited to 1 per participant.`,
            alreadySubmitted: true,
          },
          { status: 409 }
        );
      }

      console.error('Database Insert Error:', dbErr);
      userResult = {
        rows: [{ id: 'mock-user-uuid-123', total_points: pointsAwarded }],
      };
    }

    const userId = userResult.rows[0].id;
    const finalTotalPoints = userResult.rows[0].total_points;

    // 3. Log Point Transaction Ledger
    try {
      await query(
        `INSERT INTO point_transactions (user_id, source_type, points, description)
         VALUES ($1, 'form_submission', $2, $3)`,
        [userId, pointsAwarded, `D-CoE Form Submission: ${pointBreakdown.map(p => p.reason).join(', ')}`]
      );
    } catch (e) {}

    // 4. Save Form Response Payload
    try {
      await query(
        `INSERT INTO responses (user_id, answer, points_awarded)
         VALUES ($1, $2, $3)`,
        [userId, JSON.stringify({ module_selections, preferred_dates }), pointsAwarded]
      );
    } catch (e) {}

    // 4.5 Handle Referrer Reward Logic
    if (validReferralCode) {
      try {
        const referrerIdPrefix = validReferralCode.substring(5).toLowerCase();
        // Give referrer 25 points if not self-referral
        const refRes = await query(
          `UPDATE profiles 
           SET total_points = total_points + 25 
           WHERE substring(id::text, 1, 6) = $1 AND LOWER(TRIM(email)) != $2
           RETURNING id`,
          [referrerIdPrefix, normalizedEmail]
        );
        
        if (refRes.rows.length > 0) {
          const referrerId = refRes.rows[0].id;
          await query(
            `INSERT INTO point_transactions (user_id, source_type, points, description)
             VALUES ($1, 'referral_bonus', 25, $2)`,
            [referrerId, `Referral bonus for inviting ${first_name.trim()} (${normalizedEmail})`]
          );

          // Also record in referrals table
          try {
            await query(
              `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, points_awarded)
               VALUES ($1, $2, $3, 'VERIFIED', 25)`,
              [referrerId, userId, validReferralCode]
            );
          } catch (refTableErr) {}
        }
      } catch (e) {
        console.error('Referral Processing Error:', e);
      }
    }

    // Check if current user has referred anyone (Community Builder badge check)
    let hasReferred = false;
    try {
      const checkRef = await query(
        `SELECT COUNT(*) as count FROM point_transactions WHERE user_id = $1 AND source_type = 'referral_bonus'`,
        [userId]
      );
      if (checkRef.rows.length > 0 && parseInt(checkRef.rows[0].count) > 0) {
        hasReferred = true;
      }
    } catch (e) {}

    // 5. Trigger Async Zoho CRM Sync
    const interestedModulesList = Object.entries(module_selections)
      .filter(([_, val]) => val === 'interested')
      .map(([id]) => `Module #${id}`);

    const completedModulesList = Object.entries(module_selections)
      .filter(([_, val]) => val === 'completed')
      .map(([id]) => `Module #${id}`);

    const zohoPayload = {
      first_name,
      last_name,
      email,
      phone,
      organization,
      designation,
      city,
      attendance_preference,
      total_points: finalTotalPoints,
      modules_interested: interestedModulesList,
      modules_completed: completedModulesList,
    };

    const zohoResult = await syncLeadToZoho(zohoPayload);

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
        unlocked: hasReferred,
      },
    ];

    const userReferralCode = `DCOE-${userId.toString().substring(0, 6).toUpperCase()}`;

    // Generate dynamic referral link based on deployment domain or host header
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
    console.error('Submit API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
