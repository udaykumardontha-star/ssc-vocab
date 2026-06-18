'use client';

import { Mode } from '@/types';
import { cn } from '@/lib/utils';

interface ModeSelectorProps {
  selected: Mode;
  onChange: (mode: Mode) => void;
}

const modes: { value: Mode; label: string; desc: string; color: string }[] = [
  { value: 'ows', label: 'OWS', desc: 'One Word Subs.', color: 'violet' },
  { value: 'vocabulary', label: 'Vocabulary', desc: 'Words & Synonyms', color: 'emerald' },
  { value: 'idioms', label: 'Idioms', desc: 'Phrases & Meanings', color: 'amber' },
  { value: 'mixed', label: 'Mixed', desc: 'All Categories', color: 'blue' },
  { value: 'auto', label: 'Auto', desc: 'AI Detects', color: 'rose' },
];

const colorMap: Record<string, string> = {
  violet: 'border-violet-500/50 bg-violet-600/15 text-violet-300 shadow-violet-500/20',
  emerald: 'border-emerald-500/50 bg-emerald-600/15 text-emerald-300 shadow-emerald-500/20',
  amber: 'border-amber-500/50 bg-amber-600/15 text-amber-300 shadow-amber-500/20',
  blue: 'border-blue-500/50 bg-blue-600/15 text-blue-300 shadow-blue-500/20',
  rose: 'border-rose-500/50 bg-rose-600/15 text-rose-300 shadow-rose-500/20',
};

const inactiveColor = 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground hover:border-border/80';

export function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map(({ value, label, desc, color }) => {
        const isActive = selected === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              'flex flex-col items-center px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200',
              'min-w-[90px] cursor-pointer',
              isActive
                ? cn(colorMap[color], 'shadow-md scale-[1.03]')
                : inactiveColor
            )}
          >
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-xs opacity-70 mt-0.5 whitespace-nowrap">{desc}</span>
          </button>
        );
      })}
    </div>
  );
}
