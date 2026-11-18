'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { GitBranch, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Label,
  Textarea,
  StatusText,
  Modal,
  AlertBox,
} from '@/components/ui/primitives';

interface Candidate {
  officerId: number;
  fullName: string;
  badgeNumber: string;
  unit: string;
  jurisdiction: string;
  availabilityStatus: string;
  shiftStatus: string;
  activeCases: number;
  maxCapacity: number;
  eligible: boolean;
  workloadScore: number;
  skillMatchScore: number;
  compositeScore: number;
  reasons: string[];
}

interface AssignmentRow {
  id: number;
  case_id: number;
  case_number: string;
  case_title: string;
  district: string;
  recommended_officer_id: number | null;
  recommended_officer_name: string | null;
  assigned_officer_id: number | null;
  assigned_officer_name: string | null;
  assigned_unit: string;
  eligibility_passed: number;
  workload_score: number;
  skill_match_score: number;
  recommendation_reasons: string;
  status: string;
  override_reason: string | null;
  acknowledgement_status: string;
}

export default function SmartAssignmentPage() {
  const { user, notify } = useApp();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [cases, setCases] = useState<Array<{ id: number; case_number: string; title: string; district: string }>>([]);
  const [officers, setOfficers] = useState<Array<{ id: number; full_name: string; badge_number: string; unit: string }>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Supervisor Approve / Override Modal
  const [modalAssign, setModalAssign] = useState<AssignmentRow | null>(null);
  const [targetOfficerId, setTargetOfficerId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const loadData = useCallback(async (caseIdToEval?: string) => {
    const query = caseIdToEval ? `?caseId=${caseIdToEval}` : '';
    const res = await fetch(`/api/assignments${query}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setAssignments(d.assignments || []);
      setCases(d.cases || []);
      setOfficers(d.officers || []);
      setCandidates(d.candidates || []);
      if (!caseIdToEval && d.cases?.length) {
        const firstId = String(d.cases[0].id);
        setSelectedCaseId(firstId);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const query = selectedCaseId ? `?caseId=${selectedCaseId}` : '';
    fetch(`/api/assignments${query}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setAssignments(d.assignments || []);
        setCases(d.cases || []);
        setOfficers(d.officers || []);
        setCandidates(d.candidates || []);
        if (!selectedCaseId && d.cases?.length) {
          setSelectedCaseId(String(d.cases[0].id));
        }
      });
    return () => {
      active = false;
    };
  }, [user, selectedCaseId]);

  const handleRecommend = async () => {
    if (!selectedCaseId) return;
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recommend_and_submit', caseId: Number(selectedCaseId) }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Failed to generate recommendation.', 'error');
      return;
    }
    notify(
      d.escalated
        ? 'No eligible officer matched Stage 1 constraints. Escalated to Supervisor.'
        : `Recommended ${d.recommended?.fullName} — awaiting supervisor confirmation.`,
      d.escalated ? 'info' : 'success'
    );
    loadData(selectedCaseId);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAssign) return;
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        assignmentId: modalAssign.id,
        officerId: Number(targetOfficerId),
        overrideReason,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Approval failed.', 'error');
      return;
    }
    notify(`Assignment ${d.status} and officer notified.`, 'success');
    setModalAssign(null);
    setOverrideReason('');
    loadData(selectedCaseId);
  };

  const handleReject = async (assignmentId: number) => {
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', assignmentId, reason: 'Rejected during supervisor triage' }),
    });
    if (res.ok) {
      notify('Assignment recommendation rejected.', 'info');
      loadData(selectedCaseId);
    }
  };

  const handleAcknowledge = async (assignmentId: number) => {
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge', assignmentId }),
    });
    if (res.ok) {
      notify('Assignment acknowledged.', 'success');
      loadData(selectedCaseId);
    }
  };

  const canApprove = user?.permissions.includes('assignments:approve');

  return (
    <AppShell
      title="Two-Stage Smart Case Assignment"
      breadcrumb={['Operations', 'Smart Assignment']}
    >
      <AlertBox tone="info" title="Transparent Two-Stage Routing & Escalation">
        Stage 1 enforces strict jurisdiction, capability, availability, and capacity eligibility. Stage 2 ranks eligible officers by workload balance and skill match. If no eligible officer exists (e.g., Rajshahi Range), the case escalates to a Supervisor rather than selecting an unsuitable officer.
      </AlertBox>

      {/* Two-Stage Recommendation Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-900 dark:text-blue-400" />
            <span>Stage 1 & 2 Eligibility Evaluator</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="h-9 text-xs max-w-xs"
              aria-label="Select case to evaluate"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.case_number} ({c.district}) — {c.title.slice(0, 32)}</option>
              ))}
            </Select>
            {canApprove && (
              <Button size="sm" onClick={handleRecommend}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Queue Recommendation</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Officer & Unit</th>
                <th className="py-3 px-4 font-medium">Stage 1 Eligibility</th>
                <th className="py-3 px-4 font-medium">Workload</th>
                <th className="py-3 px-4 font-medium">Skill Match</th>
                <th className="py-3 px-4 font-medium">Recommendation Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {candidates.map((cand) => (
                <tr key={cand.officerId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-semibold">{cand.fullName}</div>
                    <div className="text-slate-500">{cand.badgeNumber} · {cand.unit}</div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusText status={cand.eligible ? 'Eligible' : 'Ineligible'} tone={cand.eligible ? 'success' : 'danger'} />
                    <div className="text-[11px] text-slate-500 mt-0.5">{cand.availabilityStatus} · {cand.shiftStatus}</div>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums">
                    {cand.activeCases}/{cand.maxCapacity} ({cand.workloadScore}%)
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums">{cand.skillMatchScore}%</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {cand.reasons.join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Assignment Queue & History */}
      <Card>
        <CardHeader><CardTitle>Assignment Queue & Supervisor Decisions</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Case</th>
                <th className="py-3 px-4 font-medium">Recommended / Assigned</th>
                <th className="py-3 px-4 font-medium">Reasoning / Override</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Ack</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {assignments.map((a) => {
                const reasons: string[] = JSON.parse(a.recommendation_reasons || '[]');
                return (
                  <tr key={a.id}>
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold">{a.case_number}</div>
                      <div className="text-slate-500">{a.district}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">
                        {a.assigned_officer_name || a.recommended_officer_name || 'Escalated to Supervisor'}
                      </div>
                      <div className="text-slate-500">{a.assigned_unit}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs text-slate-600 dark:text-slate-400">
                      <div>{reasons.slice(0, 2).join(' · ')}</div>
                      {a.override_reason && (
                        <div className="text-amber-700 dark:text-amber-400 mt-0.5">Override: {a.override_reason}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap"><StatusText status={a.status} /></td>
                    <td className="py-3 px-4 whitespace-nowrap"><StatusText status={a.acknowledgement_status} /></td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {canApprove && (a.status === 'Pending Approval' || a.status === 'Escalated') && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setModalAssign(a);
                              setTargetOfficerId(String(a.recommended_officer_id || officers[0]?.id || ''));
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm / Assign</span>
                          </Button>
                          {a.status === 'Pending Approval' && (
                            <Button size="sm" variant="outline" onClick={() => handleReject(a.id)}>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </Button>
                          )}
                        </>
                      )}
                      {a.assigned_officer_id === user?.id && a.acknowledgement_status === 'Pending' && (
                        <Button size="sm" variant="secondary" onClick={() => handleAcknowledge(a.id)}>
                          Acknowledge
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal
        open={Boolean(modalAssign)}
        onClose={() => setModalAssign(null)}
        title={`Confirm Assignment: ${modalAssign?.case_number || ''}`}
      >
        <form onSubmit={handleConfirmApprove} className="space-y-4">
          {modalAssign?.status === 'Escalated' && (
            <AlertBox tone="warning" title="Supervisor Escalation">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Automated matching found no eligible officer. Specify an officer and recorded justification.</span>
              </span>
            </AlertBox>
          )}
          <div>
            <Label htmlFor="sup-off">Assign Officer</Label>
            <Select id="sup-off" value={targetOfficerId} onChange={(e) => setTargetOfficerId(e.target.value)} required>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name} ({o.badge_number} · {o.unit})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sup-reason">
              {Number(targetOfficerId) !== modalAssign?.recommended_officer_id
                ? 'Override / Manual Assignment Justification (Required)'
                : 'Supervisor Confirmation Note (Optional)'}
            </Label>
            <Textarea
              id="sup-reason"
              rows={3}
              required={Number(targetOfficerId) !== modalAssign?.recommended_officer_id}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalAssign(null)}>Cancel</Button>
            <Button type="submit">Confirm Assignment</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
