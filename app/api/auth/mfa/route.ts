import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { ensureSeeded } from '@/lib/db/seed';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getUserWithRolesAndPermissions, recordAuditLog } from '@/lib/auth/rbac';

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'No active authentication session.' }, { status: 401 });
    }

    const body = await req.json();
    const code = String(body.code || '').trim();
    const mode = String(body.mode || 'login'); // 'login' | 'emergency'
    const reason = String(body.reason || '').trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter a valid 6-digit verification code.' }, { status: 400 });
    }

    const db = getDb();
    const userRow = db
      .prepare('SELECT id, email, mfa_secret FROM users WHERE id = ?')
      .get(session.userId) as { id: number; email: string; mfa_secret: string } | undefined;

    if (!userRow) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // For academic demonstration, accept the user's configured MFA secret (default 482910) or any 6-digit demo authenticator code matching 482910 / 123456
    const validCodes = new Set([userRow.mfa_secret, '482910', '123456']);
    if (!validCodes.has(code)) {
      recordAuditLog({
        userId: userRow.id,
        userRole: 'MFA Verification',
        action: 'MFA_FAILED',
        resourceId: userRow.email,
        purpose: `Invalid MFA code during ${mode}`,
        outcome: 'Denied',
      });
      return NextResponse.json(
        { error: 'Invalid MFA verification code. Use demo authenticator code 482910.' },
        { status: 401 }
      );
    }

    const profile = getUserWithRolesAndPermissions(userRow.id);

    if (mode === 'emergency') {
      if (!profile?.permissions.includes('emergency:break_glass')) {
        return NextResponse.json(
          { error: 'Role does not hold emergency break-glass authorization.' },
          { status: 403 }
        );
      }
      if (reason.length < 12) {
        return NextResponse.json(
          { error: 'Provide a detailed justification (minimum 12 characters) for emergency privileged access.' },
          { status: 400 }
        );
      }
      const setting = db
        .prepare("SELECT value FROM system_settings WHERE key = 'emergency_access_minutes'")
        .get() as { value: string } | undefined;
      const mins = Number(setting?.value || 15);
      const until = new Date(Date.now() + mins * 60 * 1000).toISOString();

      db.prepare(
        `UPDATE sessions SET mfa_verified = 1, emergency_access_until = ?, emergency_reason = ? WHERE token_jti = ?`
      ).run(until, reason, session.jti);

      recordAuditLog({
        userId: userRow.id,
        userRole: profile.roleNames.join(', '),
        action: 'EMERGENCY_BREAK_GLASS_GRANTED',
        resourceId: 'CONFIDENTIAL_CASES',
        purpose: reason,
        outcome: 'Flagged',
        approvalRef: `MFA-${session.jti.slice(0, 8)}`,
      });

      return NextResponse.json({
        success: true,
        emergencyAccessUntil: until,
        emergencyReason: reason,
      });
    }

    db.prepare('UPDATE sessions SET mfa_verified = 1 WHERE token_jti = ?').run(session.jti);

    recordAuditLog({
      userId: userRow.id,
      userRole: profile?.roleNames.join(', ') || 'User',
      action: 'LOGIN_MFA_VERIFIED',
      resourceId: userRow.email,
      purpose: 'MFA verification completed',
      outcome: 'Success',
    });

    return NextResponse.json({ success: true, user: profile });
  } catch (error) {
    console.error('MFA error:', error);
    return NextResponse.json({ error: 'MFA verification error.' }, { status: 500 });
  }
}
