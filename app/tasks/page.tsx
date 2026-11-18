'use client';

import React, { useEffect, useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
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

interface TaskRow {
  id: number;
  case_id: number;
  case_number: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  deadline: string;
  assignee_name: string;
  comments: string;
}

export default function TasksPage() {
  const { user, notify } = useApp();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [cases, setCases] = useState<Array<{ id: number; case_number: string; title: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: number; full_name: string; badge_number: string }>>([]);
  const [filter, setFilter] = useState('All');

  const [createOpen, setCreateOpen] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [deadline, setDeadline] = useState('2026-11-30');

  const [commentTask, setCommentTask] = useState<TaskRow | null>(null);
  const [commentText, setCommentText] = useState('');

  const loadData = async () => {
    const res = await fetch('/api/tasks', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setTasks(d.tasks || []);
      setCases(d.cases || []);
      setUsers(d.users || []);
      if (d.cases?.length && !caseId) setCaseId(String(d.cases[0].id));
      if (d.users?.length && !assignedTo) setAssignedTo(String(d.users[0].id));
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/tasks', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setTasks(d.tasks || []);
        setCases(d.cases || []);
        setUsers(d.users || []);
        if (d.cases?.length) setCaseId((prev) => prev || String(d.cases[0].id));
        if (d.users?.length) setAssignedTo((prev) => prev || String(d.users[0].id));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: Number(caseId),
        title,
        description,
        assignedTo: Number(assignedTo),
        priority,
        deadline,
      }),
    });
    if (res.ok) {
      notify('Task created.', 'success');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      loadData();
    } else {
      const d = await res.json();
      notify(d.error || 'Failed to create task.', 'error');
    }
  };

  const handleStatusChange = async (taskId: number, status: string) => {
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    if (res.ok) {
      notify(`Task status updated to ${status}.`, 'success');
      loadData();
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentTask) return;
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: commentTask.id, comment: commentText }),
    });
    if (res.ok) {
      notify('Comment added.', 'success');
      setCommentText('');
      setCommentTask(null);
      loadData();
    }
  };

  const filtered = tasks.filter((t) => filter === 'All' || t.status === filter);
  const canManage = user?.permissions.includes('tasks:manage');

  return (
    <AppShell
      title="Task Management"
      breadcrumb={['Operations', 'Task Management']}
      actions={
        canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </Button>
        )
      }
    >
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit overflow-x-auto">
        {['All', 'Overdue', 'Pending', 'In Progress', 'Under Review', 'Completed'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
              filter === st
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Task & Case</th>
                <th className="py-3 px-4 font-medium">Assignee</th>
                <th className="py-3 px-4 font-medium">Priority</th>
                <th className="py-3 px-4 font-medium">Deadline</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((t) => {
                const comments: Array<{ id: string; author: string; text: string }> = JSON.parse(t.comments || '[]');
                return (
                  <tr key={t.id}>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{t.title}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{t.case_number}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{t.assignee_name}</td>
                    <td className="py-3 px-4 whitespace-nowrap"><StatusText status={t.priority} /></td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">{t.deadline}</td>
                    <td className="py-3 px-4 whitespace-nowrap"><StatusText status={t.status} /></td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      {canManage && (
                        <Select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className="inline-block w-32 h-8 text-xs"
                          aria-label="Update task status"
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Under Review</option>
                          <option>Completed</option>
                          <option>Overdue</option>
                        </Select>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setCommentTask(t)}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{comments.length}</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Investigation Task">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="t-case">Case</Label>
            <Select id="t-case" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="t-title">Task Title</Label>
            <Input id="t-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="t-desc">Instructions</Label>
            <Textarea id="t-desc" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="t-ass">Assignee</Label>
              <Select id="t-ass" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="t-prio">Priority</Label>
              <Select id="t-prio" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-dl">Deadline</Label>
              <Input id="t-dl" type="date" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(commentTask)} onClose={() => setCommentTask(null)} title={`Task Comments: ${commentTask?.title || ''}`}>
        {commentTask && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
              {(JSON.parse(commentTask.comments || '[]') as Array<{ id: string; author: string; text: string; createdAt: string }>).map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                  <div className="font-semibold">{c.author}</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{c.text}</div>
                </div>
              ))}
            </div>
            {canManage && (
              <form onSubmit={handleAddComment} className="space-y-3">
                <Textarea rows={2} required value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add update comment..." />
                <div className="flex justify-end">
                  <Button type="submit" size="sm">Post Comment</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
