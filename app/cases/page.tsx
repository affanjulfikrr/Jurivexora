'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Lock, Eye } from 'lucide-react';
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

interface CaseRecord {
  id: number;
  case_number: string;
  title: string;
  category: string;
  district: string;
  assigned_unit: string;
  assigned_officer_name: string | null;
  priority: string;
  status: string;
  sensitivity_level: string;
  deadline: string | null;
  updated_at: string;
  accessAllowed: boolean;
  accessDenialReason: string | null;
}

export default function CasesPage() {
  const { user, notify, refreshSession } = useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Create Case Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Financial Fraud');
  const [district, setDistrict] = useState('Dhaka');
  const [thana, setThana] = useState('Gulshan');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [sensitivityLevel, setSensitivityLevel] = useState('Standard');
  const [deadline, setDeadline] = useState('2026-12-15');
  const [description, setDescription] = useState('');

  // Break-glass
  const [bgOpen, setBgOpen] = useState(false);
  const [bgReason, setBgReason] = useState('');
  const [bgCode, setBgCode] = useState('482910');

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        status: statusFilter,
        priority: priorityFilter,
      });
      const res = await fetch(`/api/cases?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setCases(d.cases || []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, priorityFilter]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const params = new URLSearchParams({
      q,
      status: statusFilter,
      priority: priorityFilter,
    });
    fetch(`/api/cases?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active) return;
        if (d) setCases(d.cases || []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, q, statusFilter, priorityFilter]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        district,
        thana,
        location,
        priority,
        sensitivityLevel,
        deadline,
        description,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Failed to create case.', 'error');
      return;
    }
    notify(`Created case ${d.caseNumber}`, 'success');
    setCreateOpen(false);
    setTitle('');
    setLocation('');
    setDescription('');
    loadCases();
  };

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'emergency', code: bgCode, reason: bgReason }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Failed to unlock emergency access.', 'error');
      return;
    }
    notify('15-minute Break-Glass access authorized.', 'success');
    setBgOpen(false);
    await refreshSession();
    loadCases();
  };

  const canCreate = user?.permissions.includes('cases:write');
  const canBreakGlass = user?.permissions.includes('emergency:break_glass');

  return (
    <AppShell
      title="Case Management"
      breadcrumb={['Operations', 'Case Management']}
      actions={
        <>
          {canBreakGlass && (
            <Button variant="outline" size="sm" onClick={() => setBgOpen(true)}>
              <Lock className="w-3.5 h-3.5" />
              <span>Emergency Break-Glass</span>
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>New Case</span>
            </Button>
          )}
        </>
      }
    >
      {/* Search & Segmented Filters */}
      <Card>
        <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search case ID, title, unit, or district..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
              {['All', 'New', 'Under Review', 'Assigned', 'In Progress', 'Pending', 'Closed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-32 h-9 text-xs"
              aria-label="Filter by priority"
            >
              <option value="All">All Priority</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-xs text-slate-500">Loading authorized case registry...</div>
          ) : cases.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="text-sm font-medium">No matching cases found</div>
              <p className="text-xs text-slate-500">Adjust your search or status filter, or create a new synthetic case.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Case ID</th>
                  <th className="py-3 px-4 font-medium">Title & Category</th>
                  <th className="py-3 px-4 font-medium">Unit & Officer</th>
                  <th className="py-3 px-4 font-medium">Sensitivity</th>
                  <th className="py-3 px-4 font-medium">Priority</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                      {c.case_number}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {c.title}
                      </div>
                      <div className="text-slate-500">
                        {c.category} · {c.district}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div>{c.assigned_unit}</div>
                      <div className="text-slate-500">{c.assigned_officer_name || 'Unassigned'}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      {c.sensitivity_level}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusText status={c.priority} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusText status={c.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {c.accessAllowed ? (
                        <Link
                          href={`/cases/${c.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400" title={c.accessDenialReason || ''}>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Restricted</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Case Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register New Case"
        description="Use synthetic Bangladesh demonstration data only."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateCase} className="space-y-4">
          <div>
            <Label htmlFor="c-title">Case Title</Label>
            <Input
              id="c-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Digital Invoice Impersonation — Banani"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="c-cat">Category</Label>
              <Select id="c-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Financial Fraud</option>
                <option>Cyber Crime</option>
                <option>Property & Cargo</option>
                <option>Document Forgery</option>
                <option>Infrastructure Theft</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-dist">District</Label>
              <Select id="c-dist" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option>Dhaka</option>
                <option>Chattogram</option>
                <option>Sylhet</option>
                <option>Rajshahi</option>
                <option>Gazipur</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-thana">Thana / Station</Label>
              <Input id="c-thana" required value={thana} onChange={(e) => setThana(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="c-prio">Priority</Label>
              <Select id="c-prio" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-sens">Sensitivity Level</Label>
              <Select id="c-sens" value={sensitivityLevel} onChange={(e) => setSensitivityLevel(e.target.value)}>
                <option>Standard</option>
                <option>Restricted</option>
                <option>Confidential</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="c-dl">Target Deadline</Label>
              <Input id="c-dl" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="c-loc">Incident Location</Label>
            <Input
              id="c-loc"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Road, Sector, Area"
            />
          </div>
          <div>
            <Label htmlFor="c-desc">Incident Description</Label>
            <Textarea
              id="c-desc"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Factual intake summary..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Case</Button>
          </div>
        </form>
      </Modal>

      {/* Break-Glass Modal */}
      <Modal
        open={bgOpen}
        onClose={() => setBgOpen(false)}
        title="Emergency Break-Glass Access"
        description="Required for Super Admin access to Restricted or Confidential case files."
      >
        <form onSubmit={handleBreakGlass} className="space-y-4">
          <AlertBox tone="warning" title="Audited Time-Limited Elevation">
            All views under Break-Glass mode are permanently logged with your reason and MFA token.
          </AlertBox>
          <div>
            <Label htmlFor="cases-bg-reason">Written Justification</Label>
            <Textarea
              id="cases-bg-reason"
              rows={3}
              required
              minLength={12}
              value={bgReason}
              onChange={(e) => setBgReason(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cases-bg-code">MFA Code (Demo: 482910)</Label>
            <Input
              id="cases-bg-code"
              required
              maxLength={6}
              value={bgCode}
              onChange={(e) => setBgCode(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBgOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Access</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
