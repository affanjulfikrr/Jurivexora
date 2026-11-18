'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Lock, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { firebaseAuth, googleAuthProvider, testFirestoreConnection } from '@/lib/firebase-client';
import { useApp } from '@/components/providers/AppProvider';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, AlertBox } from '@/components/ui/primitives';

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'superadmin@jurivexora.bd.demo', desc: 'Users, roles, AI governance, break-glass oversight' },
  { role: 'System Administrator', email: 'sysadmin@jurivexora.bd.demo', desc: 'Technical settings & logs (no routine case access)' },
  { role: 'Investigating Officer', email: 'officer.dmp@jurivexora.bd.demo', desc: 'DMP Gulshan assigned cases, evidence & AI assist' },
  { role: 'Supervisor', email: 'supervisor.dmp@jurivexora.bd.demo', desc: 'Unit review, smart assignment & AI approvals' },
  { role: 'Evidence Custodian', email: 'custodian@jurivexora.bd.demo', desc: 'SHA-256 verification, vault & chain of custody' },
  { role: 'Forensic Analyst', email: 'forensic@jurivexora.bd.demo', desc: 'OCR, transcription & forensic analysis' },
  { role: 'Legal / Compliance', email: 'legal@jurivexora.bd.demo', desc: 'Disclosure review, retention & export approvals' },
  { role: 'Auditor / Oversight', email: 'auditor@jurivexora.bd.demo', desc: 'Read-only tamper-evident audit logs & oversight' },
];

function getDefaultRouteForRoles(roles: string[]): string {
  if (roles.includes('auditor')) return '/audit';
  if (roles.includes('evidence_custodian')) return '/evidence';
  if (roles.includes('forensic_analyst')) return '/ai-assistance';
  return '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession, notify } = useApp();

  const [email, setEmail] = useState('officer.dmp@jurivexora.bd.demo');
  const [password, setPassword] = useState('Jurivexora@2026');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA Step
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('482910');
  const [pendingRoles, setPendingRoles] = useState<string[]>([]);

  // Forgot Password Step
  const [forgotMode, setForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [demoCodeIssued, setDemoCodeIssued] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign in failed.');
        return;
      }
      if (data.mfaRequired) {
        setPendingRoles(data.user?.roles || []);
        setMfaStep(true);
        notify('Password verified. Complete MFA verification.', 'info');
      } else {
        await refreshSession();
        router.push(getDefaultRouteForRoles(data.user?.roles || []));
      }
    } catch {
      setError('Network error while authenticating.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode, mode: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'MFA verification failed.');
        return;
      }
      await refreshSession();
      notify('Authenticated with MFA.', 'success');
      router.push(getDefaultRouteForRoles(data.user?.roles || pendingRoles));
    } catch {
      setError('MFA verification network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
      notify(`Firebase Google account verified (${result.user.email}). Select a role credential below to enter workspace.`, 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In cancelled or unavailable.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          resetStep === 'request'
            ? { step: 'request', email: resetEmail }
            : { step: 'reset', email: resetEmail, resetCode, newPassword }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Reset failed.');
        return;
      }
      if (resetStep === 'request') {
        setDemoCodeIssued(data.demoResetCode || null);
        if (data.demoResetCode) setResetCode(data.demoResetCode);
        setResetStep('confirm');
        notify('Password reset verification code generated.', 'info');
      } else {
        notify('Password reset successful. Sign in with your new password.', 'success');
        setForgotMode(false);
        setResetStep('request');
        setEmail(resetEmail);
      }
    } catch {
      setError('Reset workflow error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between">
        <Link href="/" className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          <span>Jurivexora</span>
        </Link>
        <Link
          href="/public-report"
          className="text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline"
        >
          Public Incident Portal
        </Link>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Login / MFA / Reset Card */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {forgotMode ? (
                  <>
                    <KeyRound className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                    <span>Password Reset</span>
                  </>
                ) : mfaStep ? (
                  <>
                    <Lock className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                    <span>Multi-Factor Verification</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                    <span>Authorized Personnel Sign In</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <AlertBox tone="danger" title="Authentication Notice">
                  {error}
                </AlertBox>
              )}

              {forgotMode ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email">Account Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="officer.dmp@jurivexora.bd.demo"
                    />
                  </div>
                  {resetStep === 'confirm' && (
                    <>
                      {demoCodeIssued && (
                        <AlertBox tone="info" title="Demo Verification Code">
                          Code: <span className="font-mono font-bold">{demoCodeIssued}</span> (valid 15 mins)
                        </AlertBox>
                      )}
                      <div>
                        <Label htmlFor="reset-code">6-Digit Reset Code</Label>
                        <Input
                          id="reset-code"
                          required
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-pw">New Password (min 8 characters)</Label>
                        <Input
                          id="new-pw"
                          type="password"
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setForgotMode(false);
                        setResetStep('request');
                        setError(null);
                      }}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Login</span>
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {resetStep === 'request' ? 'Issue Reset Code' : 'Confirm Password Reset'}
                    </Button>
                  </div>
                </form>
              ) : mfaStep ? (
                <form onSubmit={handleMfaVerify} className="space-y-4">
                  <AlertBox tone="info" title="MFA Challenge Active">
                    Enter your 6-digit authenticator verification code. For academic demo accounts, use{' '}
                    <span className="font-mono font-semibold">482910</span>.
                  </AlertBox>
                  <div>
                    <Label htmlFor="mfa-code">6-Digit Verification Code</Label>
                    <Input
                      id="mfa-code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      maxLength={6}
                      required
                      className="font-mono tracking-widest text-center text-base"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setMfaStep(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      Verify & Enter Workspace
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Official Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="login-password" className="mb-0">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setResetEmail(email);
                          setError(null);
                        }}
                        className="text-xs text-blue-900 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Verifying Credentials...' : 'Sign In'}
                  </Button>

                  <div className="relative py-2">
                    <div className="border-t border-slate-200 dark:border-slate-800" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                  >
                    Verify Google Identity (Firebase Auth)
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: 8 Role Demo Accounts */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Academic R&D Role Evaluation Directory
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Click any synthetic role below to populate its demo credentials (Password:{' '}
              <code className="font-mono">Jurivexora@2026</code> · MFA:{' '}
              <code className="font-mono">482910</code>). Backend RBAC and least-privilege rules are strictly enforced per role.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DEMO_ACCOUNTS.map((acc) => {
              const selected = email === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('Jurivexora@2026');
                    setMfaStep(false);
                    setForgotMode(false);
                    setError(null);
                  }}
                  className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {acc.role}
                    </span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />}
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1 truncate">
                    {acc.email}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {acc.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
