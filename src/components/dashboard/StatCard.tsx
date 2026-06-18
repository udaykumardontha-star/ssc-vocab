'use client';

import { DashboardStats } from '@/types';
import {
  BookMarked,
  BookOpen,
  MessageSquareQuote,
  Layers,
  CalendarDays,
  TrendingUp,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'purple' | 'emerald' | 'amber' | 'blue' | 'rose' | 'cyan';
  subtitle?: string;
}

const colorMap = {
  purple: {
    bg: 'bg-violet-600/10',
    icon: 'text-violet-400',
    border: 'border-violet-500/20',
    value: 'text-violet-300',
    glow: 'shadow-violet-500/10',
  },
  emerald: {
    bg: 'bg-emerald-600/10',
    icon: 'text-emerald-400',
    border: 'border-emerald-500/20',
    value: 'text-emerald-300',
    glow: 'shadow-emerald-500/10',
  },
  amber: {
    bg: 'bg-amber-600/10',
    icon: 'text-amber-400',
    border: 'border-amber-500/20',
    value: 'text-amber-300',
    glow: 'shadow-amber-500/10',
  },
  blue: {
    bg: 'bg-blue-600/10',
    icon: 'text-blue-400',
    border: 'border-blue-500/20',
    value: 'text-blue-300',
    glow: 'shadow-blue-500/10',
  },
  rose: {
    bg: 'bg-rose-600/10',
    icon: 'text-rose-400',
    border: 'border-rose-500/20',
    value: 'text-rose-300',
    glow: 'shadow-rose-500/10',
  },
  cyan: {
    bg: 'bg-cyan-600/10',
    icon: 'text-cyan-400',
    border: 'border-cyan-500/20',
    value: 'text-cyan-300',
    glow: 'shadow-cyan-500/10',
  },
};

export function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={cn(
        'relative rounded-xl border p-5 transition-all duration-300 hover:scale-[1.02] cursor-default',
        'bg-card shadow-lg',
        c.border,
        c.glow,
        'hover:shadow-xl'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-2.5 rounded-lg', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
      </div>
      <div>
        <p className={cn('text-3xl font-bold tabular-nums', c.value)}>
          {value.toLocaleString()}
        </p>
        <p className="text-sm font-medium text-foreground mt-1">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

interface DashboardStatsGridProps {
  stats: DashboardStats;
}

export function DashboardStatsGrid({ stats }: DashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        title="One Word Sub."
        value={stats.totalOWS}
        icon={BookMarked}
        color="purple"
        subtitle="OWS entries"
      />
      <StatCard
        title="Vocabulary"
        value={stats.totalVocab}
        icon={BookOpen}
        color="emerald"
        subtitle="Word entries"
      />
      <StatCard
        title="Idioms"
        value={stats.totalIdioms}
        icon={MessageSquareQuote}
        color="amber"
        subtitle="Phrase entries"
      />
      <StatCard
        title="Total Unique"
        value={stats.totalUnique}
        icon={Layers}
        color="blue"
        subtitle="All entries"
      />
      <StatCard
        title="Today"
        value={stats.todayAdded}
        icon={CalendarDays}
        color="rose"
        subtitle="Added today"
      />
      <StatCard
        title="This Week"
        value={stats.weekAdded}
        icon={TrendingUp}
        color="cyan"
        subtitle="Last 7 days"
      />
    </div>
  );
}
