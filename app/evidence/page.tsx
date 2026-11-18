'use client';

import React, { useEffect, useState } from 'react';
import { Plus, ShieldCheck, ArrowRightLeft, Download, Printer, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Select,
  Label,
  StatusText,
  Modal,
  AlertBox,
} from '@/components/ui/primitives';

interface EvidenceRow {
  id: number;
  evidence_number: string;
  case_id: number;
  case_number: string;
  case_title: string;
  title: string;
  category: string;
  storage_type: string;
  description: string;
  source_info: string;
  receiving_custodian_name: string;
  current_custodian_name: string;
  file_name: string;
  file_size: number;
  sha256_hash: string;
  integrity_status: string;
  last_verified_at: string | null;
  uploaded_at: string;
}

export default function EvidencePage() {
  const { user, notify } = useApp();
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [cases, setCases] = useState<Array<{ id: number; case_number: string; title: string }>>([]);
  const [custodians, setCustodians] = useState<Array<{ id: number; full_name: string; badge_number: string; role_name: string }>>([]);
  const [q, setQ] = useState('');

  // Upload Modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Digital Document');
  const [storageType, setStorageType] = useState('Digital');
  const [sourceInfo, setSourceInfo] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Transfer Modal
  const [transferTarget, setTransferTarget] = useState<EvidenceRow | null>(null);
  const [newCustodianId, setNewCustodianId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Receipt Modal
  const [receiptTarget, setReceiptTarget] = useState<EvidenceRow | null>(null);

  const loadData = async () => {
    const res = await fetch('/api/evidence', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setEvidence(d.evidence || []);
      setCases(d.cases || []);
      setCustodians(d.custodians || []);
      if (d.cases?.length && !caseId) setCaseId(String(d.cases[0].id));
      if (d.custodians?.length && !newCustodianId) setNewCustodianId(String(d.custodians[0].id));
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/evidence', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setEvidence(d.evidence || []);
        setCases(d.cases || []);
        setCustodians(d.custodians || []);
        if (d.cases?.length) setCaseId((prev) => prev || String(d.cases[0].id));
        if (d.custodians?.length) setNewCustodianId((prev) => prev || String(d.custodians[0].id));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('caseId', caseId);
    fd.append('title', title);
    fd.append('category', category);
    fd.append('storageType', storageType);
    fd.append('sourceInfo', sourceInfo);
    fd.append('description', description);
    if (file) fd.append('file', file);

    const res = await fetch('/api/evidence', { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Evidence upload failed.', 'error');
      return;
    }
    notify(`Registered ${d.evidenceNumber} (SHA-256 computed).`, 'success');
    setUploadOpen(false);
    setTitle('');
    setSourceInfo('');
    setDescription('');
    setFile(null);
    loadData();
  };

  const handleVerify = async (ev: EvidenceRow, simulateMismatch = false) => {
    const res = await fetch(`/api/evidence/${ev.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulateMismatch }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Verification failed.', 'error');
      return;
    }
    if (d.matched) {
      notify(`${ev.evidence_number} integrity verified (SHA-256 matched).`, 'success');
    } else {
      notify(`ALERT: ${ev.evidence_number} failed SHA-256 verification and was QUARANTINED.`, 'error');
    }
    loadData();
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    const res = await fetch(`/api/evidence/${transferTarget.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newCustodianId: Number(newCustodianId),
        transferReason,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Custody transfer failed.', 'error');
      return;
    }
    notify(`Transferred ${transferTarget.evidence_number} (${d.signatureRef}).`, 'success');
    setTransferTarget(null);
    setTransferReason('');
    loadData();
  };

  const filtered = evidence.filter((ev) => {
    if (!q.trim()) return true;
    const hay = `${ev.evidence_number} ${ev.title} ${ev.case_number} ${ev.sha256_hash}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const canUpload = user?.permissions.includes('evidence:upload');
  const canVerify = user?.permissions.includes('evidence:verify');
  const canTransfer = user?.permissions.includes('custody:transfer');

  return (
    <AppShell
      title="Digital & Physical Evidence Vault"
      breadcrumb={['Evidence', 'Evidence Management']}
      actions={
        canUpload && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Register Evidence</span>
          </Button>
        )
      }
    >
      <AlertBox tone="info" title="Original Artifact Preservation & SHA-256 Integrity">
        Original uploaded exhibits are preserved untouched on vault storage. Any failed SHA-256 verification automatically marks the exhibit as QUARANTINED and notifies Evidence Custodians and Supervisors.
      </AlertBox>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by Evidence ID, Case Number, Title, or SHA-256..."
            className="max-w-md"
          />
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {filtered.length} Exhibit(s)
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Evidence ID</th>
                <th className="py-3 px-4 font-medium">Title & Case</th>
                <th className="py-3 px-4 font-medium">SHA-256 Digest</th>
                <th className="py-3 px-4 font-medium">Current Custodian</th>
                <th className="py-3 px-4 font-medium">Integrity</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                    <div>{ev.evidence_number}</div>
                    <div className="text-[11px] font-normal text-slate-500">{ev.storage_type}</div>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{ev.title}</div>
                    <div className="text-slate-500 font-mono text-[11px]">{ev.case_number} · {ev.category}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {ev.sha256_hash.slice(0, 16)}...
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{ev.current_custodian_name}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusText status={ev.integrity_status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <a
                        href={`/api/evidence/${ev.id}/download`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Download Original File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setReceiptTarget(ev)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Generate Evidence Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {canVerify && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleVerify(ev, false)}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify Hash</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVerify(ev, true)}
                            title="Academic Demo: Simulate Hash Tamper Mismatch -> QUARANTINE"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          </Button>
                        </>
                      )}
                      {canTransfer && ev.integrity_status !== 'QUARANTINED' && (
                        <Button size="sm" onClick={() => setTransferTarget(ev)}>
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Transfer</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Register Evidence Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Register Digital or Physical Evidence"
        description="Computes cryptographic SHA-256 digest and logs initial Chain of Custody entry."
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <Label htmlFor="ev-case">Linked Case</Label>
            <Select id="ev-case" value={caseId} onChange={(e) => setCaseId(e.target.value)} required>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ev-title">Exhibit Title</Label>
            <Input id="ev-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-cat">Category</Label>
              <Select id="ev-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Digital Document</option>
                <option>Audio Recording</option>
                <option>CCTV/Image</option>
                <option>Physical Exhibit</option>
                <option>Forensic Log</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="ev-type">Storage Type</Label>
              <Select id="ev-type" value={storageType} onChange={(e) => setStorageType(e.target.value)}>
                <option value="Digital">Digital</option>
                <option value="Physical">Physical</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ev-src">Source Information</Label>
            <Input id="ev-src" required value={sourceInfo} onChange={(e) => setSourceInfo(e.target.value)} placeholder="e.g., Bank Compliance Desk / Vault Intake" />
          </div>
          <div>
            <Label htmlFor="ev-desc">Exhibit Description</Label>
            <Textarea id="ev-desc" rows={2} required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ev-file">Digital File (Optional for Physical Exhibits)</Label>
            <Input id="ev-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="pt-1.5" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit">Register & Compute SHA-256</Button>
          </div>
        </form>
      </Modal>

      {/* Custody Transfer Modal */}
      <Modal
        open={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        title={`Transfer Custody: ${transferTarget?.evidence_number || ''}`}
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <Label htmlFor="tr-cust">Receiving Custodian / Analyst</Label>
            <Select id="tr-cust" value={newCustodianId} onChange={(e) => setNewCustodianId(e.target.value)}>
              {custodians.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role_name} · {u.badge_number})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tr-reason">Transfer Purpose / Justification</Label>
            <Textarea
              id="tr-reason"
              rows={3}
              required
              minLength={5}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g., Transferred to Digital Forensics Lab for OCR and timestamp extraction"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Cancel</Button>
            <Button type="submit">Confirm Transfer</Button>
          </div>
        </form>
      </Modal>

      {/* Official Evidence Receipt Modal */}
      <Modal
        open={Boolean(receiptTarget)}
        onClose={() => setReceiptTarget(null)}
        title="Official Digital Evidence Receipt"
      >
        {receiptTarget && (
          <div className="space-y-4 text-xs">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 bg-slate-50 dark:bg-slate-950">
              <div className="font-display text-sm font-bold">JURIVEXORA CENTRAL EVIDENCE VAULT</div>
              <div>Receipt Reference: <span className="font-mono font-semibold">{receiptTarget.evidence_number}</span></div>
              <div>Case Number: <span className="font-mono">{receiptTarget.case_number}</span></div>
              <div>Exhibit: {receiptTarget.title} ({receiptTarget.category})</div>
              <div>Source: {receiptTarget.source_info}</div>
              <div>Receiving Custodian: {receiptTarget.receiving_custodian_name}</div>
              <div>Current Custodian: {receiptTarget.current_custodian_name}</div>
              <div>Integrity Status: <StatusText status={receiptTarget.integrity_status} /></div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-slate-500">Cryptographic SHA-256 Digest:</div>
                <div className="font-mono break-all text-[11px] mt-0.5">{receiptTarget.sha256_hash}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 no-print">
              <Button variant="outline" onClick={() => setReceiptTarget(null)}>Close</Button>
              <Button onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
