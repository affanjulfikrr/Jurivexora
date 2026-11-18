'use client';

import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui/primitives';

interface SettingRow {
  key: string;
  value: string;
  category: string;
  description: string;
  updated_at: string;
}

export default function SystemSettingsPage() {
  const { user, notify } = useApp();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const loadData = async () => {
    const res = await fetch('/api/admin/settings', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setSettings(d.settings || []);
      const map: Record<string, string> = {};
      for (const s of d.settings || []) map[s.key] = s.value;
      setDrafts(map);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setSettings(d.settings || []);
        const map: Record<string, string> = {};
        for (const s of d.settings || []) map[s.key] = s.value;
        setDrafts(map);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const saveSetting = async (key: string) => {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: drafts[key] }),
    });
    if (res.ok) {
      notify(`Updated ${key}.`, 'success');
      loadData();
    } else {
      const d = await res.json();
      notify(d.error || 'Failed to update setting.', 'error');
    }
  };

  return (
    <AppShell
      title="System Settings & Compliance Parameters"
      breadcrumb={['Administration', 'System Settings']}
    >
      <Card>
        <CardHeader><CardTitle>Platform Configuration Parameters</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-200 dark:divide-slate-800 p-0">
          {settings.map((s) => (
            <div key={s.key} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {s.key} <span className="font-sans font-normal text-slate-500">· {s.category}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{s.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                <Input
                  value={drafts[s.key] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  className="md:w-72 text-xs font-mono"
                />
                <Button size="sm" onClick={() => saveSetting(s.key)}>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
