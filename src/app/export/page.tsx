'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useVocabData } from '@/hooks/useVocabData';
import { ExportCategory, ExportFormat } from '@/types';
import { exportCSV, exportExcel, exportPDF, filterByCategory } from '@/lib/exportUtils';
import {
  FileSpreadsheet,
  FileText,
  Table,
  Download,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const categoryOptions: { value: ExportCategory; label: string }[] = [
  { value: 'all', label: 'All Entries' },
  { value: 'OWS', label: 'OWS Only' },
  { value: 'VOCAB', label: 'Vocabulary Only' },
  { value: 'IDIOM', label: 'Idioms Only' },
];

const formatOptions: {
  format: ExportFormat;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    format: 'csv',
    label: 'CSV',
    desc: 'Comma-separated values. Open in Excel, Google Sheets, or any spreadsheet app.',
    icon: Table,
    color: 'emerald',
  },
  {
    format: 'excel',
    label: 'Excel',
    desc: 'Microsoft Excel workbook (.xlsx) with formatted columns.',
    icon: FileSpreadsheet,
    color: 'green',
  },
  {
    format: 'pdf',
    label: 'PDF',
    desc: 'Formatted PDF document with color-coded sections — perfect for printing.',
    icon: FileText,
    color: 'rose',
  },
];

const colorMap: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-300',
  green: 'border-green-500/30 bg-green-600/10 hover:bg-green-600/20 text-green-300',
  rose: 'border-rose-500/30 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300',
};

export default function ExportPage() {
  const { settings, isLoaded } = useSettings();
  const { entries, isLoading, refresh } = useVocabData(settings.webAppUrl);
  const [category, setCategory] = useState<ExportCategory>('all');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    if (isLoaded && settings.webAppUrl) refresh();
  }, [isLoaded, settings.webAppUrl]);

  const filteredEntries = filterByCategory(entries, category);

  const handleExport = async (format: ExportFormat) => {
    if (filteredEntries.length === 0) {
      toast.error('No entries to export. Add vocabulary first.');
      return;
    }
    setExporting(format);
    const suffix = category === 'all' ? 'all' : category.toLowerCase();
    const filename = `ssc-vocab-${suffix}-${new Date().toISOString().split('T')[0]}`;
    try {
      if (format === 'csv') exportCSV(filteredEntries, filename);
      else if (format === 'excel') await exportExcel(filteredEntries, filename);
      else if (format === 'pdf') await exportPDF(filteredEntries, filename);
      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Export</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Download your vocabulary database in multiple formats
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Category Filter */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            What to Export
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={cn(
                'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                category === value
                  ? 'border-violet-500/50 bg-violet-600/15 text-violet-300 shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isLoading ? 'Loading...' : `${filteredEntries.length} entries will be exported`}
        </p>
      </div>

      {/* Export Buttons */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Export Format
        </div>
        {formatOptions.map(({ format, label, desc, icon: Icon, color }) => (
          <button
            key={format}
            onClick={() => handleExport(format)}
            disabled={!!exporting || filteredEntries.length === 0}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              colorMap[color]
            )}
          >
            <div className="shrink-0">
              {exporting === format ? (
                <div className="w-8 h-8 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <Icon className="w-8 h-8 opacity-70" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs opacity-70 mt-0.5">{desc}</div>
            </div>
            <Download className="w-4 h-4 shrink-0 opacity-50" />
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Database Summary
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'OWS', count: entries.filter((e) => e.category === 'OWS').length, color: 'violet' },
            { label: 'Vocabulary', count: entries.filter((e) => e.category === 'VOCAB').length, color: 'emerald' },
            { label: 'Idioms', count: entries.filter((e) => e.category === 'IDIOM').length, color: 'amber' },
          ].map(({ label, count, color }) => (
            <div key={label} className="text-center">
              <div className={cn(
                'text-2xl font-bold tabular-nums',
                color === 'violet' ? 'text-violet-300' : color === 'emerald' ? 'text-emerald-300' : 'text-amber-300'
              )}>
                {count}
              </div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
