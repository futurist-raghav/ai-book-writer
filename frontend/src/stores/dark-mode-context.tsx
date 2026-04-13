'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface DarkModeContextType {
  isDark: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'theme-mode';
const LIGHT_THEME_COLOR = '#e7effd';
const DARK_THEME_COLOR = '#0f1728';

function applyTheme(dark: boolean) {
  const html = document.documentElement;

  html.classList.toggle('dark', dark);
  html.setAttribute('data-theme', dark ? 'dark' : 'light');

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const shouldBeDark = stored === 'dark';

    setIsDark(shouldBeDark);
    applyTheme(shouldBeDark);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    applyTheme(isDark);
  }, [isDark, isHydrated]);

  const toggleDarkMode = () => setIsDark((prev) => !prev);
  const setDarkMode = (dark: boolean) => setIsDark(dark);

  return (
    <DarkModeContext.Provider value={{ isDark, toggleDarkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
}
