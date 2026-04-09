/**
 * Hook to handle keyboard shortcuts
 * 
 * Usage:
 * useKeyboardShortcuts({
 *   'save': () => handleSave(),
 *   'undo': () => handleUndo(),
 * });
 */

import { useEffect } from 'react';
import {
  type ShortcutAction,
  matchesShortcut,
  findShortcutByAction,
  KEYBOARD_SHORTCUTS,
} from './keyboard-shortcuts';

export type ShortcutHandler = {
  [key in ShortcutAction]?: () => void;
};

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  suppressInInputs?: boolean;
}

/**
 * Hook to handle keyboard shortcuts globally
 * @param handlers Map of action names to handler functions
 * @param options Configuration options
 */
export function useKeyboardShortcuts(
  handlers: ShortcutHandler,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, suppressInInputs = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if in input/textarea and suppressInInputs is true
      // (unless it's for help or mode toggles which should work everywhere)
      if (suppressInInputs) {
        const target = event.target as HTMLElement;
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target.contentEditable === 'true' && event.key !== '?');

        if (isInput) return;
      }

      // Check all shortcuts
      for (const shortcut of KEYBOARD_SHORTCUTS) {
        if (matchesShortcut(event, shortcut) && handlers[shortcut.action]) {
          event.preventDefault();
          handlers[shortcut.action]?.();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled, suppressInInputs]);
}

/**
 * Hook to trap keyboard shortcuts in a specific element
 * Useful for modal dialogs or specific form sections
 * @param ref Reference to the element
 * @param handlers Map of action names to handler functions
 */
export function useElementKeyboardShortcuts(
  ref: React.RefObject<HTMLElement>,
  handlers: ShortcutHandler
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of KEYBOARD_SHORTCUTS) {
        if (matchesShortcut(event, shortcut) && handlers[shortcut.action]) {
          event.preventDefault();
          handlers[shortcut.action]?.();
          return;
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [ref, handlers]);
}

/**
 * Get display text for a shortcut key combination
 * @param action The action to get the shortcut for
 * @returns Formatted string like "Cmd+S"
 */
export function getShortcutDisplay(action: ShortcutAction): string | null {
  const shortcut = findShortcutByAction(action);
  if (!shortcut) return null;
  return shortcut.keys.join('+');
}
