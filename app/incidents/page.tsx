'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
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
} from '@/components/ui/primitives';

interface IncidentRow {
  id: number;
  incident_number: string;
  case_id: number | null;
  case_number: string | null;
  title: string;
  category: string;
  incident_date: string;
  location: string;
  district: string;
  description: string;
  reporter_type: string;
  status: string;
  creator_name: string | null;
  created_at: string;
}

export default function IncidentsPage() {
  const { user, notify } = useApp();
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Cyber Crime');
  const [district, setDistrict] = useState('Dhaka');
  const [location, setLocation] = useState('');
  const [reporterType, setReporterType] = useState('Patrol Officer');
  const [description, setDescription] = useState('');
  const [promoteToCase, setPromoteToCase] = useState(true);

  const load = async () => {
    const res = await fetch('/api/incidents', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setIncidents(d.incidents || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/incidents', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (active && d) setIncidents(d.incidents || []);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        district,
        location,
        reporterType,
        description,
        promoteToCase,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Failed to log incident.', 'error');
      return;
    }
    notify(
      d.caseNumber ? `Logged ${d.incidentNumber} and created ${d.caseNumber}` : `Logged ${d.incidentNumber}`,
      'success'
    );
    setOpen(false);
    setTitle('');
    setLocation('');
    setDescription('');
    load();
  };

  return (
    <AppShell
      title="Incident Reports"
      breadcrumb={['Operations', 'Incident Reports']}
      actions={
        user?.permissions.includes('incidents:write') && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Log Incident</span>
          </Button>
        )
      }
    >
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Incident ID</th>
                <th className="py-3 px-4 font-medium">Title & Location</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Linked Case</th>
                <th className="py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-semibold">{inc.incident_number}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{inc.title}</div>
                    <div className="text-slate-500">{inc.location}, {inc.district}</div>
                  </td>
                  <td className="py-3 px-4">{inc.category}</td>
                  <td className="py-3 px-4 font-mono">
                    {inc.case_number && inc.case_id ? (
                      <Link href={`/cases/${inc.case_id}`} className="text-blue-900 dark:text-blue-400 hover:underline">
                        {inc.case_number}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Triage only</span>
                    )}
                  </td>
                  <td className="py-3 px-4"><StatusText status={inc.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Log New Operational Incident">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="inc-title">Incident Title</Label>
            <Input id="inc-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inc-cat">Category</Label>
              <Select id="inc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Cyber Crime</option>
                <option>Financial Fraud</option>
                <option>Property & Cargo</option>
                <option>Public Safety Hazard</option>
                <option>Document Forgery</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="inc-dist">District</Label>
              <Select id="inc-dist" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option>Dhaka</option>
                <option>Chattogram</option>
                <option>Sylhet</option>
                <option>Rajshahi</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="inc-loc">Location</Label>
            <Input id="inc-loc" required value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inc-rep">Reporting Source</Label>
            <Input id="inc-rep" required value={reporterType} onChange={(e) => setReporterType(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inc-desc">Description</Label>
            <Textarea id="inc-desc" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={promoteToCase}
              onChange={(e) => setPromoteToCase(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Immediately promote to formal Case record</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Incident</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
