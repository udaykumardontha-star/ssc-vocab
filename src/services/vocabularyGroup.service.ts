/**
 * vocabularyGroup.service.ts
 * All logic for generating, storing, and retrieving Vocabulary Groups.
 * Groups are stored flat in VOCAB_GROUPS sheet, reconstructed into VocabularyGroup objects in-memory.
 */

import {
  VocabularyGroup,
  VocabularyGroupWord,
  GeminiGroupResponse,
} from '@/types/vocabulary-group';

// ─── LocalStorage Cache ───────────────────────────────────────────────────────

const GROUPS_CACHE_KEY = 'ssc_vocab_groups_cache';
const GROUPS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface GroupsCache {
  data: VocabularyGroupWord[];
  fetchedAt: number;
  webAppUrl: string;
}

export function readGroupsCache(webAppUrl: string): GroupsCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GROUPS_CACHE_KEY);
    if (!raw) return null;
    const parsed: GroupsCache = JSON.parse(raw);
    if (parsed.webAppUrl !== webAppUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGroupsCache(data: VocabularyGroupWord[], webAppUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: GroupsCache = { data, fetchedAt: Date.now(), webAppUrl };
    localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore QuotaExceededError
  }
}

export function invalidateGroupsCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GROUPS_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isGroupsCacheStale(cache: GroupsCache): boolean {
  return Date.now() - cache.fetchedAt > GROUPS_CACHE_TTL_MS;
}

// ─── Reconstruct Groups from Flat Rows ────────────────────────────────────────

/**
 * Convert flat VocabularyGroupWord[] rows into grouped VocabularyGroup[] objects.
 * All rows with the same groupName are merged into one group.
 */
export function reconstructGroups(rows: VocabularyGroupWord[]): VocabularyGroup[] {
  const map = new Map<string, VocabularyGroup>();

  for (const row of rows) {
    const key = row.groupName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        groupName: row.groupName,
        trigger: row.trigger,
        sourceWord: row.sourceWord,
        relatedWords: [],
        oppositeWords: [],
        createdAt: row.createdAt,
      });
    }
    const group = map.get(key)!;
    if (row.wordType === 'RELATED') {
      if (!group.relatedWords.includes(row.word)) {
        group.relatedWords.push(row.word);
      }
    } else {
      if (!group.oppositeWords.includes(row.word)) {
        group.oppositeWords.push(row.word);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Find a group that contains a specific word (either as RELATED or OPPOSITE).
 * Used for auto-group discovery — if "Auxiliary" was stored as part of "Supporting Words",
 * searching "Auxiliary" returns the same group.
 */
export function findGroupByWord(
  word: string,
  rows: VocabularyGroupWord[]
): VocabularyGroup | null {
  const normalised = word.toLowerCase().trim();
  const match = rows.find((r) => r.word.toLowerCase().trim() === normalised);
  if (!match) return null;

  // Reconstruct the full group from all rows with this groupName
  const groupRows = rows.filter(
    (r) => r.groupName.toLowerCase() === match.groupName.toLowerCase()
  );
  const groups = reconstructGroups(groupRows);
  return groups[0] ?? null;
}

// ─── Parse Groups from Apps Script Combined Response ─────────────────────────

/**
 * Parse VOCAB_GROUPS rows from the combined Apps Script GET response.
 * Expected format: { VOCAB_GROUPS: [[groupName, word, trigger, wordType, sourceWord, createdAt], ...] }
 */
export function parseGroupsFromResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
): VocabularyGroupWord[] {
  const rawRows: string[][] =
    payload['VOCAB_GROUPS'] ??
    payload['vocab_groups'] ??
    [];

  const results: VocabularyGroupWord[] = [];

  for (const row of rawRows) {
    const groupName = String(row[0] ?? '').trim();
    const word = String(row[1] ?? '').trim();
    const trigger = String(row[2] ?? '').trim();
    const wordType = String(row[3] ?? '').trim().toUpperCase();
    const sourceWord = String(row[4] ?? '').trim();
    const createdAt = String(row[5] ?? '').trim();

    // Skip header rows and empty rows
    if (!groupName || !word || groupName.toLowerCase() === 'groupname') continue;
    if (wordType !== 'RELATED' && wordType !== 'OPPOSITE') continue;

    results.push({
      groupName,
      word,
      trigger,
      wordType: wordType as 'RELATED' | 'OPPOSITE',
      sourceWord,
      createdAt: createdAt || new Date().toISOString(),
    });
  }

  return results;
}

// ─── Save Group to Apps Script ────────────────────────────────────────────────

/**
 * Save a VocabularyGroup to the VOCAB_GROUPS sheet via the Next.js API route.
 */
export async function saveGroup(
  group: VocabularyGroup,
  webAppUrl: string
): Promise<void> {
  const now = new Date().toISOString();

  const rows: string[][] = [
    ...group.relatedWords.map((word) => [
      group.groupName,
      word,
      group.trigger,
      'RELATED',
      group.sourceWord,
      now,
    ]),
    ...group.oppositeWords.map((word) => [
      group.groupName,
      word,
      group.trigger,
      'OPPOSITE',
      group.sourceWord,
      now,
    ]),
  ];

  const response = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webAppUrl,
      sheet: 'VOCAB_GROUPS',
      rows,
      action: 'saveGroup',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || 'Failed to save group to Google Sheets');
  }

  invalidateGroupsCache();
}

