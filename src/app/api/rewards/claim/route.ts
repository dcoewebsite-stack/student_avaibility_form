import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const { userId, rewardId } = await req.json();

    if (!userId || !rewardId) {
      return NextResponse.json(
        { error: 'User ID and Reward ID are required.' },
        { status: 400 }
      );
    }

    // 1. Begin Isolated Transaction
    await client.query('BEGIN');

    // 2. Fetch User Points
    const userRes = await client.query(
      'SELECT total_points FROM profiles WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const userPoints = userRes.rows[0].total_points;

    // 3. Fetch Reward details with Atomic Inventory Lock
    const rewardRes = await client.query(
      'SELECT id, name, points_threshold, inventory FROM rewards WHERE id = $1 FOR UPDATE',
      [rewardId]
    );

    if (rewardRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Reward not found.' }, { status: 404 });
    }

    const reward = rewardRes.rows[0];

    // Check Eligibility
    if (userPoints < reward.points_threshold) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Insufficient points. You need ${reward.points_threshold} points for ${reward.name}.` },
        { status: 400 }
      );
    }

    // Check Inventory
    if (reward.inventory <= 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Sorry, ${reward.name} is currently out of stock.` },
        { status: 400 }
      );
    }

    // 4. Decrement Inventory & Generate Unique Claim Code
    const claimCode = `DCOE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await client.query(
      'UPDATE rewards SET inventory = inventory - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [rewardId]
    );

    // 5. Create Claim Record
    await client.query(
      `INSERT INTO user_rewards (user_id, reward_id, status, claim_code, claimed_at)
       VALUES ($1, $2, 'CLAIMED', $3, CURRENT_TIMESTAMP)`,
      [userId, rewardId, claimCode]
    );

    // 6. Commit Transaction
    await client.query('COMMIT');

    let claimMessage = `Successfully claimed ${reward.name}! Show code ${claimCode} to redeem.`;
    if (reward.id === 'b1000000-0000-0000-0000-000000000005' || reward.name.toLowerCase().includes('key ring')) {
      claimMessage = `🎉 Successfully claimed your Free D-CoE Key Ring! Your claim code is ${claimCode}. Collect it manually in-person at the D-CoE campus by presenting this code.`;
    } else if (reward.points_threshold === 200 || reward.name.toLowerCase().includes('1-day') || reward.name.toLowerCase().includes('workshop')) {
      claimMessage = `🎉 Successfully claimed your Free 1-Day Workshop! Your 100% coupon code is ${claimCode}. Present this coupon code during workshop registration to attend for free.`;
    }

    return NextResponse.json({
      success: true,
      rewardName: reward.name,
      claimCode,
      message: claimMessage,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Reward Claim Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to claim reward.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
