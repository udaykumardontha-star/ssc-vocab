'use client';

import { useState, useCallback } from 'react';
import { VocabEntry, DashboardStats, Category } from '@/types';
import { fetchAllEntries } from '@/services/googleSheets.service';

export function useVocabData(webAppUrl: string) {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!webAppUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllEntries(webAppUrl);
      setEntries(data);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setIsLoading(false);
    }
  }, [webAppUrl]);

  // ─── Dashboard Stats (uses CreatedAt internally, never displayed) ──────────
  const stats: DashboardStats = (() => {
    const totalOWS = entries.filter((e) => e.category === 'OWS').length;
    const totalVocab = entries.filter((e) => e.category === 'VOCAB').length;
    const totalIdioms = entries.filter((e) => e.category === 'IDIOM').length;
    const totalUnique = entries.length;

    const now = new Date();
    // Today: from midnight local time
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    // This week: last 7 days
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const todayAdded = entries.filter(
      (e) => e.createdAt && e.createdAt >= todayStart
    ).length;
    const weekAdded = entries.filter(
      (e) => e.createdAt && e.createdAt >= weekStart
    ).length;

    return { totalOWS, totalVocab, totalIdioms, totalUnique, todayAdded, weekAdded };
  })();

  const getByCategory = (category: Category) =>
    entries.filter((e) => e.category === category);

  // ─── Search (across all 3 sheets, returns category label, never CreatedAt) ─
  const search = (query: string, categoryFilter?: Category | 'all') => {
    const q = query.toLowerCase().trim();
    return entries.filter((e) => {
      const matchesQuery =
        !q ||
        e.word.toLowerCase().includes(q) ||
        e.trigger.toLowerCase().includes(q);
      const matchesCategory =
        !categoryFilter || categoryFilter === 'all' || e.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  };

  return {
    entries,
    stats,
    isLoading,
    error,
    lastFetched,
    refresh,
    getByCategory,
    search,
  };
}
