'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Label,
  StatusText,
  Modal,
} from '@/components/ui/primitives';

interface RoleRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_system: number;
  is_active: number;
  permissionIds: number[];
}

interface PermRow {
  id: number;
  code: string;
  module: string;
  description: string;
}

export default function AdminRolesPage() {
  const { user, notify } = useApp();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadData = async () => {
    const res = await fetch('/api/admin/roles', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setRoles(d.roles || []);
      setPerms(d.permissions || []);
      if (d.roles?.length && !selectedRole) setSelectedRole(d.roles[0]);
      else if (selectedRole) {
        const refreshed = d.roles.find((r: RoleRow) => r.id === selectedRole.id);
        if (refreshed) setSelectedRole(refreshed);
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/admin/roles', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setRoles(d.roles || []);
        setPerms(d.permissions || []);
        if (d.roles?.length) {
          setSelectedRole((prev) =>
            prev ? d.roles.find((r: RoleRow) => r.id === prev.id) || d.roles[0] : d.roles[0]
          );
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleTogglePerm = async (permId: number) => {
    if (!selectedRole) return;
    const has = selectedRole.permissionIds.includes(permId);
    const nextIds = has
      ? selectedRole.permissionIds.filter((id) => id !== permId)
      : [...selectedRole.permissionIds, permId];

    const res = await fetch('/api/admin/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: selectedRole.id, permissionIds: nextIds }),
    });
    if (res.ok) {
      notify(`Updated permissions for ${selectedRole.name}.`, 'success');
      loadData();
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    if (res.ok) {
      notify('Custom RBAC role created.', 'success');
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      loadData();
    } else {
      const d = await res.json();
      notify(d.error || 'Failed to create role.', 'error');
    }
  };

  const handleToggleActive = async (r: RoleRow) => {
    const res = await fetch('/api/admin/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: r.id, isActive: !r.is_active }),
    });
    if (res.ok) {
      notify(`${r.name} ${r.is_active ? 'deactivated' : 'activated'}.`, 'info');
      loadData();
    }
  };

  return (
    <AppShell
      title="Roles & Permissions Matrix"
      breadcrumb={['Administration', 'Roles & Permissions']}
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Create Role</span>
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader><CardTitle>System & Custom Roles</CardTitle></CardHeader>
          <CardContent className="p-0 divide-y divide-slate-200 dark:divide-slate-800">
            {roles.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedRole(r)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedRole?.id === r.id
                    ? 'bg-blue-50/70 dark:bg-blue-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusText status={r.is_active ? 'Active' : 'Disabled'} />
                    {!r.is_system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(r);
                        }}
                      >
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {r.permissionIds.length} permission(s)
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>
              {selectedRole ? `Permissions: ${selectedRole.name}` : 'Select a Role'}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-slate-800 p-0">
            {selectedRole &&
              perms.map((p) => {
                const checked = selectedRole.permissionIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {p.code} <span className="font-sans font-normal text-slate-400">· {p.module}</span>
                      </div>
                      <div className="text-slate-500">{p.description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleTogglePerm(p.id)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </label>
                );
              })}
          </CardContent>
        </Card>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Custom RBAC Role">
        <form onSubmit={handleCreateRole} className="space-y-4">
          <div>
            <Label htmlFor="r-name">Role Name</Label>
            <Input id="r-name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="r-desc">Role Scope & Description</Label>
            <Textarea id="r-desc" rows={3} required value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Role</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
