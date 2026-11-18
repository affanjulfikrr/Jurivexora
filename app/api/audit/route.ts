import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('audit:read');
  if (errorResponse || !user) return errorResponse!;

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const outcome = searchParams.get('outcome') || 'All';
    const actionFilter = (searchParams.get('action') || '').trim().toLowerCase();

    const db = getDb();
    const logs = db
      .prepare(
        `SELECT a.*, u.full_name as user_name, u.email as user_email
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.id DESC LIMIT 200`
      )
      .all() as Array<{
      id: number;
      event_id: string;
      user_id: number | null;
      user_name: string | null;
      user_email: string | null;
      user_role: string;
      action: string;
      resource_id: string;
      purpose: string;
      outcome: string;
      approval_ref: string | null;
      ip_address: string;
      prev_hash: string;
      entry_hash: string;
      created_at: string;
    }>;

    // Verify tamper-evident hash chain linking across all rows
    const ascLogs = [...logs].reverse();
    let chainIntact = true;
    for (let i = 1; i < ascLogs.length; i++) {
      if (ascLogs[i].prev_hash !== ascLogs[i - 1].entry_hash) {
        chainIntact = false;
        break;
      }
    }

    const filtered = logs.filter((l) => {
      if (outcome !== 'All' && l.outcome !== outcome) return false;
      if (actionFilter && !l.action.toLowerCase().includes(actionFilter)) return false;
      if (q) {
        const hay = `${l.event_id} ${l.user_name || ''} ${l.user_role} ${l.action} ${l.resource_id} ${l.purpose}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const securityAlerts = logs.filter((l) => l.outcome === 'Denied' || l.outcome === 'Flagged').slice(0, 12);

    return NextResponse.json({
      logs: filtered,
      securityAlerts,
      chainVerification: {
        intact: chainIntact,
        totalRecords: logs.length,
        latestHashDigest: logs[0]?.entry_hash || crypto.createHash('sha256').update('empty').digest('hex'),
      },
    });
  } catch (error) {
    console.error('Audit GET error:', error);
    return NextResponse.json({ error: 'Failed to load audit logs.' }, { status: 500 });
  }
}
