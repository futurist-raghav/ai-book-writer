'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useKeyboardShortcutsContext } from '@/stores/keyboard-shortcuts-context';
import { useDarkMode } from '@/stores/dark-mode-context';
import { ScribeHouseLogo } from '@/components/scribe-house-logo';
import { cn } from '@/lib/utils';

const topNav = [
  { href: '/dashboard/books', label: 'Projects' },
  { href: '/dashboard/drafts', label: 'Drafts' },
  { href: '/dashboard/archive', label: 'Archive' },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuthStore();
  const { openHelp } = useKeyboardShortcutsContext();
  const { isDark, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    const handleAuthExpired = () => {
      router.push('/login');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const iconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:border-primary/40 hover:bg-surface-container transition-colors';

  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/40 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1700px] items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 md:gap-4">
          <div className="h-12 w-12 flex-shrink-0">
            <ScribeHouseLogo className="h-12 w-12" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Workspace
            </span>
            <h1 className="truncate text-lg font-bold italic font-headline tracking-tight text-on-surface md:text-xl">
              Scribe House
            </h1>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-xl border border-outline-variant/35 bg-surface-container-low p-1 lg:flex">
          {topNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/dashboard/books' && pathname === '/dashboard');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <button className={iconButtonClass} title="History" aria-label="History">
            <span className="material-symbols-outlined">history</span>
          </button>

          <button
            onClick={openHelp}
            className={iconButtonClass}
            title="Help and Keyboard Shortcuts"
            aria-label="Help and Keyboard Shortcuts"
          >
            <span className="material-symbols-outlined">help_outline</span>
          </button>

          <button
            onClick={toggleDarkMode}
            className="theme-chip inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-on-surface hover:border-primary/50"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-wider xl:inline">
              {isDark ? 'Light' : 'Dark'}
            </span>
          </button>

          <Link href="/dashboard/settings" className={iconButtonClass} title="Settings" aria-label="Settings">
            <span className="material-symbols-outlined">settings</span>
          </Link>

          <button
            onClick={handleLogout}
            className={iconButtonClass}
            title="Logout"
            aria-label="Logout"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
