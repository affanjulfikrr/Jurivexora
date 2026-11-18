'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  FileWarning,
  Globe,
  HardDrive,
  Link2,
  Sparkles,
  CheckSquare,
  GitBranch,
  ListTodo,
  Bell,
  BarChart3,
  ShieldAlert,
  Cpu,
  Users,
  KeyRound,
  Settings,
  BookOpen,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Shield,
  UserCog,
} from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { label: 'Case Management', href: '/cases', icon: Briefcase, permission: 'cases:read' },
  { label: 'Incident Reports', href: '/incidents', icon: FileWarning, permission: 'incidents:read' },
  { label: 'Public Reporting', href: '/public-report', icon: Globe },
  { label: 'Evidence Management', href: '/evidence', icon: HardDrive, permission: 'evidence:read' },
  { label: 'Chain of Custody', href: '/custody', icon: Link2, permission: 'custody:read' },
  { label: 'AI Assistance', href: '/ai-assistance', icon: Sparkles, permission: 'ai:assist' },
  { label: 'AI Recommendation Review', href: '/ai-review', icon: CheckSquare, permission: 'ai:review' },
  { label: 'Smart Assignment', href: '/assignments', icon: GitBranch, permission: 'assignments:view' },
  { label: 'Task Management', href: '/tasks', icon: ListTodo, permission: 'tasks:read' },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Analytics & Reports', href: '/analytics', icon: BarChart3, permission: 'analytics:view' },
  { label: 'Audit & Security', href: '/audit', icon: ShieldAlert, permission: 'audit:read' },
  { label: 'AI Governance', href: '/ai-governance', icon: Cpu, permission: 'governance:manage' },
  { label: 'User Management', href: '/admin/users', icon: Users, permission: 'users:manage' },
  { label: 'Roles & Permissions', href: '/admin/roles', icon: KeyRound, permission: 'roles:manage' },
  { label: 'System Settings', href: '/admin/settings', icon: Settings, permission: 'settings:manage' },
  { label: 'Help & Documentation', href: '/help', icon: BookOpen },
];

export function AppShell({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb: string[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, unreadNotifications, theme, toggleTheme, refreshSession, notify } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const init = setTimeout(tick, 0);
    const interval = setInterval(tick, 30000);
    return () => {
      clearTimeout(init);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refreshSession();
    notify('Signed out securely.', 'info');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-sm text-slate-600 dark:text-slate-400">Loading Jurivexora workspace...</div>
      </div>
    );
  }

  if (!user || (user.mfaEnabled && !user.mfaVerified)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-10 h-10 text-blue-900 dark:text-blue-400 mb-3" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Authentication Required
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md">
          Sign in and complete MFA verification to access protected Jurivexora modules.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            Go to Sign In
          </Link>
          <Link
            href="/public-report"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Public Incident Portal
          </Link>
        </div>
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    if (user.permissions.includes(item.permission)) return true;
    // Allow Super Admin to view Case Management in redacted / break-glass mode
    if (item.href === '/cases' && user.permissions.includes('emergency:break_glass')) return true;
    // Allow Auditor read-only access to AI Governance inspection
    if (item.href === '/ai-governance' && user.permissions.includes('audit:read')) return true;
    return false;
  });

  const emergencyActive =
    Boolean(user.emergencyAccessUntil) &&
    nowMs > 0 &&
    new Date(user.emergencyAccessUntil as string).getTime() > nowMs;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 shrink-0">
          <Shield className="w-6 h-6 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
              Jurivexora
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Intelligent · Secure · Accountable
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  active
                    ? 'bg-blue-600/20 text-white border border-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.href === '/notifications' && unreadNotifications > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold text-blue-300">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1 shrink-0">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <UserCog className="w-4 h-4 shrink-0 text-slate-400" />
            <span className="truncate">Profile & Sessions</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-red-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col h-full z-10 border-r border-slate-800">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="font-display font-bold text-white">Jurivexora</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium',
                      active ? 'bg-blue-600/20 text-white' : 'text-slate-300 hover:bg-slate-800'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-800 space-y-1">
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                <UserCog className="w-4 h-4" />
                <span>Profile & Sessions</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-red-300 hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (3 clean zones) */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span>Jurivexora</span>
              {breadcrumb.map((seg, i) => (
                <React.Fragment key={i}>
                  <span aria-hidden="true">/</span>
                  <span className={i === breadcrumb.length - 1 ? 'text-slate-900 dark:text-slate-100 font-medium truncate' : 'truncate'}>
                    {seg}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {emergencyActive && (
              <span className="hidden md:inline text-xs font-medium text-amber-700 dark:text-amber-400">
                Break-Glass Active
              </span>
            )}
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-1 rounded">
                  {unreadNotifications}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              href="/profile"
              className="hidden sm:flex flex-col items-end text-right hover:opacity-80 transition-opacity"
            >
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {user.fullName}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {user.roleNames[0]} · {user.badgeNumber}
              </span>
            </Link>
          </div>
        </header>

        {/* Academic Research Notice Strip */}
        <div className="bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-1.5 text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 no-print">
          <span>
            Academic Research & Development Demonstration · Synthetic Bangladesh Data · Not an Officially Deployed Law-Enforcement System
          </span>
          <span className="font-mono">
            Unit: {user.unit}
          </span>
        </div>

        {/* Page Header + Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              {title}
            </h1>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
