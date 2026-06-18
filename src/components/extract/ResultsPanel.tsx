'use client';

import { VocabEntry, Category } from '@/types';
import { Copy, CheckCheck, BookMarked, BookOpen, MessageSquareQuote } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ResultsPanelProps {
  entries: VocabEntry[];
  isLoading?: boolean;
  saveResult?: { added: number; skipped: number } | null;
}

const categoryConfig: Record<Category, {
  label: string;
  icon: React.ElementType;
  headerColor: string;
  wordColor: string;
  triggerColor: string;
  badge: string;
}> = {
  OWS: {
    label: 'ONE WORD SUBSTITUTIONS',
    icon: BookMarked,
    headerColor: 'text-violet-400 border-violet-500/30',
    wordColor: 'text-violet-200 font-semibold',
    triggerColor: 'text-violet-400/80',
    badge: 'bg-violet-600/20 text-violet-300 border-violet-500/30',
  },
  VOCAB: {
    label: 'VOCABULARY',
    icon: BookOpen,
    headerColor: 'text-emerald-400 border-emerald-500/30',
    wordColor: 'text-emerald-200 font-semibold',
    triggerColor: 'text-emerald-400/80',
    badge: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
  },
  IDIOM: {
    label: 'IDIOMS & PHRASES',
    icon: MessageSquareQuote,
    headerColor: 'text-amber-400 border-amber-500/30',
    wordColor: 'text-amber-200 font-semibold',
    triggerColor: 'text-amber-400/80',
    badge: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
  },
};

function EntrySection({ category, entries }: { category: Category; entries: VocabEntry[] }) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in-up">
      <div className={cn('flex items-center gap-2 pb-2 border-b', config.headerColor)}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-bold tracking-widest uppercase">{config.label}</span>
        <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full border', config.badge)}>
          {entries.length}
        </span>
      </div>
      <div className="space-y-1 pl-1">
        {entries.map((entry, i) => (
          <div
            key={`${entry.word}-${i}`}
            className="flex items-baseline gap-3 py-1 group"
          >
            {category === 'IDIOM' ? (
              <>
                <span className={cn('text-sm', config.wordColor)}>{entry.word}</span>
                <span className="text-muted-foreground text-sm">:</span>
                <span className={cn('text-sm', config.triggerColor)}>{entry.trigger}</span>
              </>
            ) : (
              <>
                <span className={cn('text-sm min-w-[140px]', config.wordColor)}>{entry.word}</span>
                <span className={cn('text-sm', config.triggerColor)}>{entry.trigger}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildCopyText(entries: VocabEntry[]): string {
  const sections: string[] = [];

  const ows = entries.filter((e) => e.category === 'OWS');
  const vocab = entries.filter((e) => e.category === 'VOCAB');
  const idioms = entries.filter((e) => e.category === 'IDIOM');

  if (ows.length > 0) {
    sections.push('OWS\n' + ows.map((e) => `${e.word}  ${e.trigger}`).join('\n'));
  }
  if (vocab.length > 0) {
    sections.push('VOCAB\n' + vocab.map((e) => `${e.word}  ${e.trigger}`).join('\n'));
  }
  if (idioms.length > 0) {
    sections.push('IDIOMS\n' + idioms.map((e) => `${e.word} : ${e.trigger}`).join('\n'));
  }

  return sections.join('\n\n');
}

export function ResultsPanel({ entries, isLoading, saveResult }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = buildCopyText(entries);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const owsEntries = entries.filter((e) => e.category === 'OWS');
  const vocabEntries = entries.filter((e) => e.category === 'VOCAB');
  const idiomEntries = entries.filter((e) => e.category === 'IDIOM');

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Processing with Gemini AI...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center min-h-[200px]">
        <div className="text-center text-muted-foreground">
          <BookMarked className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Results will appear here after extraction</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Extraction Results</span>
          <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-300">
            {entries.length} entries
          </Badge>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
        >
          {copied ? (
            <>
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy Results
            </>
          )}
        </button>
      </div>

      {/* Save result banner */}
      {saveResult && (
        <div className={cn(
          'px-5 py-2.5 text-xs font-medium border-b border-border flex items-center gap-2',
          saveResult.added > 0 ? 'bg-emerald-600/10 text-emerald-300' : 'bg-amber-600/10 text-amber-300'
        )}>
          {saveResult.added > 0 ? '✓' : '⚠'}
          {saveResult.added > 0
            ? `${saveResult.added} new ${saveResult.added === 1 ? 'entry' : 'entries'} saved to Google Sheets`
            : 'No new entries'}
          {saveResult.skipped > 0 && (
            <span className="text-muted-foreground ml-1">
              · {saveResult.skipped} duplicate{saveResult.skipped > 1 ? 's' : ''} skipped
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-5 space-y-6 font-mono text-sm">
        <EntrySection category="OWS" entries={owsEntries} />
        <EntrySection category="VOCAB" entries={vocabEntries} />
        <EntrySection category="IDIOM" entries={idiomEntries} />
      </div>
    </div>
  );
}
