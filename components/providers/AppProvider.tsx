'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface UserSessionProfile {
  id: number;
  email: string;
  fullName: string;
  badgeNumber: string;
  unit: string;
  jurisdiction: string;
  roles: string[];
  roleNames: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mfaVerified: boolean;
  sessionJti: string;
  emergencyAccessUntil: string | null;
  emergencyReason: string | null;
}

interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  user: UserSessionProfile | null;
  loading: boolean;
  unreadNotifications: number;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  refreshSession: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  hasPermission: (perm: string) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSessionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('jurivexora_theme') : null;
      const initial = saved === 'dark' ? 'dark' : 'light';
      setTheme(initial);
      if (initial === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('jurivexora_theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = String(Date.now() + Math.random());
    setToasts((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifications(data.unreadCount || 0);
      }
    } catch {
      // ignore background poll failures
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        refreshNotifications();
      } else {
        setUser(null);
        setUnreadNotifications(0);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        if (data.authenticated && data.user) {
          setUser(data.user);
          const notifRes = await fetch('/api/notifications');
          if (active && notifRes.ok) {
            const nd = await notifRes.json();
            setUnreadNotifications(nd.unreadCount || 0);
          }
        } else {
          setUser(null);
          setUnreadNotifications(0);
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const hasPermission = useCallback(
    (perm: string) => {
      if (!user) return false;
      return user.permissions.includes(perm);
    },
    [user]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        unreadNotifications,
        theme,
        toggleTheme,
        refreshSession,
        refreshNotifications,
        notify,
        hasPermission,
      }}
    >
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg transition-all ${
                t.tone === 'error'
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100'
                  : t.tone === 'success'
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
