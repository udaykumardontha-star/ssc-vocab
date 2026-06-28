'use client';

import { useState, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useVocabData } from '@/hooks/useVocabData';
import { useVocabGroups } from '@/hooks/useVocabGroups';
import { Category, VocabEntry } from '@/types';
import { VocabularyGroup } from '@/types/vocabulary-group';
import { Search, RefreshCw, Filter, Layers, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { VocabularyGroupDialog } from '@/components/groups/VocabularyGroupDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { extractFromText, parseGeminiOutput } from '@/services/gemini.service';
import { saveUniqueEntries } from '@/services/googleSheets.service';

type CategoryFilter = 'all' | Category;

const categoryFilters: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'OWS', label: 'OWS' },
  { value: 'VOCAB', label: 'Vocabulary' },
  { value: 'IDIOM', label: 'Idioms' },
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
  const { settings } = useSettings();
  const { entries, isLoading, error, refresh } = useVocabData(settings.webAppUrl);
  const { getGroupForWord, createGroup } = useVocabGroups(
    settings.webAppUrl,
    settings.geminiApiKey
  );

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [isExtracting, setIsExtracting] = useState(false);
  const extractingRef = useRef(false);

  // ── Vocabulary Group Dialog state ──────────────────────────────────────────
  const [dialogEntry, setDialogEntry] = useState<VocabEntry | null>(null);
  const [dialogGroup, setDialogGroup] = useState<VocabularyGroup | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();
    return entries.filter((e) => {
      const matchQuery =
        !q || e.word.toLowerCase().includes(q) || e.trigger.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      return matchQuery && matchCat;
    });
  }, [entries, deferredQuery, categoryFilter]);

  const displayedResults = useMemo(() => filtered.slice(0, 100), [filtered]);

  // ── Open vocabulary group dialog ───────────────────────────────────────────
  const handleViewGroup = useCallback(async (entry: VocabEntry) => {
    if (!settings.geminiApiKey) {
      toast.error('Gemini API key not configured. Go to Settings.');
      return;
    }

    setDialogEntry(entry);
    setDialogGroup(null);
    setDialogError(null);

    // Check cache first
    const cached = getGroupForWord(entry.word);
    if (cached) {
      setDialogGroup(cached);
      return;
    }

    // Generate via Gemini
    setDialogLoading(true);
    try {
      const generated = await createGroup(entry.word, entry.trigger);
      if (generated) {
        setDialogGroup(generated);
      } else {
        setDialogError('Could not generate a vocabulary group. Please try again.');
      }
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Failed to generate group');
    } finally {
      setDialogLoading(false);
    }
  }, [settings.geminiApiKey, getGroupForWord, createGroup]);

  const handleCloseDialog = useCallback(() => {
    setDialogEntry(null);
    setDialogGroup(null);
    setDialogError(null);
    setDialogLoading(false);
  }, []);

  // ── Quick Extract from search ─────────────────────────────────────────────
  const handleQuickExtract = useCallback(async () => {
    if (!settings.geminiApiKey || !settings.webAppUrl || extractingRef.current) return;
    const searchTerm = query.trim();
    if (!searchTerm) return;

    extractingRef.current = true;
    setIsExtracting(true);
    toast.info(`Extracting "${searchTerm}"...`, { duration: 2000 });

    try {
      const raw = await extractFromText(searchTerm, 'auto', settings.geminiApiKey);
      const parsed = parseGeminiOutput(raw);

      if (parsed.length === 0) {
        toast.warning(`No vocabulary found for "${searchTerm}"`);
        return;
      }

      const result = await saveUniqueEntries(settings.webAppUrl, parsed);
      if (result.added > 0) {
        toast.success(`Added ${result.added} entr${result.added === 1 ? 'y' : 'ies'} for "${searchTerm}"`);
        refresh();
      } else {
        toast.info(`"${searchTerm}" already exists in your database`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
      extractingRef.current = false;
    }
  }, [query, settings.geminiApiKey, settings.webAppUrl, refresh]);

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
          className={cn('pl-10 h-11 bg-card border-border text-sm', query ? 'pr-24' : 'pr-4')}
          autoFocus
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {query && settings.geminiApiKey && settings.webAppUrl && (
            <button
              onClick={handleQuickExtract}
              disabled={isExtracting}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
                'bg-violet-600/25 border border-violet-500/40 text-violet-300',
                'hover:bg-violet-600/40 hover:border-violet-500/60 hover:text-violet-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={`Extract "${query}" using AI`}
            >
              {isExtracting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Extract
            </button>
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
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
            {categoryFilter === 'VOCAB' && (
              <p className="text-xs text-emerald-400/70 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Click View Group on any word
              </p>
            )}
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
                {displayedResults.map((entry, i) => (
                  <div
                    key={`${entry.category}-${entry.word}-${i}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 px-3 sm:px-5 py-3 sm:py-3.5 hover:bg-accent/50 transition-colors group"
                  >
                    {/* Badge + word */}
                    <div className="flex items-center gap-2 sm:contents">
                      <span className={cn(
                        'text-xs font-mono font-bold px-2 py-0.5 rounded border shrink-0',
                        badgeStyle[entry.category]
                      )}>
                        {entry.category}
                      </span>
                      <span className="text-sm font-semibold text-foreground sm:min-w-[140px] truncate">
                        {highlightMatch(entry.word, query)}
                      </span>
                    </div>

                    {/* Trigger */}
                    <span className="text-sm text-muted-foreground pl-1 sm:pl-0 flex-1 truncate">
                      {entry.category === 'IDIOM' && <span className="text-muted-foreground mr-1 hidden sm:inline">:</span>}
                      {highlightMatch(entry.trigger, query)}
                    </span>

                    {/* View Group button — VOCAB only */}
                    {entry.category === 'VOCAB' && (
                      <button
                        onClick={() => handleViewGroup(entry)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0',
                          'border-emerald-500/30 bg-emerald-600/8 text-emerald-400',
                          'hover:bg-emerald-600/20 hover:border-emerald-500/50 hover:text-emerald-300',
                          'opacity-0 group-hover:opacity-100 sm:opacity-100'
                        )}
                        title="View vocabulary group"
                      >
                        <Layers className="w-3 h-3" />
                        <span className="hidden sm:inline">Group</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {filtered.length > 100 && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Showing 100 of {filtered.length} results. Refine your search to see more.
            </p>
          )}
        </div>
      )}

      {/* Vocabulary Group Dialog */}
      {dialogEntry && (
        <VocabularyGroupDialog
          word={dialogEntry.word}
          trigger={dialogEntry.trigger}
          group={dialogGroup}
          isLoading={dialogLoading}
          error={dialogError}
          onClose={handleCloseDialog}
        />
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = escapeRegex(query);
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
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
