import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('analytics:view');
  if (errorResponse || !user) return errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'All';
    const db = getDb();

    const casesByCategory = db
      .prepare(
        `SELECT category, COUNT(*) as total,
                SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
         FROM cases
         ${category !== 'All' ? 'WHERE category = ?' : ''}
         GROUP BY category`
      )
      .all(...(category !== 'All' ? [category] : []));

    const officerWorkload = db
      .prepare(
        `SELECT u.full_name as name, u.unit, u.max_capacity as capacity,
                COUNT(c.id) as assignedCases
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         LEFT JOIN cases c ON c.assigned_officer_id = u.id AND c.status != 'Closed'
         WHERE r.slug = 'investigating_officer' AND u.is_active = 1
         GROUP BY u.id`
      )
      .all();

    const evidenceSummary = db
      .prepare(
        `SELECT integrity_status as status, COUNT(*) as count FROM evidence GROUP BY integrity_status`
      )
      .all();

    const aiPerformance = db
      .prepare(
        `SELECT suggestion_type as capability,
                COUNT(*) as total,
                ROUND(AVG(confidence_score), 1) as avgConfidence,
                SUM(CASE WHEN review_status = 'Accepted' THEN 1 ELSE 0 END) as accepted,
                SUM(CASE WHEN review_status = 'Rejected' OR review_status = 'Error Reported' THEN 1 ELSE 0 END) as rejectedOrFlagged
         FROM ai_suggestions
         GROUP BY suggestion_type`
      )
      .all();

    const savedReports = db
      .prepare(
        `SELECT r.*, u.full_name as generated_by_name
         FROM reports r LEFT JOIN users u ON u.id = r.generated_by
         ORDER BY r.id DESC LIMIT 20`
      )
      .all();

    return NextResponse.json({
      casesByCategory,
      officerWorkload,
      evidenceSummary,
      aiPerformance,
      savedReports,
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Failed to load analytics.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('reports:export');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const title = String(body.title || 'Jurivexora Operational Report').trim();
    const reportType = String(body.reportType || 'Case & Evidence Summary').trim();
    const filters = body.filters || {};
    const summary = body.summary || {};

    const db = getDb();
    const cnt = (db.prepare('SELECT COUNT(*) as c FROM reports').get() as { c: number }).c;
    const reportNumber = `RPT-2026-${String(cnt + 1).padStart(3, '0')}`;

    db.prepare(
      `INSERT INTO reports (report_number, title, report_type, filters_json, summary_json, generated_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(reportNumber, title, reportType, JSON.stringify(filters), JSON.stringify(summary), user.id);

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'REPORT_EXPORTED',
      resourceId: reportNumber,
      purpose: `Generated ${reportType}: ${title}`,
      outcome: 'Success',
    });

    return NextResponse.json({ success: true, reportNumber });
  } catch (error) {
    console.error('Analytics POST error:', error);
    return NextResponse.json({ error: 'Failed to generate report.' }, { status: 500 });
  }
}
