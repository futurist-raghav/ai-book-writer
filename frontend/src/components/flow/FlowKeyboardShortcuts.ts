/**
 * Flow Engine Keyboard Shortcuts
 * Handles Cmd/Ctrl+F (filter), Cmd+E (export), Cmd+D (delete selected)
 */

export interface KeyboardShortcut {
  key: string;
  label: string;
  description: string;
  isMac: boolean;
}

export const FLOW_SHORTCUTS = {
  FILTER: {
    key: 'f',
    label: 'Cmd/Ctrl + F',
    description: 'Focus on filter search',
    modifiers: ['meta', 'control'],
  },
  EXPORT: {
    key: 'e',
    label: 'Cmd/Ctrl + E',
    description: 'Export selected events as CSV',
    modifiers: ['meta', 'control'],
  },
  SELECT_ALL: {
    key: 'a',
    label: 'Cmd/Ctrl + A',
    description: 'Select all events',
    modifiers: ['meta', 'control'],
  },
  CLEAR_SELECTION: {
    key: 'Escape',
    label: 'Escape',
    description: 'Clear all selections',
    modifiers: [],
  },
  DELETE_SELECTED: {
    key: 'Delete',
    label: 'Delete',
    description: 'Delete selected events (with confirmation)',
    modifiers: [],
  },
  TOGGLE_GANTT: {
    key: 'g',
    label: 'Cmd/Ctrl + Shift + G',
    description: 'Switch to Gantt view',
    modifiers: ['meta', 'control', 'shift'],
  },
  TOGGLE_ANALYTICS: {
    key: 'k',
    label: 'Cmd/Ctrl + Shift + K',
    description: 'Switch to Analytics view',
    modifiers: ['meta', 'control', 'shift'],
  },
};

/**
 * Custom hook for handling flow keyboard shortcuts
 */
export function useFlowKeyboardShortcuts(
  handlers: {
    onFilterFocus?: () => void;
    onExport?: () => void;
    onSelectAll?: () => void;
    onClearSelection?: () => void;
    onDeleteSelected?: () => void;
    onToggleGantt?: () => void;
    onToggleAnalytics?: () => void;
  },
  enabled = true
) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return;

    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl + F: Focus filter
    if (modKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      handlers.onFilterFocus?.();
    }

    // Cmd/Ctrl + E: Export
    if (modKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      handlers.onExport?.();
    }

    // Cmd/Ctrl + A: Select all
    if (modKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      handlers.onSelectAll?.();
    }

    // Escape: Clear selection
    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onClearSelection?.();
    }

    // Delete: Delete selected
    if (event.key === 'Delete' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handlers.onDeleteSelected?.();
    }

    // Cmd/Ctrl + Shift + G: Toggle Gantt
    if (modKey && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      handlers.onToggleGantt?.();
    }

    // Cmd/Ctrl + Shift + K: Toggle Analytics
    if (modKey && event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      handlers.onToggleAnalytics?.();
    }
  };

  return { handleKeyDown };
}

/**
 * Get platform-appropriate shortcut label
 */
export function getShortcutLabel(shortcut: typeof FLOW_SHORTCUTS[keyof typeof FLOW_SHORTCUTS]): string {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  if (isMac) {
    return shortcut.label.replace('Cmd/Ctrl', 'Cmd');
  }
  return shortcut.label.replace('Cmd/Ctrl', 'Ctrl');
}

/**
 * Get all shortcuts formatted for display
 */
export function getFormattedShortcuts() {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  return Object.entries(FLOW_SHORTCUTS).map(([key, shortcut]) => ({
    id: key,
    label: isMac ? shortcut.label.replace('Cmd/Ctrl', 'Cmd') : shortcut.label.replace('Cmd/Ctrl', 'Ctrl'),
    description: shortcut.description,
  }));
}
