'use client';

import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useVocabData } from '@/hooks/useVocabData';
import { Category, VocabEntry } from '@/types';
import {
  BookMarked,
  BookOpen,
  MessageSquareQuote,
  RefreshCw,
  AlertCircle,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SectionProps {
  category: Category;
  entries: VocabEntry[];
}

const sectionConfig = {
  OWS: {
    title: 'ONE WORD SUBSTITUTIONS',
    icon: BookMarked,
    headerClass: 'text-violet-400 border-violet-500/30 bg-violet-600/5',
    wordClass: 'text-violet-100 font-semibold',
    triggerClass: 'text-violet-400/70',
  },
  VOCAB: {
    title: 'VOCABULARY',
    icon: BookOpen,
    headerClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-600/5',
    wordClass: 'text-emerald-100 font-semibold',
    triggerClass: 'text-emerald-400/70',
  },
  IDIOM: {
    title: 'IDIOMS & PHRASES',
    icon: MessageSquareQuote,
    headerClass: 'text-amber-400 border-amber-500/30 bg-amber-600/5',
    wordClass: 'text-amber-100 font-semibold',
    triggerClass: 'text-amber-400/70',
  },
} as const;

function RevisionSection({ category, entries }: SectionProps) {
  const config = sectionConfig[category];
  const Icon = config.icon;

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Section Header */}
      <div className={cn('flex items-center gap-3 px-6 py-4 border-b border-border', config.headerClass)}>
        <Icon className="w-5 h-5" />
        <h2 className="text-sm font-bold tracking-widest uppercase">{config.title}</h2>
        <span className="ml-auto text-xs font-mono opacity-60">{entries.length} entries</span>
      </div>

      {/* Entries */}
      <div className="divide-y divide-border/50">
        {entries.map((entry, i) => (
          <div
            key={`${entry.word}-${i}`}
            className="flex items-baseline px-6 py-3 hover:bg-accent/30 transition-colors"
          >
            {category === 'IDIOM' ? (
              <div className="flex items-baseline gap-2 font-mono text-sm w-full">
                <span className={cn('flex-1', config.wordClass)}>{entry.word}</span>
                <span className="text-muted-foreground shrink-0">:</span>
                <span className={cn('flex-1 text-right sm:text-left', config.triggerClass)}>{entry.trigger}</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-4 font-mono text-sm w-full">
                <span className={cn('w-48 shrink-0', config.wordClass)}>{entry.word}</span>
                <span className={config.triggerClass}>{entry.trigger}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RevisionPage() {
  const { settings, isLoaded } = useSettings();
  const { entries, isLoading, error, refresh } = useVocabData(settings.webAppUrl);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isLoaded && settings.webAppUrl) refresh();
  }, [isLoaded, settings.webAppUrl]);

  const owsEntries = entries.filter((e) => e.category === 'OWS');
  const vocabEntries = entries.filter((e) => e.category === 'VOCAB');
  const idiomEntries = entries.filter((e) => e.category === 'IDIOM');

  const handleCopyAll = () => {
    const lines: string[] = [];
    if (owsEntries.length > 0) {
      lines.push('OWS');
      owsEntries.forEach((e) => lines.push(`${e.word}  ${e.trigger}`));
      lines.push('');
    }
    if (vocabEntries.length > 0) {
      lines.push('VOCAB');
      vocabEntries.forEach((e) => lines.push(`${e.word}  ${e.trigger}`));
      lines.push('');
    }
    if (idiomEntries.length > 0) {
      lines.push('IDIOMS');
      idiomEntries.forEach((e) => lines.push(`${e.word} : ${e.trigger}`));
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revision</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All {entries.length} entries in SSC exam format
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            {copied ? (
              <><CheckCheck className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
            ) : (
              <><Copy className="w-4 h-4" />Copy All</>
            )}
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-600/10 p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No entries yet. Go to Extract to add vocabulary.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <RevisionSection category="OWS" entries={owsEntries} />
          <RevisionSection category="VOCAB" entries={vocabEntries} />
          <RevisionSection category="IDIOM" entries={idiomEntries} />
        </div>
      )}
    </div>
  );
}