// ─── Generate Group via Gemini ────────────────────────────────────────────────

const GROUP_PROMPT = (word: string, trigger: string) => `You are an English vocabulary expert specializing in SSC (Staff Selection Commission) examinations.

Word: ${word}
Meaning/Trigger: ${trigger}

Create a vocabulary group for this word. Requirements:
- Return words commonly seen in SSC exams and standard English usage.
- Prefer well-known vocabulary over obscure academic words.
- Quality over quantity — only include genuinely useful words.
- Group name should be 2-4 words capturing the shared theme.
- Trigger should be 1-3 words — the core shared meaning.
- Include the original word "${word}" in relatedWords.

Return ONLY valid JSON with no markdown, no code fences, no extra text:

{
  "groupName": "Supporting Words",
  "trigger": "Supporting",
  "relatedWords": ["Ancillary", "Auxiliary", "Supplementary"],
  "oppositeWords": ["Primary", "Essential", "Main"]
}`;

/**
 * Call Gemini to generate a vocabulary group for the given VOCAB word.
 * Returns null if generation fails (caller should handle gracefully).
 */
export async function generateGroup(
  word: string,
  trigger: string,
  apiKey: string
): Promise<VocabularyGroup | null> {
  const GEMINI_GROUP_MODEL = 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_GROUP_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: GROUP_PROMPT(word, trigger) }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: GeminiGroupResponse;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('Gemini group response was not valid JSON:', rawText);
    return null;
  }

  if (!parsed.groupName || !parsed.relatedWords?.length) return null;

  // Ensure source word is in relatedWords
  const relatedLower = parsed.relatedWords.map((w) => w.toLowerCase());
  if (!relatedLower.includes(word.toLowerCase())) {
    parsed.relatedWords.unshift(word);
  }

  return {
    groupName: parsed.groupName,
    trigger: parsed.trigger || trigger,
    sourceWord: word,
    relatedWords: parsed.relatedWords.filter(Boolean),
    oppositeWords: (parsed.oppositeWords ?? []).filter(Boolean),
    createdAt: new Date().toISOString(),
  };
}

// ─── Search Groups ────────────────────────────────────────────────────────────

/**
 * Filter groups by query — matches groupName, trigger, or any word in the group.
 */
export function searchGroups(
  groups: VocabularyGroup[],
  query: string
): VocabularyGroup[] {
  if (!query.trim()) return groups;
  const q = query.toLowerCase().trim();
  return groups.filter(
    (g) =>
      g.groupName.toLowerCase().includes(q) ||
      g.trigger.toLowerCase().includes(q) ||
      g.sourceWord.toLowerCase().includes(q) ||
      g.relatedWords.some((w) => w.toLowerCase().includes(q)) ||
      g.oppositeWords.some((w) => w.toLowerCase().includes(q))
  );
}
