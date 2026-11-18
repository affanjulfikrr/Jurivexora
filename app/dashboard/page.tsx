'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { ShieldAlert, ArrowUpRight, Lock } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusText,
  Button,
  Modal,
  Input,
  Textarea,
  Label,
  AlertBox,
} from '@/components/ui/primitives';

interface DashboardData {
  roleScope: string;
  metrics: {
    totalCases: number;
    accessibleCasesCount: number;
    activeCases: number;
    pendingCases: number;
    closedCases: number;
    totalEvidence: number;
    pendingEvidenceVerification: number;
    quarantinedEvidence: number;
    pendingTasks: number;
    overdueTasks: number;
    aiJobs: number;
    pendingAiReviews: number;
    highPriorityAi: number;
  };
  charts: {
    statusDistribution: Array<{ name: string; count: number }>;
    monthlyIncidents: Array<{ month: string; incidents: number; cases: number; evidence: number }>;
  };
  recentCaseUpdates: Array<{
    id: number;
    case_number: string;
    title: string;
    status: string;
    priority: string;
    assigned_unit: string;
    officer_name: string;
    updated_at: string;
  }>;
  assignmentOverview: Array<{
    id: number;
    case_number: string;
    assigned_unit: string;
    status: string;
    skill_match_score: number;
    workload_score: number;
    officer_name: string | null;
  }>;
  recentActivities: Array<{
    event_id: string;
    user_role: string;
    action: string;
    resource_id: string;
    outcome: string;
    created_at: string;
  }>;
  alerts: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail: string }>;
}

export default function DashboardPage() {
  const { user, refreshSession, notify } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Break-glass modal for Super Admin
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [bgReason, setBgReason] = useState('');
  const [bgCode, setBgCode] = useState('482910');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active) return;
        if (d) setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'emergency', code: bgCode, reason: bgReason }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Emergency access denied.', 'error');
      return;
    }
    notify('Time-limited Break-Glass access granted and logged.', 'success');
    setBreakGlassOpen(false);
    setBgReason('');
    await refreshSession();
    loadDashboard();
  };

  return (
    <AppShell
      title="Overview Dashboard"
      breadcrumb={['Operations', 'Overview Dashboard']}
      actions={
        <>
          {user?.permissions.includes('emergency:break_glass') && (
            <Button variant="outline" size="sm" onClick={() => setBreakGlassOpen(true)}>
              <Lock className="w-3.5 h-3.5" />
              <span>Emergency Break-Glass</span>
            </Button>
          )}
          {user?.permissions.includes('cases:write') && (
            <Link
              href="/cases"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-900 text-white text-xs font-medium hover:bg-blue-800 transition-colors"
            >
              <span>Manage Cases</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </>
      }
    >
      {loading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-24 animate-pulse bg-slate-100 dark:bg-slate-800/40 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Alerts */}
          {data.alerts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.alerts.map((al) => (
                <AlertBox
                  key={al.id}
                  tone={al.severity === 'critical' ? 'danger' : al.severity === 'warning' ? 'warning' : 'info'}
                  title={al.title}
                >
                  {al.detail}
                </AlertBox>
              ))}
            </div>
          )}

          {/* Primary KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Cases</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{data.metrics.totalCases}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {data.metrics.accessibleCasesCount} accessible to your role
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Active / Pending / Closed</div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {data.metrics.activeCases} / {data.metrics.pendingCases} / {data.metrics.closedCases}
                </div>
                <div className="text-[11px] text-slate-500">Current operational split</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Evidence Exhibits</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{data.metrics.totalEvidence}</div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 tabular-nums">
                  {data.metrics.pendingEvidenceVerification} pending verification · {data.metrics.quarantinedEvidence} quarantined
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Pending Tasks</div>
                <div className="text-2xl font-bold font-mono tabular-nums">{data.metrics.pendingTasks}</div>
                <div className="text-[11px] text-red-700 dark:text-red-400 tabular-nums">
                  {data.metrics.overdueTasks} overdue deadline(s)
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">AI Jobs & Reviews</div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {data.metrics.aiJobs} / {data.metrics.pendingAiReviews}
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-400 tabular-nums">
                  {data.metrics.highPriorityAi} High Priority drafts
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Case Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.statusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Incidents, Cases & Evidence Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.monthlyIncidents}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="incidents" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="cases" stroke="#0f172a" fill="#0f172a" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="evidence" stroke="#16a34a" fill="#16a34a" fillOpacity={0.12} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tables Row: Recent Case Updates + Assignment Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Authorized Case Updates</CardTitle>
                <Link href="/cases" className="text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline">
                  View Registry
                </Link>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {data.recentCaseUpdates.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500">
                    Your current role ({data.roleScope}) enforces least-privilege isolation and has no routine confidential case dossiers assigned.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 px-4 font-medium">Case ID</th>
                        <th className="py-2.5 px-4 font-medium">Title & Unit</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.recentCaseUpdates.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono font-medium">
                            <Link href={`/cases/${c.id}`} className="text-blue-900 dark:text-blue-400 hover:underline">
                              {c.case_number}
                            </Link>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium truncate max-w-xs">{c.title}</div>
                            <div className="text-slate-500">{c.assigned_unit} · {c.officer_name}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusText status={c.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Recent System Activity</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-slate-200 dark:divide-slate-800 p-0">
                {data.recentActivities.map((act) => (
                  <div key={act.event_id} className="px-4 py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {act.action}
                      </div>
                      <div className="text-slate-500 truncate">
                        {act.user_role} · <span className="font-mono">{act.resource_id}</span>
                      </div>
                    </div>
                    <StatusText status={act.outcome} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Emergency Break-Glass Modal */}
      <Modal
        open={breakGlassOpen}
        onClose={() => setBreakGlassOpen(false)}
        title="Emergency Break-Glass Privileged Access"
        description="Grants 15-minute time-limited access to Confidential cases. Strictly MFA-protected and permanently audited."
      >
        <form onSubmit={handleBreakGlass} className="space-y-4">
          <AlertBox tone="warning" title="Least-Privilege Policy Override">
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Your justification and MFA signature will be recorded in the immutable audit chain.</span>
            </span>
          </AlertBox>
          <div>
            <Label htmlFor="bg-reason">Formal Justification (min 12 chars)</Label>
            <Textarea
              id="bg-reason"
              rows={3}
              required
              minLength={12}
              value={bgReason}
              onChange={(e) => setBgReason(e.target.value)}
              placeholder="e.g., Urgent judicial oversight compliance check on JRX-DHK-2026-0043"
            />
          </div>
          <div>
            <Label htmlFor="bg-code">MFA Verification Code (Demo: 482910)</Label>
            <Input
              id="bg-code"
              required
              maxLength={6}
              value={bgCode}
              onChange={(e) => setBgCode(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBreakGlassOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Authorize 15-Min Access</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
