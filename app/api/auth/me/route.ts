import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db/database';
import { ensureSeeded } from '@/lib/db/seed';
import { getCurrentUser, recordAuditLog } from '@/lib/auth/rbac';

export async function GET() {
  try {
    ensureSeeded();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }
    const db = getDb();
    const sessions = db
      .prepare(
        `SELECT id, token_jti, ip_address, user_agent, mfa_verified, emergency_access_until, expires_at, revoked_at, created_at
         FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
      )
      .all(user.id);

    return NextResponse.json({
      authenticated: true,
      user,
      sessions,
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const body = await req.json();
    const db = getDb();

    if (body.action === 'change_password') {
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
      }
      const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as {
        password_hash: string;
      };
      if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }
      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
        hash,
        user.id
      );
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'PASSWORD_CHANGED',
        resourceId: user.email,
        purpose: 'User updated account password',
        outcome: 'Success',
      });
      return NextResponse.json({ success: true, message: 'Password updated successfully.' });
    }

    if (body.action === 'revoke_session') {
      const jti = String(body.jti || '');
      db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE token_jti = ? AND user_id = ?`).run(
        jti,
        user.id
      );
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'SESSION_REVOKED',
        resourceId: jti.slice(0, 8),
        purpose: 'User terminated active session',
        outcome: 'Success',
      });
      return NextResponse.json({ success: true });
    }

    const fullName = String(body.fullName || user.fullName).trim();
    const availabilityStatus = String(body.availabilityStatus || 'Available');
    const shiftStatus = String(body.shiftStatus || 'Day Shift');
    const mfaEnabled = typeof body.mfaEnabled === 'boolean' ? (body.mfaEnabled ? 1 : 0) : undefined;

    if (fullName.length < 2) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    if (mfaEnabled !== undefined) {
      db.prepare(
        `UPDATE users SET full_name = ?, availability_status = ?, shift_status = ?, mfa_enabled = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(fullName, availabilityStatus, shiftStatus, mfaEnabled, user.id);
    } else {
      db.prepare(
        `UPDATE users SET full_name = ?, availability_status = ?, shift_status = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(fullName, availabilityStatus, shiftStatus, user.id);
    }

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'PROFILE_UPDATED',
      resourceId: user.email,
      purpose: 'User updated profile and availability settings',
      outcome: 'Success',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}
