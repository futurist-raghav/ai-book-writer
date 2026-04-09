'use client';

import { useDarkMode } from '@/stores/dark-mode-context';

export function DarkModeToggle() {
  const { isDark, toggleDarkMode } = useDarkMode();

  return (
    <div className="flex items-center justify-between py-4 px-4 bg-surface-container-low rounded-lg border border-outline-variant/10">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-2xl">
          {isDark ? 'dark_mode' : 'light_mode'}
        </span>
        <div>
          <h3 className="font-label text-sm font-bold text-on-surface">Dark Mode</h3>
          <p className="font-label text-xs text-on-surface-variant">
            {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
          </p>
        </div>
      </div>

      {/* Toggle Switch */}
      <button
        onClick={toggleDarkMode}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isDark ? 'bg-primary' : 'bg-outline-variant/30'
        }`}
        aria-label="Toggle dark mode"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            isDark ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
