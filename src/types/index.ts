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
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'excel' | 'pdf';
export type ExportCategory = 'all' | 'OWS' | 'VOCAB' | 'IDIOM';
