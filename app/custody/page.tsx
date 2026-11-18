'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import { Card, CardContent, Input, StatusText, AlertBox } from '@/components/ui/primitives';

interface CustodyRow {
  id: number;
  evidence_number: string;
  evidence_title: string;
  previous_custodian_name: string | null;
  new_custodian_name: string | null;
  action_performed: string;
  transfer_reason: string;
  responsible_user_name: string;
  verification_status: string;
  signature_ref: string;
  event_hash: string;
  created_at: string;
}

export default function CustodyPage() {
  const { user } = useApp();
  const [events, setEvents] = useState<CustodyRow[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch('/api/evidence', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.custodyEvents) setEvents(d.custodyEvents);
      });
  }, [user]);

  const filtered = events.filter((e) => {
    if (!q.trim()) return true;
    const hay = `${e.evidence_number} ${e.evidence_title} ${e.action_performed} ${e.signature_ref} ${e.responsible_user_name}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AppShell
      title="Immutable Chain of Custody Ledger"
      breadcrumb={['Evidence', 'Chain of Custody']}
    >
      <AlertBox tone="info" title="Append-Only Cryptographic Custody History">
        Historical custody events are append-only and hash-chained. Neither investigators nor administrators may alter or delete past custody records.
      </AlertBox>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by Evidence ID, Signature Ref, Custodian, or Action..."
            className="max-w-md"
          />
          <span className="text-xs font-mono text-slate-500 tabular-nums">{filtered.length} Event(s)</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">Evidence</th>
                <th className="py-3 px-4 font-medium">Custody Transition</th>
                <th className="py-3 px-4 font-medium">Action & Reason</th>
                <th className="py-3 px-4 font-medium">Signature / Hash</th>
                <th className="py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-500">{ev.created_at}</td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-semibold">{ev.evidence_number}</div>
                    <div className="text-slate-500 truncate max-w-[180px]">{ev.evidence_title}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span>{ev.previous_custodian_name || 'Intake Origin'}</span>
                    <span className="mx-1.5 text-slate-400">→</span>
                    <span className="font-medium">{ev.new_custodian_name || 'Vault'}</span>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-medium">{ev.action_performed}</div>
                    <div className="text-slate-500">{ev.transfer_reason} (By: {ev.responsible_user_name})</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    <div>{ev.signature_ref}</div>
                    <div className="text-slate-400">{ev.event_hash.slice(0, 14)}...</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusText status={ev.verification_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
