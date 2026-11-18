'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Label,
  StatusText,
} from '@/components/ui/primitives';

interface SessionRow {
  id: number;
  token_jti: string;
  ip_address: string;
  user_agent: string;
  mfa_verified: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const { user, refreshSession, notify } = useApp();
  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState('Available');
  const [shiftStatus, setShiftStatus] = useState('Day Shift');
  const [mfaDraft, setMfaDraft] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const fullName = fullNameDraft ?? user?.fullName ?? '';
  const mfaEnabled = mfaDraft ?? user?.mfaEnabled ?? true;

  const loadSessions = async () => {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setSessions(d.sessions || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (active && res.ok) {
        const d = await res.json();
        setSessions(d.sessions || []);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, availabilityStatus, shiftStatus, mfaEnabled }),
    });
    if (res.ok) {
      notify('Profile updated.', 'success');
      await refreshSession();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_password', currentPassword, newPassword }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Password update failed.', 'error');
      return;
    }
    notify('Password changed securely.', 'success');
    setCurrentPassword('');
    setNewPassword('');
  };

  const handleRevokeSession = async (jti: string) => {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_session', jti }),
    });
    if (res.ok) {
      notify('Session revoked.', 'info');
      if (jti === user?.sessionJti) {
        await refreshSession();
      } else {
        loadSessions();
      }
    }
  };

  return (
    <AppShell
      title="User Profile & Session Security"
      breadcrumb={['Account', 'Profile & Sessions']}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6">
          <CardHeader><CardTitle>Personnel Profile & MFA</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <Label htmlFor="p-name">Full Name</Label>
                <Input id="p-name" required value={fullName} onChange={(e) => setFullNameDraft(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="p-avail">Duty Availability</Label>
                  <Select id="p-avail" value={availabilityStatus} onChange={(e) => setAvailabilityStatus(e.target.value)}>
                    <option>Available</option>
                    <option>On Duty</option>
                    <option>In Field</option>
                    <option>On Leave</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="p-shift">Shift</Label>
                  <Select id="p-shift" value={shiftStatus} onChange={(e) => setShiftStatus(e.target.value)}>
                    <option>Day Shift</option>
                    <option>Night Shift</option>
                    <option>Standby</option>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={mfaEnabled} onChange={(e) => setMfaDraft(e.target.checked)} />
                <span>Require Multi-Factor Authentication (MFA) on sign-in</span>
              </label>
              <Button type="submit" size="sm">Update Profile</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="cp-curr">Current Password</Label>
                <Input id="cp-curr" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cp-new">New Password (min 8 chars)</Label>
                <Input id="cp-new" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <Button type="submit" size="sm">Update Password</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Active & Recent Authentication Sessions</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 px-4">Session Token ID</th>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">MFA</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 px-4 font-mono">
                    {s.token_jti.slice(0, 12)}...
                    {s.token_jti === user?.sessionJti && <span className="ml-2 text-blue-700 dark:text-blue-400">(Current)</span>}
                  </td>
                  <td className="py-2.5 px-4 truncate max-w-xs">{s.user_agent}</td>
                  <td className="py-2.5 px-4">{s.mfa_verified ? 'Verified' : 'Pending'}</td>
                  <td className="py-2.5 px-4 font-mono">{s.created_at}</td>
                  <td className="py-2.5 px-4">
                    <StatusText status={s.revoked_at ? 'Revoked' : 'Active'} tone={s.revoked_at ? 'neutral' : 'success'} />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {!s.revoked_at && (
                      <Button size="sm" variant="outline" onClick={() => handleRevokeSession(s.token_jti)}>
                        Revoke
                      </Button>
                    )}
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
