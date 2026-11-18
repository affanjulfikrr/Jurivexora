import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Public_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/providers/AppProvider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plus-jakarta',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Jurivexora — Intelligent, Secure & Accountable Law Enforcement Support System',
  description:
    'An Intelligent, Secure and Human-Centred Law Enforcement Support System (Academic R&D Demonstration).',
  openGraph: {
    title: 'Jurivexora — Human-Centred Law Enforcement Support System',
    description:
      'Academic R&D platform demonstrating RBAC, cryptographic chain of custody, and responsible AI assistance.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jurivexora',
    description: 'Intelligent. Secure. Accountable.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased"
        suppressHydrationWarning
      >
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
