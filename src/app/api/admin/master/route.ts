import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        organization,
        designation,
        city,
        attendance_preference,
        total_points,
        rewards_redeemed,
        already_done_modules,
        interested_modules_and_dates,
        created_at
      FROM v_master_registrations
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      success: true,
      totalCount: res.rowCount,
      registrations: res.rows,
    });
  } catch (error: any) {
    console.error('Admin Master Registrations API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch master registrations' },
      { status: 500 }
    );
  }
}

