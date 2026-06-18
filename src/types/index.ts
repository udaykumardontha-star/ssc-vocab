// ─── Core Domain Types ────────────────────────────────────────────────────────

export type Category = 'OWS' | 'VOCAB' | 'IDIOM';

export type Mode = 'ows' | 'vocabulary' | 'idioms' | 'mixed' | 'auto';

export interface VocabEntry {
  category: Category;
  word: string;
  trigger: string;
  createdAt: string;
}

// ─── Extraction ───────────────────────────────────────────────────────────────

export interface ExtractionResult {
  entries: VocabEntry[];
  rawText: string;
  ocrText?: string; // populated when image was used
}

export interface SaveResult {
  added: number;
  skipped: number;
  errors: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  geminiApiKey: string;
  webAppUrl: string; // Google Apps Script Web App URL
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalOWS: number;
  totalVocab: number;
  totalIdioms: number;
  totalUnique: number;
  todayAdded: number;
  weekAdded: number;
  totalGroups: number;
  totalGroupWords: number;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'excel' | 'pdf';
export type ExportCategory = 'all' | 'OWS' | 'VOCAB' | 'IDIOM';

// ─── PDF Processing ────────────────────────────────────────────────────────────

export type PdfRangePreset = 'all' | 'first50' | 'first100' | 'custom';

export interface PdfPageRange {
  preset: PdfRangePreset;
  customStart: number;
  customEnd: number;
}

export interface PdfTextResult {
  pages: string[];      // one string per page (index 0 = page 1)
  totalPages: number;
  totalChars: number;
  isScanned: boolean;   // true when avg chars/page < 50
}

export interface PdfProgress {
  phase: 'idle' | 'reading' | 'processing' | 'saving' | 'done' | 'error';
  currentChunk: number;
  totalChunks: number;
  message: string;
  entriesFound: number;
}

