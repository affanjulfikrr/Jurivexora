import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth('ai:review');
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    const thresholdRow = db
      .prepare("SELECT value FROM system_settings WHERE key = 'ai_confidence_threshold'")
      .get() as { value: string } | undefined;

    const suggestions = db
      .prepare(
        `SELECT s.*, c.case_number, c.title as case_title, u.full_name as reviewer_name, j.mode as ai_mode, j.job_number
         FROM ai_suggestions s
         LEFT JOIN cases c ON c.id = s.case_id
         LEFT JOIN users u ON u.id = s.reviewer_id
         LEFT JOIN ai_jobs j ON j.id = s.job_id
         ORDER BY s.id DESC`
      )
      .all();

    const reviews = db
      .prepare(
        `SELECT r.*, s.suggestion_number, u.full_name as reviewer_name
         FROM ai_reviews r
         INNER JOIN ai_suggestions s ON s.id = r.suggestion_id
         INNER JOIN users u ON u.id = r.reviewer_id
         ORDER BY r.id DESC LIMIT 40`
      )
      .all();

    return NextResponse.json({
      confidenceThreshold: Number(thresholdRow?.value || 85),
      suggestions,
      reviews,
    });
  } catch (error) {
    console.error('AI suggestions GET error:', error);
    return NextResponse.json({ error: 'Failed to load AI recommendations.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('ai:review');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const suggestionId = Number(body.suggestionId);
    const action = String(body.action || '');
    const correctedText = body.correctedText ? String(body.correctedText).trim() : null;
    const reviewNotes = String(body.reviewNotes || '').trim();
    const includeInCaseNotes = Boolean(body.includeInCaseNotes);

    const allowedActions = [
      'Accept',
      'Reject',
      'Correct',
      'Request Further Verification',
      'Report Error',
    ];
    if (!suggestionId || !allowedActions.includes(action)) {
      return NextResponse.json({ error: 'Valid suggestion ID and review action are required.' }, { status: 400 });
    }
    if (reviewNotes.length < 4) {
      return NextResponse.json({ error: 'Provide human review notes explaining your decision.' }, { status: 400 });
    }

    const db = getDb();
    const sug = db
      .prepare('SELECT * FROM ai_suggestions WHERE id = ?')
      .get(suggestionId) as
      | {
          id: number;
          suggestion_number: string;
          case_id: number | null;
          suggestion_text: string;
          source_references: string;
        }
      | undefined;

    if (!sug) {
      return NextResponse.json({ error: 'Suggestion not found.' }, { status: 404 });
    }

    const statusMap: Record<string, string> = {
      Accept: 'Accepted',
      Reject: 'Rejected',
      Correct: 'Corrected',
      'Request Further Verification': 'Needs Verification',
      'Report Error': 'Error Reported',
    };

    const newStatus = statusMap[action];
    db.prepare(
      `UPDATE ai_suggestions SET review_status = ?, reviewer_id = ? WHERE id = ?`
    ).run(newStatus, user.id, sug.id);

    db.prepare(
      `INSERT INTO ai_reviews (suggestion_id, reviewer_id, action, corrected_text, review_notes, included_in_case_notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      sug.id,
      user.id,
      action,
      correctedText,
      reviewNotes,
      includeInCaseNotes && (action === 'Accept' || action === 'Correct') ? 1 : 0
    );

    // Only approved/corrected human-verified output may enter official case notes
    if (includeInCaseNotes && sug.case_id && (action === 'Accept' || action === 'Correct')) {
      const caseRow = db
        .prepare('SELECT id, case_number, investigation_notes FROM cases WHERE id = ?')
        .get(sug.case_id) as { id: number; case_number: string; investigation_notes: string } | undefined;

      if (caseRow) {
        const notes = JSON.parse(caseRow.investigation_notes || '[]') as Array<Record<string, unknown>>;
        notes.unshift({
          id: `AI-${Date.now()}`,
          authorId: user.id,
          authorName: `${user.fullName} (Verified AI Draft ${sug.suggestion_number})`,
          note: correctedText || sug.suggestion_text,
          sourceRef: sug.source_references,
          createdAt: new Date().toISOString(),
        });
        db.prepare(
          `UPDATE cases SET investigation_notes = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(JSON.stringify(notes), caseRow.id);
      }
    }

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: `AI_REVIEW_${action.toUpperCase().replace(/\s+/g, '_')}`,
      resourceId: sug.suggestion_number,
      purpose: reviewNotes,
      outcome: action === 'Report Error' ? 'Flagged' : 'Success',
      approvalRef: `REV-${sug.id}-${user.id}`,
    });

    return NextResponse.json({ success: true, reviewStatus: newStatus });
  } catch (error) {
    console.error('AI review POST error:', error);
    return NextResponse.json({ error: 'Failed to submit human review.' }, { status: 500 });
  }
}
