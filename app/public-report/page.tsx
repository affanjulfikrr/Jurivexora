'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Search, FileUp, CheckCircle2, ArrowLeft } from 'lucide-react';
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

interface PublicLookupResult {
  reference_number: string;
  title: string;
  category: string;
  incident_date: string;
  district: string;
  status: string;
  public_note: string;
  created_at: string;
  updated_at: string;
}

export default function PublicReportPage() {
  const { user, notify } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Cyber & Phishing');
  const [incidentDate, setIncidentDate] = useState('2026-11-16T10:00');
  const [district, setDistrict] = useState('Dhaka');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [contactPreference, setContactPreference] = useState<'Anonymous' | 'Phone' | 'Email'>('Anonymous');
  const [contactValue, setContactValue] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationRef, setConfirmationRef] = useState<string | null>(null);

  // Lookup
  const [lookupRef, setLookupRef] = useState('PUB-BD-2026-8831');
  const [lookupResult, setLookupResult] = useState<PublicLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Supervisor triage list (only when logged in with triage permission)
  const [triageReports, setTriageReports] = useState<Array<PublicLookupResult & { description: string; location: string }>>([]);

  const canTriage = user?.permissions.includes('public_reports:triage');

  useEffect(() => {
    if (canTriage) {
      fetch('/api/public-reports')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.reports) setTriageReports(d.reports);
        })
        .catch(() => {});
    }
  }, [canTriage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('category', category);
      fd.append('incidentDate', incidentDate);
      fd.append('district', district);
      fd.append('location', location);
      fd.append('description', description);
      fd.append('contactPreference', contactPreference);
      fd.append('contactValue', contactValue);
      if (attachment) fd.append('attachment', attachment);

      const res = await fetch('/api/public-reports', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Submission failed.', 'error');
        return;
      }
      setConfirmationRef(data.referenceNumber);
      setLookupRef(data.referenceNumber);
      setTitle('');
      setLocation('');
      setDescription('');
      setAttachment(null);
      notify(`Incident submitted. Reference: ${data.referenceNumber}`, 'success');
    } catch {
      notify('Network error submitting report.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    setSearching(true);
    try {
      const res = await fetch(`/api/public-reports?ref=${encodeURIComponent(lookupRef.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'Report not found.');
        return;
      }
      setLookupResult(data.report);
    } catch {
      setLookupError('Failed to check report status.');
    } finally {
      setSearching(false);
    }
  };

  const handleTriageUpdate = async (referenceNumber: string, status: string) => {
    const res = await fetch('/api/public-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceNumber,
        status,
        publicNote: `Updated to ${status} by authorized triage supervisor.`,
      }),
    });
    if (res.ok) {
      notify(`Updated ${referenceNumber} to ${status}`, 'success');
      const r2 = await fetch('/api/public-reports');
      if (r2.ok) {
        const d2 = await r2.json();
        setTriageReports(d2.reports || []);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            <span>Jurivexora</span>
          </Link>
          <span className="text-xs text-slate-400 hidden sm:inline">· Public Incident Reporting Portal</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-lg bg-blue-900 text-white text-xs font-medium hover:bg-blue-800 transition-colors"
            >
              Personnel Sign In
            </Link>
          )}
        </div>
      </header>

      <div className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-6 py-2 text-xs text-slate-600 dark:text-slate-400">
        Academic Demonstration Portal · Synthetic Public Submissions Only · Strictly Isolated from Confidential Investigation Records
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Submit Public Report */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle>Submit Public Incident Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {confirmationRef && (
                  <AlertBox tone="success" title="Submission Confirmed">
                    Your report reference number is{' '}
                    <span className="font-mono font-bold">{confirmationRef}</span>. Save this reference to track non-confidential triage status.
                  </AlertBox>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="pub-title">Incident Subject</Label>
                    <Input
                      id="pub-title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Suspicious utility SMS link reported in Mirpur"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="pub-category">Category</Label>
                      <Select id="pub-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option>Cyber & Phishing</option>
                        <option>Public Safety Hazard</option>
                        <option>Property & Theft</option>
                        <option>Traffic & Roadway</option>
                        <option>Suspicious Item</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pub-district">District</Label>
                      <Select id="pub-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
                        <option>Dhaka</option>
                        <option>Chattogram</option>
                        <option>Sylhet</option>
                        <option>Rajshahi</option>
                        <option>Khulna</option>
                        <option>Gazipur</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pub-date">Incident Date & Time</Label>
                      <Input
                        id="pub-date"
                        type="datetime-local"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pub-location">Location / Thana / Road</Label>
                    <Input
                      id="pub-location"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Road 11, Banani, Dhaka"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pub-desc">Incident Description (Use synthetic/demo text only)</Label>
                    <Textarea
                      id="pub-desc"
                      rows={4}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what happened, approximate time, and any public safety details..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pub-pref">Contact Preference</Label>
                      <Select
                        id="pub-pref"
                        value={contactPreference}
                        onChange={(e) => setContactPreference(e.target.value as 'Anonymous' | 'Phone' | 'Email')}
                      >
                        <option value="Anonymous">Anonymous (No Contact Stored)</option>
                        <option value="Phone">Phone Callback</option>
                        <option value="Email">Email Update</option>
                      </Select>
                    </div>
                    {contactPreference !== 'Anonymous' && (
                      <div>
                        <Label htmlFor="pub-contact">
                          {contactPreference === 'Phone' ? 'Demo Phone Number' : 'Demo Email'}
                        </Label>
                        <Input
                          id="pub-contact"
                          required
                          value={contactValue}
                          onChange={(e) => setContactValue(e.target.value)}
                          placeholder={contactPreference === 'Phone' ? '+880-1700-000000' : 'citizen@example.bd'}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="pub-file">Permitted Attachment (Optional — hashed on intake)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="pub-file"
                        type="file"
                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                        className="pt-1.5"
                      />
                      <FileUp className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                    {submitting ? 'Submitting...' : 'Submit Incident Report'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Track Report Status */}
          <div className="lg:col-span-5 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Track Report Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Enter a public reference number (e.g. <span className="font-mono">PUB-BD-2026-8831</span>) to view sanitized triage status without exposing confidential records.
                </p>
                <form onSubmit={handleLookup} className="flex gap-2">
                  <Input
                    value={lookupRef}
                    onChange={(e) => setLookupRef(e.target.value)}
                    placeholder="PUB-BD-2026-..."
                    className="font-mono"
                    required
                  />
                  <Button type="submit" disabled={searching}>
                    <Search className="w-4 h-4" />
                    <span>Track</span>
                  </Button>
                </form>

                {lookupError && (
                  <AlertBox tone="warning" title="Lookup Result">
                    {lookupError}
                  </AlertBox>
                )}

                {lookupResult && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-900 dark:text-blue-400">
                        {lookupResult.reference_number}
                      </span>
                      <StatusText status={lookupResult.status} />
                    </div>
                    <div className="text-sm font-semibold">{lookupResult.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {lookupResult.category} · {lookupResult.district}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800">
                      {lookupResult.public_note}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Authenticated Supervisor Triage Table */}
        {canTriage && triageReports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Authorized Supervisor Triage Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Subject & Location</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Triage Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {triageReports.map((r) => (
                    <tr key={r.reference_number} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-mono font-medium">{r.reference_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{r.title}</div>
                        <div className="text-slate-500">{r.location}, {r.district}</div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTriageUpdate(r.reference_number, 'Initial Triage')}
                        >
                          Triage
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleTriageUpdate(r.reference_number, 'Forwarded to Unit')}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Forward</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
