'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, Printer, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from '@/components/ui/primitives';

interface AnalyticsPayload {
  casesByCategory: Array<{ category: string; total: number; closed: number }>;
  officerWorkload: Array<{ name: string; unit: string; capacity: number; assignedCases: number }>;
  evidenceSummary: Array<{ status: string; count: number }>;
  aiPerformance: Array<{ capability: string; total: number; avgConfidence: number; accepted: number; rejectedOrFlagged: number }>;
  savedReports: Array<{ report_number: string; title: string; report_type: string; generated_by_name: string; created_at: string }>;
}

export default function AnalyticsPage() {
  const { user, notify } = useApp();
  const [category, setCategory] = useState('All');
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/analytics?category=${encodeURIComponent(category)}`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, [category]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch(`/api/analytics?category=${encodeURIComponent(category)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (active && d) setData(d);
      });
    return () => {
      active = false;
    };
  }, [user, category]);

  const handleExportCsv = () => {
    if (!data) return;
    const rows = [
      ['Category', 'Total Cases', 'Closed Cases'],
      ...data.casesByCategory.map((c) => [c.category, String(c.total), String(c.closed)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jurivexora-analytics-${category.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('CSV analytics report exported.', 'success');
  };

  const handleSaveSnapshot = async () => {
    if (!data) return;
    const res = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Operational Analytics Digest (${category})`,
        reportType: 'Aggregate Case & AI Performance',
        filters: { category },
        summary: { categories: data.casesByCategory.length },
      }),
    });
    const d = await res.json();
    if (res.ok) {
      notify(`Saved audited report ${d.reportNumber}`, 'success');
      loadData();
    } else {
      notify(d.error || 'Export permission required.', 'error');
    }
  };

  const canExport = user?.permissions.includes('reports:export');

  return (
    <AppShell
      title="Analytics & Report Generation"
      breadcrumb={['Oversight', 'Analytics & Reports']}
      actions={
        <div className="flex flex-wrap items-center gap-2 no-print">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-xs w-44" aria-label="Filter category">
            <option value="All">All Categories</option>
            <option value="Financial Fraud">Financial Fraud</option>
            <option value="Cyber Crime">Cyber Crime</option>
            <option value="Property & Cargo">Property & Cargo</option>
            <option value="Document Forgery">Document Forgery</option>
          </Select>
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            <span>CSV Export</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </Button>
          {canExport && (
            <Button size="sm" onClick={handleSaveSnapshot}>
              <Save className="w-3.5 h-3.5" />
              <span>Archive Report</span>
            </Button>
          )}
        </div>
      }
    >
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Case Volume by Category</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.casesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="closed" name="Closed" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Investigator Workload Balance</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.officerWorkload}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="assignedCases" name="Active Cases" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="capacity" name="Max Capacity" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>AI Suggestion Review Performance</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-3 px-4">Capability</th>
                    <th className="py-3 px-4 text-right">Total Drafts</th>
                    <th className="py-3 px-4 text-right">Avg Confidence</th>
                    <th className="py-3 px-4 text-right">Accepted</th>
                    <th className="py-3 px-4 text-right">Rejected / Flagged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.aiPerformance.map((p) => (
                    <tr key={p.capability}>
                      <td className="py-3 px-4 font-medium">{p.capability}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{p.total}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{p.avgConfidence}%</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{p.accepted}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{p.rejectedOrFlagged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Generated Report Archive</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-4">Report ID</th>
                    <th className="py-2.5 px-4">Title</th>
                    <th className="py-2.5 px-4">Generated By</th>
                    <th className="py-2.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.savedReports.map((r) => (
                    <tr key={r.report_number}>
                      <td className="py-2.5 px-4 font-mono font-medium">{r.report_number}</td>
                      <td className="py-2.5 px-4">{r.title}</td>
                      <td className="py-2.5 px-4">{r.generated_by_name}</td>
                      <td className="py-2.5 px-4 font-mono">{r.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
