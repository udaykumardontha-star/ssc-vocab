/**
 * pdfProcessor.service.ts
 * Client-side PDF text extraction, chunking, and Gemini processing.
 * pdfjs-dist is loaded via dynamic import (lazy) to avoid bundle bloat.
 */

import { VocabEntry, Mode, PdfTextResult, PdfPageRange, PdfProgress } from '@/types';
import { extractFromText } from './gemini.service';
import { parseGeminiOutput } from './gemini.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_MAX_PAGES = 20;
const CHUNK_MAX_CHARS = 50_000;
const CHUNK_DELAY_MS = 300; // rate limit protection between sequential Gemini calls

// ─── PDF Text Extraction ──────────────────────────────────────────────────────

/**
 * Extract text from each page of a PDF file using pdfjs-dist.
 * pdfjs-dist is dynamically imported on first call — zero impact on initial bundle.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (message: string) => void
): Promise<PdfTextResult> {
  onProgress?.('Loading PDF reader...');

  // Dynamic import — library downloaded only when user uploads a PDF
  const pdfjsLib = await import('pdfjs-dist');

  // Use jsdelivr CDN for the worker (avoids Turbopack worker bundling complexity)
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  onProgress?.('Reading PDF...');

  const arrayBuffer = await file.arrayBuffer();

  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch {
    throw new Error('Could not read PDF. The file may be corrupted or password-protected.');
  }

  const totalPages = pdf.numPages;
  const pages: string[] = [];
  let totalChars = 0;

  onProgress?.(`Extracting text from ${totalPages} pages...`);

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push(text);
      totalChars += text.length;
    } catch {
      // If a single page fails, push empty string and continue
      pages.push('');
    }

    if (i % 25 === 0 || i === totalPages) {
      onProgress?.(`Extracted ${i} / ${totalPages} pages...`);
    }
  }

  // Scanned PDF detection: if average useful chars per page < 50, likely image-only
  const avgCharsPerPage = totalPages > 0 ? totalChars / totalPages : 0;
  const isScanned = avgCharsPerPage < 50;

  return { pages, totalPages, totalChars, isScanned };
}

// ─── Page Range Resolution ────────────────────────────────────────────────────

export function resolvePageRange(
  range: PdfPageRange,
  totalPages: number
): { startPage: number; endPage: number } {
  switch (range.preset) {
    case 'all':
      return { startPage: 1, endPage: totalPages };
    case 'first50':
      return { startPage: 1, endPage: Math.min(50, totalPages) };
    case 'first100':
      return { startPage: 1, endPage: Math.min(100, totalPages) };
    case 'custom': {
      const start = Math.max(1, Math.min(range.customStart, totalPages));
      const end = Math.max(start, Math.min(range.customEnd, totalPages));
      return { startPage: start, endPage: end };
    }
  }
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Slice selected pages and group them into chunks that Gemini can handle.
 * Each chunk contains <= CHUNK_MAX_PAGES pages AND <= CHUNK_MAX_CHARS characters.
 */
export function chunkSelectedPages(
  pages: string[],
  startPage: number, // 1-indexed
  endPage: number    // 1-indexed, inclusive
): string[][] {
  const selected = pages.slice(startPage - 1, endPage);
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentChars = 0;

  for (const page of selected) {
    const willExceedChars = currentChars + page.length > CHUNK_MAX_CHARS;
    const willExceedPages = currentChunk.length >= CHUNK_MAX_PAGES;

    if (currentChunk.length > 0 && (willExceedChars || willExceedPages)) {
      chunks.push(currentChunk);
      currentChunk = [page];
      currentChars = page.length;
    } else {
      currentChunk.push(page);
      currentChars += page.length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Estimate number of chunks for a given page selection (preview before processing).
 */
export function estimateChunks(
  pages: string[],
  startPage: number,
  endPage: number
): number {
  if (pages.length === 0) return 0;
  return chunkSelectedPages(pages, startPage, endPage).length;
}

// ─── Sequential Chunk Processing ─────────────────────────────────────────────

/**
 * Process each chunk sequentially through Gemini, with progress callbacks.
 * Merges all results and deduplicates within the merged set.
 * If a single chunk fails, it is skipped — processing continues.
 */
export async function processPdfChunks(
  chunks: string[][],
  mode: Mode,
  apiKey: string,
  onProgress: (p: PdfProgress) => void
): Promise<VocabEntry[]> {
  const allEntries: VocabEntry[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress({
      phase: 'processing',
      currentChunk: i + 1,
      totalChunks: chunks.length,
      message: `Processing chunk ${i + 1} of ${chunks.length}...`,
      entriesFound: allEntries.length,
    });

    const chunkText = chunks[i].join('\n\n');

    // Skip truly empty chunks
    if (chunkText.trim().length < 10) continue;

    try {
      const raw = await extractFromText(chunkText, mode, apiKey);
      const entries = parseGeminiOutput(raw, mode);
      allEntries.push(...entries);
    } catch (err) {
      // Log but don't abort — partial results are better than none
      console.warn(`PDF chunk ${i + 1} failed:`, err);
    }

    // Rate-limit protection: small delay between sequential Gemini calls
    if (i < chunks.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }

  // Dedup within the merged result set (word + category key)
  const seen = new Set<string>();
  const deduped = allEntries.filter((entry) => {
    const key = `${entry.category}:${entry.word.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}
