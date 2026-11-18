'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, FileSearch, Languages, Mic, CopyCheck, Tags, ScanText } from 'lucide-react';
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

type AITask =
  | 'OCR'
  | 'Summarisation'
  | 'Translation'
  | 'SpeechToText'
  | 'SemanticSearch'
  | 'DuplicateDetection'
  | 'EntityExtraction';

const AI_MODES: Array<{ key: AITask; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'OCR', label: 'Bangla & English OCR', icon: ScanText },
  { key: 'Summarisation', label: 'Document Summarisation', icon: Sparkles },
  { key: 'Translation', label: 'Translation Assistant', icon: Languages },
  { key: 'SpeechToText', label: 'Speech-to-Text', icon: Mic },
  { key: 'SemanticSearch', label: 'Semantic Case Search', icon: FileSearch },
  { key: 'DuplicateDetection', label: 'Duplicate Detection', icon: CopyCheck },
  { key: 'EntityExtraction', label: 'Entity Extraction', icon: Tags },
];

export default function AIAssistancePage() {
  const { user, notify } = useApp();
  const [taskType, setTaskType] = useState<AITask>('OCR');
  const [cases, setCases] = useState<Array<{ id: number; case_number: string; title: string }>>([]);
  const [docs, setDocs] = useState<Array<{ id: number; case_id: number; title: string; language: string; content_text: string; case_number: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ id: number; job_number: string; job_type: string; mode: string; status: string; input_summary: string; created_at: string }>>([]);

  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [textInput, setTextInput] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'en' | 'bn'>('en');
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);

  const [latestResponse, setLatestResponse] = useState<{
    jobNumber: string;
    suggestionNumber: string;
    priorityTier: string;
    threshold: number;
    result: {
      mode: string;
      modelVersion: string;
      confidenceScore: number;
      uncertaintyNote: string | null;
      outputText: string;
      structuredData: Record<string, unknown>;
      sourceReferences: string[];
      disclaimer: string;
    };
  } | null>(null);

  const loadWorkspace = async () => {
    const res = await fetch('/api/ai/assist', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setCases(d.cases || []);
      setDocs(d.documents || []);
      setJobs(d.jobs || []);
      if (d.cases?.length && !selectedCaseId) setSelectedCaseId(String(d.cases[0].id));
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/ai/assist', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setCases(d.cases || []);
        setDocs(d.documents || []);
        setJobs(d.jobs || []);
        if (d.cases?.length) {
          setSelectedCaseId((prev) => prev || String(d.cases[0].id));
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    const found = docs.find((d) => String(d.id) === docId);
    if (found) {
      setTextInput(found.content_text);
      setSelectedCaseId(String(found.case_id));
    }
  };

  const handleRunAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    try {
      const fd = new FormData();
      fd.append('taskType', taskType);
      if (selectedCaseId) fd.append('caseId', selectedCaseId);
      if (selectedDocId) fd.append('documentId', selectedDocId);
      fd.append('textInput', textInput);
      fd.append('targetLanguage', targetLanguage);
      const selectedDoc = docs.find((d) => String(d.id) === selectedDocId);
      fd.append('sourceLabel', file ? file.name : selectedDoc ? selectedDoc.title : 'Investigator Input');
      if (file) fd.append('file', file);

      const res = await fetch('/api/ai/assist', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'AI request failed.', 'error');
        return;
      }
      setLatestResponse(data);
      notify(`Draft ${data.suggestionNumber} generated (${data.result.mode}).`, 'success');
      loadWorkspace();
    } catch {
      notify('Network error executing AI assistance.', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell
      title="Responsible AI Assistance Workspace"
      breadcrumb={['AI Assistance', 'Workspace']}
      actions={
        <Link
          href="/ai-review"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-900 text-white text-xs font-medium hover:bg-blue-800"
        >
          <span>Open Human Review Queue</span>
        </Link>
      }
    >
      <AlertBox tone="warning" title="Human-Centred Decision Support Charter">
        All AI outputs are Drafts requiring mandatory human verification. Jurivexora never determines guilt, intent, credibility, speaker identity, or automatic case merging. If Gemini API credentials are unavailable, the engine transparently marks results as Demo Mode.
      </AlertBox>

      {/* Capability Selector */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
        {AI_MODES.map((m) => {
          const Icon = m.icon;
          const active = taskType === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setTaskType(m.key);
                setLatestResponse(null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>{AI_MODES.find((m) => m.key === taskType)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRunAI} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ai-case">Authorized Case Context</Label>
                  <Select id="ai-case" value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
                    <option value="">General Authorized Pool</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>{c.case_number} — {c.title.slice(0, 36)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ai-doc">Load Case Document (Bangla / English)</Label>
                  <Select id="ai-doc" value={selectedDocId} onChange={(e) => handleSelectDoc(e.target.value)}>
                    <option value="">Custom Input / File Upload</option>
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>{d.case_number}: {d.title}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {taskType === 'Translation' && (
                <div>
                  <Label htmlFor="ai-lang">Target Translation Language</Label>
                  <Select
                    id="ai-lang"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value as 'en' | 'bn')}
                  >
                    <option value="en">Bangla → English</option>
                    <option value="bn">English → Bangla (বাংলা)</option>
                  </Select>
                </div>
              )}

              {(taskType === 'OCR' || taskType === 'SpeechToText') && (
                <div>
                  <Label htmlFor="ai-file">
                    {taskType === 'OCR'
                      ? 'Upload Scanned Image / PDF / Text Document'
                      : 'Upload Audio Exhibit (MP3 / WAV / Text Sample)'}
                  </Label>
                  <Input
                    id="ai-file"
                    type="file"
                    accept={taskType === 'OCR' ? 'image/*,.pdf,.txt' : 'audio/*,.txt'}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="pt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="ai-text">
                  {taskType === 'SemanticSearch'
                    ? 'Natural Language Search Query'
                    : taskType === 'DuplicateDetection'
                    ? 'Incident Description to Compare Across Authorized Cases'
                    : 'Source Text (Bangla / English) or Context Note'}
                </Label>
                <Textarea
                  id="ai-text"
                  rows={6}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    taskType === 'SemanticSearch'
                      ? 'e.g., Find previous reports mentioning Bangla utility SMS phishing in Dhaka...'
                      : 'Paste Bangla or English text, or load a case document above...'
                  }
                />
              </div>

              <Button type="submit" disabled={running} className="w-full">
                {running ? 'Processing AI Draft...' : `Run ${taskType} (Generate Draft)`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>AI-Generated Draft Output</CardTitle>
            {latestResponse && (
              <span className="text-xs font-mono font-semibold text-blue-900 dark:text-blue-400">
                {latestResponse.result.mode}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!latestResponse ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Select a case document or enter text/file input on the left to generate a grounded, source-cited AI draft.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <span className="font-mono font-semibold">{latestResponse.suggestionNumber}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="font-mono">{latestResponse.result.modelVersion}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums">
                      Confidence: {latestResponse.result.confidenceScore}% (Threshold: {latestResponse.threshold}%)
                    </span>
                    <StatusText status={latestResponse.priorityTier} />
                  </div>
                </div>

                <AlertBox tone="info" title="Draft Safeguard Notice">
                  {latestResponse.result.disclaimer}
                </AlertBox>

                {latestResponse.result.uncertaintyNote && (
                  <AlertBox tone="warning" title="Uncertainty & Verification Flag">
                    {latestResponse.result.uncertaintyNote}
                  </AlertBox>
                )}

                {taskType === 'Translation' && textInput ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950">
                      <div className="font-semibold mb-1.5 text-slate-500">Original Text (Preserved)</div>
                      <pre className="whitespace-pre-wrap font-sans leading-relaxed">{textInput}</pre>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="font-semibold mb-1.5 text-blue-900 dark:text-blue-400">AI-Generated Draft Translation</div>
                      <pre className="whitespace-pre-wrap font-sans leading-relaxed">{latestResponse.result.outputText}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950 text-xs">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{latestResponse.result.outputText}</pre>
                  </div>
                )}

                {/* Structured matches / entities if present */}
                {Array.isArray((latestResponse.result.structuredData as { matches?: unknown[] }).matches) && (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold">Candidate Related Records (Never Auto-Merged)</div>
                    {((latestResponse.result.structuredData as { matches: Array<{ caseNumber: string; similarity: number; reason: string }> }).matches).map((m, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono font-semibold">{m.caseNumber}</div>
                          <div className="text-slate-600 dark:text-slate-400 mt-0.5">{m.reason}</div>
                        </div>
                        <span className="font-mono font-semibold tabular-nums">{m.similarity}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  Source References: <span className="font-mono">{latestResponse.result.sourceReferences.join(' · ')}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent AI Jobs */}
      <Card>
        <CardHeader><CardTitle>Recent AI Processing Jobs</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 px-4 font-medium">Job ID</th>
                <th className="py-2.5 px-4 font-medium">Capability</th>
                <th className="py-2.5 px-4 font-medium">Input Summary</th>
                <th className="py-2.5 px-4 font-medium">Execution Mode</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="py-2.5 px-4 font-mono font-medium">{j.job_number}</td>
                  <td className="py-2.5 px-4">{j.job_type}</td>
                  <td className="py-2.5 px-4 truncate max-w-xs">{j.input_summary}</td>
                  <td className="py-2.5 px-4 font-mono">{j.mode}</td>
                  <td className="py-2.5 px-4"><StatusText status={j.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
