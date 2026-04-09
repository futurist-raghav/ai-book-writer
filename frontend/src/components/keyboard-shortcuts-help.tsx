/**
 * Keyboard Shortcuts Help Modal
 */

'use client';

import { useEffect, useState } from 'react';
import {
  getShortcutsByCategory,
  formatShortcut,
  getPlatformShortcut,
} from '@/lib/keyboard-shortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const [selectedCategory, setSelectedCategory] = useState<'editor' | 'navigation' | 'general'>('editor');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const editorShortcuts = getShortcutsByCategory('editor');
  const navigationShortcuts = getShortcutsByCategory('navigation');
  const generalShortcuts = getShortcutsByCategory('general');

  const currentShortcuts =
    selectedCategory === 'editor'
      ? editorShortcuts
      : selectedCategory === 'navigation'
        ? navigationShortcuts
        : generalShortcuts;

  const categories: Array<{ name: string; value: 'editor' | 'navigation' | 'general' }> = [
    { name: 'Editor', value: 'editor' },
    { name: 'Display Modes', value: 'navigation' },
    { name: 'General', value: 'general' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[999] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 z-[1000] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div>
            <h2 className="text-2xl font-body font-bold text-primary">Keyboard Shortcuts</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Master the app with keyboard shortcuts. Press <kbd className="px-2 py-1 bg-surface-container-high rounded text-xs font-mono">?</kbd> anytime to open this.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors"
            title="Close (Esc)"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Category Tabs */}
          <div className="w-40 bg-surface-container-high border-r border-outline-variant/10 overflow-y-auto">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`w-full px-4 py-3 text-left text-sm font-label font-bold uppercase tracking-tight transition-all ${
                  selectedCategory === category.value
                    ? 'bg-tertiary/20 text-tertiary border-l-4 border-tertiary'
                    : 'text-on-surface-variant hover:bg-surface-container-highest border-l-4 border-transparent'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Shortcuts List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {currentShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors group"
                >
                  <div>
                    <div className="font-label text-sm font-bold text-primary">{shortcut.name}</div>
                    <div className="font-body text-xs text-on-surface-variant mt-0.5">
                      {shortcut.description}
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-4">
                    {getPlatformShortcut(shortcut).map((key, keyIndex) => (
                      <div key={keyIndex} className="flex items-center gap-1">
                        <kbd className="px-2.5 py-1 bg-tertiary/20 text-tertiary rounded-md font-mono text-xs font-semibold border border-tertiary/30 group-hover:bg-tertiary/40 transition-colors whitespace-nowrap">
                          {key}
                        </kbd>
                        {keyIndex < getPlatformShortcut(shortcut).length - 1 && (
                          <span className="text-on-surface-variant text-xs">+</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {currentShortcuts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-on-surface-variant">No shortcuts in this category</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/10 bg-surface-container-high">
          <p className="text-xs text-on-surface-variant text-center">
            Press <kbd className="px-2 py-1 bg-surface-container rounded text-xs font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
}
