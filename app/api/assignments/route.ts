import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog, dispatchNotification } from '@/lib/auth/rbac';

interface OfficerCandidate {
  id: number;
  full_name: string;
  badge_number: string;
  unit: string;
  jurisdiction: string;
  skills: string;
  availability_status: string;
  shift_status: string;
  max_capacity: number;
  active_cases: number;
}

function evaluateCandidates(caseRow: {
  district: string;
  category: string;
  priority: string;
}) {
  const db = getDb();
  const officers = db
    .prepare(
      `SELECT u.id, u.full_name, u.badge_number, u.unit, u.jurisdiction, u.skills,
              u.availability_status, u.shift_status, u.max_capacity,
              (SELECT COUNT(*) FROM cases c WHERE c.assigned_officer_id = u.id AND c.status != 'Closed') as active_cases
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE r.slug = 'investigating_officer' AND u.is_active = 1 AND u.is_suspended = 0`
    )
    .all() as OfficerCandidate[];

  return officers.map((off) => {
    const skills: string[] = JSON.parse(off.skills || '[]');
    const jurisdictionMatch =
      off.jurisdiction === 'National' ||
      off.jurisdiction.toLowerCase() === caseRow.district.toLowerCase();
    const availableMatch = off.availability_status !== 'On Leave';
    const capacityMatch = off.active_cases < off.max_capacity;
    const eligible = jurisdictionMatch && availableMatch && capacityMatch;

    const categoryTerms = caseRow.category.toLowerCase().split(/\s+/);
    const skillHits = skills.filter((s) =>
      categoryTerms.some((t) => t.length > 2 && s.toLowerCase().includes(t))
    );
    const skillMatchScore = Math.min(98, 65 + skillHits.length * 15);
    const workloadScore = Math.max(10, Math.round(((off.max_capacity - off.active_cases) / off.max_capacity) * 100));

    const reasons: string[] = [];
    reasons.push(
      jurisdictionMatch
        ? `Jurisdiction verified (${off.jurisdiction})`
        : `Jurisdiction mismatch (${off.jurisdiction} vs ${caseRow.district})`
    );
    reasons.push(`Availability: ${off.availability_status} (${off.shift_status})`);
    reasons.push(`Active workload: ${off.active_cases}/${off.max_capacity} cases`);
    if (skillHits.length > 0) {
      reasons.push(`Skill alignment: ${skillHits.join(', ')}`);
    } else {
      reasons.push(`General investigative capability (${skills.slice(0, 2).join(', ')})`);
    }

    return {
      officerId: off.id,
      fullName: off.full_name,
      badgeNumber: off.badge_number,
      unit: off.unit,
      jurisdiction: off.jurisdiction,
      availabilityStatus: off.availability_status,
      shiftStatus: off.shift_status,
      activeCases: off.active_cases,
      maxCapacity: off.max_capacity,
      eligible,
      workloadScore,
      skillMatchScore,
      compositeScore: eligible ? Math.round(skillMatchScore * 0.55 + workloadScore * 0.45) : 0,
      reasons,
    };
  }).sort((a, b) => b.compositeScore - a.compositeScore);
}

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('assignments:view');
  if (errorResponse || !user) return errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const evaluateCaseId = searchParams.get('caseId');
    const db = getDb();

    const assignments = db
      .prepare(
        `SELECT a.*, c.case_number, c.title as case_title, c.district, c.category, c.priority,
                ro.full_name as recommended_officer_name,
                ao.full_name as assigned_officer_name,
                ap.full_name as approved_by_name
         FROM assignments a
         INNER JOIN cases c ON c.id = a.case_id
         LEFT JOIN users ro ON ro.id = a.recommended_officer_id
         LEFT JOIN users ao ON ao.id = a.assigned_officer_id
         LEFT JOIN users ap ON ap.id = a.approved_by
         ORDER BY a.id DESC`
      )
      .all();

    const unassignedOrPendingCases = db
      .prepare(
        `SELECT id, case_number, title, district, category, priority, status, assigned_unit
         FROM cases WHERE status != 'Closed' ORDER BY id DESC`
      )
      .all();

    const officers = db
      .prepare(
        `SELECT u.id, u.full_name, u.badge_number, u.unit, u.jurisdiction, u.availability_status, u.shift_status
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.slug = 'investigating_officer' AND u.is_active = 1 AND u.is_suspended = 0`
      )
      .all();

    let candidates: ReturnType<typeof evaluateCandidates> = [];
    if (evaluateCaseId) {
      const targetCase = db
        .prepare('SELECT id, district, category, priority FROM cases WHERE id = ?')
        .get(Number(evaluateCaseId)) as
        | { id: number; district: string; category: string; priority: string }
        | undefined;
      if (targetCase) {
        candidates = evaluateCandidates(targetCase);
      }
    }

    return NextResponse.json({
      assignments,
      cases: unassignedOrPendingCases,
      officers,
      candidates,
    });
  } catch (error) {
    console.error('Assignments GET error:', error);
    return NextResponse.json({ error: 'Failed to load assignments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('assignments:view');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const action = String(body.action || '');
    const db = getDb();

    if (action === 'acknowledge') {
      const assignmentId = Number(body.assignmentId);
      const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as
        | { id: number; assigned_officer_id: number | null; case_id: number }
        | undefined;
      if (!row || row.assigned_officer_id !== user.id) {
        return NextResponse.json({ error: 'Only the assigned officer can acknowledge this assignment.' }, { status: 403 });
      }
      db.prepare(
        `UPDATE assignments SET acknowledgement_status = 'Acknowledged', acknowledged_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).run(assignmentId);
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'ASSIGNMENT_ACKNOWLEDGED',
        resourceId: `ASN-${assignmentId}`,
        purpose: 'Investigating officer acknowledged case assignment',
        outcome: 'Success',
      });
      return NextResponse.json({ success: true });
    }

    if (!user.permissions.includes('assignments:approve')) {
      return NextResponse.json(
        { error: 'Forbidden: Only authorized Supervisors/Dispatchers can confirm or modify assignments.' },
        { status: 403 }
      );
    }

    if (action === 'recommend_and_submit') {
      const caseId = Number(body.caseId);
      const caseRow = db
        .prepare('SELECT * FROM cases WHERE id = ?')
        .get(caseId) as
        | { id: number; case_number: string; district: string; category: string; priority: string; assigned_unit: string }
        | undefined;
      if (!caseRow) {
        return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
      }

      const candidates = evaluateCandidates(caseRow);
      const topEligible = candidates.find((c) => c.eligible);

      if (!topEligible) {
        // Safety rule: Escalate to supervisor instead of auto-selecting an unsuitable officer
        db.prepare(
          `INSERT INTO assignments (case_id, recommended_officer_id, assigned_officer_id, assigned_unit, eligibility_passed, workload_score, skill_match_score, recommendation_reasons, status)
           VALUES (?, NULL, NULL, ?, 0, 0, 0, ?, 'Escalated')`
        ).run(
          caseRow.id,
          caseRow.assigned_unit,
          JSON.stringify([`No eligible officer available for ${caseRow.district}. Escalated to Supervisor for manual routing.`])
        );

        recordAuditLog({
          userId: user.id,
          userRole: user.roleNames.join(', '),
          action: 'ASSIGNMENT_ESCALATED',
          resourceId: caseRow.case_number,
          purpose: 'No eligible officer matched Stage 1 constraints; escalated to supervisor',
          outcome: 'Flagged',
        });

        return NextResponse.json({
          success: true,
          escalated: true,
          message: 'No eligible officer matched jurisdiction/capacity constraints. Escalated to Supervisor.',
        });
      }

      db.prepare(
        `INSERT INTO assignments (case_id, recommended_officer_id, assigned_officer_id, assigned_unit, eligibility_passed, workload_score, skill_match_score, recommendation_reasons, status)
         VALUES (?, ?, NULL, ?, 1, ?, ?, ?, 'Pending Approval')`
      ).run(
        caseRow.id,
        topEligible.officerId,
        topEligible.unit,
        topEligible.workloadScore,
        topEligible.skillMatchScore,
        JSON.stringify(topEligible.reasons)
      );

      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'ASSIGNMENT_RECOMMENDED',
        resourceId: caseRow.case_number,
        purpose: `Stage 1 & 2 recommended ${topEligible.fullName} (pending supervisor confirmation)`,
        outcome: 'Success',
      });

      return NextResponse.json({ success: true, recommended: topEligible });
    }

    const assignmentId = Number(body.assignmentId);
    const assignment = db
      .prepare(
        `SELECT a.*, c.case_number FROM assignments a INNER JOIN cases c ON c.id = a.case_id WHERE a.id = ?`
      )
      .get(assignmentId) as
      | {
          id: number;
          case_id: number;
          case_number: string;
          recommended_officer_id: number | null;
          assigned_unit: string;
        }
      | undefined;

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment record not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      const targetOfficerId = body.officerId ? Number(body.officerId) : assignment.recommended_officer_id;
      const overrideReason = body.overrideReason ? String(body.overrideReason).trim() : null;
      if (!targetOfficerId) {
        return NextResponse.json({ error: 'Select an officer to confirm assignment.' }, { status: 400 });
      }
      if (targetOfficerId !== assignment.recommended_officer_id && (!overrideReason || overrideReason.length < 5)) {
        return NextResponse.json(
          { error: 'Overriding recommended officer requires a recorded justification.' },
          { status: 400 }
        );
      }

      const officer = db.prepare('SELECT id, full_name, unit FROM users WHERE id = ?').get(targetOfficerId) as
        | { id: number; full_name: string; unit: string }
        | undefined;
      if (!officer) {
        return NextResponse.json({ error: 'Target officer not found.' }, { status: 404 });
      }

      const status =
        targetOfficerId !== assignment.recommended_officer_id && assignment.recommended_officer_id
          ? 'Reassigned'
          : 'Approved';

      db.prepare(
        `UPDATE assignments SET assigned_officer_id = ?, assigned_unit = ?, status = ?, approved_by = ?, override_reason = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(officer.id, officer.unit, status, user.id, overrideReason, assignment.id);

      db.prepare(
        `UPDATE cases SET assigned_officer_id = ?, assigned_unit = ?, status = CASE WHEN status = 'New' OR status = 'Under Review' THEN 'Assigned' ELSE status END, updated_at = datetime('now') WHERE id = ?`
      ).run(officer.id, officer.unit, assignment.case_id);

      dispatchNotification({
        userId: officer.id,
        category: 'Case Assignment',
        title: `New Case Assigned: ${assignment.case_number}`,
        message: `Supervisor confirmed assignment for ${assignment.case_number}. Please acknowledge receipt.`,
        resourceType: 'case',
        resourceId: assignment.case_number,
      });

      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: `ASSIGNMENT_${status.toUpperCase()}`,
        resourceId: assignment.case_number,
        purpose: overrideReason || `Confirmed assignment to ${officer.full_name}`,
        outcome: 'Success',
        approvalRef: `SUP-${user.badgeNumber}`,
      });

      return NextResponse.json({ success: true, status });
    }

    if (action === 'reject') {
      const reason = String(body.reason || 'Supervisor rejected recommendation').trim();
      db.prepare(
        `UPDATE assignments SET status = 'Rejected', approved_by = ?, override_reason = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(user.id, reason, assignment.id);

      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'ASSIGNMENT_REJECTED',
        resourceId: assignment.case_number,
        purpose: reason,
        outcome: 'Success',
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported assignment action.' }, { status: 400 });
  } catch (error) {
    console.error('Assignments POST error:', error);
    return NextResponse.json({ error: 'Failed to process assignment action.' }, { status: 500 });
  }
}
