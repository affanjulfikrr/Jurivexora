'use client';

import React, { useEffect, useState } from 'react';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Label,
  StatusText,
  Modal,
} from '@/components/ui/primitives';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  badge_number: string;
  unit: string;
  jurisdiction: string;
  is_active: number;
  is_suspended: number;
  roles: Array<{ role_id: number; role_name: string }>;
}

export default function AdminUsersPage() {
  const { user, notify } = useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [open, setOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [unit, setUnit] = useState('DMP Gulshan Division');
  const [jurisdiction, setJurisdiction] = useState('Dhaka');
  const [roleId, setRoleId] = useState('3');

  const loadData = async () => {
    const res = await fetch('/api/admin/users', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users || []);
      setRoles(d.roles || []);
      if (d.roles?.length && !roleId) setRoleId(String(d.roles[0].id));
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/admin/users', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setUsers(d.users || []);
        setRoles(d.roles || []);
        if (d.roles?.length) {
          setRoleId((prev) => prev || String(d.roles[0].id));
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        email,
        badgeNumber,
        unit,
        jurisdiction,
        roleId: Number(roleId),
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      notify(d.error || 'Failed to create user.', 'error');
      return;
    }
    notify('Personnel account provisioned.', 'success');
    setOpen(false);
    setFullName('');
    setEmail('');
    setBadgeNumber('');
    loadData();
  };

  const toggleSuspend = async (u: UserRow) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, isSuspended: !u.is_suspended }),
    });
    if (res.ok) {
      notify(u.is_suspended ? `${u.full_name} reactivated.` : `${u.full_name} suspended.`, 'info');
      loadData();
    }
  };

  return (
    <AppShell
      title="User Management"
      breadcrumb={['Administration', 'User Management']}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Provision User</span>
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4">Personnel & Badge</th>
                <th className="py-3 px-4">Unit & Jurisdiction</th>
                <th className="py-3 px-4">Assigned Role(s)</th>
                <th className="py-3 px-4">Account State</th>
                <th className="py-3 px-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4">
                    <div className="font-semibold">{u.full_name}</div>
                    <div className="font-mono text-slate-500 text-[11px]">{u.badge_number} · {u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{u.unit}</div>
                    <div className="text-slate-500">{u.jurisdiction}</div>
                  </td>
                  <td className="py-3 px-4">{u.roles.map((r) => r.role_name).join(', ')}</td>
                  <td className="py-3 px-4">
                    <StatusText status={u.is_suspended ? 'Suspended' : u.is_active ? 'Active' : 'Inactive'} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant={u.is_suspended ? 'outline' : 'secondary'}
                      onClick={() => toggleSuspend(u)}
                    >
                      {u.is_suspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      <span>{u.is_suspended ? 'Reactivate' : 'Suspend'}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Provision New User Account">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="u-name">Full Name</Label>
              <Input id="u-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="u-badge">Badge Number</Label>
              <Input id="u-badge" required value={badgeNumber} onChange={(e) => setBadgeNumber(e.target.value)} placeholder="DMP-NEW-901" />
            </div>
          </div>
          <div>
            <Label htmlFor="u-email">Demo Email</Label>
            <Input id="u-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="u-unit">Unit</Label>
              <Input id="u-unit" required value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="u-jur">Jurisdiction</Label>
              <Input id="u-jur" required value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="u-role">Primary RBAC Role</Label>
            <Select id="u-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Account (Default Pw: Jurivexora@2026)</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
