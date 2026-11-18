import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth('roles:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all() as Array<{
      id: number;
      name: string;
      slug: string;
      description: string;
      is_system: number;
      is_active: number;
    }>;
    const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, code ASC').all();
    const mappings = db.prepare('SELECT * FROM role_permissions').all() as Array<{
      role_id: number;
      permission_id: number;
    }>;

    const rolesWithPerms = roles.map((r) => ({
      ...r,
      permissionIds: mappings.filter((m) => m.role_id === r.id).map((m) => m.permission_id),
    }));

    return NextResponse.json({ roles: rolesWithPerms, permissions });
  } catch (error) {
    console.error('Admin roles GET error:', error);
    return NextResponse.json({ error: 'Failed to load roles & permissions.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('roles:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    if (name.length < 3 || description.length < 5) {
      return NextResponse.json({ error: 'Role name and description are required.' }, { status: 400 });
    }

    const db = getDb();
    const res = db
      .prepare('INSERT INTO roles (name, slug, description, is_system, is_active) VALUES (?, ?, ?, 0, 1)')
      .run(name, slug, description);

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: 'ROLE_CREATED',
      resourceId: slug,
      purpose: `Created custom RBAC role ${name}`,
      outcome: 'Flagged',
    });

    return NextResponse.json({ success: true, id: Number(res.lastInsertRowid) });
  } catch (error) {
    console.error('Admin roles POST error:', error);
    return NextResponse.json({ error: 'Failed to create role (name must be unique).' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('roles:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const roleId = Number(body.roleId);
    const db = getDb();

    const role = db.prepare('SELECT id, slug, name FROM roles WHERE id = ?').get(roleId) as
      | { id: number; slug: string; name: string }
      | undefined;

    if (!role) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    }

    if (typeof body.isActive === 'boolean') {
      db.prepare('UPDATE roles SET is_active = ? WHERE id = ?').run(body.isActive ? 1 : 0, role.id);
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: body.isActive ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED',
        resourceId: role.slug,
        purpose: `Changed role ${role.name} active=${body.isActive}`,
        outcome: 'Flagged',
      });
    }

    if (Array.isArray(body.permissionIds)) {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
      const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      for (const pid of body.permissionIds) {
        ins.run(role.id, Number(pid));
      }
      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'ROLE_PERMISSIONS_UPDATED',
        resourceId: role.slug,
        purpose: `Modified permissions for ${role.name} (${body.permissionIds.length} grants)`,
        outcome: 'Flagged',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin roles PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update role.' }, { status: 500 });
  }
}
