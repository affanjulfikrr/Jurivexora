'use client';

import React, { useEffect, useState } from 'react';
import { Check, X, Edit3, HelpCircle, Flag } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
  Label,
  StatusText,
  Modal,
  AlertBox,
} from '@/components/ui/primitives';

interface SuggestionRow {
  id: number;
  suggestion_number: string;
  case_id: number | null;
  case_number: string | null;
  suggestion_type: string;
  suggestion_text: string;
  source_documents: string;
  source_references: string;
  model_version: string;
  confidence_score: number;
  priority_tier: string;
  uncertainty_note: string | null;
  review_status: string;
  reviewer_name: string | null;
  ai_mode: string | null;
  created_at: string;
}

interface ReviewRow {
  id: number;
  suggestion_number: string;
  reviewer_name: string;
  action: string;
  review_notes: string;
  included_in_case_notes: number;
  created_at: string;
}

export default function AIReviewPage() {
  const { user, notify } = useApp();
  const [threshold, setThreshold] = useState(85);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [filter, setFilter] = useState<'All' | 'Pending Review' | 'High Priority' | 'Uncertain'>('All');

  // Review Modal
  const [activeSug, setActiveSug] = useState<SuggestionRow | null>(null);
  const [reviewAction, setReviewAction] = useState<'Accept' | 'Reject' | 'Correct' | 'Request Further Verification' | 'Report Error'>('Accept');
  const [correctedText, setCorrectedText] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [includeInNotes, setIncludeInNotes] = useState(true);

  const loadData = async () => {
    const res = await fetch('/api/ai/suggestions', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setThreshold(d.confidenceThreshold || 85);
      setSuggestions(d.suggestions || []);
      setReviews(d.reviews || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/ai/suggestions', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setThreshold(d.confidenceThreshold || 85);
        setSuggestions(d.suggestions || []);
        setReviews(d.reviews || []);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const openReview = (
    sug: SuggestionRow,
    action: 'Accept' | 'Reject' | 'Correct' | 'Request Further Verification' | 'Report Error'
  ) => {
    setActiveSug(sug);
    setReviewAction(action);
    setCorrectedText(sug.suggestion_text);
    setReviewNotes('');
    setIncludeInNotes(action === 'Accept' || action === 'Correct');
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSug) return;
    const res = await fetch('/api/ai/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestionId: activeSug.id,
        action: reviewAction,
        correctedText: reviewAction === 'Correct' ? correctedText : null,
        reviewNotes,
        includeInCaseNotes: includeInNotes,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Failed to submit review.', 'error');
      return;
    }
    notify(`Human review recorded (${reviewAction}).`, 'success');
    setActiveSug(null);
    loadData();
  };

  const filtered = suggestions.filter((s) => {
    if (filter === 'Pending Review') return s.review_status === 'Pending Review' || s.review_status === 'Needs Verification';
    if (filter === 'High Priority') return s.confidence_score >= threshold;
    if (filter === 'Uncertain') return s.confidence_score < threshold;
    return true;
  });

  return (
    <AppShell
      title="AI Recommendation Review Dashboard"
      breadcrumb={['AI Assistance', 'Human Review']}
    >
      <AlertBox tone="info" title={`Configurable Research Threshold: ${threshold}%`}>
        Suggestions ≥ {threshold}% are prioritized as <strong>High Priority</strong> for human review; suggestions &lt; {threshold}% are flagged as <strong>Uncertain — Request Additional Verification</strong>. This {threshold}% threshold is a proposed research parameter, not a measure of truth or guilt. Only authorized human reviewers can approve inclusion in official case notes.
      </AlertBox>

      {/* Filter Bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {(['All', 'Pending Review', 'High Priority', 'Uncertain'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filter === f
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {filtered.map((s) => {
          const refs: string[] = JSON.parse(s.source_references || '[]');
          const docs: string[] = JSON.parse(s.source_documents || '[]');
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-mono font-bold text-sm">{s.suggestion_number}</span>
                  <span className="text-slate-400">·</span>
                  <span>{s.suggestion_type}</span>
                  {s.case_number && (
                    <>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono font-medium text-blue-900 dark:text-blue-400">{s.case_number}</span>
                    </>
                  )}
                  <span className="text-slate-400">·</span>
                  <span className="font-mono">{s.model_version}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono tabular-nums font-semibold">
                    {s.confidence_score}%
                  </span>
                  <StatusText status={s.priority_tier} />
                  <StatusText status={s.review_status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {s.suggestion_text}
                </p>

                {s.uncertainty_note && (
                  <AlertBox tone="warning" title="Uncertainty Indicator">
                    {s.uncertainty_note}
                  </AlertBox>
                )}

                <div className="text-slate-500 flex flex-wrap gap-4 pt-1">
                  <span>Source Documents: <span className="font-mono">{docs.join(', ')}</span></span>
                  <span>References: <span className="font-mono">{refs.join(' · ')}</span></span>
                  {s.reviewer_name && <span>Reviewed by: <strong>{s.reviewer_name}</strong></span>}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Button size="sm" onClick={() => openReview(s, 'Accept')}>
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openReview(s, 'Correct')}>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Correct</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReview(s, 'Request Further Verification')}>
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Request Verification</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReview(s, 'Reject')}>
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openReview(s, 'Report Error')}>
                    <Flag className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-red-700 dark:text-red-400">Report AI Error</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Review History Table */}
      <Card>
        <CardHeader><CardTitle>Human Review Audit History</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 px-4 font-medium">Suggestion</th>
                <th className="py-2.5 px-4 font-medium">Reviewer</th>
                <th className="py-2.5 px-4 font-medium">Decision</th>
                <th className="py-2.5 px-4 font-medium">Notes</th>
                <th className="py-2.5 px-4 font-medium">Case Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-4 font-mono font-medium">{r.suggestion_number}</td>
                  <td className="py-2.5 px-4">{r.reviewer_name}</td>
                  <td className="py-2.5 px-4"><StatusText status={r.action} /></td>
                  <td className="py-2.5 px-4">{r.review_notes}</td>
                  <td className="py-2.5 px-4">{r.included_in_case_notes ? 'Included' : 'Not Included'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Modal
        open={Boolean(activeSug)}
        onClose={() => setActiveSug(null)}
        title={`Human Verification: ${reviewAction}`}
        description={`Suggestion ${activeSug?.suggestion_number || ''}`}
      >
        <form onSubmit={submitReview} className="space-y-4">
          {reviewAction === 'Correct' && (
            <div>
              <Label htmlFor="rev-corr">Corrected Draft Text</Label>
              <Textarea
                id="rev-corr"
                rows={4}
                required
                value={correctedText}
                onChange={(e) => setCorrectedText(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label htmlFor="rev-notes">Verification Justification / Notes</Label>
            <Textarea
              id="rev-notes"
              rows={3}
              required
              minLength={4}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Document your factual verification against the primary source..."
            />
          </div>
          {(reviewAction === 'Accept' || reviewAction === 'Correct') && activeSug?.case_id && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeInNotes}
                onChange={(e) => setIncludeInNotes(e.target.checked)}
              />
              <span>Approve inclusion into official Case Investigation Notes</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActiveSug(null)}>Cancel</Button>
            <Button type="submit">Submit Review Decision</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
