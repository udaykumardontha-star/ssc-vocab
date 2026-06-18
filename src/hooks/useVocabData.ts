'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { VocabEntry, DashboardStats, Category } from '@/types';
import {
  fetchAllEntries,
  readCache,
  writeCache,
  isCacheStale,
} from '@/services/googleSheets.service';

const HOOK_TTL_MS = 5 * 60 * 1000; // 5 minutes — don't re-fetch if hook was recently refreshed

export function useVocabData(webAppUrl: string) {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Track in-flight fetch so we don't fire duplicate requests
  const fetchingRef = useRef(false);

  // ─── Cache-first initialization ──────────────────────────────────────────
  // Runs once per hook mount (each page navigation creates a new hook instance).
  // Priority order:
  //   1. Read localStorage cache → display immediately (zero network wait)
  //   2. If cache is stale (> 5 min) → silent background refresh
  //   3. If no cache at all → show loading spinner + fetch
  useEffect(() => {
    if (!webAppUrl) return;

    const cache = readCache(webAppUrl);

    if (cache && cache.data.length > 0) {
      // ✅ Cache hit — show data instantly (< 5ms)
      setEntries(cache.data);
      setLastFetched(new Date(cache.fetchedAt));

      if (isCacheStale(cache)) {
        // Cache exists but stale → silent background refresh (no loading spinner)
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        fetchAllEntries(webAppUrl)
          .then((data) => {
            setEntries(data);
            writeCache(data, webAppUrl);
            setLastFetched(new Date());
          })
          .catch(() => {
            // Silent — user already sees stale data, don't show error
          })
          .finally(() => {
            fetchingRef.current = false;
          });
      }
      // Cache is fresh → do nothing. Navigation is instant.
    } else {
      // ❌ No cache — first visit or after invalidation
      // Show loading spinner and fetch
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setIsLoading(true);
      setError(null);
      fetchAllEntries(webAppUrl)
        .then((data) => {
          setEntries(data);
          writeCache(data, webAppUrl);
          setLastFetched(new Date());
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load entries');
        })
        .finally(() => {
          setIsLoading(false);
          fetchingRef.current = false;
        });
    }
  }, [webAppUrl]); // Only re-run if webAppUrl changes (e.g. user updates settings)

  // ─── Manual refresh (user-triggered, always fetches, always shows loading) ─
  const refresh = useCallback(async () => {
    if (!webAppUrl || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllEntries(webAppUrl);
      setEntries(data);
      writeCache(data, webAppUrl);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [webAppUrl]);

  // ─── Dashboard Stats ──────────────────────────────────────────────────────
  // CreatedAt used internally for time-based stats, never displayed.
  const stats: DashboardStats = (() => {
    const totalOWS = entries.filter((e) => e.category === 'OWS').length;
    const totalVocab = entries.filter((e) => e.category === 'VOCAB').length;
    const totalIdioms = entries.filter((e) => e.category === 'IDIOM').length;
    const totalUnique = entries.length;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const todayAdded = entries.filter((e) => e.createdAt && e.createdAt >= todayStart).length;
    const weekAdded = entries.filter((e) => e.createdAt && e.createdAt >= weekStart).length;

    return { totalOWS, totalVocab, totalIdioms, totalUnique, todayAdded, weekAdded, totalGroups: 0, totalGroupWords: 0 };
  })();

  const getByCategory = (category: Category) =>
    entries.filter((e) => e.category === category);

  // Search across all 3 sheets — never returns CreatedAt
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
