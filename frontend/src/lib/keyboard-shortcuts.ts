/**
 * Keyboard Shortcuts Configuration
 * 
 * Centralized keyboard shortcuts used throughout the app.
 * Supports Mac (Cmd) and Windows/Linux (Ctrl) modifiers.
 */

export type ShortcutAction = 
  | 'save'
  | 'undo'
  | 'redo'
  | 'find'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'code'
  | 'focus-mode'
  | 'zen-mode'
  | 'typewriter-mode'
  | 'help';

export interface KeyboardShortcut {
  name: string;
  description: string;
  keys: string[];
  action: ShortcutAction;
  category: 'editor' | 'navigation' | 'general';
  mac?: boolean;
  windows?: boolean;
  linux?: boolean;
}

export const isMac = () => {
  if (typeof window === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
};

export const getModifierKey = () => isMac() ? 'Cmd' : 'Ctrl';

/**
 * All keyboard shortcuts available in the app
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Editor shortcuts
  {
    name: 'Save',
    description: 'Save current chapter',
    keys: [getModifierKey(), 'S'],
    action: 'save',
    category: 'editor',
  },
  {
    name: 'Undo',
    description: 'Undo last edit',
    keys: [getModifierKey(), 'Z'],
    action: 'undo',
    category: 'editor',
  },
  {
    name: 'Redo',
    description: 'Redo last undone edit',
    keys: [getModifierKey(), 'Shift', 'Z'],
    action: 'redo',
    category: 'editor',
  },
  {
    name: 'Find',
    description: 'Find text in chapter',
    keys: [getModifierKey(), 'F'],
    action: 'find',
    category: 'editor',
  },
  {
    name: 'Bold',
    description: 'Bold selected text',
    keys: [getModifierKey(), 'B'],
    action: 'bold',
    category: 'editor',
  },
  {
    name: 'Italic',
    description: 'Italicize selected text',
    keys: [getModifierKey(), 'I'],
    action: 'italic',
    category: 'editor',
  },
  {
    name: 'Underline',
    description: 'Underline selected text',
    keys: [getModifierKey(), 'U'],
    action: 'underline',
    category: 'editor',
  },
  {
    name: 'Code',
    description: 'Mark selected text as code',
    keys: [getModifierKey(), 'E'],
    action: 'code',
    category: 'editor',
  },

  // Display mode shortcuts
  {
    name: 'Focus Mode',
    description: 'Enter focus mode (dim everything except current paragraph)',
    keys: [getModifierKey(), 'Shift', 'F'],
    action: 'focus-mode',
    category: 'navigation',
  },
  {
    name: 'Zen Mode',
    description: 'Enter zen mode (fullscreen, hide UI)',
    keys: [getModifierKey(), 'Shift', 'Z'],
    action: 'zen-mode',
    category: 'navigation',
  },
  {
    name: 'Typewriter Mode',
    description: 'Toggle typewriter mode (cursor stays centered)',
    keys: [getModifierKey(), 'Shift', 'T'],
    action: 'typewriter-mode',
    category: 'navigation',
  },

  // General shortcuts
  {
    name: 'Help',
    description: 'Show keyboard shortcuts help',
    keys: ['Cmd/Ctrl', '?'],
    action: 'help',
    category: 'general',
  },
];

/**
 * Get human-readable keyboard shortcut string
 * @param shortcut The keyboard shortcut
 * @returns Formatted string like "Cmd+S" or "Ctrl+Shift+Z"
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  return shortcut.keys.join('+');
}

/**
 * Get platform-specific shortcut keys
 * @param shortcut The keyboard shortcut
 * @returns Array of keys adjusted for current platform
 */
export function getPlatformShortcut(shortcut: KeyboardShortcut): string[] {
  const keys = [...shortcut.keys];
  const modifier = getModifierKey();
  
  // Replace generic modifier with platform-specific one
  if (keys[0] === 'Cmd' || keys[0] === 'Ctrl' || keys[0] === 'Cmd/Ctrl') {
    keys[0] = modifier;
  }
  
  return keys;
}

/**
 * Convert keyboard event to keys array for comparison
 * @param event The keyboard event
 * @returns Array of pressed keys
 */
export function getKeysFromEvent(event: KeyboardEvent): string[] {
  const keys: string[] = [];
  
  if (event.ctrlKey || event.metaKey) {
    keys.push(isMac() ? 'Cmd' : 'Ctrl');
  }
  if (event.shiftKey) {
    keys.push('Shift');
  }
  if (event.altKey) {
    keys.push('Alt');
  }
  
  // Add the main key
  const key = event.key.toUpperCase();
  if (key.length === 1) {
    keys.push(key);
  } else if (key === 'ENTER') {
    keys.push('Enter');
  } else if (key === '?') {
    keys.push('?');
  }
  
  return keys;
}

/**
 * Check if keyboard event matches a shortcut
 * @param event The keyboard event
 * @param shortcut The shortcut to match
 * @returns True if the event matches the shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const eventKeys = getKeysFromEvent(event);
  const shortcutKeys = getPlatformShortcut(shortcut);
  
  // Must have same number of keys pressed
  if (eventKeys.length !== shortcutKeys.length) {
    return false;
  }
  
  // All keys must match
  return eventKeys.every((key, index) => key === shortcutKeys[index]);
}

/**
 * Find shortcut by action
 * @param action The shortcut action
 * @returns The shortcut object if found
 */
export function findShortcutByAction(action: ShortcutAction): KeyboardShortcut | undefined {
  return KEYBOARD_SHORTCUTS.find(s => s.action === action);
}

/**
 * Get shortcuts by category
 * @param category The category to filter by
 * @returns Array of shortcuts in that category
 */
export function getShortcutsByCategory(category: 'editor' | 'navigation' | 'general'): KeyboardShortcut[] {
  return KEYBOARD_SHORTCUTS.filter(s => s.category === category);
}
