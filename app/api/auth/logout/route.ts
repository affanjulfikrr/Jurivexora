import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { clearSessionCookie, getSessionFromCookies } from '@/lib/auth/session';
import { getUserWithRolesAndPermissions, recordAuditLog } from '@/lib/auth/rbac';

export async function POST() {
  try {
    const session = await getSessionFromCookies();
    if (session) {
      const db = getDb();
      db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE token_jti = ?`).run(session.jti);
      const profile = getUserWithRolesAndPermissions(session.userId);
      recordAuditLog({
        userId: session.userId,
        userRole: profile?.roleNames.join(', ') || 'User',
        action: 'LOGOUT',
        resourceId: session.email,
        purpose: 'User initiated session logout',
        outcome: 'Success',
      });
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
