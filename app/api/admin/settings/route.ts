import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth('settings:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM system_settings ORDER BY category, key ASC').all();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to load system settings.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('settings:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const key = String(body.key || '').trim();
    const value = String(body.value ?? '').trim();

    if (!key) {
      return NextResponse.json({ error: 'Setting key is required.' }, { status: 400 });
    }

    const db = getDb();
    db.prepare(
      `UPDATE system_settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?`
    ).run(value, user.id, key);

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'SYSTEM_SETTING_UPDATED',
      resourceId: key,
      purpose: `Updated setting ${key} = ${value}`,
      outcome: 'Flagged',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update setting.' }, { status: 500 });
  }
}
