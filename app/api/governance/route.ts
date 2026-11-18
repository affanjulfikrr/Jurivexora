import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, recordAuditLog } from '@/lib/auth/rbac';

export async function GET() {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse || !user) return errorResponse!;

  if (!user.permissions.includes('governance:manage') && !user.permissions.includes('audit:read')) {
    return NextResponse.json({ error: 'Forbidden: Missing AI governance or oversight permission.' }, { status: 403 });
  }

  try {
    const db = getDb();
    const models = db.prepare('SELECT * FROM model_registry ORDER BY id ASC').all();
    const usageHistory = db
      .prepare(
        `SELECT j.job_number, j.job_type, j.mode, j.status, j.created_at, m.name as model_name, u.full_name as requester_name
         FROM ai_jobs j
         LEFT JOIN model_registry m ON m.id = j.model_id
         LEFT JOIN users u ON u.id = j.requested_by
         ORDER BY j.id DESC LIMIT 25`
      )
      .all();

    const errorReports = db
      .prepare(
        `SELECT r.*, s.suggestion_number, u.full_name as reporter_name
         FROM ai_reviews r
         INNER JOIN ai_suggestions s ON s.id = r.suggestion_id
         INNER JOIN users u ON u.id = r.reviewer_id
         WHERE r.action = 'Report Error'
         ORDER BY r.id DESC`
      )
      .all();

    const thresholdSetting = db
      .prepare("SELECT value FROM system_settings WHERE key = 'ai_confidence_threshold'")
      .get() as { value: string } | undefined;

    const globalSetting = db
      .prepare("SELECT value FROM system_settings WHERE key = 'ai_global_enabled'")
      .get() as { value: string } | undefined;

    return NextResponse.json({
      models,
      usageHistory,
      errorReports,
      confidenceThreshold: Number(thresholdSetting?.value || 85),
      globalAiEnabled: globalSetting?.value !== 'false',
    });
  } catch (error) {
    console.error('Governance GET error:', error);
    return NextResponse.json({ error: 'Failed to load AI governance data.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('governance:manage');
  if (errorResponse || !user) return errorResponse!;

  try {
    const body = await req.json();
    const db = getDb();

    if (body.action === 'update_threshold') {
      const threshold = Math.min(99, Math.max(50, Number(body.threshold || 85)));
      db.prepare(
        `UPDATE system_settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = 'ai_confidence_threshold'`
      ).run(String(threshold), user.id);

      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: 'AI_THRESHOLD_UPDATED',
        resourceId: 'ai_confidence_threshold',
        purpose: `Updated research confidence threshold to ${threshold}%`,
        outcome: 'Success',
      });
      return NextResponse.json({ success: true, threshold });
    }

    if (body.action === 'toggle_global_ai') {
      const enabled = Boolean(body.enabled);
      db.prepare(
        `UPDATE system_settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = 'ai_global_enabled'`
      ).run(enabled ? 'true' : 'false', user.id);

      recordAuditLog({
        userId: user.id,
        userRole: user.roleNames.join(', '),
        action: enabled ? 'AI_GLOBAL_ENABLED' : 'AI_GLOBAL_DISABLED',
        resourceId: 'ai_global_enabled',
        purpose: enabled ? 'Re-enabled AI assistance platform-wide' : 'Activated global AI kill-switch (manual fallback)',
        outcome: 'Flagged',
      });
      return NextResponse.json({ success: true, globalAiEnabled: enabled });
    }

    const modelId = Number(body.modelId);
    const status = String(body.status || 'Active');
    const version = body.version ? String(body.version) : undefined;
    const reason = String(body.reason || 'Governance update').trim();

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required.' }, { status: 400 });
    }

    const model = db.prepare('SELECT model_key, version FROM model_registry WHERE id = ?').get(modelId) as
      | { model_key: string; version: string }
      | undefined;

    if (!model) {
      return NextResponse.json({ error: 'Model not found.' }, { status: 404 });
    }

    if (version) {
      db.prepare(
        `UPDATE model_registry SET status = ?, version = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(status, version, user.id, modelId);
    } else {
      db.prepare(
        `UPDATE model_registry SET status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(status, user.id, modelId);
    }

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: `AI_MODEL_${status.toUpperCase()}`,
      resourceId: model.model_key,
      purpose: `${reason}${version ? ` (version ${version})` : ''}`,
      outcome: 'Flagged',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Governance PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update AI governance settings.' }, { status: 500 });
  }
}
