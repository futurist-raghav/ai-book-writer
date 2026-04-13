'use client';

import { useDarkMode } from '@/stores/dark-mode-context';
import { cn } from '@/lib/utils';

export function DarkModeToggle() {
  const { isDark, setDarkMode } = useDarkMode();

  return (
    <div className="theme-chip rounded-xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-xl">
          contrast
        </span>
        <div>
          <h3 className="font-label text-sm font-bold text-on-surface">Theme Mode</h3>
          <p className="font-label text-xs text-on-surface-variant">Choose the workspace appearance.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-lg bg-surface-container-low p-1" role="radiogroup" aria-label="Theme mode">
        <button
          type="button"
          role="radio"
          aria-checked={!isDark}
          onClick={() => setDarkMode(false)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider',
            !isDark
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          <span className="material-symbols-outlined text-base">light_mode</span>
          Light
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={isDark}
          onClick={() => setDarkMode(true)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider',
            isDark
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          <span className="material-symbols-outlined text-base">dark_mode</span>
          Dark
        </button>
      </div>
    </div>
  );
}
