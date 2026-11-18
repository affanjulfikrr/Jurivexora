'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Shield, ArrowLeft } from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, AlertBox } from '@/components/ui/primitives';

const EXTERNAL_REFERENCES = [
  {
    title: 'INTERPOL AI Toolkit',
    url: 'https://www.interpol.int/en/How-we-work/Innovation/Artificial-Intelligence-Toolkit',
    description: 'International guidance on responsible AI principles, accountability, and operational safeguards in policing.',
  },
  {
    title: 'UNICRI Responsible AI Toolkit',
    url: 'https://aitoolkit.unicri.it/',
    description: 'United Nations Interregional Crime and Justice Research Institute toolkit for ethical AI lifecycle governance.',
  },
  {
    title: 'NIST AI Risk Management Framework',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    description: 'Structured Govern, Map, Measure, and Manage practices for trustworthy AI systems and threshold calibration.',
  },
  {
    title: 'OWASP Application Security Verification Standard (ASVS)',
    url: 'https://owasp.org/www-project-application-security-verification-standard/',
    description: 'Web application security verification benchmarks covering authentication, RBAC, session management, and auditability.',
  },
  {
    title: 'Bangladesh Police',
    url: 'https://www.police.gov.bd/',
    description: 'Official institutional reference for organizational structure and public service context in Bangladesh.',
  },
  {
    title: 'Laws of Bangladesh (Ministry of Law)',
    url: 'https://bdlaws.minlaw.gov.bd/',
    description: 'Statutory reference repository including Evidence Act, Penal Code, and procedural compliance frameworks.',
  },
];

function HelpContent() {
  return (
    <div className="space-y-6">
      <AlertBox tone="info" title="Academic Research & Responsible AI Safeguards">
        Jurivexora is strictly a human-centred decision-support demonstration using synthetic Bangladesh data. It never determines guilt, recommends arrest, detention, sentencing, or use-of-force, never performs speaker profiling or biometric surveillance, and never automatically merges case records or modifies original evidence.
      </AlertBox>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXTERNAL_REFERENCES.map((ref) => (
          <Card key={ref.url}>
            <CardHeader>
              <CardTitle className="text-sm">{ref.title}</CardTitle>
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline shrink-0"
              >
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <p className="leading-relaxed">{ref.description}</p>
              <div className="font-mono text-[11px] text-slate-400 break-all">{ref.url}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Quick Demonstration Guide</CardTitle></CardHeader>
        <CardContent className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <p>1. <strong>Least-Privilege Verification:</strong> Sign in as Super Admin (<span className="font-mono">superadmin@jurivexora.bd.demo</span>) and observe that Confidential case <span className="font-mono">JRX-DHK-2026-0043</span> is protected until Emergency Break-Glass MFA access is justified and granted.</p>
          <p>2. <strong>Evidence Integrity & Quarantine:</strong> Sign in as Evidence Custodian (<span className="font-mono">custodian@jurivexora.bd.demo</span>) and verify SHA-256 hashes or trigger a tamper mismatch test to observe automatic <span className="font-mono">QUARANTINED</span> status and supervisor alerts.</p>
          <p>3. <strong>AI Assistance & Human Review:</strong> Run Bangla/English OCR, Translation, or Duplicate Detection in AI Assistance, then review the 85% threshold priority tiers in AI Recommendation Review.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HelpPage() {
  const { user } = useApp();

  if (user && user.mfaVerified) {
    return (
      <AppShell title="Help, Documentation & Guidance References" breadcrumb={['Guidance', 'Help & Documentation']}>
        <HelpContent />
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between">
        <Link href="/" className="font-display text-lg font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          <span>Jurivexora</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900 dark:text-blue-400 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>
      <main className="max-w-5xl w-full mx-auto px-6 py-10 space-y-6">
        <h1 className="font-display text-2xl font-bold">Guidance & Institutional References</h1>
        <HelpContent />
      </main>
    </div>
  );
}
