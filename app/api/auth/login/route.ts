import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db/database';
import { ensureSeeded } from '@/lib/db/seed';
import { createUserSession, setSessionCookie } from '@/lib/auth/session';
import { getUserWithRolesAndPermissions, recordAuditLog } from '@/lib/auth/rbac';

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare(
        `SELECT id, email, password_hash, full_name, mfa_enabled, is_active, is_suspended, failed_login_attempts
         FROM users WHERE lower(email) = ?`
      )
      .get(email) as
      | {
          id: number;
          email: string;
          password_hash: string;
          full_name: string;
          mfa_enabled: number;
          is_active: number;
          is_suspended: number;
          failed_login_attempts: number;
        }
      | undefined;

    if (!user) {
      recordAuditLog({
        userId: null,
        userRole: 'Unknown',
        action: 'LOGIN_FAILED',
        resourceId: email,
        purpose: 'Authentication attempt with unrecognized account email',
        outcome: 'Denied',
      });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (!user.is_active || user.is_suspended) {
      recordAuditLog({
        userId: user.id,
        userRole: 'Suspended/Inactive',
        action: 'LOGIN_BLOCKED',
        resourceId: user.email,
        purpose: 'Attempted login on deactivated or suspended account',
        outcome: 'Denied',
      });
      return NextResponse.json(
        { error: 'Account is suspended or deactivated. Contact a Super Admin.' },
        { status: 403 }
      );
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?').run(
        user.id
      );
      recordAuditLog({
        userId: user.id,
        userRole: 'Unverified',
        action: 'LOGIN_FAILED',
        resourceId: user.email,
        purpose: 'Invalid password submitted during login',
        outcome: 'Denied',
      });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    db.prepare(
      `UPDATE users SET failed_login_attempts = 0, last_login_at = datetime('now') WHERE id = ?`
    ).run(user.id);

    const profile = getUserWithRolesAndPermissions(user.id);
    const mfaRequired = Boolean(user.mfa_enabled);
    const { token } = await createUserSession({
      userId: user.id,
      email: user.email,
      mfaVerified: !mfaRequired,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Browser',
    });

    await setSessionCookie(token);

    recordAuditLog({
      userId: user.id,
      userRole: profile?.roleNames.join(', ') || 'User',
      action: mfaRequired ? 'LOGIN_MFA_CHALLENGE' : 'LOGIN_SUCCESS',
      resourceId: user.email,
      purpose: 'User authentication',
      outcome: 'Success',
    });

    return NextResponse.json({
      mfaRequired,
      user: profile,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication service error.' }, { status: 500 });
  }
}
