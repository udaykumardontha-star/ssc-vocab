'use client';

import { useEffect } from 'react';
import { VocabularyGroup } from '@/types/vocabulary-group';
import { X, Layers, TrendingUp, TrendingDown, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface VocabularyGroupDialogProps {
  word: string;
  trigger: string;
  group: VocabularyGroup | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export function VocabularyGroupDialog({
  word,
  trigger,
  group,
  isLoading,
  error,
  onClose,
}: VocabularyGroupDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Vocabulary Group for ${word}`}
        className={cn(
          'fixed z-50 inset-x-4 top-1/2 -translate-y-1/2',
          'sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2',
          'w-auto sm:w-full sm:max-w-lg',
          'bg-[oklch(0.12_0.025_270)] border border-border rounded-2xl shadow-2xl',
          'flex flex-col max-h-[85vh] overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/15 shrink-0">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Vocabulary Group
              </p>
              <h2 className="text-base font-bold text-foreground">
                {group?.groupName ?? word}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 mt-0.5"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Source word info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-600/8 border border-emerald-500/20">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Word</p>
              <p className="text-sm font-bold text-emerald-300 mt-0.5">{word}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Trigger</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{trigger}</p>
            </div>
            {group && (
              <>
                <div className="w-px h-8 bg-border" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Theme</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{group.trigger}</p>
                </div>
              </>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <p className="text-sm text-muted-foreground">Generating vocabulary group...</p>
              <p className="text-xs text-muted-foreground/60">This happens only once — the group is saved forever.</p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex items-start gap-3 p-3 rounded-xl border border-red-500/30 bg-red-600/10">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300">{error}</p>
                <p className="text-xs text-muted-foreground mt-1">Check your Gemini API key in Settings.</p>
              </div>
            </div>
          )}

          {/* Group content */}
          {group && !isLoading && (
            <>
              {/* Related Words */}
              {group.relatedWords.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Related Words
                    </p>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {group.relatedWords.length} words
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.relatedWords.map((w) => (
                      <span
                        key={w}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                          w.toLowerCase() === word.toLowerCase()
                            ? 'bg-emerald-600/25 border-emerald-500/50 text-emerald-200 font-semibold'
                            : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-600/20'
                        )}
                      >
                        {w}
                        {w.toLowerCase() === word.toLowerCase() && (
                          <span className="ml-1 text-xs opacity-60">★</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Opposite Words */}
              {group.oppositeWords.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                    <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      Opposite Words
                    </p>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {group.oppositeWords.length} words
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.oppositeWords.map((w) => (
                      <span
                        key={w}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-rose-600/10 border-rose-500/20 text-rose-300 hover:bg-rose-600/20 transition-colors"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {group && !isLoading && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-muted-foreground">
              {group.relatedWords.length + group.oppositeWords.length} words in group
            </p>
            <Link
              href="/groups"
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View all groups
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
