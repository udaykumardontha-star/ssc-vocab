'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, ImageIcon, X, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onImageSelected: (base64: string, mimeType: string, previewUrl: string) => void;
  onClear: () => void;
  previewUrl: string | null;
  isProcessing?: boolean;
}

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const SUPPORTED_EXT = '.png, .jpg, .jpeg, .webp';
const MAX_SIZE_MB = 10;

export function ImageUpload({ onImageSelected, onClear, previewUrl, isProcessing }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState(false);

  // ─── Process a File (shared by upload, drag-drop, and paste) ────────────────
  const processFile = useCallback(
    (file: File) => {
      setError(null);

      const type = file.type || 'image/png';
      if (!SUPPORTED_TYPES.includes(type)) {
        setError(`Unsupported format. Supported: ${SUPPORTED_EXT}`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File too large. Max ${MAX_SIZE_MB}MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        const objectUrl = URL.createObjectURL(file);
        onImageSelected(base64, type, objectUrl);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  // ─── Clipboard Paste (Ctrl+V) ─────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only intercept if no image is already showing and not currently processing
      if (previewUrl || isProcessing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Show brief paste feedback
            setPasteHint(true);
            setTimeout(() => setPasteHint(false), 1000);
            processFile(file);
          }
          return; // Process only the first image
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [previewUrl, isProcessing, processFile]);

  // ─── Drag and Drop ────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ─── File Input (Browse) ──────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ─── Preview Mode ─────────────────────────────────────────────────────────
  if (previewUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-card">
        <img
          src={previewUrl}
          alt="Uploaded screenshot"
          className="w-full max-h-72 object-contain bg-black/20"
        />
        {!isProcessing && (
          <button
            onClick={() => { onClear(); setError(null); }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white font-medium">Running OCR with Gemini...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Upload Zone ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Paste Hint Banner */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-300',
        pasteHint
          ? 'border-violet-500/60 bg-violet-600/20 text-violet-300 scale-[1.01]'
          : 'border-border bg-card/50 text-muted-foreground'
      )}>
        <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
        <span>
          {pasteHint
            ? '✓ Image detected from clipboard!'
            : 'Press Ctrl+V anywhere to paste a screenshot from clipboard'}
        </span>
        <kbd className="ml-auto px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono shrink-0">
          Ctrl+V
        </kbd>
      </div>

      {/* Drop Zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-violet-500 bg-violet-600/10 scale-[1.01]'
            : 'border-border hover:border-violet-500/50 hover:bg-accent/40'
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-violet-600/10 border border-violet-500/20">
            <ImageIcon className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? 'Drop to upload' : (
                <>
                  Drop image here or{' '}
                  <span className="text-violet-400 underline underline-offset-2">browse files</span>
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports: {SUPPORTED_EXT} · Max {MAX_SIZE_MB}MB
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Upload className="w-3.5 h-3.5" />
            <span>or use Ctrl+V to paste</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <span>⚠</span> {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_TYPES.join(',')}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
