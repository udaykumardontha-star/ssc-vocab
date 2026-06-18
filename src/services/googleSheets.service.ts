import { VocabEntry, SaveResult, Category } from '@/types';

// ─── Category ↔ Sheet Name ────────────────────────────────────────────────────
const SHEET_MAP: Record<Category, string> = {
  OWS: 'OWS',
  VOCAB: 'VOCAB',
  IDIOM: 'IDIOMS',
};

// ─── LocalStorage Cache ───────────────────────────────────────────────────────
const CACHE_KEY = 'ssc_vocab_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface VocabCache {
  data: VocabEntry[];
  fetchedAt: number;
  webAppUrl: string; // invalidate if URL changes
}

export function readCache(webAppUrl: string): VocabCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: VocabCache = JSON.parse(raw);
    // Invalidate cache if it belongs to a different Apps Script URL
    if (parsed.webAppUrl !== webAppUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(data: VocabEntry[], webAppUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: VocabCache = { data, fetchedAt: Date.now(), webAppUrl };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignore QuotaExceededError etc.
  }
}

export function invalidateCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isCacheStale(cache: VocabCache): boolean {
  return Date.now() - cache.fetchedAt > CACHE_TTL_MS;
}

// ─── Parse a raw sheet row → VocabEntry ──────────────────────────────────────
function rowToEntry(row: string[], category: Category): VocabEntry | null {
  const word = String(row[0] ?? '').trim();
  const trigger = String(row[1] ?? '').trim();
  // CreatedAt: read from column Z (index 25) — new rows
  // Fallback to column C (index 2) — rows saved before the column Z fix
  const createdAt = String(row[25] ?? row[2] ?? '').trim();

  if (!word || !trigger) return null;
  // Skip header rows
  if (
    word.toLowerCase() === 'word' ||
    word.toLowerCase() === 'idiom' ||
    word.toLowerCase() === 'category'
  ) return null;

  return { category, word, trigger, createdAt: createdAt || new Date().toISOString() };
}

// ─── Parse the combined { OWS, VOCAB, IDIOMS } response ──────────────────────
function parseCombinedResponse(payload: Record<string, string[][]>): VocabEntry[] {
  const entries: VocabEntry[] = [];

  const categorySheetMap: [Category, string[]][] = [
    ['OWS',   ['OWS',   'ows']],
    ['VOCAB',  ['VOCAB', 'vocab']],
    ['IDIOM',  ['IDIOMS','idioms']],
  ];

  for (const [category, keys] of categorySheetMap) {
    // Accept either casing from Apps Script response
    const rows: string[][] = keys.reduce<string[][]>(
      (acc, k) => acc.length ? acc : (payload[k] ?? []),
      []
    );
    for (const row of rows) {
      const entry = rowToEntry(row as string[], category);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

// ─── Fetch ALL entries — single Apps Script request ───────────────────────────
// One round trip returns { OWS: [[...]], VOCAB: [[...]], IDIOMS: [[...]] }
// instead of 3 separate requests. Reduces latency from ~2.4s to ~1.8s and
// eliminates 2 extra Apps Script cold-start risks.
export async function fetchAllEntries(webAppUrl: string): Promise<VocabEntry[]> {
  if (!webAppUrl) throw new Error('Google Apps Script URL not configured. Please go to Settings.');

  // No ?sheet param → combined endpoint → all 3 sheets in one response
  const url = `/api/sheets?webAppUrl=${encodeURIComponent(webAppUrl)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Failed to fetch data: ${response.statusText}`);
  }

  const payload = await response.json();

  // Handle both combined { OWS: [], VOCAB: [], IDIOMS: [] }
  // and legacy flat array (fallback)
  if (Array.isArray(payload)) {
    // Legacy single-sheet response — shouldn't happen with new Apps Script but be safe
    return payload
      .map((row: string[]) => rowToEntry(row, 'OWS'))
      .filter((e): e is VocabEntry => e !== null);
  }

  return parseCombinedResponse(payload as Record<string, string[][]>);
}

// ─── Duplicate Check (per-sheet, case-insensitive) ────────────────────────────
export function filterDuplicates(
  newEntries: VocabEntry[],
  existing: VocabEntry[]
): { unique: VocabEntry[]; skipped: number } {
  const existingKeys = new Set(
    existing.map((e) => `${e.category}::${e.word.toLowerCase().trim()}`)
  );

  const unique: VocabEntry[] = [];
  let skipped = 0;

  for (const entry of newEntries) {
    const key = `${entry.category}::${entry.word.toLowerCase().trim()}`;
    if (existingKeys.has(key)) {
      skipped++;
    } else {
      unique.push(entry);
      existingKeys.add(key);
    }
  }

  return { unique, skipped };
}

// ─── Append Entries to Their Respective Sheets ────────────────────────────────
export async function appendEntries(
  webAppUrl: string,
  entries: VocabEntry[]
): Promise<void> {
  if (!webAppUrl) throw new Error('Google Apps Script URL not configured.');
  if (entries.length === 0) return;

  // Group by category → sheet
  const groups: Record<string, VocabEntry[]> = {};
  for (const entry of entries) {
    const sheetName = SHEET_MAP[entry.category];
    if (!groups[sheetName]) groups[sheetName] = [];
    groups[sheetName].push(entry);
  }

  await Promise.all(
    Object.entries(groups).map(async ([sheetName, sheetEntries]) => {
      const rows = sheetEntries.map((e) => [e.word, e.trigger, e.createdAt]);

      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl, sheet: sheetName, rows }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to save to ${sheetName} sheet`);
      }
    })
  );
}

// ─── Save with Duplicate Prevention ──────────────────────────────────────────
export async function saveUniqueEntries(
  webAppUrl: string,
  newEntries: VocabEntry[]
): Promise<SaveResult> {
  // Use cached existing entries for dedup (avoids extra Apps Script call)
  const cachedData = readCache(webAppUrl);
  const existing = cachedData?.data ?? await fetchAllEntries(webAppUrl).catch(() => []);

  const { unique, skipped } = filterDuplicates(newEntries, existing);

  if (unique.length > 0) {
    await appendEntries(webAppUrl, unique);
  }

  // Invalidate cache so next navigation fetches fresh data
  invalidateCache();

  return { added: unique.length, skipped, errors: 0 };
}
