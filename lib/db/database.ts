import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'jurivexora.sqlite');
export const ORIGINALS_DIR = path.join(DATA_DIR, 'uploads', 'originals');
export const PROCESSED_DIR = path.join(DATA_DIR, 'uploads', 'processed');

declare global {
  var _jurivexoraDb: DatabaseSync | undefined;
  var _jurivexoraSeeded: boolean | undefined;
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      badge_number TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      skills TEXT NOT NULL DEFAULT '[]',
      availability_status TEXT NOT NULL DEFAULT 'Available',
      shift_status TEXT NOT NULL DEFAULT 'Day Shift',
      max_capacity INTEGER NOT NULL DEFAULT 8,
      mfa_enabled INTEGER NOT NULL DEFAULT 1,
      mfa_secret TEXT NOT NULL DEFAULT '482910',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_jti TEXT NOT NULL UNIQUE,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      user_agent TEXT NOT NULL DEFAULT 'Browser',
      mfa_verified INTEGER NOT NULL DEFAULT 0,
      emergency_access_until TEXT,
      emergency_reason TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reset_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      incident_date TEXT NOT NULL,
      location TEXT NOT NULL,
      district TEXT NOT NULL,
      thana TEXT NOT NULL,
      description TEXT NOT NULL,
      reporting_source TEXT NOT NULL,
      assigned_officer_id INTEGER REFERENCES users(id),
      assigned_unit TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('Low','Medium','High','Critical')),
      status TEXT NOT NULL CHECK(status IN ('New','Under Review','Assigned','In Progress','Pending','Closed')),
      sensitivity_level TEXT NOT NULL DEFAULT 'Standard' CHECK(sensitivity_level IN ('Standard','Restricted','Confidential')),
      deadline TEXT,
      investigation_notes TEXT NOT NULL DEFAULT '[]',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_number TEXT NOT NULL UNIQUE,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      incident_date TEXT NOT NULL,
      location TEXT NOT NULL,
      district TEXT NOT NULL,
      description TEXT NOT NULL,
      reporter_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS public_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      incident_date TEXT NOT NULL,
      location TEXT NOT NULL,
      district TEXT NOT NULL,
      description TEXT NOT NULL,
      contact_preference TEXT NOT NULL CHECK(contact_preference IN ('Anonymous','Phone','Email')),
      contact_value TEXT,
      attachments TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK(status IN ('Submitted','Initial Triage','Forwarded to Unit','Closed')),
      public_note TEXT NOT NULL DEFAULT 'Report received and queued for initial triage.',
      linked_case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_number TEXT NOT NULL UNIQUE,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      storage_type TEXT NOT NULL CHECK(storage_type IN ('Digital','Physical')),
      description TEXT NOT NULL,
      source_info TEXT NOT NULL,
      receiving_custodian_id INTEGER REFERENCES users(id),
      current_custodian_id INTEGER REFERENCES users(id),
      file_name TEXT,
      file_mime TEXT,
      file_size INTEGER DEFAULT 0,
      original_file_path TEXT,
      processed_file_path TEXT,
      sha256_hash TEXT NOT NULL,
      integrity_status TEXT NOT NULL DEFAULT 'Verified' CHECK(integrity_status IN ('Verified','Pending Verification','QUARANTINED')),
      last_verified_at TEXT,
      is_sealed INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custody_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id INTEGER NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,
      previous_custodian_id INTEGER REFERENCES users(id),
      new_custodian_id INTEGER REFERENCES users(id),
      action_performed TEXT NOT NULL,
      transfer_reason TEXT NOT NULL,
      responsible_user_id INTEGER NOT NULL REFERENCES users(id),
      verification_status TEXT NOT NULL,
      signature_ref TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      recommended_officer_id INTEGER REFERENCES users(id),
      assigned_officer_id INTEGER REFERENCES users(id),
      assigned_unit TEXT NOT NULL,
      eligibility_passed INTEGER NOT NULL DEFAULT 1,
      workload_score INTEGER NOT NULL DEFAULT 0,
      skill_match_score INTEGER NOT NULL DEFAULT 0,
      recommendation_reasons TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK(status IN ('Pending Approval','Approved','Rejected','Reassigned','Escalated')),
      approved_by INTEGER REFERENCES users(id),
      override_reason TEXT,
      acknowledgement_status TEXT NOT NULL DEFAULT 'Pending' CHECK(acknowledgement_status IN ('Pending','Acknowledged')),
      acknowledged_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assigned_to INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      priority TEXT NOT NULL CHECK(priority IN ('Low','Medium','High','Critical')),
      status TEXT NOT NULL CHECK(status IN ('Pending','In Progress','Under Review','Completed','Overdue')),
      deadline TEXT NOT NULL,
      comments TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      content_text TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      sha256_hash TEXT NOT NULL,
      is_original INTEGER NOT NULL DEFAULT 1,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS model_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      capability TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Active','Disabled','Rollback','Evaluating')),
      error_rate REAL NOT NULL DEFAULT 0.02,
      bn_accuracy REAL NOT NULL DEFAULT 91.5,
      en_accuracy REAL NOT NULL DEFAULT 95.8,
      bias_score REAL NOT NULL DEFAULT 0.04,
      drift_status TEXT NOT NULL DEFAULT 'Nominal',
      config_json TEXT NOT NULL DEFAULT '{}',
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_number TEXT NOT NULL UNIQUE,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
      job_type TEXT NOT NULL,
      model_id INTEGER REFERENCES model_registry(id),
      mode TEXT NOT NULL CHECK(mode IN ('Live Gemini AI','Demo Mode')),
      status TEXT NOT NULL CHECK(status IN ('Queued','Processing','Completed','Failed')),
      input_summary TEXT NOT NULL,
      output_payload TEXT NOT NULL DEFAULT '{}',
      requested_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_number TEXT NOT NULL UNIQUE,
      job_id INTEGER NOT NULL REFERENCES ai_jobs(id) ON DELETE CASCADE,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      suggestion_type TEXT NOT NULL,
      suggestion_text TEXT NOT NULL,
      source_documents TEXT NOT NULL DEFAULT '[]',
      source_references TEXT NOT NULL DEFAULT '[]',
      model_version TEXT NOT NULL,
      confidence_score INTEGER NOT NULL,
      priority_tier TEXT NOT NULL,
      uncertainty_note TEXT,
      review_status TEXT NOT NULL DEFAULT 'Pending Review',
      reviewer_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id INTEGER NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL CHECK(action IN ('Accept','Reject','Correct','Request Further Verification','Report Error')),
      corrected_text TEXT,
      review_notes TEXT NOT NULL,
      included_in_case_notes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id),
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('Success','Denied','Flagged')),
      approval_ref TEXT,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      prev_hash TEXT NOT NULL,
      entry_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      report_type TEXT NOT NULL,
      filters_json TEXT NOT NULL DEFAULT '{}',
      summary_json TEXT NOT NULL DEFAULT '{}',
      generated_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_officer ON cases(assigned_officer_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
    CREATE INDEX IF NOT EXISTS idx_custody_evidence ON custody_events(evidence_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(review_status);
  `);
}

export function getDb(): DatabaseSync {
  if (!global._jurivexoraDb) {
    ensureDirectories();
    const db = new DatabaseSync(DB_PATH);
    initSchema(db);
    global._jurivexoraDb = db;
  }
  return global._jurivexoraDb;
}
