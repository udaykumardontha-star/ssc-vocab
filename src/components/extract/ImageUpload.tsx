'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onImageSelected: (base64: string, mimeType: string, previewUrl: string) => void;
  onClear: () => void;
  previewUrl: string | null;
  isProcessing?: boolean;
}

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const SUPPORTED_EXT = '.png, .jpg, .jpeg, .webp';

export function ImageUpload({ onImageSelected, onClear, previewUrl, isProcessing }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!SUPPORTED_TYPES.includes(file.type)) {
        setError(`Unsupported format. Use: ${SUPPORTED_EXT}`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File too large. Max 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        const previewUrl = URL.createObjectURL(file);
        onImageSelected(base64, file.type, previewUrl);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

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
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white font-medium">Running OCR...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-violet-500 bg-violet-600/10 scale-[1.01]'
            : 'border-border hover:border-violet-500/50 hover:bg-accent/50'
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-violet-600/10 border border-violet-500/20">
            <ImageIcon className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Drop screenshot here or{' '}
              <span className="text-violet-400 underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports: {SUPPORTED_EXT} · Max 10MB
            </p>
          </div>
          <Upload className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
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
