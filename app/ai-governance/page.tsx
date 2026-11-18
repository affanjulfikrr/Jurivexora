'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Power, RotateCcw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  StatusText,
  AlertBox,
} from '@/components/ui/primitives';

interface ModelRow {
  id: number;
  model_key: string;
  name: string;
  version: string;
  capability: string;
  status: string;
  error_rate: number;
  bn_accuracy: number;
  en_accuracy: number;
  bias_score: number;
  drift_status: string;
  updated_at: string;
}

export default function AIGovernancePage() {
  const { user, notify } = useApp();
  const [models, setModels] = useState<ModelRow[]>([]);
  const [usage, setUsage] = useState<Array<{ job_number: string; job_type: string; mode: string; model_name: string; requester_name: string; created_at: string }>>([]);
  const [errors, setErrors] = useState<Array<{ id: number; suggestion_number: string; reporter_name: string; review_notes: string; created_at: string }>>([]);
  const [threshold, setThreshold] = useState(85);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  const loadData = async () => {
    const res = await fetch('/api/governance', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setModels(d.models || []);
      setUsage(d.usageHistory || []);
      setErrors(d.errorReports || []);
      setThreshold(d.confidenceThreshold || 85);
      setGlobalEnabled(d.globalAiEnabled !== false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/governance', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setModels(d.models || []);
        setUsage(d.usageHistory || []);
        setErrors(d.errorReports || []);
        setThreshold(d.confidenceThreshold || 85);
        setGlobalEnabled(d.globalAiEnabled !== false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const canManage = user?.permissions.includes('governance:manage');

  const handleToggleGlobal = async () => {
    const res = await fetch('/api/governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_global_ai', enabled: !globalEnabled }),
    });
    if (res.ok) {
      notify(globalEnabled ? 'Global AI kill-switch activated (manual fallback mode).' : 'AI assistance re-enabled.', 'info');
      loadData();
    }
  };

  const handleUpdateThreshold = async () => {
    const res = await fetch('/api/governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_threshold', threshold }),
    });
    if (res.ok) {
      notify(`Updated research confidence threshold to ${threshold}%.`, 'success');
      loadData();
    }
  };

  const handleModelAction = async (model: ModelRow, status: string, rollbackVersion?: string) => {
    const res = await fetch('/api/governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: model.id,
        status,
        version: rollbackVersion,
        reason: rollbackVersion
          ? `Rolled back ${model.name} to ${rollbackVersion}`
          : `Set ${model.name} status to ${status}`,
      }),
    });
    if (res.ok) {
      notify(`Updated ${model.name} (${status}).`, 'success');
      loadData();
    }
  };

  return (
    <AppShell
      title="AI Governance & Model Oversight Console"
      breadcrumb={['Governance', 'AI Governance']}
      actions={
        canManage && (
          <Button
            size="sm"
            variant={globalEnabled ? 'danger' : 'primary'}
            onClick={handleToggleGlobal}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{globalEnabled ? 'Disable All AI (Kill-Switch)' : 'Re-Enable AI Platform'}</span>
          </Button>
        )
      }
    >
      {!globalEnabled && (
        <AlertBox tone="danger" title="AI Kill-Switch Active — Manual Fallback Mode">
          All automated AI assistance is suspended by Governance. Officers continue operating via standard manual case and evidence workflows.
        </AlertBox>
      )}

      {/* Configurable Confidence Threshold + Language Performance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader><CardTitle>Research Parameter Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              The 85% threshold is a proposed research parameter prioritizing human review, not a validated measure of truth or guilt. Adjust for academic evaluation:
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={50}
                max={99}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                disabled={!canManage}
                className="w-28 font-mono"
              />
              <span className="text-slate-500">% Confidence Threshold</span>
              {canManage && (
                <Button size="sm" onClick={handleUpdateThreshold}>Save Threshold</Button>
              )}
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="font-semibold mb-1">Reported AI Errors ({errors.length})</div>
              {errors.length === 0 ? (
                <div className="text-slate-500">No AI errors reported in current evaluation window.</div>
              ) : (
                <div className="space-y-1.5">
                  {errors.slice(0, 3).map((er) => (
                    <div key={er.id} className="rounded border border-red-200 dark:border-red-900/50 p-2">
                      <span className="font-mono font-semibold">{er.suggestion_number}</span> · {er.reporter_name}: {er.review_notes}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader><CardTitle>Bangla vs. English Evaluation Accuracy (%)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={models}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="model_key" tick={{ fontSize: 10 }} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="bn_accuracy" name="Bangla Accuracy %" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="en_accuracy" name="English Accuracy %" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Model Registry */}
      <Card>
        <CardHeader><CardTitle>AI Model Registry, Bias & Drift Monitoring</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4">Model & Capability</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4 text-right">Error Rate</th>
                <th className="py-3 px-4 text-right">Bias Metric</th>
                <th className="py-3 px-4">Drift</th>
                <th className="py-3 px-4">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Controls</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {models.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 px-4">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-slate-500">{m.capability}</div>
                  </td>
                  <td className="py-3 px-4 font-mono">{m.version}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{(m.error_rate * 100).toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{m.bias_score.toFixed(2)}</td>
                  <td className="py-3 px-4"><StatusText status={m.drift_status} /></td>
                  <td className="py-3 px-4"><StatusText status={m.status} /></td>
                  {canManage && (
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModelAction(m, m.status === 'Disabled' ? 'Active' : 'Disabled')}
                      >
                        {m.status === 'Disabled' ? 'Enable' : 'Suspend'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleModelAction(m, 'Rollback', 'gemini-3.1-flash-lite')}
                        title="Rollback to previous validated model baseline"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Rollback</span>
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Usage History */}
      <Card>
        <CardHeader><CardTitle>AI Usage History</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 px-4">Job ID</th>
                <th className="py-2.5 px-4">Model</th>
                <th className="py-2.5 px-4">Task</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4">Requested By</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {usage.map((u) => (
                <tr key={u.job_number}>
                  <td className="py-2.5 px-4 font-mono font-medium">{u.job_number}</td>
                  <td className="py-2.5 px-4">{u.model_name}</td>
                  <td className="py-2.5 px-4">{u.job_type}</td>
                  <td className="py-2.5 px-4 font-mono">{u.mode}</td>
                  <td className="py-2.5 px-4">{u.requester_name}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{u.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
