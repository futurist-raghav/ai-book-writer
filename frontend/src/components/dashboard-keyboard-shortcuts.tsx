/**
 * Dashboard Keyboard Shortcuts Provider
 * Handles keyboard shortcuts throughout the dashboard
 */

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help';
import { KeyboardShortcutsProvider, useKeyboardShortcutsContext } from '@/stores/keyboard-shortcuts-context';
import type { ShortcutAction } from '@/lib/keyboard-shortcuts';

interface DashboardKeyboardShortcutsProps {
  children: React.ReactNode;
}

/**
 * Inner component that uses the context
 */
function DashboardKeyboardShortcutsInner({ children }: DashboardKeyboardShortcutsProps) {
  const router = useRouter();
  const { helpOpen, openHelp, closeHelp } = useKeyboardShortcutsContext();

  // Handle save action
  const handleSave = useCallback(() => {
    // Dispatch custom event that editor components can listen to
    const event = new CustomEvent('keyboard-shortcut:save');
    window.dispatchEvent(event);
  }, []);

  // Handle undo action
  const handleUndo = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:undo');
    window.dispatchEvent(event);
  }, []);

  // Handle redo action
  const handleRedo = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:redo');
    window.dispatchEvent(event);
  }, []);

  // Handle find action
  const handleFind = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:find');
    window.dispatchEvent(event);
  }, []);

  // Handle formatting
  const handleBold = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:bold');
    window.dispatchEvent(event);
  }, []);

  const handleItalic = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:italic');
    window.dispatchEvent(event);
  }, []);

  const handleUnderline = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:underline');
    window.dispatchEvent(event);
  }, []);

  const handleCode = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:code');
    window.dispatchEvent(event);
  }, []);

  // Handle display modes
  const handleFocusMode = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:focus-mode');
    window.dispatchEvent(event);
  }, []);

  const handleZenMode = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:zen-mode');
    window.dispatchEvent(event);
  }, []);

  const handleTypewriterMode = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:typewriter-mode');
    window.dispatchEvent(event);
  }, []);

  // Register all keyboard shortcuts
  useKeyboardShortcuts({
    save: handleSave,
    undo: handleUndo,
    redo: handleRedo,
    find: handleFind,
    bold: handleBold,
    italic: handleItalic,
    underline: handleUnderline,
    code: handleCode,
    'focus-mode': handleFocusMode,
    'zen-mode': handleZenMode,
    'typewriter-mode': handleTypewriterMode,
    help: openHelp,
  });

  return (
    <>
      {children}
      <KeyboardShortcutsHelp isOpen={helpOpen} onClose={closeHelp} />
    </>
  );
}

/**
 * Provider component that adds keyboard shortcuts to dashboard
 */
export function DashboardKeyboardShortcuts({ children }: DashboardKeyboardShortcutsProps) {
  return (
    <KeyboardShortcutsProvider>
      <DashboardKeyboardShortcutsInner>
        {children}
      </DashboardKeyboardShortcutsInner>
    </KeyboardShortcutsProvider>
  );
}
