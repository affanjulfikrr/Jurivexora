import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth('users:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    const users = db
      .prepare(
        `SELECT u.id, u.email, u.full_name, u.badge_number, u.unit, u.jurisdiction, u.skills,
                u.availability_status, u.shift_status, u.max_capacity, u.mfa_enabled,
                u.is_active, u.is_suspended, u.failed_login_attempts, u.last_login_at, u.created_at
         FROM users u ORDER BY u.id ASC`
      )
      .all() as Array<Record<string, unknown>>;

    const userRoles = db
      .prepare(
        `SELECT ur.user_id, r.id as role_id, r.name as role_name, r.slug as role_slug
         FROM user_roles ur INNER JOIN roles r ON r.id = ur.role_id`
      )
      .all() as Array<{ user_id: number; role_id: number; role_name: string; role_slug: string }>;

    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();

    const enriched = users.map((u) => ({
      ...u,
      roles: userRoles.filter((ur) => ur.user_id === u.id),
    }));

    return NextResponse.json({ users: enriched, roles });
  } catch (error) {
    console.error('Admin users GET error:', error);
    return NextResponse.json({ error: 'Failed to load user directory.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('users:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const badgeNumber = String(body.badgeNumber || '').trim();
    const unit = String(body.unit || 'DMP Gulshan Division').trim();
    const jurisdiction = String(body.jurisdiction || 'Dhaka').trim();
    const roleId = Number(body.roleId);
    const password = String(body.password || 'Jurivexora@2026');

    if (!email || fullName.length < 2 || !badgeNumber || !roleId) {
      return NextResponse.json({ error: 'Email, full name, badge number, and role are required.' }, { status: 400 });
    }

    const db = getDb();
    const hash = bcrypt.hashSync(password, 10);
    const res = db
      .prepare(
        `INSERT INTO users (email, password_hash, full_name, badge_number, unit, jurisdiction, skills, mfa_enabled, mfa_secret, is_active, is_suspended)
         VALUES (?, ?, ?, ?, ?, ?, '["General Investigation"]', 1, '482910', 1, 0)`
      )
      .run(email, hash, fullName, badgeNumber, unit, jurisdiction);

    const newUserId = Number(res.lastInsertRowid);
    db.prepare('INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)').run(
      newUserId,
      roleId,
      user.id
    );

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'USER_CREATED',
      resourceId: email,
      purpose: `Created account for ${fullName} (${badgeNumber})`,
      outcome: 'Success',
    });

    return NextResponse.json({ success: true, id: newUserId });
  } catch (error) {
    console.error('Admin users POST error:', error);
    return NextResponse.json({ error: 'Failed to create user (check unique email/badge).' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('users:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const targetUserId = Number(body.userId);
    const db = getDb();

    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetUserId) as
      | { id: number; email: string }
      | undefined;

    if (!target) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }

    if (typeof body.isSuspended === 'boolean') {
      db.prepare(`UPDATE users SET is_suspended = ?, updated_at = datetime('now') WHERE id = ?`).run(
        body.isSuspended ? 1 : 0,
        target.id
      );
      if (body.isSuspended) {
        db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ?`).run(target.id);
      }
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: body.isSuspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
        resourceId: target.email,
        purpose: body.isSuspended ? 'Suspended account and revoked sessions' : 'Reactivated suspended account',
        outcome: 'Flagged',
      });
    }

    if (typeof body.isActive === 'boolean') {
      db.prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(
        body.isActive ? 1 : 0,
        target.id
      );
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: body.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        resourceId: target.email,
        purpose: `Set account active=${body.isActive}`,
        outcome: 'Success',
      });
    }

    if (Array.isArray(body.roleIds)) {
      db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(target.id);
      const ins = db.prepare('INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)');
      for (const rid of body.roleIds) {
        ins.run(target.id, Number(rid), user.id);
      }
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'USER_ROLES_UPDATED',
        resourceId: target.email,
        purpose: `Updated assigned roles (${body.roleIds.join(',')})`,
        outcome: 'Flagged',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin users PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}
