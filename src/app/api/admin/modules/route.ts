import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MODULES_CONFIG = [
  { id: 1, title: 'Industry 4.0 Technologies', desc: 'IoT, AI, automation & smart systems · 5-day hands-on', icon: 'Cpu' },
  { id: 2, title: 'Design Thinking & Methodology', desc: 'Human-centred problem solving · 5-day hands-on', icon: 'Lightbulb' },
  { id: 3, title: 'Ergonomics & Human Factors', desc: 'Design for people, safety & comfort · 5-day hands-on', icon: 'UserCheck' },
  { id: 4, title: 'Aesthetics & Semiotics', desc: 'Visual language & product meaning · 5-day hands-on', icon: 'Palette' },
  { id: 5, title: 'Design Prototyping', desc: 'Rapid prototyping & iteration · 5-day hands-on', icon: 'Layers' },
  { id: 6, title: 'Mechanical Prototyping', desc: 'Hands-on fabrication & machining · 5-day hands-on', icon: 'Wrench' },
  { id: 7, title: 'Electronic Prototyping', desc: 'Circuits, sensors & embedded systems · 5-day hands-on', icon: 'Zap' },
  { id: 8, title: 'Business Development & Entrepreneurship', desc: 'From idea to venture · 5-day hands-on', icon: 'TrendingUp' },
];

export async function GET() {
  try {
    // 1. Fetch all student preferences from our view
    const prefsRes = await query(`
      SELECT 
        module_id,
        module_name,
        student_name,
        preferred_date,
        alternative_date,
        email,
        phone,
        organization,
        attendance_preference,
        user_id,
        registered_at
      FROM v_module_preferences
      ORDER BY module_id ASC, preferred_date ASC, student_name ASC
    `);

    // 2. Fetch overall stats
    const statsRes = await query(`
      SELECT 
        COUNT(DISTINCT id) as total_students,
        COUNT(DISTINCT CASE WHEN total_points >= 125 THEN id END) as eligible_rewards_students
      FROM profiles
    `);

    const totalStudents = parseInt(statsRes.rows[0]?.total_students || '0', 10);
    const eligibleCount = parseInt(statsRes.rows[0]?.eligible_rewards_students || '0', 10);

    // 3. Group by Module
    const rows = prefsRes.rows;

    const modules = MODULES_CONFIG.map((mod) => {
      const moduleRows = rows.filter((r) => r.module_id === mod.id);

      // Group students by preferred date
      const dateGroupsMap: { [dateStr: string]: { date: string; count: number; students: { name: string; email: string; organization: string }[] } } = {};

      const students = moduleRows.map((r) => {
        const prefDate = r.preferred_date || 'No Date Chosen';

        if (!dateGroupsMap[prefDate]) {
          dateGroupsMap[prefDate] = {
            date: prefDate,
            count: 0,
            students: [],
          };
        }
        dateGroupsMap[prefDate].count += 1;
        dateGroupsMap[prefDate].students.push({
          name: r.student_name,
          email: r.email,
          organization: r.organization,
        });

        return {
          userId: r.user_id,
          name: r.student_name,
          preferredDate: r.preferred_date,
          alternativeDate: r.alternative_date,
          email: r.email,
          phone: r.phone,
          organization: r.organization,
          attendancePreference: r.attendance_preference,
          registeredAt: r.registered_at,
        };
      });

      // Convert dateGroupsMap to sorted array
      const dateGroups = Object.values(dateGroupsMap).sort((a, b) => {
        if (a.date === 'No Date Chosen') return 1;
        if (b.date === 'No Date Chosen') return -1;
        return a.date.localeCompare(b.date);
      });

      return {
        id: mod.id,
        title: mod.title,
        desc: mod.desc,
        icon: mod.icon,
        totalStudents: students.length,
        dateGroups,
        students,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalStudents,
        eligibleCount,
        totalModulePreferences: rows.length,
      },
      modules,
    });
  } catch (error: any) {
    console.error('Admin Modules API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch module preferences' },
      { status: 500 }
    );
  }
}
