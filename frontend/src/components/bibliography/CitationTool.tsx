/**
 * Citation Tool for TipTap Editor
 * Allows inserting citations with footnotes/endnotes
 */

import React from 'react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CitationAttributes {
  citationId: string;
  bibliographyId: string;
  format: 'superscript' | 'parenthetical' | 'footnote';
  number?: number;
}

/**
 * TipTap Extension for Citations
 */
export const Citation = Extension.create({
  name: 'citation',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      citationId: {
        default: null,
      },
      bibliographyId: {
        default: null,
      },
      format: {
        default: 'superscript',
      },
      number: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-citation]',
        getAttrs: (dom) => ({
          citationId: dom.getAttribute('data-citation-id'),
          bibliographyId: dom.getAttribute('data-bibliography-id'),
          format: dom.getAttribute('data-citation-format') || 'superscript',
          number: dom.getAttribute('data-citation-number'),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-citation': 'true',
        'data-citation-id': HTMLAttributes.citationId,
        'data-bibliography-id': HTMLAttributes.bibliographyId,
        'data-citation-format': HTMLAttributes.format,
        'data-citation-number': HTMLAttributes.number,
        class: 'citation-marker',
        style: 'color: #0066cc; cursor: pointer; text-decoration: underline;',
      },
      `[${HTMLAttributes.number || '?'}]`,
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl + Shift + C to open citation dialog
      'Mod-Shift-c': () => {
        // Dispatch custom event for parent component
        window.dispatchEvent(new CustomEvent('openCitationDialog'));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('citationClick'),
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;
              if (target.classList.contains('citation-marker')) {
                const citationId = target.getAttribute('data-citation-id');
                window.dispatchEvent(
                  new CustomEvent('citationClicked', { detail: { citationId } })
                );
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Citation Toolbar Button
 */
export interface CitationToolbarProps {
  editor: any;
  bibliographySources: Array<{ id: string; title: string; authors?: string }>;
  disabled?: boolean;
  onCitationInsert?: (citationId: string, bibliographyId: string) => void;
}

export const CitationToolbar: React.FC<CitationToolbarProps> = ({
  editor,
  bibliographySources,
  disabled,
  onCitationInsert,
}) => {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredSources = bibliographySources.filter(
    (source) =>
      source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.authors?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const insertCitation = (sourceId: string, sourceTitle: string) => {
    if (!editor) return;

    const citationId = `citation_${Date.now()}`;

    // Insert citation marker at cursor
    editor.chain().focus().insertContent({
      type: 'citation',
      attrs: {
        citationId,
        bibliographyId: sourceId,
        format: 'superscript',
      },
    }).run();

    onCitationInsert?.(citationId, sourceId);
    setShowDropdown(false);
    setSearchQuery('');
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={disabled || bibliographySources.length === 0}
        title="Insert Citation (Cmd/Ctrl+Shift+C)"
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
      >
        <span>📎</span>
        <span className="text-sm">Cite</span>
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredSources.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {bibliographySources.length === 0
                  ? 'No sources added yet'
                  : 'No matching sources'}
              </div>
            ) : (
              filteredSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => insertCitation(source.id, source.title)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                >
                  <p className="font-semibold text-sm text-gray-900">{source.title}</p>
                  {source.authors && (
                    <p className="text-xs text-gray-500">{source.authors}</p>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
            💡 Drag to move, Backspace to delete citation
          </div>
        </div>
      )}
    </div>
  );
};
