'use client';

import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useVocabData } from '@/hooks/useVocabData';
import { DashboardStatsGrid } from '@/components/dashboard/StatCard';
import { AlertCircle, RefreshCw, Settings, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { settings, isLoaded } = useSettings();
  const { stats, entries, isLoading, error, refresh, lastFetched } = useVocabData(
    settings.webAppUrl
  );

  useEffect(() => {
    if (isLoaded && settings.webAppUrl) {
      refresh();
    }
  }, [isLoaded, settings.webAppUrl]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings.geminiApiKey || !settings.webAppUrl) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text">SSC Vocabulary Tracker</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered vocabulary management for SSC exam preparation
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-600/10 p-6 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300 mb-1">Setup Required</p>
            <p className="text-sm text-muted-foreground mb-4">
              Configure your Gemini API Key and Google Apps Script URL to get started.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-sm font-medium transition-colors border border-amber-500/30"
            >
              <Settings className="w-4 h-4" />
              Go to Settings
            </Link>
          </div>
        </div>

        {/* Feature overview */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'AI Extraction', desc: 'Gemini AI extracts OWS, vocabulary, and idioms from any text or screenshot', color: 'violet' },
            { title: 'Google Sheets', desc: 'Auto-saves to your Google Sheet with duplicate prevention', color: 'emerald' },
            { title: 'Export & Revise', desc: 'Export to CSV, Excel, PDF and revise all entries in SSC format', color: 'amber' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-4">
              <div className={cn(
                'text-sm font-semibold mb-1.5',
                f.color === 'violet' ? 'text-violet-300' : f.color === 'emerald' ? 'text-emerald-300' : 'text-amber-300'
              )}>
                {f.title}
              </div>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lastFetched
              ? `Last synced ${lastFetched.toLocaleTimeString()}`
              : 'Your SSC vocabulary overview'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-600/10 p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={refresh}
              className="text-xs text-red-400 underline mt-1 hover:text-red-300"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <DashboardStatsGrid stats={stats} />

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: '/extract', label: 'Extract New', desc: 'Paste text or upload screenshot', icon: Zap, color: 'violet' },
            { href: '/revision', label: 'Revise All', desc: 'Review in SSC format', icon: RefreshCw, color: 'emerald' },
            { href: '/search', label: 'Search', desc: 'Find any word or idiom', icon: Settings, color: 'blue' },
            { href: '/export', label: 'Export', desc: 'CSV, Excel, or PDF', icon: AlertCircle, color: 'amber' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-xl border border-border bg-card hover:bg-accent p-4 transition-all hover:scale-[1.02] group"
            >
              <p className={cn(
                'text-sm font-semibold mb-1 group-hover:text-foreground',
                action.color === 'violet' ? 'text-violet-300' :
                action.color === 'emerald' ? 'text-emerald-300' :
                action.color === 'blue' ? 'text-blue-300' : 'text-amber-300'
              )}>
                {action.label}
              </p>
              <p className="text-xs text-muted-foreground">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Entries */}
      {entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Entries
            </h2>
            <Link href="/revision" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {entries.slice(-10).reverse().map((entry, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors">
                  <span className={cn(
                    'text-xs font-mono font-bold px-2 py-0.5 rounded border',
                    entry.category === 'OWS'
                      ? 'text-violet-300 bg-violet-600/15 border-violet-500/30'
                      : entry.category === 'VOCAB'
                      ? 'text-emerald-300 bg-emerald-600/15 border-emerald-500/30'
                      : 'text-amber-300 bg-amber-600/15 border-amber-500/30'
                  )}>
                    {entry.category}
                  </span>
                  <span className="text-sm font-medium text-foreground min-w-[120px]">{entry.word}</span>
                  <span className="text-sm text-muted-foreground">{entry.trigger}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
