import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { getDb, ORIGINALS_DIR, PROCESSED_DIR } from '@/lib/db/database';

function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function writeSyntheticEvidenceFile(filename: string, content: string): {
  filePath: string;
  size: number;
  sha256: string;
} {
  const fullPath = path.join(ORIGINALS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  const buf = fs.readFileSync(fullPath);
  return {
    filePath: fullPath,
    size: buf.byteLength,
    sha256: computeSha256(buf),
  };
}

export function ensureSeeded(): void {
  if (global._jurivexoraSeeded) return;
  const db = getDb();

  const existingUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existingUsers.cnt > 0) {
    global._jurivexoraSeeded = true;
    return;
  }

  const demoPasswordHash = bcrypt.hashSync('Jurivexora@2026', 10);

  // 1. Seed Roles
  const roles = [
    {
      name: 'Super Admin',
      slug: 'super_admin',
      description: 'Platform governance, user accounts, roles, AI registry, and emergency break-glass oversight.',
    },
    {
      name: 'System Administrator',
      slug: 'system_admin',
      description: 'Technical infrastructure configuration, backups, availability, and system health logs without routine confidential case access.',
    },
    {
      name: 'Investigating Officer',
      slug: 'investigating_officer',
      description: 'Creates incidents, manages assigned cases, uploads evidence, adds notes, and requests AI assistance.',
    },
    {
      name: 'Supervisor',
      slug: 'supervisor',
      description: 'Monitors unit operations, reviews cases, approves smart assignments, escalations, and sensitive actions.',
    },
    {
      name: 'Evidence Custodian',
      slug: 'evidence_custodian',
      description: 'Registers exhibits, verifies SHA-256 hashes, manages custody transfers, and issues official receipts.',
    },
    {
      name: 'Forensic Analyst',
      slug: 'forensic_analyst',
      description: 'Accesses authorized evidence, executes OCR/transcription/extraction, and submits forensic analysis.',
    },
    {
      name: 'Legal / Compliance Reviewer',
      slug: 'legal_reviewer',
      description: 'Reviews authorized legal records, disclosure requests, retention policies, and approves exports.',
    },
    {
      name: 'Auditor / Oversight',
      slug: 'auditor',
      description: 'Read-only oversight of tamper-evident audit logs, security events, and governance history.',
    },
  ];

  const insertRole = db.prepare(
    `INSERT INTO roles (name, slug, description, is_system, is_active) VALUES (?, ?, ?, 1, 1)`
  );
  const roleIds: Record<string, number> = {};
  for (const r of roles) {
    const res = insertRole.run(r.name, r.slug, r.description);
    roleIds[r.slug] = Number(res.lastInsertRowid);
  }

  // 2. Seed Permissions
  const permissionsList: Array<[string, string, string]> = [
    ['dashboard:view', 'Dashboard', 'View role-scoped operational dashboard'],
    ['cases:read', 'Cases', 'View authorized case records'],
    ['cases:read_all', 'Cases', 'View unit-level non-confidential cases'],
    ['cases:write', 'Cases', 'Create and update assigned cases and notes'],
    ['incidents:read', 'Incidents', 'View incident reports'],
    ['incidents:write', 'Incidents', 'Register and triage incident reports'],
    ['public_reports:triage', 'Public Reporting', 'Review and triage public portal submissions'],
    ['evidence:read', 'Evidence', 'View authorized evidence metadata and files'],
    ['evidence:upload', 'Evidence', 'Upload digital evidence and register exhibits'],
    ['evidence:verify', 'Evidence', 'Verify SHA-256 hashes and manage quarantine state'],
    ['custody:transfer', 'Chain of Custody', 'Execute custody transfers and issue receipts'],
    ['custody:read', 'Chain of Custody', 'Inspect immutable chain-of-custody records'],
    ['ai:assist', 'AI Assistance', 'Invoke OCR, summarization, translation, search, entity extraction'],
    ['ai:review', 'AI Review', 'Accept, reject, correct, or escalate AI recommendations'],
    ['assignments:view', 'Smart Assignment', 'View case assignment recommendations'],
    ['assignments:approve', 'Smart Assignment', 'Confirm, override, or escalate officer assignments'],
    ['tasks:read', 'Tasks', 'View assigned and unit tasks'],
    ['tasks:manage', 'Tasks', 'Create, assign, and update investigation tasks'],
    ['analytics:view', 'Analytics', 'View authorized aggregate analytics and reports'],
    ['reports:export', 'Analytics', 'Generate and export authorized PDF/CSV reports'],
    ['audit:read', 'Audit & Security', 'Inspect tamper-evident audit logs and security alerts'],
    ['governance:manage', 'AI Governance', 'Manage AI model registry, thresholds, rollbacks, and kill-switches'],
    ['users:manage', 'Administration', 'Create, activate, suspend, and edit user accounts'],
    ['roles:manage', 'Administration', 'Create, update, and assign roles and permissions'],
    ['settings:manage', 'Administration', 'Configure system settings and retention parameters'],
    ['emergency:break_glass', 'Security', 'Request justified, MFA-verified, time-limited emergency case access'],
  ];

  const insertPerm = db.prepare(
    `INSERT INTO permissions (code, module, description) VALUES (?, ?, ?)`
  );
  const permIds: Record<string, number> = {};
  for (const [code, mod, desc] of permissionsList) {
    const res = insertPerm.run(code, mod, desc);
    permIds[code] = Number(res.lastInsertRowid);
  }

  const rolePermissionsMap: Record<string, string[]> = {
    super_admin: [
      'dashboard:view', 'analytics:view', 'reports:export', 'audit:read',
      'governance:manage', 'users:manage', 'roles:manage', 'settings:manage',
      'emergency:break_glass', 'assignments:view', 'ai:review',
    ],
    system_admin: [
      'dashboard:view', 'settings:manage', 'audit:read', 'analytics:view',
    ],
    investigating_officer: [
      'dashboard:view', 'cases:read', 'cases:write', 'incidents:read', 'incidents:write',
      'evidence:read', 'evidence:upload', 'custody:read', 'ai:assist', 'ai:review',
      'assignments:view', 'tasks:read', 'tasks:manage', 'analytics:view',
    ],
    supervisor: [
      'dashboard:view', 'cases:read', 'cases:read_all', 'cases:write', 'incidents:read',
      'incidents:write', 'public_reports:triage', 'evidence:read', 'custody:read',
      'ai:assist', 'ai:review', 'assignments:view', 'assignments:approve',
      'tasks:read', 'tasks:manage', 'analytics:view', 'reports:export',
    ],
    evidence_custodian: [
      'dashboard:view', 'cases:read', 'evidence:read', 'evidence:upload',
      'evidence:verify', 'custody:transfer', 'custody:read', 'tasks:read', 'analytics:view',
    ],
    forensic_analyst: [
      'dashboard:view', 'cases:read', 'evidence:read', 'custody:read',
      'ai:assist', 'ai:review', 'tasks:read', 'tasks:manage', 'analytics:view',
    ],
    legal_reviewer: [
      'dashboard:view', 'cases:read', 'cases:read_all', 'evidence:read', 'custody:read',
      'ai:review', 'analytics:view', 'reports:export', 'audit:read',
    ],
    auditor: [
      'dashboard:view', 'audit:read', 'analytics:view', 'reports:export', 'custody:read',
    ],
  };

  const insertRolePerm = db.prepare(
    `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`
  );
  for (const [slug, perms] of Object.entries(rolePermissionsMap)) {
    for (const p of perms) {
      insertRolePerm.run(roleIds[slug], permIds[p]);
    }
  }

  // 3. Seed Users (10 realistic synthetic Bangladesh personnel across all 8 roles)
  const usersData = [
    {
      email: 'superadmin@jurivexora.bd.demo',
      fullName: 'Tariqul Islam',
      badge: 'BD-HQ-001',
      unit: 'Police HQ Governance Directorate',
      jurisdiction: 'National',
      skills: ['Governance', 'Policy', 'Oversight'],
      availability: 'On Duty',
      shift: 'Day Shift',
      maxCapacity: 4,
      role: 'super_admin',
    },
    {
      email: 'sysadmin@jurivexora.bd.demo',
      fullName: 'Nusrat Jahan',
      badge: 'BD-ICT-014',
      unit: 'ICT & Infrastructure Operations',
      jurisdiction: 'National',
      skills: ['Infrastructure', 'Backups', 'Security Ops'],
      availability: 'On Duty',
      shift: 'Day Shift',
      maxCapacity: 5,
      role: 'system_admin',
    },
    {
      email: 'officer.dmp@jurivexora.bd.demo',
      fullName: 'SI Rafiqul Hasan',
      badge: 'DMP-GLS-204',
      unit: 'DMP Gulshan Division',
      jurisdiction: 'Dhaka',
      skills: ['Financial Fraud', 'Cyber Crime', 'Bangla Documentation', 'Field Investigation'],
      availability: 'Available',
      shift: 'Day Shift',
      maxCapacity: 8,
      role: 'investigating_officer',
    },
    {
      email: 'officer.cmp@jurivexora.bd.demo',
      fullName: 'Inspector Tanvir Ahmed',
      badge: 'CMP-KTW-118',
      unit: 'CMP Kotwali Division',
      jurisdiction: 'Chattogram',
      skills: ['Property Crime', 'Port Logistics', 'Burglary', 'CCTV Analysis'],
      availability: 'Available',
      shift: 'Day Shift',
      maxCapacity: 8,
      role: 'investigating_officer',
    },
    {
      email: 'officer.ccid@jurivexora.bd.demo',
      fullName: 'SI Meherun Nesa',
      badge: 'CCID-DHK-309',
      unit: 'Cyber Crime Investigation Division',
      jurisdiction: 'Dhaka',
      skills: ['Cyber Crime', 'Phishing', 'Financial Fraud', 'Digital Forensics'],
      availability: 'In Field',
      shift: 'Night Shift',
      maxCapacity: 6,
      role: 'investigating_officer',
    },
    {
      email: 'supervisor.dmp@jurivexora.bd.demo',
      fullName: 'AC Farhana Rahman',
      badge: 'DMP-SUP-042',
      unit: 'DMP Gulshan Division',
      jurisdiction: 'Dhaka',
      skills: ['Case Review', 'Resource Allocation', 'Compliance'],
      availability: 'On Duty',
      shift: 'Day Shift',
      maxCapacity: 12,
      role: 'supervisor',
    },
    {
      email: 'custodian@jurivexora.bd.demo',
      fullName: 'Inspector Kamrul Ahsan',
      badge: 'EVD-VLT-088',
      unit: 'Central Evidence Vault Dhaka',
      jurisdiction: 'Dhaka',
      skills: ['Chain of Custody', 'SHA-256 Verification', 'Physical Exhibits'],
      availability: 'On Duty',
      shift: 'Day Shift',
      maxCapacity: 15,
      role: 'evidence_custodian',
    },
    {
      email: 'forensic@jurivexora.bd.demo',
      fullName: 'Dr. Mahbub Alam',
      badge: 'FSL-DHK-051',
      unit: 'Digital Forensics & Document Lab',
      jurisdiction: 'National',
      skills: ['Document Forensics', 'Audio Transcription', 'Bangla OCR'],
      availability: 'Available',
      shift: 'Day Shift',
      maxCapacity: 10,
      role: 'forensic_analyst',
    },
    {
      email: 'legal@jurivexora.bd.demo',
      fullName: 'Adv. Sharmin Akter',
      badge: 'LEG-HQ-019',
      unit: 'Legal & Compliance Cell',
      jurisdiction: 'National',
      skills: ['Evidence Act', 'Disclosure Review', 'Data Retention'],
      availability: 'On Duty',
      shift: 'Day Shift',
      maxCapacity: 10,
      role: 'legal_reviewer',
    },
    {
      email: 'auditor@jurivexora.bd.demo',
      fullName: 'Zahidul Karim',
      badge: 'AUD-OVS-007',
      unit: 'Independent Oversight Desk',
      jurisdiction: 'National',
      skills: ['Audit Trails', 'Bias Inspection', 'OWASP Compliance'],
      availability: 'On Duty',
      shift: 'Day Shift',
      maxCapacity: 10,
      role: 'auditor',
    },
  ];

  const insertUser = db.prepare(
    `INSERT INTO users (email, password_hash, full_name, badge_number, unit, jurisdiction, skills, availability_status, shift_status, max_capacity, mfa_enabled, mfa_secret, is_active, is_suspended)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '482910', 1, 0)`
  );
  const insertUserRole = db.prepare(
    `INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, 1)`
  );

  const userIds: Record<string, number> = {};
  for (const u of usersData) {
    const res = insertUser.run(
      u.email,
      demoPasswordHash,
      u.fullName,
      u.badge,
      u.unit,
      u.jurisdiction,
      JSON.stringify(u.skills),
      u.availability,
      u.shift,
      u.maxCapacity
    );
    const uid = Number(res.lastInsertRowid);
    userIds[u.email] = uid;
    insertUserRole.run(uid, roleIds[u.role]);
  }

  // 4. Seed System Settings
  const settingsData = [
    ['ai_confidence_threshold', '85', 'AI Governance', 'Proposed research confidence threshold (%) separating High Priority from Uncertain AI suggestions.'],
    ['ai_global_enabled', 'true', 'AI Governance', 'Master kill-switch for live AI processing across Jurivexora.'],
    ['mfa_required_privileged', 'true', 'Security', 'Require MFA verification for emergency break-glass and admin actions.'],
    ['emergency_access_minutes', '15', 'Security', 'Maximum duration in minutes for justified break-glass confidential case access.'],
    ['evidence_retention_days', '2555', 'Compliance', 'Default statutory retention window (days) for sealed digital evidence.'],
    ['demo_disclaimer_text', 'Academic Research & Development Demonstration · Synthetic Bangladesh Data · Not an Officially Deployed Law-Enforcement System', 'Governance', 'Displayed across all views to maintain research transparency.'],
  ];
  const insertSetting = db.prepare(
    `INSERT INTO system_settings (key, value, category, description, updated_by) VALUES (?, ?, ?, ?, ?)`
  );
  for (const [k, v, cat, desc] of settingsData) {
    insertSetting.run(k, v, cat, desc, userIds['superadmin@jurivexora.bd.demo']);
  }

  // 5. Seed AI Model Registry
  const modelsData = [
    ['ocr_bn_en', 'Jurivexora Bilingual OCR', 'gemini-4-hydrogen', 'Bangla & English Document OCR', 'Active', 0.018, 92.4, 97.1, 0.03, 'Nominal', '{"languages":["bn","en"],"preserveOriginals":true}'],
    ['doc_summariser', 'Case Brief Summariser', 'gemini-4-hydrogen', 'Grounded Document Summarisation', 'Active', 0.022, 90.8, 96.4, 0.04, 'Nominal', '{"requireCitations":true,"draftOnly":true}'],
    ['bilingual_translator', 'Bangla-English Legal Translator', 'gemini-4-hydrogen', 'Mixed-Language Translation Assistant', 'Active', 0.025, 91.2, 95.6, 0.03, 'Nominal', '{"sideBySide":true,"draftLabel":true}'],
    ['speech_transcriber', 'Audio Evidence Transcriber', 'gemini-3.5-transcribe', 'Bangla & English Speech-to-Text', 'Active', 0.041, 87.9, 94.2, 0.05, 'Watch', '{"disableSpeakerId":true,"markUnclear":true}'],
    ['semantic_search', 'Permission-Aware Case Retriever', 'gemini-4-hydrogen', 'Semantic Case & Precedent Search', 'Active', 0.015, 91.0, 96.0, 0.02, 'Nominal', '{"enforceRbacFilter":true}'],
    ['duplicate_detector', 'Incident Similarity Engine', 'gemini-4-hydrogen', 'Duplicate Incident Detection', 'Active', 0.029, 89.5, 94.8, 0.04, 'Nominal', '{"autoMergeBlocked":true}'],
    ['entity_extractor', 'Structured Entity Extractor', 'gemini-4-hydrogen', 'Date, Location & Reference Extraction', 'Active', 0.019, 92.0, 96.9, 0.02, 'Nominal', '{"prohibitGuiltInference":true}'],
  ];
  const insertModel = db.prepare(
    `INSERT INTO model_registry (model_key, name, version, capability, status, error_rate, bn_accuracy, en_accuracy, bias_score, drift_status, config_json, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const modelIds: Record<string, number> = {};
  for (const m of modelsData) {
    const res = insertModel.run(...m, userIds['superadmin@jurivexora.bd.demo']);
    modelIds[m[0] as string] = Number(res.lastInsertRowid);
  }

  // 6. Seed Cases (8 synthetic Bangladesh cases)
  const casesData = [
    {
      caseNumber: 'JRX-DHK-2026-0041',
      title: 'Commercial Invoice Spoofing & Wire Diversion — Motijheel',
      category: 'Financial Fraud',
      incidentDate: '2026-10-18T11:20:00Z',
      location: 'Motijheel Commercial Area, Road 4, Dhaka',
      district: 'Dhaka',
      thana: 'Motijheel',
      description: 'Synthetic demonstration record: A local textile exporter reported spoofed supplier banking instructions resulting in an attempted BDT 14.2 lakh transfer diversion. Bank compliance froze the settlement pending verification.',
      source: 'Corporate Compliance Desk',
      officerId: userIds['officer.dmp@jurivexora.bd.demo'],
      unit: 'DMP Gulshan Division',
      priority: 'High',
      status: 'In Progress',
      sensitivity: 'Restricted',
      deadline: '2026-11-28',
      notes: [
        { id: 'N-101', authorId: userIds['officer.dmp@jurivexora.bd.demo'], authorName: 'SI Rafiqul Hasan', note: 'Collected certified bank transfer freeze memo and bilingual email headers.', sourceRef: 'DOC-2026-011 p.1', createdAt: '2026-10-20T09:30:00Z' },
      ],
    },
    {
      caseNumber: 'JRX-CMP-2026-0042',
      title: 'Bonded Warehouse Inventory Discrepancy — Chattogram Port Road',
      category: 'Property & Cargo',
      incidentDate: '2026-10-24T03:45:00Z',
      location: 'Sadarghat & Port Access Corridor, Chattogram',
      district: 'Chattogram',
      thana: 'Kotwali',
      description: 'Synthetic demonstration record: Night-shift gate manifest mismatch involving 42 electronics cartons. Gate CCTV logs and physical seal tags submitted for integrity hashing.',
      source: 'Port Security Liaison',
      officerId: userIds['officer.cmp@jurivexora.bd.demo'],
      unit: 'CMP Kotwali Division',
      priority: 'High',
      status: 'Assigned',
      sensitivity: 'Standard',
      deadline: '2026-11-24',
      notes: [],
    },
    {
      caseNumber: 'JRX-DHK-2026-0043',
      title: 'Mobile Financial Service Impersonation Cluster — Mirpur Section 10',
      category: 'Cyber Crime',
      incidentDate: '2026-11-02T15:10:00Z',
      location: 'Mirpur Section 10 Circle, Dhaka',
      district: 'Dhaka',
      thana: 'Mirpur',
      description: 'Synthetic demonstration record: Multiple citizen reports describing automated Bangla voice calls impersonating utility billing desks. Requires audio transcription without speaker profiling.',
      source: 'Public Reporting Portal',
      officerId: userIds['officer.ccid@jurivexora.bd.demo'],
      unit: 'Cyber Crime Investigation Division',
      priority: 'Critical',
      status: 'In Progress',
      sensitivity: 'Confidential',
      deadline: '2026-11-20',
      notes: [],
    },
    {
      caseNumber: 'JRX-DHK-2026-0044',
      title: 'Utility Pole Copper Cable Theft — Uttara Sector 11',
      category: 'Infrastructure Theft',
      incidentDate: '2026-11-05T02:15:00Z',
      location: 'Garib-E-Newaz Avenue, Uttara Sector 11, Dhaka',
      district: 'Dhaka',
      thana: 'Uttara West',
      description: 'Synthetic demonstration record: Overnight telecom duct tampering reported by municipal maintenance crew. Awaiting supervisor assignment confirmation.',
      source: 'Municipal Utility Desk',
      officerId: null,
      unit: 'DMP Gulshan Division',
      priority: 'Medium',
      status: 'Under Review',
      sensitivity: 'Standard',
      deadline: '2026-12-05',
      notes: [],
    },
    {
      caseNumber: 'JRX-SYL-2026-0045',
      title: 'Forged Land Mutation Deed Verification — Sylhet Sadar',
      category: 'Document Forgery',
      incidentDate: '2026-09-29T10:00:00Z',
      location: 'Zindabazar Sub-Registry Office, Sylhet',
      district: 'Sylhet',
      thana: 'Kotwali Sylhet',
      description: 'Synthetic demonstration record: Sub-registrar flagged discrepancies in Bangla stamp paper serial numbers on a disputed commercial lease.',
      source: 'District Land Office',
      officerId: userIds['officer.dmp@jurivexora.bd.demo'],
      unit: 'DMP Gulshan Division',
      priority: 'Medium',
      status: 'Pending',
      sensitivity: 'Restricted',
      deadline: '2026-11-19',
      notes: [],
    },
    {
      caseNumber: 'JRX-DHK-2026-0046',
      title: 'Duplicate Utility Phishing SMS Campaign — Dhanmondi',
      category: 'Cyber Crime',
      incidentDate: '2026-11-04T18:40:00Z',
      location: 'Satmasjid Road, Dhanmondi, Dhaka',
      district: 'Dhaka',
      thana: 'Dhanmondi',
      description: 'Synthetic demonstration record: Citizen received Bangla SMS requesting OTP verification for electricity meter update, matching syntax seen in Mirpur MFS reports.',
      source: 'Thana Duty Officer',
      officerId: userIds['officer.dmp@jurivexora.bd.demo'],
      unit: 'DMP Gulshan Division',
      priority: 'High',
      status: 'New',
      sensitivity: 'Standard',
      deadline: '2026-11-30',
      notes: [],
    },
    {
      caseNumber: 'JRX-GAZ-2026-0047',
      title: 'Highway Freight Seal Tampering — Gazipur Bypass',
      category: 'Property & Cargo',
      incidentDate: '2026-08-19T22:30:00Z',
      location: 'Joydebpur Chowrasta, Gazipur',
      district: 'Gazipur',
      thana: 'Joydebpur',
      description: 'Synthetic demonstration record: Garment shipment container arrived with broken bolt seal; transport log reconciled and closed after recovery.',
      source: 'Highway Patrol Unit',
      officerId: userIds['officer.cmp@jurivexora.bd.demo'],
      unit: 'CMP Kotwali Division',
      priority: 'Low',
      status: 'Closed',
      sensitivity: 'Standard',
      deadline: '2026-09-15',
      notes: [],
    },
    {
      caseNumber: 'JRX-RAJ-2026-0048',
      title: 'Academic Credential Verification Inquiry — Rajshahi',
      category: 'Document Forgery',
      incidentDate: '2026-11-09T13:05:00Z',
      location: 'Shaheb Bazar, Rajshahi',
      district: 'Rajshahi',
      thana: 'Boalia',
      description: 'Synthetic demonstration record: Regional administrative board requested forensic review of suspect registrar seal impression. Needs specialized jurisdiction routing.',
      source: 'Education Board Liaison',
      officerId: null,
      unit: 'Rajshahi Range',
      priority: 'Medium',
      status: 'New',
      sensitivity: 'Standard',
      deadline: '2026-12-10',
      notes: [],
    },
  ];

  const insertCase = db.prepare(
    `INSERT INTO cases (case_number, title, category, incident_date, location, district, thana, description, reporting_source, assigned_officer_id, assigned_unit, priority, status, sensitivity_level, deadline, investigation_notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const caseIds: Record<string, number> = {};
  for (const c of casesData) {
    const res = insertCase.run(
      c.caseNumber,
      c.title,
      c.category,
      c.incidentDate,
      c.location,
      c.district,
      c.thana,
      c.description,
      c.source,
      c.officerId,
      c.unit,
      c.priority,
      c.status,
      c.sensitivity,
      c.deadline,
      JSON.stringify(c.notes),
      userIds['supervisor.dmp@jurivexora.bd.demo']
    );
    caseIds[c.caseNumber] = Number(res.lastInsertRowid);
  }

  // 7. Seed Incidents & Public Reports
  const insertIncident = db.prepare(
    `INSERT INTO incidents (incident_number, case_id, title, category, incident_date, location, district, description, reporter_type, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertIncident.run('INC-2026-0301', caseIds['JRX-DHK-2026-0041'], 'Motijheel Bank Transfer Freeze Alert', 'Financial Fraud', '2026-10-18T11:20:00Z', 'Motijheel Road 4, Dhaka', 'Dhaka', 'Bank compliance reported spoofed remittance email headers.', 'Institutional Liaison', 'Linked to Case', userIds['officer.dmp@jurivexora.bd.demo']);
  insertIncident.run('INC-2026-0302', caseIds['JRX-DHK-2026-0044'], 'Uttara Duct Tampering Report', 'Infrastructure Theft', '2026-11-05T02:15:00Z', 'Uttara Sector 11, Dhaka', 'Dhaka', 'Overnight utility cable cut discovered by patrol.', 'Municipal Utility', 'Under Review', userIds['officer.dmp@jurivexora.bd.demo']);
  insertIncident.run('INC-2026-0303', null, 'Gulshan Avenue Traffic Signal Controller Fault', 'Public Safety Hazard', '2026-11-12T08:15:00Z', 'Gulshan-2 Circle, Dhaka', 'Dhaka', 'Signal box door found unlatched; no missing hardware confirmed yet.', 'Patrol Unit', 'Open Triage', userIds['officer.dmp@jurivexora.bd.demo']);

  const insertPublicReport = db.prepare(
    `INSERT INTO public_reports (reference_number, title, category, incident_date, location, district, description, contact_preference, contact_value, attachments, status, public_note, linked_case_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertPublicReport.run('PUB-BD-2026-8831', 'Suspicious Utility SMS Link Reported', 'Cyber & Phishing', '2026-11-03T16:20:00Z', 'Mirpur-10, Dhaka', 'Dhaka', 'Received SMS claiming meter disconnection unless fee paid via unofficial link.', 'Anonymous', '', '[{"name":"sms_screenshot_redacted.png","size":42100}]', 'Forwarded to Unit', 'Forwarded to Cyber Crime triage unit for technical review.', caseIds['JRX-DHK-2026-0043']);
  insertPublicReport.run('PUB-BD-2026-8832', 'Abandoned Damaged Parcel Near Commercial Gate', 'Suspicious Item', '2026-11-11T09:40:00Z', 'Banani Road 11, Dhaka', 'Dhaka', 'Unattended torn shipping crate left near commercial driveway.', 'Phone', '+880-1700-000102', '[]', 'Initial Triage', 'Duty officer assigned to inspect location.', null);
  insertPublicReport.run('PUB-BD-2026-8833', 'Streetlight Outage & Blind Intersection', 'Public Safety Hazard', '2026-11-14T20:00:00Z', 'Agrabad Commercial Area, Chattogram', 'Chattogram', 'Three consecutive streetlights non-operational near pedestrian crossing.', 'Email', 'citizen.demo@example.bd', '[]', 'Submitted', 'Submission logged. Awaiting municipal coordination.', null);

  // 8. Seed Real Files + Evidence + Tamper-Evident Chain of Custody
  const f1 = writeSyntheticEvidenceFile(
    'EVD-2026-0191_motijheel_swift_memo.txt',
    'JURIVEXORA SYNTHETIC DIGITAL EXHIBIT\nCase: JRX-DHK-2026-0041\nDocument: Bank Remittance Hold Memo\nAmount: BDT 1,420,000\nTimestamp: 2026-10-18T11:25:00Z\nNote: Academic R&D synthetic artifact.'
  );
  const f2 = writeSyntheticEvidenceFile(
    'EVD-2026-0192_chattogram_gate_manifest.csv',
    'carton_id,manifest_seal,gate_scan_time,status\nCTN-001,SEAL-8821,2026-10-24T03:12:00Z,Verified\nCTN-042,SEAL-8862,2026-10-24T03:45:00Z,Discrepancy'
  );
  const f3 = writeSyntheticEvidenceFile(
    'EVD-2026-0193_mirpur_phishing_audio_script.txt',
    'SYNTHETIC AUDIO TRANSCRIPT PLACEHOLDER\nDuration: 00:42\nLanguage: Bangla / English mixed\n[00:02] "হ্যালো, এটি ইউটিলিটি বিলিং ডেস্ক থেকে বলা হচ্ছে..."\n[00:18] "[Unclear background street traffic] অনুগ্রহ করে ভেরিফিকেশন কোড..."'
  );
  const f4 = writeSyntheticEvidenceFile(
    'EVD-2026-0194_sylhet_deed_scan.txt',
    'দলিল নং: SYL-2026-9941\nতারিখ: ২৯ সেপ্টেম্বর ২০২৬\nস্থান: জিন্দাবাজার সাব-রেজিস্ট্রি অফিস, সিলেট\nমন্তব্য: স্ট্যাম্প নম্বর যাচাইয়ের জন্য ফরেনসিক ল্যাবে প্রেরিত।'
  );

  const insertEvidence = db.prepare(
    `INSERT INTO evidence (evidence_number, case_id, title, category, storage_type, description, source_info, receiving_custodian_id, current_custodian_id, file_name, file_mime, file_size, original_file_path, processed_file_path, sha256_hash, integrity_status, last_verified_at, is_sealed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const ev1 = Number(insertEvidence.run('EVD-2026-0191', caseIds['JRX-DHK-2026-0041'], 'Bank Remittance Freeze Memo', 'Digital Document', 'Digital', 'Certified PDF/text compliance hold memo from Motijheel branch.', 'Commercial Bank Compliance', userIds['custodian@jurivexora.bd.demo'], userIds['custodian@jurivexora.bd.demo'], 'EVD-2026-0191_motijheel_swift_memo.txt', 'text/plain', f1.size, f1.filePath, path.join(PROCESSED_DIR, 'EVD-2026-0191_ocr.txt'), f1.sha256, 'Verified', '2026-11-10T10:00:00Z', 1).lastInsertRowid);
  const ev2 = Number(insertEvidence.run('EVD-2026-0192', caseIds['JRX-CMP-2026-0042'], 'Port Gate Cargo Manifest CSV', 'Forensic Log', 'Digital', 'Exported gate scanner CSV log covering cartons CTN-001 to CTN-042.', 'Chattogram Port Gate 4', userIds['custodian@jurivexora.bd.demo'], userIds['forensic@jurivexora.bd.demo'], 'EVD-2026-0192_chattogram_gate_manifest.csv', 'text/csv', f2.size, f2.filePath, null, f2.sha256, 'Verified', '2026-11-11T14:20:00Z', 0).lastInsertRowid);
  const ev3 = Number(insertEvidence.run('EVD-2026-0193', caseIds['JRX-DHK-2026-0043'], 'Mirpur Phishing Call Recording Sample', 'Audio Recording', 'Digital', 'Recorded citizen-submitted voicemail sample in Bangla.', 'Citizen Submission PUB-BD-2026-8831', userIds['custodian@jurivexora.bd.demo'], userIds['forensic@jurivexora.bd.demo'], 'EVD-2026-0193_mirpur_phishing_audio_script.txt', 'text/plain', f3.size, f3.filePath, null, f3.sha256, 'Pending Verification', null, 0).lastInsertRowid);
  const ev4 = Number(insertEvidence.run('EVD-2026-0194', caseIds['JRX-SYL-2026-0045'], 'Sylhet Stamp Paper Exhibit (Tamper Alert)', 'Physical Exhibit', 'Physical', 'Physical lease stamp paper exhibit sealed in tamper-evident pouch #SYL-88.', 'Sub-Registry Office Sylhet', userIds['custodian@jurivexora.bd.demo'], userIds['custodian@jurivexora.bd.demo'], 'EVD-2026-0194_sylhet_deed_scan.txt', 'text/plain', f4.size, f4.filePath, null, f4.sha256, 'Verified', '2026-11-12T08:30:00Z', 1).lastInsertRowid);

  // Custody Events
  const insertCustody = db.prepare(
    `INSERT INTO custody_events (evidence_id, previous_custodian_id, new_custodian_id, action_performed, transfer_reason, responsible_user_id, verification_status, signature_ref, event_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const cHash1 = computeSha256(`EV1-INIT-${f1.sha256}`);
  insertCustody.run(ev1, null, userIds['custodian@jurivexora.bd.demo'], 'Initial Registration & Sealing', 'Logged into Central Evidence Vault upon officer intake', userIds['custodian@jurivexora.bd.demo'], 'Verified', 'SIG-CUST-088-A1', cHash1);
  const cHash2 = computeSha256(`EV2-INIT-${f2.sha256}`);
  insertCustody.run(ev2, null, userIds['custodian@jurivexora.bd.demo'], 'Initial Registration', 'Port manifest uploaded by CMP Kotwali officer', userIds['custodian@jurivexora.bd.demo'], 'Verified', 'SIG-CUST-088-B1', cHash2);
  const cHash3 = computeSha256(`${cHash2}-EV2-TRANSFER`);
  insertCustody.run(ev2, userIds['custodian@jurivexora.bd.demo'], userIds['forensic@jurivexora.bd.demo'], 'Custody Transfer to Forensics', 'Requested timestamp correlation analysis', userIds['custodian@jurivexora.bd.demo'], 'Verified', 'SIG-CUST-088-B2', cHash3);
  const cHash4 = computeSha256(`EV3-INIT-${f3.sha256}`);
  insertCustody.run(ev3, null, userIds['custodian@jurivexora.bd.demo'], 'Initial Registration', 'Citizen-submitted audio logged for forensic speech-to-text', userIds['custodian@jurivexora.bd.demo'], 'Pending Verification', 'SIG-CUST-088-C1', cHash4);
  const cHash5 = computeSha256(`EV4-INIT-${f4.sha256}`);
  insertCustody.run(ev4, null, userIds['custodian@jurivexora.bd.demo'], 'Physical Exhibit Vault Intake', 'Sealed physical stamp paper pouch registered', userIds['custodian@jurivexora.bd.demo'], 'Verified', 'SIG-CUST-088-D1', cHash5);

  // 9. Seed Bilingual Documents
  const insertDoc = db.prepare(
    `INSERT INTO documents (case_id, title, doc_type, language, content_text, file_name, file_size, sha256_hash, is_original, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const doc1Text = `MOTIJHEEL BRANCH COMPLIANCE MEMO\nReference: JRX-DHK-2026-0041\nDate: 18 October 2026\nLocation: Motijheel C/A, Dhaka\nSummary: Remittance instruction BDT 1,420,000 flagged for spoofed domain header (textile-exports-bd[.]example). Beneficiary account placed on temporary administrative hold pending officer inquiry.`;
  const doc1Id = Number(insertDoc.run(caseIds['JRX-DHK-2026-0041'], 'Motijheel Bank Hold Memo (EN)', 'Compliance Memo', 'en', doc1Text, 'motijheel_hold_memo.txt', doc1Text.length, computeSha256(doc1Text), userIds['officer.dmp@jurivexora.bd.demo']).lastInsertRowid);

  const doc2Text = `প্রাথমিক অভিযোগ বিবরণী (মিরপুর সেকশন ১০)\nমামলা সূত্র: JRX-DHK-2026-0043\nতারিখ: ০২ নভেম্বর ২০২৬\nবিবরণ: মিরপুর-১০ এলাকায় একাধিক নাগরিক মোবাইল ফিন্যান্সিয়াল সার্ভিস (MFS) ও বিদ্যুৎ বিল যাচাইয়ের নামে প্রতারণামূলক বাংলা ভয়েস কল এবং ভুয়া এসএমএস লিংক পাওয়ার অভিযোগ করেছেন। সকল তথ্য যাচাইসাপেক্ষ।`;
  const doc2Id = Number(insertDoc.run(caseIds['JRX-DHK-2026-0043'], 'Mirpur MFS Complaint Statement (BN)', 'Witness Statement', 'bn', doc2Text, 'mirpur_statement_bn.txt', doc2Text.length, computeSha256(doc2Text), userIds['officer.ccid@jurivexora.bd.demo']).lastInsertRowid);

  const doc3Text = `DHANMONDI THANA DUTY LOG\nReference: JRX-DHK-2026-0046\nDate: 04 November 2026\nLocation: Satmasjid Road, Dhanmondi, Dhaka\nDetails: Citizen reported receiving an SMS in Bangla asking for an OTP code to avoid utility electricity meter disconnection. Link domain resembles pattern logged in Mirpur MFS complaint JRX-DHK-2026-0043.`;
  insertDoc.run(caseIds['JRX-DHK-2026-0046'], 'Dhanmondi Phishing SMS Log (EN/BN)', 'Incident Log', 'mixed', doc3Text, 'dhanmondi_sms_log.txt', doc3Text.length, computeSha256(doc3Text), userIds['officer.dmp@jurivexora.bd.demo']);

  // 10. Seed Smart Assignments
  const insertAssign = db.prepare(
    `INSERT INTO assignments (case_id, recommended_officer_id, assigned_officer_id, assigned_unit, eligibility_passed, workload_score, skill_match_score, recommendation_reasons, status, approved_by, acknowledgement_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertAssign.run(caseIds['JRX-DHK-2026-0041'], userIds['officer.dmp@jurivexora.bd.demo'], userIds['officer.dmp@jurivexora.bd.demo'], 'DMP Gulshan Division', 1, 78, 94, JSON.stringify(['Dhaka jurisdiction verified', 'Financial Fraud & Bangla Documentation skill match', 'Workload 3/8 active cases']), 'Approved', userIds['supervisor.dmp@jurivexora.bd.demo'], 'Acknowledged');
  insertAssign.run(caseIds['JRX-DHK-2026-0044'], userIds['officer.dmp@jurivexora.bd.demo'], null, 'DMP Gulshan Division', 1, 75, 84, JSON.stringify(['Dhaka jurisdiction verified', 'Day shift active availability', 'Lowest current open queue in DMP']), 'Pending Approval', null, 'Pending');
  insertAssign.run(caseIds['JRX-RAJ-2026-0048'], null, null, 'Rajshahi Range', 0, 0, 0, JSON.stringify(['No eligible Rajshahi Range investigator currently on active shift; escalated to Supervisor per safety policy.']), 'Escalated', null, 'Pending');

  // 11. Seed Tasks
  const insertTask = db.prepare(
    `INSERT INTO tasks (case_id, title, description, assigned_to, created_by, priority, status, deadline, comments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTask.run(caseIds['JRX-DHK-2026-0041'], 'Obtain Certified Bank Header Audit', 'Request signed SMTP & gateway header log from Motijheel branch compliance officer.', userIds['officer.dmp@jurivexora.bd.demo'], userIds['supervisor.dmp@jurivexora.bd.demo'], 'High', 'In Progress', '2026-11-22', JSON.stringify([{ id: 'C1', author: 'AC Farhana Rahman', text: 'Ensure official seal accompanies CSV log.', createdAt: '2026-11-10T11:00:00Z' }]));
  insertTask.run(caseIds['JRX-DHK-2026-0043'], 'Verify Audio Exhibit EVD-2026-0193 & Transcribe', 'Run Bangla/English speech-to-text draft and perform human verification of unclear segments.', userIds['forensic@jurivexora.bd.demo'], userIds['supervisor.dmp@jurivexora.bd.demo'], 'Critical', 'Pending', '2026-11-18', '[]');
  insertTask.run(caseIds['JRX-SYL-2026-0045'], 'Confirm Sub-Registry Stamp Serial Range', 'Cross-check disputed Bangla stamp paper serial range with District Treasury archive.', userIds['officer.dmp@jurivexora.bd.demo'], userIds['supervisor.dmp@jurivexora.bd.demo'], 'Medium', 'Overdue', '2026-11-14', '[]');
  insertTask.run(caseIds['JRX-CMP-2026-0042'], 'Reconcile Gate 4 CCTV Timestamps', 'Compare gate manifest discrepancies against sealed camera timestamp index.', userIds['officer.cmp@jurivexora.bd.demo'], userIds['supervisor.dmp@jurivexora.bd.demo'], 'High', 'Completed', '2026-11-12', '[]');

  // 12. Seed AI Jobs, Suggestions & Reviews
  const insertJob = db.prepare(
    `INSERT INTO ai_jobs (job_number, case_id, document_id, job_type, model_id, mode, status, input_summary, output_payload, requested_by, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, datetime('now'))`
  );
  const j1 = Number(insertJob.run('AIJ-2026-1001', caseIds['JRX-DHK-2026-0041'], doc1Id, 'Summarisation', modelIds['doc_summariser'], 'Demo Mode', 'Motijheel Bank Hold Memo (EN)', JSON.stringify({ summary: 'Bank compliance placed BDT 1,420,000 remittance on hold due to spoofed header domain [DOC-1 p.1].' }), userIds['officer.dmp@jurivexora.bd.demo']).lastInsertRowid);
  const j2 = Number(insertJob.run('AIJ-2026-1002', caseIds['JRX-DHK-2026-0043'], doc2Id, 'Translation', modelIds['bilingual_translator'], 'Demo Mode', 'Mirpur MFS Complaint Statement (BN)', JSON.stringify({ translatedText: 'Multiple citizens in Mirpur-10 reported fraudulent Bangla voice calls and fake SMS links impersonating MFS and electricity billing desks. All claims require verification.' }), userIds['forensic@jurivexora.bd.demo']).lastInsertRowid);
  const j3 = Number(insertJob.run('AIJ-2026-1003', caseIds['JRX-DHK-2026-0046'], null, 'DuplicateDetection', modelIds['duplicate_detector'], 'Demo Mode', 'Dhanmondi SMS vs Mirpur MFS Cluster', JSON.stringify({ candidateCase: 'JRX-DHK-2026-0043', similarity: 78 }), userIds['officer.dmp@jurivexora.bd.demo']).lastInsertRowid);

  const insertSug = db.prepare(
    `INSERT INTO ai_suggestions (suggestion_number, job_id, case_id, suggestion_type, suggestion_text, source_documents, source_references, model_version, confidence_score, priority_tier, uncertainty_note, review_status, reviewer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const s1 = Number(insertSug.run('SUG-2026-0411', j1, caseIds['JRX-DHK-2026-0041'], 'Document Summary', 'Draft Summary: Bank compliance froze BDT 1,420,000 on 18 Oct 2026 after detecting a spoofed supplier domain header. No suspect attribution inferred.', JSON.stringify(['Motijheel Bank Hold Memo (EN)']), JSON.stringify(['DOC-1, Page 1, Line 3-6']), 'gemini-4-hydrogen', 91, 'High Priority', null, 'Accepted', userIds['supervisor.dmp@jurivexora.bd.demo']).lastInsertRowid);
  insertSug.run('SUG-2026-0412', j2, caseIds['JRX-DHK-2026-0043'], 'Bangla-English Translation', 'Draft Translation: Citizens in Mirpur-10 reported impersonation voice calls and SMS links referencing electricity billing and MFS verification.', JSON.stringify(['Mirpur MFS Complaint Statement (BN)']), JSON.stringify(['DOC-2, Page 1, Paragraph 1']), 'gemini-4-hydrogen', 88, 'High Priority', null, 'Pending Review', null);
  insertSug.run('SUG-2026-0413', j3, caseIds['JRX-DHK-2026-0046'], 'Duplicate Incident Link', 'Potential related pattern between JRX-DHK-2026-0046 (Dhanmondi utility SMS) and JRX-DHK-2026-0043 (Mirpur MFS impersonation). Human confirmation required; records are NOT auto-merged.', JSON.stringify(['Dhanmondi Phishing SMS Log', 'Mirpur MFS Complaint Statement']), JSON.stringify(['DOC-3 Line 4', 'DOC-2 Line 3']), 'gemini-4-hydrogen', 76, 'Uncertain - Needs Verification', 'Confidence 76% is below the 85% research threshold; overlapping Bangla phrasing observed, but timestamps and telecom gateways remain unverified.', 'Pending Review', null);

  db.prepare(
    `INSERT INTO ai_reviews (suggestion_id, reviewer_id, action, corrected_text, review_notes, included_in_case_notes)
     VALUES (?, ?, 'Accept', NULL, 'Verified against original bank hold memo DOC-1.', 1)`
  ).run(s1, userIds['supervisor.dmp@jurivexora.bd.demo']);

  // 13. Seed Sanitized Notifications (NO confidential case details in previews!)
  const insertNotif = db.prepare(
    `INSERT INTO notifications (user_id, category, title, message, resource_type, resource_id, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertNotif.run(userIds['officer.dmp@jurivexora.bd.demo'], 'AI Review', 'AI Suggestion Ready for Review', 'A new High Priority draft summary (SUG-2026-0412) is queued for human verification.', 'ai_suggestion', 'SUG-2026-0412', 0);
  insertNotif.run(userIds['officer.dmp@jurivexora.bd.demo'], 'Task Deadline', 'Overdue Task Reminder', 'Task on case JRX-SYL-2026-0045 has passed its scheduled deadline.', 'task', '3', 0);
  insertNotif.run(userIds['supervisor.dmp@jurivexora.bd.demo'], 'Assignment Escalation', 'Supervisor Escalation Required', 'Case JRX-RAJ-2026-0048 could not be matched to an eligible active officer and requires supervisor routing.', 'assignment', '3', 0);
  insertNotif.run(userIds['custodian@jurivexora.bd.demo'], 'Evidence Integrity', 'Pending Hash Verification', 'Exhibit EVD-2026-0193 is awaiting scheduled SHA-256 verification.', 'evidence', 'EVD-2026-0193', 0);
  insertNotif.run(userIds['forensic@jurivexora.bd.demo'], 'Custody Transfer', 'Exhibit Transferred to Lab', 'Exhibit EVD-2026-0192 custody transferred for manifest correlation.', 'evidence', 'EVD-2026-0192', 1);

  // 14. Seed Tamper-Evident Audit Logs
  const auditEntries = [
    { userId: userIds['superadmin@jurivexora.bd.demo'], role: 'Super Admin', action: 'SYSTEM_INIT', resource: 'SYS-CORE', purpose: 'Initialize Jurivexora academic R&D environment', outcome: 'Success', ref: 'INIT-2026' },
    { userId: userIds['custodian@jurivexora.bd.demo'], role: 'Evidence Custodian', action: 'EVIDENCE_REGISTER', resource: 'EVD-2026-0191', purpose: 'Register and SHA-256 hash Motijheel compliance exhibit', outcome: 'Success', ref: 'SIG-CUST-088-A1' },
    { userId: userIds['supervisor.dmp@jurivexora.bd.demo'], role: 'Supervisor', action: 'AI_REVIEW_ACCEPT', resource: 'SUG-2026-0411', purpose: 'Human verification and approval of draft summary', outcome: 'Success', ref: 'REV-2026-01' },
    { userId: userIds['superadmin@jurivexora.bd.demo'], role: 'Super Admin', action: 'CASE_READ_ATTEMPT', resource: 'JRX-DHK-2026-0043', purpose: 'Routine check blocked by least-privilege Confidential policy', outcome: 'Denied', ref: 'POLICY-LP-01' },
  ];

  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const insertAudit = db.prepare(
    `INSERT INTO audit_logs (event_id, user_id, user_role, action, resource_id, purpose, outcome, approval_ref, ip_address, prev_hash, entry_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '10.24.0.1', ?, ?)`
  );
  auditEntries.forEach((a, idx) => {
    const eventId = `AUD-2026-${String(idx + 1).padStart(5, '0')}`;
    const entryHash = computeSha256(`${prevHash}|${eventId}|${a.userId}|${a.action}|${a.resource}|${a.outcome}`);
    insertAudit.run(eventId, a.userId, a.role, a.action, a.resource, a.purpose, a.outcome, a.ref, prevHash, entryHash);
    prevHash = entryHash;
  });

  // 15. Seed Sample Saved Report
  db.prepare(
    `INSERT INTO reports (report_number, title, report_type, filters_json, summary_json, generated_by)
     VALUES ('RPT-2026-001', 'Monthly Operational & AI Oversight Digest (Nov 2026)', 'Executive Governance', '{"period":"2026-11"}', '{"totalCases":8,"verifiedEvidence":3,"aiAcceptanceRate":"100% reviewed"}', ?)`
  ).run(userIds['auditor@jurivexora.bd.demo']);

  global._jurivexoraSeeded = true;
}
