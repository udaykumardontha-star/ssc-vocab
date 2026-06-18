'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mode, VocabEntry, PdfPageRange, PdfTextResult, PdfProgress } from '@/types';
import { ModeSelector } from '@/components/extract/ModeSelector';
import { ImageUpload } from '@/components/extract/ImageUpload';
import { PdfUpload } from '@/components/extract/PdfUpload';
import { ResultsPanel } from '@/components/extract/ResultsPanel';
import { useSettings } from '@/hooks/useSettings';
import { extractFromText, extractFromImage, parseGeminiOutput } from '@/services/gemini.service';
import { saveUniqueEntries } from '@/services/googleSheets.service';
import { autoGenerateGroups } from '@/services/vocabularyGroup.service';
import {
  chunkSelectedPages,
  processPdfChunks,
  resolvePageRange,
} from '@/services/pdfProcessor.service';
import {
  Wand2,
  FileText,
  ImageIcon,
  FileUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type InputTab = 'text' | 'image' | 'pdf';

const TAB_CONFIG: {
  value: InputTab;
  icon: React.ElementType;
  label: string;
}[] = [
  { value: 'text',  icon: FileText,  label: 'Text' },
  { value: 'image', icon: ImageIcon, label: 'Image' },
  { value: 'pdf',   icon: FileUp,    label: 'PDF' },
];

export default function ExtractPage() {
  const { settings } = useSettings();

  const [inputTab, setInputTab] = useState<InputTab>('text');
  const [mode, setMode] = useState<Mode>('auto');
  const [textInput, setTextInput] = useState('');

  // ── Image state ─────────────────────────────────────────────────────────────
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [showOcr, setShowOcr] = useState(true);

  // ── PDF state ────────────────────────────────────────────────────────────────
  const [pdfResult, setPdfResult] = useState<PdfTextResult | null>(null);
  const [pdfPageRange, setPdfPageRange] = useState<PdfPageRange>({
    preset: 'all',
    customStart: 1,
    customEnd: 1,
  });
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);

  // ── Processing state ─────────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [saveResult, setSaveResult] = useState<{ added: number; skipped: number } | null>(null);

  // ── Image handlers ───────────────────────────────────────────────────────────
  const handleImageSelected = (base64: string, mimeType: string, previewUrl: string) => {
    setImageBase64(base64);
    setImageMime(mimeType);
    setImagePreviewUrl(previewUrl);
    setOcrText(null);
    setEntries([]);
    setSaveResult(null);
  };

  const handleClearImage = () => {
    setImageBase64(null);
    setImagePreviewUrl(null);
    setOcrText(null);
    setEntries([]);
    setSaveResult(null);
  };

  // ── PDF handlers ─────────────────────────────────────────────────────────────
  const handlePdfLoad = (result: PdfTextResult) => {
    setPdfResult(result);
    // Reset page range to "all" when a new PDF is loaded
    setPdfPageRange({ preset: 'all', customStart: 1, customEnd: result.totalPages });
    setEntries([]);
    setSaveResult(null);
    setPdfProgress(null);
  };

  const handlePdfClear = () => {
    setPdfResult(null);
    setPdfProgress(null);
    setEntries([]);
    setSaveResult(null);
  };

  // ── Page-level Ctrl+V handler: auto-switch to image tab ──────────────────────
  useEffect(() => {
    const handlePagePaste = (e: ClipboardEvent) => {
      // Already on image tab with a preview — ImageUpload handles it
      if (inputTab === 'image' && imagePreviewUrl) return;
      // Don't intercept text pastes in the textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault();
          setInputTab('image');
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const result = ev.target?.result as string;
              const base64 = result.split(',')[1];
              const objectUrl = URL.createObjectURL(file);
              handleImageSelected(base64, file.type, objectUrl);
            };
            reader.readAsDataURL(file);
          }
          return;
        }
      }
    };

    window.addEventListener('paste', handlePagePaste);
    return () => window.removeEventListener('paste', handlePagePaste);
  }, [inputTab, imagePreviewUrl]);

  // ── Main process handler ──────────────────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    if (!settings.geminiApiKey) {
      toast.error('Gemini API key not configured. Go to Settings.');
      return;
    }
    if (!settings.webAppUrl) {
      toast.error('Google Apps Script URL not configured. Go to Settings.');
      return;
    }

    // ── PDF branch ─────────────────────────────────────────────────────────────
    if (inputTab === 'pdf') {
      if (!pdfResult) {
        toast.error('Please upload a PDF first.');
        return;
      }

      const { startPage, endPage } = resolvePageRange(pdfPageRange, pdfResult.totalPages);
      const chunks = chunkSelectedPages(pdfResult.pages, startPage, endPage);

      if (chunks.length === 0) {
        toast.error('Selected page range contains no text to process.');
        return;
      }

      setIsProcessing(true);
      setSaveResult(null);
      setEntries([]);
      setPdfProgress({
        phase: 'processing',
        currentChunk: 0,
        totalChunks: chunks.length,
        message: `Starting — ${chunks.length} chunk${chunks.length !== 1 ? 's' : ''} to process...`,
        entriesFound: 0,
      });

      try {
        const allEntries = await processPdfChunks(
          chunks,
          mode,
          settings.geminiApiKey,
          (p) => setPdfProgress(p)
        );

        if (allEntries.length === 0) {
          toast.warning('No vocabulary entries found in the selected pages. Try a different mode or page range.');
          setIsProcessing(false);
          setPdfProgress(null);
          return;
        }

        setEntries(allEntries);
        setIsProcessing(false);

        // Auto-save
        setIsSaving(true);
        setPdfProgress({
          phase: 'saving',
          currentChunk: chunks.length,
          totalChunks: chunks.length,
          message: 'Saving to Google Sheets...',
          entriesFound: allEntries.length,
        });

        try {
          const result = await saveUniqueEntries(settings.webAppUrl, allEntries);
          setSaveResult({ added: result.added, skipped: result.skipped });

          if (result.added > 0 || result.skipped > 0) {
            toast.success(
              `${result.added} new ${result.added === 1 ? 'entry' : 'entries'} added` +
              `${result.skipped > 0 ? `, ${result.skipped} duplicate${result.skipped > 1 ? 's' : ''} skipped` : ''}`
            );
          } else {
            toast.info('All entries already exist in your sheet.');
          }

          // Auto-generate groups for new VOCAB entries in background
          const newVocab = allEntries.filter((e) => e.category === 'VOCAB');
          if (newVocab.length > 0 && settings.geminiApiKey) {
            toast.info(`Generating groups for ${newVocab.length} vocab word${newVocab.length > 1 ? 's' : ''}...`, { duration: 3000 });
            autoGenerateGroups(
              newVocab,
              settings.webAppUrl,
              settings.geminiApiKey,
              (done, total) => {
                if (done === total) {
                  toast.success(`${total} vocab group${total > 1 ? 's' : ''} generated!`);
                }
              }
            );
          }
        } catch (saveErr) {
          toast.error(saveErr instanceof Error ? saveErr.message : 'Failed to save to Google Sheets');
        } finally {
          setIsSaving(false);
          setPdfProgress(null);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'PDF processing failed');
        setIsProcessing(false);
        setIsSaving(false);
        setPdfProgress(null);
      }

      return;
    }

    // ── Text / Image branch (unchanged) ────────────────────────────────────────
    if (inputTab === 'text' && !textInput.trim()) {
      toast.error('Please enter some text to process.');
      return;
    }
    if (inputTab === 'image' && !imageBase64) {
      toast.error('Please upload an image first.');
      return;
    }

    setIsProcessing(true);
    setSaveResult(null);
    setEntries([]);

    try {
      let rawOutput = '';
      let extractedOcrText = '';

      if (inputTab === 'image' && imageBase64) {
        const result = await extractFromImage(imageBase64, imageMime, settings.geminiApiKey);
        rawOutput = result.rawOutput;
        extractedOcrText = result.ocrText;
        setOcrText(extractedOcrText);
      } else {
        rawOutput = await extractFromText(textInput, mode, settings.geminiApiKey);
      }

      const parsed = parseGeminiOutput(rawOutput, mode);

      if (parsed.length === 0) {
        toast.warning('No vocabulary entries found in the input. Try a different mode or more detailed text.');
        setIsProcessing(false);
        return;
      }

      setEntries(parsed);
      setIsProcessing(false);

      // Auto-save
      setIsSaving(true);
      try {
        const result = await saveUniqueEntries(settings.webAppUrl, parsed);
        setSaveResult({ added: result.added, skipped: result.skipped });

        if (result.added > 0 || result.skipped > 0) {
          toast.success(
            `${result.added} new ${result.added === 1 ? 'entry' : 'entries'} added${result.skipped > 0 ? `, ${result.skipped} duplicate${result.skipped > 1 ? 's' : ''} skipped` : ''}`
          );
        } else {
          toast.info('All entries already exist in your sheet.');
        }

        // Auto-generate groups for new VOCAB entries in background
        const newVocab = parsed.filter((e) => e.category === 'VOCAB');
        if (newVocab.length > 0 && settings.geminiApiKey) {
          toast.info(`Generating groups for ${newVocab.length} vocab word${newVocab.length > 1 ? 's' : ''}...`, { duration: 3000 });
          autoGenerateGroups(
            newVocab,
            settings.webAppUrl,
            settings.geminiApiKey,
            (done, total) => {
              if (done === total) {
                toast.success(`${total} vocab group${total > 1 ? 's' : ''} generated!`);
              }
            }
          );
        }
      } catch (saveErr) {
        const msg = saveErr instanceof Error ? saveErr.message : 'Failed to save to Google Sheets';
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      toast.error(msg);
      setIsProcessing(false);
      setIsSaving(false);
    }
  }, [settings, inputTab, textInput, imageBase64, imageMime, mode, pdfResult, pdfPageRange]);

  // ── Derived state ─────────────────────────────────────────────────────────────
  const isReady = Boolean(settings.geminiApiKey && settings.webAppUrl);

  const canProcess =
    isReady &&
    !isProcessing &&
    !isSaving &&
    (inputTab === 'text'
      ? textInput.trim().length > 0
      : inputTab === 'image'
      ? imageBase64 !== null
      : pdfResult !== null); // PDF tab

  if (!isReady) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extract Vocabulary</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Paste text, upload an image, or upload a PDF — Gemini AI extracts everything automatically
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-600/10 p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-300">
            Please{' '}
            <Link href="/settings" className="underline hover:text-amber-200">
              configure your API keys
            </Link>{' '}
            before extracting.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extract Vocabulary</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Paste text, upload or{' '}
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-xs font-mono">
              Ctrl+V
            </kbd>{' '}
            a screenshot — Gemini AI extracts everything automatically
          </p>
        </div>
        {/* Clipboard Hint Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-600/10 text-xs text-violet-300">
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>Ctrl+V anywhere to paste screenshot</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Input Panel */}
        <div className="space-y-5">
          {/* Mode Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Extraction Mode
            </label>
            <ModeSelector selected={mode} onChange={setMode} />
          </div>

          {/* Input Type Tabs */}
          <div>
            {/* Tab bar — 3 tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border mb-4">
              {TAB_CONFIG.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setInputTab(value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                    inputTab === value
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {inputTab === 'text' && (
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`Paste your text here...\n\nExamples:\n• Single words: Cynic, Bibliophile\n• Passage from a book\n• SSC question paper\n• Vocabulary list\n• Idioms list`}
                className="min-h-[280px] text-sm font-mono bg-card border-border resize-y"
                disabled={isProcessing || isSaving}
              />
            )}

            {inputTab === 'image' && (
              <ImageUpload
                onImageSelected={handleImageSelected}
                onClear={handleClearImage}
                previewUrl={imagePreviewUrl}
                isProcessing={isProcessing}
              />
            )}

            {inputTab === 'pdf' && (
              <PdfUpload
                pdfResult={pdfResult}
                pageRange={pdfPageRange}
                progress={pdfProgress}
                onFileLoad={handlePdfLoad}
                onClear={handlePdfClear}
                onPageRangeChange={setPdfPageRange}
                isProcessing={isProcessing || isSaving}
              />
            )}
          </div>

          {/* OCR Preview (Image tab only) */}
          {inputTab === 'image' && ocrText && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setShowOcr(!showOcr)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors border-b border-border"
              >
                <span className="uppercase tracking-wider">OCR Text Preview</span>
                {showOcr ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showOcr && (
                <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                  {ocrText}
                </pre>
              )}
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
              canProcess
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:scale-[1.01] glow-purple'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {inputTab === 'pdf' && pdfProgress
                  ? `Chunk ${pdfProgress.currentChunk} / ${pdfProgress.totalChunks}`
                  : 'Extracting...'}
              </>
            ) : isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving to Sheets...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Extract &amp; Save
              </>
            )}
          </button>

          {/* Mode / PDF hint */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {inputTab === 'pdf'
                ? pdfResult
                  ? 'PDF loaded. Select page range and click Extract & Save to process.'
                  : 'Upload a PDF to extract vocabulary from SSC books, question papers, and study material.'
                : mode === 'auto'
                ? 'Auto mode: Gemini will automatically detect and classify OWS, vocabulary, and idioms.'
                : mode === 'ows'
                ? 'OWS mode: Input one word per line or a passage containing one-word substitutions.'
                : mode === 'vocabulary'
                ? 'Vocabulary mode: Input words or passages to extract vocabulary with synonyms.'
                : mode === 'idioms'
                ? 'Idioms mode: Input idioms or passages containing idiomatic expressions.'
                : 'Mixed mode: Input any text — extracts all three categories at once.'}
            </span>
          </div>
        </div>

        {/* RIGHT: Results Panel */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
            Extraction Results
          </label>
          <ResultsPanel
            entries={entries}
            isLoading={isProcessing}
            saveResult={saveResult}
          />
        </div>
      </div>
    </div>
  );
}
