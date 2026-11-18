import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';
import { requireAuth, canAccessCase, recordAuditLog, dispatchNotification } from '@/lib/auth/rbac';
import { runResponsibleAI, getModelState } from '@/lib/ai/gemini';

const TASK_TO_MODEL: Record<string, string> = {
  OCR: 'ocr_bn_en',
  Summarisation: 'doc_summariser',
  Translation: 'bilingual_translator',
  SpeechToText: 'speech_transcriber',
  SemanticSearch: 'semantic_search',
  DuplicateDetection: 'duplicate_detector',
  EntityExtraction: 'entity_extractor',
};

export async function GET() {
  const { user, errorResponse } = await requireAuth('ai:assist');
  if (errorResponse || !user) return errorResponse!;

  try {
    const db = getDb();
    const jobs = db
      .prepare(
        `SELECT j.*, c.case_number, u.full_name as requester_name
         FROM ai_jobs j
         LEFT JOIN cases c ON c.id = j.case_id
         LEFT JOIN users u ON u.id = j.requested_by
         ORDER BY j.id DESC LIMIT 20`
      )
      .all();

    const allCases = db
      .prepare('SELECT id, case_number, title, assigned_officer_id, assigned_unit, sensitivity_level FROM cases ORDER BY id DESC')
      .all() as Array<{
      id: number;
      case_number: string;
      title: string;
      assigned_officer_id: number | null;
      assigned_unit: string;
      sensitivity_level: string;
    }>;

    const authorizedCases = allCases.filter((c) => canAccessCase(user, c).allowed);
    const docs = db
      .prepare(
        `SELECT d.id, d.case_id, d.title, d.doc_type, d.language, d.content_text, c.case_number
         FROM documents d INNER JOIN cases c ON c.id = d.case_id
         ORDER BY d.id DESC`
      )
      .all() as Array<{
      id: number;
      case_id: number;
      title: string;
      doc_type: string;
      language: string;
      content_text: string;
      case_number: string;
    }>;

    const authorizedCaseIds = new Set(authorizedCases.map((c) => c.id));
    const authorizedDocuments = docs.filter((d) => authorizedCaseIds.has(d.case_id));

    return NextResponse.json({
      jobs,
      cases: authorizedCases,
      documents: authorizedDocuments,
    });
  } catch (error) {
    console.error('AI assist GET error:', error);
    return NextResponse.json({ error: 'Failed to load AI workspace.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth('ai:assist');
  if (errorResponse || !user) return errorResponse!;

  try {
    const contentType = req.headers.get('content-type') || '';
    let taskType = 'Summarisation';
    let caseId: number | null = null;
    let documentId: number | null = null;
    let textInput = '';
    let sourceLabel = '';
    let targetLanguage: 'en' | 'bn' = 'en';
    let fileBase64: string | undefined;
    let fileMimeType: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      taskType = String(formData.get('taskType') || 'OCR');
      caseId = formData.get('caseId') ? Number(formData.get('caseId')) : null;
      documentId = formData.get('documentId') ? Number(formData.get('documentId')) : null;
      textInput = String(formData.get('textInput') || '');
      sourceLabel = String(formData.get('sourceLabel') || 'Uploaded Artifact');
      targetLanguage = formData.get('targetLanguage') === 'bn' ? 'bn' : 'en';
      const file = formData.get('file');
      if (file instanceof File && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        fileBase64 = buf.toString('base64');
        fileMimeType = file.type || 'application/octet-stream';
        if (!sourceLabel || sourceLabel === 'Uploaded Artifact') {
          sourceLabel = file.name;
        }
        if (!textInput && file.type.startsWith('text/')) {
          textInput = buf.toString('utf8');
        }
      }
    } else {
      const body = await req.json();
      taskType = String(body.taskType || 'Summarisation');
      caseId = body.caseId ? Number(body.caseId) : null;
      documentId = body.documentId ? Number(body.documentId) : null;
      textInput = String(body.textInput || '');
      sourceLabel = String(body.sourceLabel || 'Authorized Case Text');
      targetLanguage = body.targetLanguage === 'bn' ? 'bn' : 'en';
    }

    const db = getDb();

    if (caseId) {
      const caseRow = db
        .prepare('SELECT id, case_number, assigned_officer_id, assigned_unit, sensitivity_level FROM cases WHERE id = ?')
        .get(caseId) as
        | {
            id: number;
            case_number: string;
            assigned_officer_id: number | null;
            assigned_unit: string;
            sensitivity_level: string;
          }
        | undefined;
      if (!caseRow) {
        return NextResponse.json({ error: 'Selected case not found.' }, { status: 404 });
      }
      const access = canAccessCase(user, caseRow);
      if (!access.allowed) {
        return NextResponse.json({ error: access.reason || 'Forbidden case access.' }, { status: 403 });
      }
    }

    if (documentId && !textInput) {
      const docRow = db.prepare('SELECT title, content_text FROM documents WHERE id = ?').get(documentId) as
        | { title: string; content_text: string }
        | undefined;
      if (docRow) {
        textInput = docRow.content_text;
        sourceLabel = docRow.title;
      }
    }

    // Build permission-aware comparison pool for Semantic Search & Duplicate Detection
    const poolRows = db
      .prepare('SELECT id, case_number, title, incident_date, location, description, assigned_officer_id, assigned_unit, sensitivity_level FROM cases')
      .all() as Array<{
      id: number;
      case_number: string;
      title: string;
      incident_date: string;
      location: string;
      description: string;
      assigned_officer_id: number | null;
      assigned_unit: string;
      sensitivity_level: string;
    }>;

    const comparisonPool = poolRows
      .filter((c) => canAccessCase(user, c).allowed)
      .map((c) => ({
        caseNumber: c.case_number,
        title: c.title,
        date: c.incident_date,
        location: c.location,
        description: c.description,
      }));

    const modelKey = TASK_TO_MODEL[taskType] || 'doc_summariser';
    const state = getModelState(modelKey);

    const result = await runResponsibleAI({
      taskType: taskType as
        | 'OCR'
        | 'Summarisation'
        | 'Translation'
        | 'SpeechToText'
        | 'SemanticSearch'
        | 'DuplicateDetection'
        | 'EntityExtraction',
      modelKey,
      textInput,
      fileBase64,
      fileMimeType,
      sourceLabel,
      targetLanguage,
      comparisonPool,
    });

    const jobCount = (db.prepare('SELECT COUNT(*) as c FROM ai_jobs').get() as { c: number }).c;
    const jobNumber = `AIJ-2026-${String(1001 + jobCount).padStart(4, '0')}`;

    const jobRes = db
      .prepare(
        `INSERT INTO ai_jobs (job_number, case_id, document_id, job_type, model_id, mode, status, input_summary, output_payload, requested_by, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, datetime('now'))`
      )
      .run(
        jobNumber,
        caseId,
        documentId,
        taskType,
        state.id,
        result.mode,
        `${taskType}: ${sourceLabel}`.slice(0, 120),
        JSON.stringify(result),
        user.id
      );

    const jobId = Number(jobRes.lastInsertRowid);
    const sugCount = (db.prepare('SELECT COUNT(*) as c FROM ai_suggestions').get() as { c: number }).c;
    const suggestionNumber = `SUG-2026-${String(411 + sugCount).padStart(4, '0')}`;
    const threshold = state.confidenceThreshold;
    const priorityTier =
      result.confidenceScore >= threshold ? 'High Priority' : 'Uncertain - Needs Verification';

    db.prepare(
      `INSERT INTO ai_suggestions (suggestion_number, job_id, case_id, suggestion_type, suggestion_text, source_documents, source_references, model_version, confidence_score, priority_tier, uncertainty_note, review_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review')`
    ).run(
      suggestionNumber,
      jobId,
      caseId,
      taskType,
      result.outputText,
      JSON.stringify([sourceLabel]),
      JSON.stringify(result.sourceReferences),
      result.modelVersion,
      result.confidenceScore,
      priorityTier,
      result.uncertaintyNote
    );

    dispatchNotification({
      userId: user.id,
      category: 'AI Processing',
      title: `AI Draft Ready (${priorityTier})`,
      message: `${taskType} draft ${suggestionNumber} completed in ${result.mode} and queued for human review.`,
      resourceType: 'ai_suggestion',
      resourceId: suggestionNumber,
    });

    recordAuditLog({
      userId: user.id,
      userRole: user.roleNames.join(', '),
      action: `AI_JOB_${taskType.toUpperCase()}`,
      resourceId: suggestionNumber,
      purpose: `Executed ${taskType} in ${result.mode} (confidence ${result.confidenceScore}%)`,
      outcome: 'Success',
      approvalRef: jobNumber,
    });

    return NextResponse.json({
      success: true,
      jobNumber,
      suggestionNumber,
      priorityTier,
      threshold,
      result,
    });
  } catch (error) {
    console.error('AI assist POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI assistance execution failed.' },
      { status: 500 }
    );
  }
}
