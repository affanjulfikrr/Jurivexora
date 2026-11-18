import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog, dispatchNotification } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth('tasks:read');
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    // Auto-flag past-due tasks as Overdue
    db.prepare(
      `UPDATE tasks SET status = 'Overdue', updated_at = datetime('now')
       WHERE status IN ('Pending','In Progress') AND date(deadline) < date('now')`
    ).run();

    const tasks = db
      .prepare(
        `SELECT t.*, c.case_number, c.title as case_title,
                ua.full_name as assignee_name, uc.full_name as creator_name
         FROM tasks t
         INNER JOIN cases c ON c.id = t.case_id
         LEFT JOIN users ua ON ua.id = t.assigned_to
         LEFT JOIN users uc ON uc.id = t.created_by
         ORDER BY CASE t.status WHEN 'Overdue' THEN 1 WHEN 'Pending' THEN 2 WHEN 'In Progress' THEN 3 WHEN 'Under Review' THEN 4 ELSE 5 END, t.deadline ASC`
      )
      .all();

    const cases = db.prepare('SELECT id, case_number, title FROM cases ORDER BY id DESC').all();
    const users = db
      .prepare('SELECT id, full_name, badge_number, unit FROM users WHERE is_active = 1 AND is_suspended = 0 ORDER BY full_name ASC')
      .all();

    return NextResponse.json({ tasks, cases, users });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json({ error: 'Failed to load tasks.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('tasks:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const caseId = Number(body.caseId);
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const assignedTo = Number(body.assignedTo) || user.id;
    const priority = String(body.priority || 'Medium');
    const deadline = String(body.deadline || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

    if (!caseId || title.length < 3 || description.length < 5) {
      return NextResponse.json({ error: 'Case, title, and description are required.' }, { status: 400 });
    }

    const db = getDb();
    const res = db
      .prepare(
        `INSERT INTO tasks (case_id, title, description, assigned_to, created_by, priority, status, deadline)
         VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`
      )
      .run(caseId, title, description, assignedTo, user.id, priority, deadline);

    const caseRow = db.prepare('SELECT case_number FROM cases WHERE id = ?').get(caseId) as { case_number: string };

    if (assignedTo !== user.id) {
      dispatchNotification({
        userId: assignedTo,
        category: 'Task Assignment',
        title: `New Investigation Task (${priority})`,
        message: `Task "${title}" assigned for ${caseRow?.case_number || 'Case'} due ${deadline}.`,
        resourceType: 'task',
        resourceId: String(res.lastInsertRowid),
      });
    }

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'TASK_CREATED',
      resourceId: caseRow?.case_number || String(caseId),
      purpose: `Created task "${title}" due ${deadline}`,
      outcome: 'Success',
    });

    return NextResponse.json({ success: true, id: Number(res.lastInsertRowid) });
  } catch (error) {
    console.error('Tasks POST error:', error);
    return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('tasks:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const taskId = Number(body.taskId);
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
      | { id: number; status: string; comments: string; title: string }
      | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    if (body.comment) {
      const comments = JSON.parse(task.comments || '[]') as Array<Record<string, unknown>>;
      comments.push({
        id: `C-${Date.now()}`,
        author: user.fullName,
        text: String(body.comment).trim(),
        createdAt: new Date().toISOString(),
      });
      db.prepare(`UPDATE tasks SET comments = ?, updated_at = datetime('now') WHERE id = ?`).run(
        JSON.stringify(comments),
        task.id
      );
      return NextResponse.json({ success: true });
    }

    const newStatus = String(body.status || task.status);
    db.prepare(`UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(newStatus, task.id);

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'TASK_STATUS_UPDATED',
      resourceId: `TASK-${task.id}`,
      purpose: `Updated "${task.title}" status to ${newStatus}`,
      outcome: 'Success',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tasks PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
  }
}
