'use client';

import { useRef, useState } from 'react';
import {
  FileText,
  X,
  Upload,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PdfTextResult, PdfPageRange, PdfProgress, PdfRangePreset } from '@/types';
import {
  extractPdfText,
  resolvePageRange,
  estimateChunks,
} from '@/services/pdfProcessor.service';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PdfUploadProps {
  pdfResult: PdfTextResult | null;
  pageRange: PdfPageRange;
  progress: PdfProgress | null;
  onFileLoad: (result: PdfTextResult) => void;
  onClear: () => void;
  onPageRangeChange: (range: PdfPageRange) => void;
  isProcessing: boolean;
}

// ─── Range Presets ────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: PdfRangePreset; label: (total: number) => string }[] = [
  { value: 'all',      label: (t) => `Entire PDF (${t} pages)` },
  { value: 'first50',  label: (t) => `First 50 Pages${t < 50 ? ` (only ${t} available)` : ''}` },
  { value: 'first100', label: (t) => `First 100 Pages${t < 100 ? ` (only ${t} available)` : ''}` },
  { value: 'custom',   label: () => 'Custom Range' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatChars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PdfUpload({
  pdfResult,
  pageRange,
  progress,
  onFileLoad,
  onClear,
  onPageRangeChange,
  isProcessing,
}: PdfUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readMessage, setReadMessage] = useState('');
  const [readError, setReadError] = useState<string | null>(null);

  // ─── File selection ────────────────────────────────────────────────────────

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setReadError('Please select a valid PDF file.');
      return;
    }

    setReadError(null);
    setIsReading(true);
    setReadMessage('Loading PDF reader...');

    try {
      const result = await extractPdfText(file, setReadMessage);
      onFileLoad(result);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Failed to read PDF.');
    } finally {
      setIsReading(false);
      setReadMessage('');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleClear = () => {
    setReadError(null);
    onClear();
  };

  // ─── Page range helpers ────────────────────────────────────────────────────

  const totalPages = pdfResult?.totalPages ?? 0;

  const { startPage, endPage } = pdfResult
    ? resolvePageRange(pageRange, totalPages)
    : { startPage: 1, endPage: 1 };

  const selectedCount = pdfResult ? endPage - startPage + 1 : 0;

  const estimatedChunks = pdfResult
    ? estimateChunks(pdfResult.pages, startPage, endPage)
    : 0;

  const updatePreset = (preset: PdfRangePreset) => {
    onPageRangeChange({ ...pageRange, preset });
  };

  const updateCustom = (field: 'customStart' | 'customEnd', value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      onPageRangeChange({ ...pageRange, [field]: num });
    }
  };

  // ─── Progress bar ──────────────────────────────────────────────────────────

  const progressPct =
    progress && progress.totalChunks > 0
      ? Math.round((progress.currentChunk / progress.totalChunks) * 100)
      : 0;

  // ─── Render: Progress state ────────────────────────────────────────────────

  if (isProcessing && progress && progress.phase !== 'idle') {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {/* Status message */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-sm font-medium text-foreground">{progress.message}</span>
        </div>

        {/* Progress bar (only shown during chunk processing) */}
        {progress.phase === 'processing' && progress.totalChunks > 0 && (
          <>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Chunk {progress.currentChunk} of {progress.totalChunks}</span>
              <span>{progressPct}%</span>
            </div>
          </>
        )}

        {/* Live entry count */}
        {progress.entriesFound > 0 && (
          <p className="text-xs text-emerald-400 font-medium">
            ✓ {progress.entriesFound} entries found so far
          </p>
        )}
      </div>
    );
  }

  // ─── Render: Reading state (text extraction in progress) ──────────────────

  if (isReading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-sm text-muted-foreground">{readMessage}</span>
        </div>
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-violet-600/40 to-indigo-500/40 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  // ─── Render: Error state ───────────────────────────────────────────────────

  if (readError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-600/10 p-4 flex gap-3">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-300">{readError}</p>
          <button
            onClick={() => { setReadError(null); inputRef.current?.click(); }}
            className="text-xs text-red-400 underline mt-1 hover:text-red-300"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: File loaded — show info + page range ─────────────────────────

  if (pdfResult) {
    return (
      <div className="space-y-4">
        {/* File info bar */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="p-2 rounded-lg bg-rose-600/10 shrink-0">
            <FileText className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{pdfResult.totalPages} pages</p>
            <p className="text-xs text-muted-foreground">
              {formatChars(pdfResult.totalChars)} characters
              {pdfResult.isScanned && (
                <span className="ml-2 text-amber-400">⚠ Scanned PDF — text may be limited</span>
              )}
            </p>
          </div>
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            aria-label="Clear PDF"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Page range selector */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Page Range
          </p>

          <div className="space-y-2">
            {RANGE_OPTIONS.map(({ value, label }) => {
              // Hide First 50/100 options if PDF has fewer pages
              if (value === 'first50' && totalPages <= 50) return null;
              if (value === 'first100' && totalPages <= 100) return null;

              return (
                <label
                  key={value}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                    pageRange.preset === value
                      ? 'border-violet-500/50 bg-violet-600/10 text-violet-300'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <input
                    type="radio"
                    name="pdf-range"
                    value={value}
                    checked={pageRange.preset === value}
                    onChange={() => updatePreset(value)}
                    className="accent-violet-500 shrink-0"
                  />
                  <span className="text-sm">{label(totalPages)}</span>
                </label>
              );
            })}
          </div>

          {/* Custom range inputs */}
          {pageRange.preset === 'custom' && (
            <div className="flex items-center gap-2 pt-1 pl-2">
              <span className="text-xs text-muted-foreground shrink-0">Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageRange.customStart}
                onChange={(e) => updateCustom('customStart', e.target.value)}
                className="w-20 px-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="number"
                min={pageRange.customStart}
                max={totalPages}
                value={pageRange.customEnd}
                onChange={(e) => updateCustom('customEnd', e.target.value)}
                className="w-20 px-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="text-xs text-muted-foreground shrink-0">of {totalPages}</span>
            </div>
          )}
        </div>

        {/* Summary: selected pages + estimated chunks */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums text-violet-300">{totalPages}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Pages</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-violet-300">
              {pageRange.preset === 'all'
                ? totalPages
                : `${startPage}–${endPage}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pageRange.preset === 'all' ? 'All Pages' : `${selectedCount} Pages`}
            </p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-violet-300">{estimatedChunks}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Est. Chunks</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Dropzone (no file selected) ──────────────────────────────────

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInput}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-rose-500 bg-rose-600/10 scale-[1.01]'
            : 'border-border hover:border-rose-500/50 hover:bg-accent/40'
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'p-3 rounded-xl transition-colors',
            isDragging ? 'bg-rose-600/20' : 'bg-muted/60'
          )}>
            <Upload className={cn('w-6 h-6', isDragging ? 'text-rose-400' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? 'Drop PDF here' : 'Drop PDF here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports large PDFs — 50, 100, 200, 600+ pages
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border">
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs text-muted-foreground font-mono">.pdf</span>
          </div>
        </div>
      </div>
    </>
  );
}
