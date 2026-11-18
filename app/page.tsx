'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Lock, FileCheck2, Sparkles, ArrowRight, Globe, Scale } from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';
import { Card, CardContent } from '@/components/ui/primitives';

export default function HomePage() {
  const { user } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-8">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          Jurivexora
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#capabilities" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            Capabilities
          </a>
          <a href="#governance" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            Governance
          </a>
          <Link href="/public-report" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            Public Portal
          </Link>
          <Link href="/help" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
            References
          </Link>
        </nav>

        <div className="shrink-0">
          <Link
            href={user ? '/dashboard' : '/login'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <span>{user ? 'Open Dashboard' : 'Personnel Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-14 sm:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-400">
              Academic R&D Demonstration · Bangladesh Law Enforcement Context
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white text-balance leading-[1.12]">
              Intelligent, Secure, and Accountable Law Enforcement Support
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Jurivexora is a human-centred decision-support architecture combining least-privilege access control, cryptographic SHA-256 chain of custody, bilingual Bangla/English AI assistance, and mandatory human verification.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={user ? '/dashboard' : '/login'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-900 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <span>{user ? 'Enter Operations Workspace' : 'Sign In with Demo Roles'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/public-report"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>Public Incident Reporting Portal</span>
              </Link>
            </div>
          </div>

          {/* 4-column summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            <Card>
              <CardContent className="space-y-2">
                <Lock className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <h2 className="text-sm font-semibold">8-Role Least Privilege</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Server-enforced RBAC with MFA, session revocation, and audited break-glass access.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <FileCheck2 className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <h2 className="text-sm font-semibold">SHA-256 Chain of Custody</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Immutable custody ledger, original file preservation, and automated quarantine alerts.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <Sparkles className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <h2 className="text-sm font-semibold">Bilingual Bangla & English AI</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  OCR, grounded summaries, translation, speech-to-text, entity extraction, and semantic search.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <Scale className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <h2 className="text-sm font-semibold">Human-Centred Safeguards</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Configurable 85% review threshold, source citations, zero guilt inference, and AI kill-switch.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Capabilities & Governance */}
        <section id="capabilities" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-14">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold">Core Operational Modules</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Designed for transparent case administration across Dhaka, Chattogram, Sylhet, and Rajshahi synthetic demonstration units.
              </p>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 pt-2">
                <li>· Case & Incident Lifecycle with tabular timelines and task deadlines</li>
                <li>· Two-stage Smart Case Assignment with supervisor confirmation & escalation</li>
                <li>· Isolated Public Reporting Portal with non-confidential reference tracking</li>
                <li>· Tamper-evident hash-chained Audit Logs & Executive Analytics exports</li>
              </ul>
            </div>

            <div id="governance" className="space-y-3">
              <h2 className="font-display text-xl font-bold">Responsible AI Charter</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Aligned with INTERPOL, UNICRI, NIST AI RMF, and OWASP ASVS accountability principles.
              </p>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 pt-2">
                <li>· Never determines guilt, intent, credibility, detention, or sentencing</li>
                <li>· Never performs speaker profiling, biometric surveillance, or auto-merging</li>
                <li>· Marks every AI output as a Draft requiring authorized human verification</li>
                <li>· Supports instant model suspension, version rollback, and error reporting</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-900 dark:text-blue-400" />
          <span>Jurivexora · Academic Research & Development Demonstration · Not an Officially Deployed System</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/public-report" className="hover:underline">Public Portal</Link>
          <Link href="/help" className="hover:underline">Guidance & References</Link>
          <Link href="/login" className="hover:underline">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
