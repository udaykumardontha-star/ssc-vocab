import { VocabEntry, ExportCategory } from '@/types';

// ─── Filter Entries ────────────────────────────────────────────────────────────

export function filterByCategory(
  entries: VocabEntry[],
  category: ExportCategory
): VocabEntry[] {
  if (category === 'all') return entries;
  return entries.filter((e) => e.category === category);
}

// ─── Format for Display ───────────────────────────────────────────────────────

export function formatEntryForDisplay(entry: VocabEntry): string {
  if (entry.category === 'IDIOM') {
    return `${entry.word} : ${entry.trigger}`;
  }
  return `${entry.word}  ${entry.trigger}`;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportCSV(entries: VocabEntry[], filename = 'ssc-vocab'): void {
  const header = 'Category,Word,Trigger';
  const rows = entries.map((e) => {
    const cat = `"${e.category}"`;
    const word = `"${e.word.replace(/"/g, '""')}"`;
    const trigger = `"${e.trigger.replace(/"/g, '""')}"`;
    return [cat, word, trigger].join(',');
  });

  const csvContent = [header, ...rows].join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

// ─── Excel Export (using SheetJS) ─────────────────────────────────────────────

export async function exportExcel(
  entries: VocabEntry[],
  filename = 'ssc-vocab'
): Promise<void> {
  const XLSX = await import('xlsx');

  const ws_data = [
    ['Category', 'Word', 'Trigger'],
    ...entries.map((e) => [e.category, e.word, e.trigger]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Column widths
  ws['!cols'] = [
    { wch: 10 },
    { wch: 35 },
    { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'SSC Vocabulary');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF Export (using jsPDF) ─────────────────────────────────────────────────

export async function exportPDF(
  entries: VocabEntry[],
  filename = 'ssc-vocab'
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(99, 102, 241);
  doc.text('SSC Vocabulary Tracker', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()} — Total: ${entries.length} entries`, 14, 26);

  // Group by category for PDF
  const owsEntries = entries.filter((e) => e.category === 'OWS');
  const vocabEntries = entries.filter((e) => e.category === 'VOCAB');
  const idiomEntries = entries.filter((e) => e.category === 'IDIOM');

  let startY = 35;

  const addSection = (title: string, rows: VocabEntry[], color: [number, number, number]) => {
    if (rows.length === 0) return;

    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(title, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [['Word / Idiom', 'Meaning / Trigger']],
      body: rows.map((e) => [e.word, e.trigger]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: color, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        startY = data.cursor?.y ?? startY;
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;

    if (startY > 180) {
      doc.addPage();
      startY = 14;
    }
  };

  addSection('ONE WORD SUBSTITUTIONS', owsEntries, [99, 102, 241]);
  addSection('VOCABULARY', vocabEntries, [16, 185, 129]);
  addSection('IDIOMS & PHRASES', idiomEntries, [245, 158, 11]);

  doc.save(`${filename}.pdf`);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
