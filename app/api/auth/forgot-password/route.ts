import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db/database';
import { ensureSeeded } from '@/lib/db/seed';
import { recordAuditLog } from '@/lib/auth/rbac';

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const body = await req.json();
    const step = String(body.step || 'request');
    const email = String(body.email || '').trim().toLowerCase();
    const db = getDb();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const user = db
      .prepare('SELECT id, email, full_name FROM users WHERE lower(email) = ?')
      .get(email) as { id: number; email: string; full_name: string } | undefined;

    if (step === 'request') {
      if (!user) {
        return NextResponse.json({
          success: true,
          message: 'If the account exists, a password reset verification code has been issued.',
        });
      }
      const resetCode = String(crypto.randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO password_resets (user_id, reset_code, expires_at) VALUES (?, ?, ?)`
      ).run(user.id, resetCode, expiresAt);

      recordAuditLog({
        userId: user.id,
        userRole: 'Password Reset',
        action: 'PASSWORD_RESET_REQUESTED',
        resourceId: user.email,
        purpose: 'Self-service password reset code generated',
        outcome: 'Success',
      });

      return NextResponse.json({
        success: true,
        message: 'Verification code generated (Academic Demo Preview shown below).',
        demoResetCode: resetCode,
      });
    }

    if (step === 'reset') {
      const resetCode = String(body.resetCode || '').trim();
      const newPassword = String(body.newPassword || '');
      if (!user) {
        return NextResponse.json({ error: 'Invalid reset request.' }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
      }
      const tokenRow = db
        .prepare(
          `SELECT id, expires_at, used_at FROM password_resets
           WHERE user_id = ? AND reset_code = ? ORDER BY id DESC LIMIT 1`
        )
        .get(user.id, resetCode) as
        | { id: number; expires_at: string; used_at: string | null }
        | undefined;

      if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Invalid or expired reset code.' }, { status: 400 });
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
        hash,
        user.id
      );
      db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`).run(tokenRow.id);
      db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ?`).run(user.id);

      recordAuditLog({
        userId: user.id,
        userRole: 'Password Reset',
        action: 'PASSWORD_RESET_COMPLETED',
        resourceId: user.email,
        purpose: 'Password updated via reset verification code',
        outcome: 'Success',
      });

      return NextResponse.json({ success: true, message: 'Password reset complete. You may now sign in.' });
    }

    return NextResponse.json({ error: 'Invalid workflow step.' }, { status: 400 });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Password reset service error.' }, { status: 500 });
  }
}
