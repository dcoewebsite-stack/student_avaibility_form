import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Fetch profile
    const userRes = await query(
      `SELECT id, first_name, last_name, email, phone, organization, city, attendance_preference, total_points, created_at
       FROM profiles
       WHERE LOWER(TRIM(email)) = $1`,
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ found: false });
    }

    const user = userRes.rows[0];
    const userId = user.id;

    // 2. Fetch referral activity
    // Query both referrals table and point_transactions for referral bonuses
    const refHistoryRes = await query(
      `SELECT 
         COALESCE(p.first_name || ' ' || SUBSTRING(COALESCE(p.last_name, ''), 1, 1) || '.', 'Friend') AS friend_name,
         r.points_awarded,
         r.created_at
       FROM referrals r
       LEFT JOIN profiles p ON r.referred_user_id = p.id
       WHERE r.referrer_user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    let referralHistory = refHistoryRes.rows.map((r: any) => ({
      name: r.friend_name.trim(),
      points: r.points_awarded || 25,
      date: r.created_at,
    }));

    // If referrals table had 0 rows but point_transactions has referral bonuses, extract from transactions
    if (referralHistory.length === 0) {
      const txRes = await query(
        `SELECT points, description, created_at 
         FROM point_transactions 
         WHERE user_id = $1 AND source_type = 'referral_bonus'
         ORDER BY created_at DESC`,
        [userId]
      );

      referralHistory = txRes.rows.map((tx: any) => {
        // extract name from description: "Referral bonus for inviting John (email)"
        const match = tx.description?.match(/inviting ([^(]+)/i);
        const friendName = match ? match[1].trim() : 'Friend';
        return {
          name: friendName,
          points: tx.points,
          date: tx.created_at,
        };
      });
    }

    const totalFriendsReferred = referralHistory.length;
    const totalReferralPoints = referralHistory.reduce((sum: number, r: any) => sum + (r.points || 0), 0);

    // 3. Fetch claimed rewards
    const rewardsRes = await query(
      `SELECT 
         ur.id,
         ur.reward_id,
         ur.status,
         ur.claim_code,
         ur.claimed_at,
         rew.name AS reward_name,
         rew.points_threshold
       FROM user_rewards ur
       JOIN rewards rew ON ur.reward_id = rew.id
       WHERE ur.user_id = $1
       ORDER BY ur.claimed_at DESC`,
      [userId]
    );

    const claimedRewards = rewardsRes.rows.map((r: any) => ({
      id: r.id,
      rewardId: r.reward_id,
      rewardName: r.reward_name,
      claimCode: r.claim_code,
      claimedAt: r.claimed_at,
      pointsThreshold: r.points_threshold,
      status: r.status,
    }));

    // 4. Fetch completed modules count from latest response
    const respRes = await query(
      `SELECT answer FROM responses WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
      [userId]
    );

    let completedModuleCount = 0;
    if (respRes.rows.length > 0 && respRes.rows[0].answer?.module_selections) {
      const selections = respRes.rows[0].answer.module_selections;
      completedModuleCount = Object.values(selections).filter((s) => s === 'completed').length;
    }

    // 5. Generate referral code & link
    const userReferralCode = `DCOE-${userId.toString().substring(0, 6).toUpperCase()}`;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : 'https://dcoeiisc.com');
    const referralUrl = `${baseUrl.replace(/\/$/, '')}?ref=${userReferralCode}`;

    return NextResponse.json({
      found: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name || ''}`.trim(),
        email: user.email,
        phone: user.phone,
        organization: user.organization,
        city: user.city,
        attendancePreference: user.attendance_preference,
        totalPoints: user.total_points,
      },
      referralStats: {
        referralCode: userReferralCode,
        referralUrl,
        totalFriendsReferred,
        totalReferralPoints,
        referralHistory,
      },
      claimedRewards,
      completedModuleCount,
    });
  } catch (error: any) {
    console.error('User status error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

