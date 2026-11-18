import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    const notifications = db
      .prepare(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50`
      )
      .all(user.id);
    const unreadCount = (
      db
        .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
        .get(user.id) as { c: number }
    ).c;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const db = getDb();

    if (body.markAll) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
    } else if (body.id) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
        Number(body.id),
        user.id
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notifications.' }, { status: 500 });
  }
}
