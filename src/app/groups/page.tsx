'use client';

import { useState, useMemo } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useVocabGroups } from '@/hooks/useVocabGroups';
import { VocabularyGroup } from '@/types/vocabulary-group';
import { VocabularyGroupDialog } from '@/components/groups/VocabularyGroupDialog';
import {
  Layers,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Layers2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchGroups } from '@/services/vocabularyGroup.service';

export default function GroupsPage() {
  const { settings } = useSettings();
  const { groups, totalGroups, totalGroupWords, isLoading, error, refresh } = useVocabGroups(
    settings.webAppUrl,
    settings.geminiApiKey
  );

  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<VocabularyGroup | null>(null);

  const filtered = useMemo(
    () => searchGroups(groups, query),
    [groups, query]
  );

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vocabulary Groups</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Words grouped by theme — related and opposite words together
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-600/8 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Total Groups</p>
          </div>
          <p className="text-3xl font-bold tabular-nums text-emerald-300">{totalGroups}</p>
          <p className="text-xs text-muted-foreground mt-1">vocabulary groups</p>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-600/8 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Total Words</p>
          </div>
          <p className="text-3xl font-bold tabular-nums text-violet-300">{totalGroupWords}</p>
          <p className="text-xs text-muted-foreground mt-1">related + opposite words</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups by name, word, or theme..."
          className="pl-10 h-11 bg-card border-border text-sm"
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

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-600/10 p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No groups found for &quot;{query}&quot;</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {query
              ? `${filtered.length} group${filtered.length !== 1 ? 's' : ''} matching "${query}"`
              : `${filtered.length} group${filtered.length !== 1 ? 's' : ''}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((group) => (
              <GroupCard
                key={group.groupName}
                group={group}
                onOpen={() => setSelectedGroup(group)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group Dialog */}
      {selectedGroup && (
        <VocabularyGroupDialog
          word={selectedGroup.sourceWord}
          trigger={selectedGroup.trigger}
          group={selectedGroup}
          isLoading={false}
          error={null}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
}

// ─── Group Card ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onOpen,
}: {
  group: VocabularyGroup;
  onOpen: () => void;
}) {
  const previewRelated = group.relatedWords.slice(0, 4);
  const previewOpposite = group.oppositeWords.slice(0, 3);
  const hasMore =
    group.relatedWords.length > 4 || group.oppositeWords.length > 3;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-emerald-500/30 transition-all hover:bg-accent/20 group">
      {/* Card Header */}
      <div>
        <h3 className="text-sm font-bold text-foreground group-hover:text-emerald-300 transition-colors">
          {group.groupName}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Theme: <span className="text-foreground/70">{group.trigger}</span>
        </p>
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{group.relatedWords.length} related</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-rose-400">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{group.oppositeWords.length} opposite</span>
        </div>
      </div>

      {/* Preview chips */}
      <div className="flex flex-wrap gap-1.5">
        {previewRelated.map((w) => (
          <span
            key={w}
            className="px-2 py-0.5 rounded-md text-xs bg-emerald-600/10 border border-emerald-500/20 text-emerald-300"
          >
            {w}
          </span>
        ))}
        {previewOpposite.map((w) => (
          <span
            key={w}
            className="px-2 py-0.5 rounded-md text-xs bg-rose-600/10 border border-rose-500/20 text-rose-300"
          >
            {w}
          </span>
        ))}
        {hasMore && (
          <span className="px-2 py-0.5 rounded-md text-xs bg-muted/40 text-muted-foreground border border-border">
            +{group.relatedWords.length + group.oppositeWords.length - previewRelated.length - previewOpposite.length} more
          </span>
        )}
      </div>

      {/* Open button */}
      <button
        onClick={onOpen}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-all',
          'border-emerald-500/30 bg-emerald-600/8 text-emerald-400',
          'hover:bg-emerald-600/20 hover:border-emerald-500/50 hover:text-emerald-300'
        )}
      >
        <Layers className="w-3.5 h-3.5" />
        Open Group
      </button>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
      <div className="flex items-center justify-center">
        <div className="p-4 rounded-2xl bg-emerald-600/10">
          <Layers className="w-10 h-10 text-emerald-400/50" />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No vocabulary groups yet</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
          Go to <strong>Search</strong>, find any vocabulary word, and click{' '}
          <strong>Group</strong> to generate your first group using Gemini AI.
        </p>
      </div>
    </div>
  );
}
