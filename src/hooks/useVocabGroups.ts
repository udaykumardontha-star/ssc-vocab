'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { VocabularyGroupWord, VocabularyGroup } from '@/types/vocabulary-group';
import {
  readGroupsCache,
  writeGroupsCache,
  isGroupsCacheStale,
  reconstructGroups,
  findGroupByWord,
  parseGroupsFromResponse,
  saveGroup as saveGroupToSheet,
  generateGroup,
} from '@/services/vocabularyGroup.service';

export function useVocabGroups(webAppUrl: string, geminiApiKey: string) {
  const [groupRows, setGroupRows] = useState<VocabularyGroupWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchingRef = useRef(false);

  // ─── Fetch group rows from Apps Script ──────────────────────────────────────
  const fetchGroups = useCallback(async (silent = false) => {
    if (!webAppUrl || fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const url = `/api/sheets?webAppUrl=${encodeURIComponent(webAppUrl)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch groups');
      const payload = await res.json();
      const rows = parseGroupsFromResponse(payload);
      setGroupRows(rows);
      writeGroupsCache(rows, webAppUrl);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load groups');
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [webAppUrl]);

  // ─── Cache-first init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!webAppUrl) return;
    const cache = readGroupsCache(webAppUrl);
    if (cache && cache.data.length > 0) {
      setGroupRows(cache.data);
      if (isGroupsCacheStale(cache)) {
        fetchGroups(true); // silent background refresh
      }
    } else {
      fetchGroups(false);
    }
  }, [webAppUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived state ───────────────────────────────────────────────────────────
  const groups: VocabularyGroup[] = reconstructGroups(groupRows);

  // ─── Find group for a specific word ─────────────────────────────────────────
  const getGroupForWord = useCallback(
    (word: string): VocabularyGroup | null => findGroupByWord(word, groupRows),
    [groupRows]
  );

  // ─── Generate + save a new group ─────────────────────────────────────────────
  const createGroup = useCallback(
    async (word: string, trigger: string): Promise<VocabularyGroup | null> => {
      if (!geminiApiKey || !webAppUrl) return null;

      const generated = await generateGroup(word, trigger, geminiApiKey);
      if (!generated) return null;

      // Optimistically update local state
      const now = new Date().toISOString();
      const newRows: VocabularyGroupWord[] = [
        ...generated.relatedWords.map((w) => ({
          groupName: generated.groupName,
          word: w,
          trigger: generated.trigger,
          wordType: 'RELATED' as const,
          sourceWord: generated.sourceWord,
          createdAt: now,
        })),
        ...generated.oppositeWords.map((w) => ({
          groupName: generated.groupName,
          word: w,
          trigger: generated.trigger,
          wordType: 'OPPOSITE' as const,
          sourceWord: generated.sourceWord,
          createdAt: now,
        })),
      ];

      setGroupRows((prev) => [...prev, ...newRows]);
      writeGroupsCache([...groupRows, ...newRows], webAppUrl);

      // Save to sheet in background (don't await — user already sees the result)
      saveGroupToSheet(generated, webAppUrl).catch((err) =>
        console.warn('Background group save failed:', err)
      );

      return generated;
    },
    [geminiApiKey, webAppUrl, groupRows]
  );

  return {
    groups,
    groupRows,
    isLoading,
    error,
    refresh: () => fetchGroups(false),
    getGroupForWord,
    createGroup,
    totalGroups: groups.length,
    totalGroupWords: groupRows.length,
  };
}
