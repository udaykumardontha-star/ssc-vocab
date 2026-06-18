'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useVocabData } from '@/hooks/useVocabData';
import { Category } from '@/types';
import { Search, RefreshCw, Filter, BookMarked, BookOpen, MessageSquareQuote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CategoryFilter = 'all' | Category;

const categoryFilters: { value: CategoryFilter; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'default' },
  { value: 'OWS', label: 'OWS', color: 'violet' },
  { value: 'VOCAB', label: 'Vocabulary', color: 'emerald' },
  { value: 'IDIOM', label: 'Idioms', color: 'amber' },
];

const categoryStyle: Record<CategoryFilter, string> = {
  all: 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
  OWS: 'border-violet-500/50 bg-violet-600/15 text-violet-300',
  VOCAB: 'border-emerald-500/50 bg-emerald-600/15 text-emerald-300',
  IDIOM: 'border-amber-500/50 bg-amber-600/15 text-amber-300',
};

const badgeStyle: Record<Category, string> = {
  OWS: 'text-violet-300 bg-violet-600/15 border-violet-500/30',
  VOCAB: 'text-emerald-300 bg-emerald-600/15 border-emerald-500/30',
  IDIOM: 'text-amber-300 bg-amber-600/15 border-amber-500/30',
};

export default function SearchPage() {
  const { settings, isLoaded } = useSettings();
  const { entries, isLoading, error, refresh } = useVocabData(settings.webAppUrl);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    if (isLoaded && settings.webAppUrl) refresh();
  }, [isLoaded, settings.webAppUrl]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entries.filter((e) => {
      const matchQuery =
        !q || e.word.toLowerCase().includes(q) || e.trigger.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      return matchQuery && matchCat;
    });
  }, [entries, query, categoryFilter]);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search across {entries.length} entries by word or meaning
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by word or meaning... (e.g. 'Cynic', 'avoid topic')"
          className="pl-10 h-11 bg-card border-border text-sm"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {categoryFilters.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setCategoryFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
              categoryFilter === value
                ? categoryStyle[value]
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-600/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <div>
          {/* Result Count */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              {query
                ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${query}"`
                : `Showing ${filtered.length} of ${entries.length} entries`}
            </p>
          </div>

          {/* Result List */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {query ? `No entries found for "${query}"` : 'No entries yet. Go to Extract to add vocabulary.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="divide-y divide-border">
                {filtered.map((entry, i) => (
                  <div
                    key={`${entry.category}-${entry.word}-${i}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors animate-fade-in-up group"
                  >
                    <span className={cn(
                      'text-xs font-mono font-bold px-2 py-0.5 rounded border shrink-0',
                      badgeStyle[entry.category]
                    )}>
                      {entry.category}
                    </span>
                    <span className="text-sm font-semibold text-foreground min-w-[140px]">
                      {highlightMatch(entry.word, query)}
                    </span>
                    {entry.category === 'IDIOM' ? (
                      <span className="text-muted-foreground text-sm mr-1">:</span>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {highlightMatch(entry.trigger, query)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-violet-500/30 text-violet-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
