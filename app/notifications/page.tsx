'use client';

import React, { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppProvider';
import { Button, Card, CardContent, StatusText, AlertBox } from '@/components/ui/primitives';

interface NotifRow {
  id: number;
  category: string;
  title: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  is_read: number;
  created_at: string;
}

export default function NotificationsPage() {
  const { user, refreshNotifications, notify } = useApp();
  const [items, setItems] = useState<NotifRow[]>([]);

  const loadData = async () => {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setItems(d.notifications || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch('/api/notifications', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (active && d) setItems(d.notifications || []);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const markRead = async (id?: number) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : { markAll: true }),
    });
    await refreshNotifications();
    loadData();
    if (!id) notify('All notifications marked as read.', 'info');
  };

  return (
    <AppShell
      title="Notifications & Alerts"
      breadcrumb={['Operations', 'Notifications']}
      actions={
        <Button size="sm" variant="outline" onClick={() => markRead()}>
          <CheckCheck className="w-4 h-4" />
          <span>Mark All Read</span>
        </Button>
      }
    >
      <AlertBox tone="info" title="Privacy-Safe Notification Previews">
        Notifications are scoped to your role and account. Confidential case specifics are never exposed inside notification previews.
      </AlertBox>

      <Card>
        <CardContent className="p-0 divide-y divide-slate-200 dark:divide-slate-800">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No notifications in your inbox.</div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  n.is_read ? 'opacity-70' : 'bg-blue-50/40 dark:bg-blue-950/20'
                }`}
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{n.title}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{n.category}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{n.message}</p>
                  <div className="font-mono text-[11px] text-slate-400">{n.created_at}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusText status={n.is_read ? 'Read' : 'Unread'} tone={n.is_read ? 'neutral' : 'info'} />
                  {!n.is_read && (
                    <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                      Mark Read
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
