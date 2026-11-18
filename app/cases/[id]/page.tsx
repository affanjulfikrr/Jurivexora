'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Lock } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Select,
  Label,
  StatusText,
  AlertBox,
} from '@/components/ui/primitives';

type TabKey = 'Overview' | 'Reports' | 'Evidence' | 'Tasks' | 'Documents' | 'AI Suggestions' | 'Activity History';

interface CaseDossier {
  caseData: {
    id: number;
    case_number: string;
    title: string;
    category: string;
    incident_date: string;
    location: string;
    district: string;
    thana: string;
    description: string;
    reporting_source: string;
    assigned_officer_name: string | null;
    assigned_officer_badge: string | null;
    assigned_unit: string;
    priority: string;
    status: string;
    sensitivity_level: string;
    deadline: string | null;
    created_at: string;
    updated_at: string;
    investigation_notes: Array<{
      id: string;
      authorName: string;
      note: string;
      sourceRef: string;
      createdAt: string;
    }>;
  };
  incidents: Array<{ id: number; incident_number: string; title: string; status: string; created_at: string }>;
  evidence: Array<{ id: number; evidence_number: string; title: string; category: string; sha256_hash: string; integrity_status: string; current_custodian_name: string }>;
  tasks: Array<{ id: number; title: string; priority: string; status: string; deadline: string; assignee_name: string }>;
  documents: Array<{ id: number; title: string; doc_type: string; language: string; content_text: string; sha256_hash: string; uploader_name: string; created_at: string }>;
  aiSuggestions: Array<{ id: number; suggestion_number: string; suggestion_type: string; suggestion_text: string; confidence_score: number; priority_tier: string; review_status: string }>;
  activityHistory: Array<{ event_id: string; user_role: string; action: string; purpose: string; outcome: string; created_at: string }>;
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, notify } = useApp();
  const [tab, setTab] = useState<TabKey>('Overview');
  const [dossier, setDossier] = useState<CaseDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Forms
  const [noteText, setNoteText] = useState('');
  const [noteSourceRef, setNoteSourceRef] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docLang, setDocLang] = useState('en');
  const [docContent, setDocContent] = useState('');
  const [statusEdit, setStatusEdit] = useState('');
  const [priorityEdit, setPriorityEdit] = useState('');

  const loadDossier = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${params.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Access denied.');
        return;
      }
      setDossier(data);
      setStatusEdit(data.caseData.status);
      setPriorityEdit(data.caseData.priority);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!user || !params.id) return;
    let active = true;
    fetch(`/api/cases/${params.id}`, { cache: 'no-store' })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) {
          setError(data.error || 'Access denied.');
        } else {
          setDossier(data);
          setStatusEdit(data.caseData.status);
          setPriorityEdit(data.caseData.priority);
          setError(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, params.id]);

  const canWrite = user?.permissions.includes('cases:write');

  const handleUpdateMeta = async () => {
    const res = await fetch(`/api/cases/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusEdit, priority: priorityEdit }),
    });
    if (res.ok) {
      notify('Case status and priority updated.', 'success');
      loadDossier();
    } else {
      const d = await res.json();
      notify(d.error || 'Update failed.', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/cases/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_note',
        note: noteText,
        sourceRef: noteSourceRef || 'Officer Investigation Note',
      }),
    });
    if (res.ok) {
      notify('Investigation note added.', 'success');
      setNoteText('');
      setNoteSourceRef('');
      loadDossier();
    } else {
      const d = await res.json();
      notify(d.error || 'Failed to add note.', 'error');
    }
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/cases/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_document',
        title: docTitle,
        docType: 'Supporting Document',
        language: docLang,
        contentText: docContent,
      }),
    });
    if (res.ok) {
      notify('Supporting document added & SHA-256 hashed.', 'success');
      setDocTitle('');
      setDocContent('');
      loadDossier();
    } else {
      const d = await res.json();
      notify(d.error || 'Failed to upload document.', 'error');
    }
  };

  const tabs: TabKey[] = [
    'Overview',
    'Reports',
    'Evidence',
    'Tasks',
    'Documents',
    'AI Suggestions',
    'Activity History',
  ];

  return (
    <AppShell
      title={dossier ? `${dossier.caseData.case_number} — ${dossier.caseData.title}` : 'Case Dossier'}
      breadcrumb={['Operations', 'Case Management', dossier?.caseData.case_number || 'Dossier']}
      actions={
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Registry</span>
        </Link>
      }
    >
      {loading ? (
        <div className="p-6 text-xs text-slate-500">Loading case dossier...</div>
      ) : error || !dossier ? (
        <AlertBox tone="danger" title="Least-Privilege Access Restricted">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>{error || 'Unable to load case.'}</span>
          </div>
        </AlertBox>
      ) : (
        <div className="space-y-6">
          {/* Segmented Tab Bar */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  tab === t
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Case Overview & Metadata</CardTitle>
                    <StatusText status={dossier.caseData.status} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {dossier.caseData.description}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <div>
                        <div className="text-slate-500">Category</div>
                        <div className="font-medium mt-0.5">{dossier.caseData.category}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Sensitivity</div>
                        <div className="font-medium mt-0.5">{dossier.caseData.sensitivity_level}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Priority</div>
                        <div className="mt-0.5"><StatusText status={dossier.caseData.priority} /></div>
                      </div>
                      <div>
                        <div className="text-slate-500">Location</div>
                        <div className="font-medium mt-0.5">{dossier.caseData.location}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Assigned Unit</div>
                        <div className="font-medium mt-0.5">{dossier.caseData.assigned_unit}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Assigned Officer</div>
                        <div className="font-medium mt-0.5">
                          {dossier.caseData.assigned_officer_name || 'Pending Assignment'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Reporting Source</div>
                        <div className="font-medium mt-0.5">{dossier.caseData.reporting_source}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Incident Date</div>
                        <div className="font-mono mt-0.5">{dossier.caseData.incident_date.slice(0, 10)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Deadline</div>
                        <div className="font-mono mt-0.5">{dossier.caseData.deadline || 'Unscheduled'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Investigation Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Official Investigation Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canWrite && (
                      <form onSubmit={handleAddNote} className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                        <Textarea
                          rows={2}
                          required
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add factual investigation note..."
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={noteSourceRef}
                            onChange={(e) => setNoteSourceRef(e.target.value)}
                            placeholder="Source reference (e.g., DOC-1 p.2)"
                          />
                          <Button type="submit" size="sm">
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Note</span>
                          </Button>
                        </div>
                      </form>
                    )}

                    {dossier.caseData.investigation_notes.length === 0 ? (
                      <div className="text-xs text-slate-500">No investigation notes recorded yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {dossier.caseData.investigation_notes.map((n) => (
                          <div key={n.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{n.authorName}</span>
                              <span className="font-mono">{n.createdAt.slice(0, 16).replace('T', ' ')}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{n.note}</p>
                            <div className="text-[11px] text-slate-500 font-mono">Source: {n.sourceRef}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Status Control */}
              <div className="lg:col-span-4 space-y-6">
                {canWrite && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Update Case Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label htmlFor="edit-status">Status</Label>
                        <Select id="edit-status" value={statusEdit} onChange={(e) => setStatusEdit(e.target.value)}>
                          <option>New</option>
                          <option>Under Review</option>
                          <option>Assigned</option>
                          <option>In Progress</option>
                          <option>Pending</option>
                          <option>Closed</option>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-prio">Priority</Label>
                        <Select id="edit-prio" value={priorityEdit} onChange={(e) => setPriorityEdit(e.target.value)}>
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                          <option>Critical</option>
                        </Select>
                      </div>
                      <Button onClick={handleUpdateMeta} className="w-full" size="sm">
                        Save Changes
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {tab === 'Reports' && (
            <Card>
              <CardHeader><CardTitle>Linked Incident Reports</CardTitle></CardHeader>
              <CardContent>
                {dossier.incidents.length === 0 ? (
                  <p className="text-xs text-slate-500">No linked incident reports.</p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {dossier.incidents.map((inc) => (
                      <div key={inc.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-semibold">{inc.incident_number}</div>
                          <div>{inc.title}</div>
                        </div>
                        <StatusText status={inc.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'Evidence' && (
            <Card>
              <CardHeader>
                <CardTitle>Case Evidence Exhibits</CardTitle>
                <Link href="/evidence" className="text-xs text-blue-900 dark:text-blue-400 hover:underline">
                  Open Evidence Vault
                </Link>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-3 px-4">Evidence ID</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">SHA-256 Digest</th>
                      <th className="py-3 px-4">Custodian</th>
                      <th className="py-3 px-4">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {dossier.evidence.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-3 px-4 font-mono font-medium">{ev.evidence_number}</td>
                        <td className="py-3 px-4">{ev.title}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">{ev.sha256_hash.slice(0, 18)}...</td>
                        <td className="py-3 px-4">{ev.current_custodian_name}</td>
                        <td className="py-3 px-4"><StatusText status={ev.integrity_status} /></td>
                      </tr>
                    ))}
                    {dossier.evidence.length === 0 && (
                      <tr><td colSpan={5} className="py-6 px-4 text-slate-500">No evidence exhibits registered for this case.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {tab === 'Tasks' && (
            <Card>
              <CardHeader>
                <CardTitle>Assigned Investigation Tasks</CardTitle>
                <Link href="/tasks" className="text-xs text-blue-900 dark:text-blue-400 hover:underline">
                  Manage Tasks
                </Link>
              </CardHeader>
              <CardContent className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {dossier.tasks.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-slate-500">Assignee: {t.assignee_name} · Due: {t.deadline}</div>
                    </div>
                    <StatusText status={t.status} />
                  </div>
                ))}
                {dossier.tasks.length === 0 && <p className="text-xs text-slate-500 py-3">No tasks linked to this case.</p>}
              </CardContent>
            </Card>
          )}

          {tab === 'Documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                {dossier.documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                        <span>{doc.title}</span>
                      </CardTitle>
                      <span className="text-[11px] font-mono text-slate-500">{doc.language.toUpperCase()}</span>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <pre className="whitespace-pre-wrap text-xs font-sans text-slate-700 dark:text-slate-300 leading-relaxed">
                        {doc.content_text}
                      </pre>
                      <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
                        SHA-256: {doc.sha256_hash.slice(0, 24)}... · Uploaded by {doc.uploader_name}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {dossier.documents.length === 0 && (
                  <Card><CardContent className="text-xs text-slate-500">No supporting documents uploaded.</CardContent></Card>
                )}
              </div>
              {canWrite && (
                <div className="lg:col-span-5">
                  <Card>
                    <CardHeader><CardTitle>Upload Supporting Document</CardTitle></CardHeader>
                    <CardContent>
                      <form onSubmit={handleAddDoc} className="space-y-3">
                        <div>
                          <Label htmlFor="doc-t">Document Title</Label>
                          <Input id="doc-t" required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="doc-l">Language</Label>
                          <Select id="doc-l" value={docLang} onChange={(e) => setDocLang(e.target.value)}>
                            <option value="en">English (en)</option>
                            <option value="bn">Bangla (bn)</option>
                            <option value="mixed">Bilingual (mixed)</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="doc-c">Document Text</Label>
                          <Textarea id="doc-c" rows={5} required value={docContent} onChange={(e) => setDocContent(e.target.value)} />
                        </div>
                        <Button type="submit" size="sm" className="w-full">Save & Hash Document</Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {tab === 'AI Suggestions' && (
            <Card>
              <CardHeader>
                <CardTitle>AI Draft Suggestions (Human Verification Required)</CardTitle>
                <Link href="/ai-review" className="text-xs text-blue-900 dark:text-blue-400 hover:underline">
                  Open Review Dashboard
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {dossier.aiSuggestions.map((s) => (
                  <div key={s.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{s.suggestion_number} · {s.suggestion_type}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums">Confidence: {s.confidence_score}%</span>
                        <StatusText status={s.review_status} />
                      </div>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{s.suggestion_text}</p>
                  </div>
                ))}
                {dossier.aiSuggestions.length === 0 && (
                  <p className="text-xs text-slate-500">No AI suggestions generated for this case yet.</p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'Activity History' && (
            <Card>
              <CardHeader><CardTitle>Audited Case Activity History</CardTitle></CardHeader>
              <CardContent className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {dossier.activityHistory.map((a) => (
                  <div key={a.event_id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{a.action}</div>
                      <div className="text-slate-500">{a.user_role} · {a.purpose}</div>
                    </div>
                    <div className="text-right">
                      <StatusText status={a.outcome} />
                      <div className="font-mono text-[11px] text-slate-500">{a.created_at}</div>
                    </div>
                  </div>
                ))}
                {dossier.activityHistory.length === 0 && (
                  <p className="text-xs text-slate-500 py-3">No recorded events for this case identifier yet.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
