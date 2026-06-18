'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wand2,
  Search,
  BookOpen,
  Download,
  Settings,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/extract',   label: 'Extract',   icon: Wand2 },
  { href: '/search',    label: 'Search',    icon: Search },
  { href: '/revision',  label: 'Revision',  icon: BookOpen },
  { href: '/export',    label: 'Export',    icon: Download },
  { href: '/settings',  label: 'Settings',  icon: Settings },
];

// Page title map for the top bar
const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/extract':   'Extract',
  '/search':    'Search',
  '/revision':  'Revision',
  '/export':    'Export',
  '/settings':  'Settings',
};

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const title = pageTitles[pathname] ?? 'SSC Vocab';

  return (
    <>
      {/* ── Top bar (mobile only) ─────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-[oklch(0.12_0.025_270)] shrink-0 lg:hidden">
        {/* Hamburger */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors -ml-1"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo + Title */}
        <div className="flex items-center gap-2.5 flex-1">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      </header>

      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-out Drawer ──────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 flex flex-col',
          'bg-[oklch(0.12_0.025_270)] border-r border-border',
          'transition-transform duration-300 ease-in-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Mobile navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shrink-0 glow-purple">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold gradient-text">SSC Vocab</p>
              <p className="text-xs text-muted-foreground">Tracker</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 shrink-0',
                    isActive ? 'text-violet-400' : 'text-muted-foreground'
                  )}
                />
                <span>{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground/60 text-center">SSC Vocab Tracker v1.0</p>
        </div>
      </aside>
    </>
  );
}
