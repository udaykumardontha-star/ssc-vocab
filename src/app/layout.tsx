import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SSC Vocabulary Tracker',
  description:
    'AI-powered personal database to extract, store, search, revise, and export SSC vocabulary — OWS, Idioms & Phrases',
  keywords: ['SSC', 'vocabulary', 'one word substitution', 'idioms', 'exam preparation'],
  // PWA / Add to Home Screen
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SSC Vocab',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        {/*
          Layout structure:
          ┌─────────────────────────────────────┐
          │  Sidebar (hidden on <lg)            │
          │  ┌───────────────────────────────┐  │
          │  │  MobileNav top bar (<lg only) │  │
          │  │  main content                 │  │
          │  └───────────────────────────────┘  │
          └─────────────────────────────────────┘
        */}
        <div className="flex h-screen overflow-hidden">
          {/* Desktop sidebar — hidden below lg, unchanged at lg+ */}
          <Sidebar />

          {/* Right column: mobile top bar + scrollable content */}
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            {/* Mobile-only top bar + slide drawer (invisible on lg+) */}
            <MobileNav />

            {/* Main content area */}
            <main className="flex-1 overflow-y-auto">
              <div className="min-h-full p-4 sm:p-6 lg:p-8">{children}</div>
            </main>
          </div>
        </div>

        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
