import { VocabEntry, SaveResult, Category } from '@/types';

// ─── Category ↔ Sheet Name ────────────────────────────────────────────────────
// Three separate sheets inside the same Google Spreadsheet:
//   OWS   → "OWS"   sheet
//   VOCAB → "VOCAB" sheet
//   IDIOM → "IDIOMS" sheet
//
// Each sheet layout:
//   Col A : Word / Idiom   (visible)
//   Col B : Trigger        (visible)
//   Col C : CreatedAt      (hidden in sheet, internal use only)

const SHEET_MAP: Record<Category, string> = {
  OWS: 'OWS',
  VOCAB: 'VOCAB',
  IDIOM: 'IDIOMS',
};

// ─── Parse a raw sheet row → VocabEntry ──────────────────────────────────────
function rowToEntry(row: string[], category: Category): VocabEntry | null {
  const word = String(row[0] ?? '').trim();
  const trigger = String(row[1] ?? '').trim();
  const createdAt = String(row[2] ?? '').trim();

  if (!word || !trigger) return null;
  // Skip header row
  if (word.toLowerCase() === 'word' || word.toLowerCase() === 'idiom') return null;

  return { category, word, trigger, createdAt: createdAt || new Date().toISOString() };
}

// ─── Fetch Entries from ONE Sheet ─────────────────────────────────────────────
async function fetchSheetEntries(
  webAppUrl: string,
  sheetName: string,
  category: Category
): Promise<VocabEntry[]> {
  const url = `/api/sheets?webAppUrl=${encodeURIComponent(webAppUrl)}&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Failed to fetch ${sheetName} sheet`);
  }

  const payload = await response.json();

  // Response shape: { sheet: "OWS", data: [[...], [...]] } or [[...]]
  const rows: string[][] = Array.isArray(payload) ? payload : (payload?.data ?? []);

  return rows
    .map((row) => rowToEntry(row, category))
    .filter((e): e is VocabEntry => e !== null);
}

// ─── Fetch ALL Entries (all 3 sheets combined) ────────────────────────────────
export async function fetchAllEntries(webAppUrl: string): Promise<VocabEntry[]> {
  if (!webAppUrl) throw new Error('Google Apps Script URL not configured. Please go to Settings.');

  const results = await Promise.all(
    (Object.entries(SHEET_MAP) as [Category, string][]).map(([cat, sheet]) =>
      fetchSheetEntries(webAppUrl, sheet, cat).catch(() => [] as VocabEntry[])
    )
  );

  return results.flat();
}

// ─── Duplicate Check (per-sheet, case-insensitive) ───────────────────────────
export function filterDuplicates(
  newEntries: VocabEntry[],
  existing: VocabEntry[]
): { unique: VocabEntry[]; skipped: number } {
  // Build a set per category for fast lookup
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
      existingKeys.add(key); // deduplicate within the same batch too
    }
  }

  return { unique, skipped };
}

// ─── Append Entries to Their Respective Sheets ───────────────────────────────
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

  // Write each group to its sheet
  await Promise.all(
    Object.entries(groups).map(async ([sheetName, sheetEntries]) => {
      // Row format: [Word, Trigger, CreatedAt]
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
  let added = 0;
  let skipped = 0;
  const errors = 0;

  // Fetch existing from all sheets for dedup
  const existing = await fetchAllEntries(webAppUrl).catch(() => []);
  const { unique, skipped: dup } = filterDuplicates(newEntries, existing);
  skipped = dup;

  if (unique.length > 0) {
    await appendEntries(webAppUrl, unique);
    added = unique.length;
  }

  return { added, skipped, errors };
}
