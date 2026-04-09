/**
 * Keyboard Shortcuts Context
 * Manages keyboard shortcuts state globally
 */

'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface KeyboardShortcutsContextType {
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  return (
    <KeyboardShortcutsContext.Provider value={{ helpOpen, openHelp, closeHelp }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider');
  }
  return context;
}
