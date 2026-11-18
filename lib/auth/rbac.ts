import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { ensureSeeded } from '@/lib/db/seed';
import { getSessionFromCookies } from '@/lib/auth/session';

export interface AuthenticatedUser {
  id: number;
  email: string;
  fullName: string;
  badgeNumber: string;
  unit: string;
  jurisdiction: string;
  roles: string[]; // role slugs
  roleNames: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaVerified: boolean;
  sessionJti: string;
  emergencyAccessUntil: string | null;
  emergencyReason: string | null;
}

export function getUserWithRolesAndPermissions(userId: number): Omit<
  AuthenticatedUser,
  'mfaVerified' | 'sessionJti' | 'emergencyAccessUntil' | 'emergencyReason'
> | null {
  ensureSeeded();
  const db = getDb();
  const userRow = db
    .prepare(
      `SELECT id, email, full_name, badge_number, unit, jurisdiction, mfa_enabled, is_active, is_suspended
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        id: number;
        email: string;
        full_name: string;
        badge_number: string;
        unit: string;
        jurisdiction: string;
        mfa_enabled: number;
        is_active: number;
        is_suspended: number;
      }
    | undefined;

  if (!userRow || !userRow.is_active || userRow.is_suspended) return null;

  const roleRows = db
    .prepare(
      `SELECT r.id, r.name, r.slug
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.is_active = 1`
    )
    .all(userId) as Array<{ id: number; name: string; slug: string }>;

  const permRows = db
    .prepare(
      `SELECT DISTINCT p.code
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       INNER JOIN user_roles ur ON ur.role_id = rp.role_id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.is_active = 1`
    )
    .all(userId) as Array<{ code: string }>;

  return {
    id: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    badgeNumber: userRow.badge_number,
    unit: userRow.unit,
    jurisdiction: userRow.jurisdiction,
    roles: roleRows.map((r) => r.slug),
    roleNames: roleRows.map((r) => r.name),
    permissions: permRows.map((p) => p.code),
    mfaEnabled: Boolean(userRow.mfa_enabled),
  };
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  ensureSeeded();
  const payload = await getSessionFromCookies();
  if (!payload) return null;

  const db = getDb();
  const sessionRow = db
    .prepare(
      `SELECT mfa_verified, emergency_access_until, emergency_reason, expires_at, revoked_at
       FROM sessions WHERE token_jti = ? AND user_id = ?`
    )
    .get(payload.jti, payload.userId) as
    | {
        mfa_verified: number;
        emergency_access_until: string | null;
        emergency_reason: string | null;
        expires_at: string;
        revoked_at: string | null;
      }
    | undefined;

  if (!sessionRow || sessionRow.revoked_at) return null;
  if (new Date(sessionRow.expires_at).getTime() < Date.now()) return null;

  const profile = getUserWithRolesAndPermissions(payload.userId);
  if (!profile) return null;

  return {
    ...profile,
    mfaVerified: Boolean(sessionRow.mfa_verified),
    sessionJti: payload.jti,
    emergencyAccessUntil: sessionRow.emergency_access_until,
    emergencyReason: sessionRow.emergency_reason,
  };
}

export async function requireAuth(requiredPermission?: string): Promise<{
  user: AuthenticatedUser | null;
  errorResponse: NextResponse | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      ),
    };
  }

  if (user.mfaEnabled && !user.mfaVerified) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Multi-factor authentication verification required.' },
        { status: 403 }
      ),
    };
  }

  if (requiredPermission && !user.permissions.includes(requiredPermission)) {
    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', ') || 'Unassigned',
      action: `PERMISSION_DENIED:${requiredPermission}`,
      resourceId: 'API',
      purpose: 'Unauthorized endpoint access attempt blocked by backend RBAC',
      outcome: 'Denied',
    });
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: `Forbidden: Missing required permission (${requiredPermission}).` },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

export function hasActiveEmergencyAccess(user: AuthenticatedUser): boolean {
  if (!user.emergencyAccessUntil) return false;
  return new Date(user.emergencyAccessUntil).getTime() > Date.now();
}

export function canAccessCase(
  user: AuthenticatedUser,
  caseRow: {
    id: number;
    assigned_officer_id: number | null;
    assigned_unit: string;
    sensitivity_level: string;
  }
): { allowed: boolean; reason?: string } {
  const isEmergencyActive = hasActiveEmergencyAccess(user);

  // System Admin and Auditor do not have routine access to confidential case dossiers
  if (
    user.roles.includes('system_admin') &&
    !user.roles.includes('super_admin')
  ) {
    return { allowed: false, reason: 'System Administrators do not have routine access to case investigation content.' };
  }

  if (user.roles.includes('auditor') && user.roles.length === 1) {
    return { allowed: false, reason: 'Auditors inspect audit logs and aggregate analytics, not confidential case files.' };
  }

  // Confidential cases enforce strict least-privilege
  if (caseRow.sensitivity_level === 'Confidential') {
    if (caseRow.assigned_officer_id === user.id) {
      return { allowed: true };
    }
    if (
      (user.roles.includes('supervisor') || user.roles.includes('legal_reviewer')) &&
      (caseRow.assigned_unit === user.unit || user.jurisdiction === 'National')
    ) {
      return { allowed: true };
    }
    if (user.roles.includes('forensic_analyst')) {
      // Forensic analysts can access cases where evidence is assigned to them
      const db = getDb();
      const ev = db
        .prepare('SELECT id FROM evidence WHERE case_id = ? AND current_custodian_id = ? LIMIT 1')
        .get(caseRow.id, user.id);
      if (ev) return { allowed: true };
    }
    if (user.roles.includes('super_admin')) {
      if (isEmergencyActive) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          'Least-privilege policy: Super Admin requires justified, time-limited, MFA-verified Emergency Break-Glass Access for Confidential cases.',
      };
    }
    return { allowed: false, reason: 'Confidential case restricted to assigned officer and authorized oversight.' };
  }

  // Restricted or Standard cases
  if (user.roles.includes('super_admin') && !isEmergencyActive && caseRow.sensitivity_level === 'Restricted') {
    return {
      allowed: false,
      reason: 'Restricted case requires Emergency Break-Glass Access for Super Admin.',
    };
  }

  if (
    user.roles.includes('supervisor') ||
    user.roles.includes('legal_reviewer') ||
    user.roles.includes('evidence_custodian') ||
    user.roles.includes('forensic_analyst')
  ) {
    return { allowed: true };
  }

  if (user.roles.includes('investigating_officer')) {
    if (caseRow.assigned_officer_id === user.id || caseRow.assigned_unit === user.unit || caseRow.assigned_officer_id === null) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Case belongs to a different unit or investigating officer.' };
  }

  if (user.roles.includes('super_admin') && caseRow.sensitivity_level === 'Standard') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Insufficient authorization for this case.' };
}

export function recordAuditLog(params: {
  userId?: number | null;
  userRole: string;
  action: string;
  resourceId: string;
  purpose: string;
  outcome: 'Success' | 'Denied' | 'Flagged';
  approvalRef?: string | null;
  ipAddress?: string;
}) {
  const db = getDb();
  const lastRow = db
    .prepare('SELECT id, entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1')
    .get() as { id: number; entry_hash: string } | undefined;

  const prevHash =
    lastRow?.entry_hash ||
    '0000000000000000000000000000000000000000000000000000000000000000';
  const nextNum = (lastRow?.id || 0) + 1;
  const eventId = `AUD-2026-${String(nextNum).padStart(5, '0')}`;
  const entryHash = crypto
    .createHash('sha256')
    .update(
      `${prevHash}|${eventId}|${params.userId ?? 'ANON'}|${params.action}|${params.resourceId}|${params.outcome}|${Date.now()}`
    )
    .digest('hex');

  db.prepare(
    `INSERT INTO audit_logs (event_id, user_id, user_role, action, resource_id, purpose, outcome, approval_ref, ip_address, prev_hash, entry_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    params.userId ?? null,
    params.userRole,
    params.action,
    params.resourceId,
    params.purpose,
    params.outcome,
    params.approvalRef || null,
    params.ipAddress || '127.0.0.1',
    prevHash,
    entryHash
  );
}

export function dispatchNotification(params: {
  userId: number;
  category: string;
  title: string;
  message: string; // Must never include confidential case details
  resourceType?: string;
  resourceId?: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO notifications (user_id, category, title, message, resource_type, resource_id, is_read)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(
    params.userId,
    params.category,
    params.title,
    params.message,
    params.resourceType || null,
    params.resourceId || null
  );
}
