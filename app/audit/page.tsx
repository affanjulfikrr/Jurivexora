'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, StatusText, AlertBox } from '@/components/ui/primitives';

interface AuditRow {
  event_id: string;
  user_name: string | null;
  user_role: string;
  action: string;
  resource_id: string;
  purpose: string;
  outcome: string;
  approval_ref: string | null;
  entry_hash: string;
  created_at: string;
}

export default function AuditPage() {
  const { user, notify } = useApp();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [alerts, setAlerts] = useState<AuditRow[]>([]);
  const [chain, setChain] = useState<{ intact: boolean; totalRecords: number; latestHashDigest: string } | null>(null);
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState('All');

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ q, outcome });
    const res = await fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs || []);
      setAlerts(d.securityAlerts || []);
      setChain(d.chainVerification || null);
    }
  }, [q, outcome]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const params = new URLSearchParams({ q, outcome });
    fetch(`/api/audit?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setLogs(d.logs || []);
        setAlerts(d.securityAlerts || []);
        setChain(d.chainVerification || null);
      });
    return () => {
      active = false;
    };
  }, [user, q, outcome]);

  const handleExportCsv = () => {
    const rows = [
      ['Event ID', 'User', 'Role', 'Action', 'Resource', 'Purpose', 'Outcome', 'Approval Ref', 'Timestamp', 'SHA-256'],
      ...logs.map((l) => [
        l.event_id,
        l.user_name || 'System',
        l.user_role,
        l.action,
        l.resource_id,
        l.purpose,
        l.outcome,
        l.approval_ref || '',
        l.created_at,
        l.entry_hash,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jurivexora-audit-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('Audit log report exported as CSV.', 'success');
  };

  return (
    <AppShell
      title="Audit Log & Security Monitoring"
      breadcrumb={['Oversight', 'Audit & Security']}
      actions={
        <Button size="sm" variant="outline" onClick={handleExportCsv}>
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit CSV</span>
        </Button>
      }
    >
      {chain && (
        <AlertBox tone={chain.intact ? 'success' : 'danger'} title="Tamper-Evident Hash Chain Verification">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {chain.intact
                  ? `Hash chain intact across ${chain.totalRecords} audited events.`
                  : 'Hash chain verification warning detected.'}
              </span>
            </span>
            <span className="font-mono text-[11px]">Head Digest: {chain.latestHashDigest.slice(0, 24)}...</span>
          </div>
        </AlertBox>
      )}

      {/* Security Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Security Alerts (Denied & Flagged Events)</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-slate-800 p-0">
            {alerts.slice(0, 5).map((al) => (
              <div key={al.event_id} className="px-4 py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold">{al.action} · <span className="font-mono">{al.resource_id}</span></div>
                  <div className="text-slate-500">{al.user_role} — {al.purpose}</div>
                </div>
                <StatusText status={al.outcome} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search event ID, user, action, resource ID, or purpose..."
            className="max-w-md"
          />
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-44 h-9 text-xs" aria-label="Filter by outcome">
            <option value="All">All Outcomes</option>
            <option value="Success">Success</option>
            <option value="Denied">Denied</option>
            <option value="Flagged">Flagged</option>
          </Select>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Event ID</th>
                <th className="py-3 px-4 font-medium">Actor & Role</th>
                <th className="py-3 px-4 font-medium">Action & Resource</th>
                <th className="py-3 px-4 font-medium">Purpose / Approval</th>
                <th className="py-3 px-4 font-medium">Outcome</th>
                <th className="py-3 px-4 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {logs.map((l) => (
                <tr key={l.event_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">{l.event_id}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium">{l.user_name || 'System / Public'}</div>
                    <div className="text-slate-500">{l.user_role}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-medium">{l.action}</div>
                    <div className="text-slate-500 font-mono text-[11px]">{l.resource_id}</div>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <div>{l.purpose}</div>
                    {l.approval_ref && <div className="font-mono text-[11px] text-slate-500">Ref: {l.approval_ref}</div>}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap"><StatusText status={l.outcome} /></td>
                  <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-500">{l.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
