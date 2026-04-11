'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, RotateCcw } from 'lucide-react';

interface BibliographyEntry {
  id: string;
  title: string;
  authors: string;
  year: string;
  source_type: 'book' | 'journal' | 'website' | 'magazine' | 'newspaper' | 'other';
}

interface BibliographyManagerPanelProps {
  entries: BibliographyEntry[];
  onEntriesChange: (entries: BibliographyEntry[]) => void;
  isEditing: boolean;
  onEditToggle: () => void;
  onOpenFullEditor?: () => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
}

export function BibliographyManagerPanel({
  entries,
  onEntriesChange,
  isEditing,
  onEditToggle,
  onOpenFullEditor,
  onSave,
  isSaving = false,
}: BibliographyManagerPanelProps) {
  const [titleInput, setTitleInput] = useState('');
  const [authorsInput, setAuthorsInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [sourceType, setSourceType] = useState<BibliographyEntry['source_type']>('book');

  const handleAddEntry = () => {
    if (!titleInput.trim() || !authorsInput.trim()) {
      toast.error('Enter title and authors');
      return;
    }

    const newEntry: BibliographyEntry = {
      id: `bib-${Date.now()}`,
      title: titleInput.trim(),
      authors: authorsInput.trim(),
      year: yearInput.trim() || new Date().getFullYear().toString(),
      source_type: sourceType,
    };

    onEntriesChange([...entries, newEntry]);
    setTitleInput('');
    setAuthorsInput('');
    setYearInput('');
    setSourceType('book');
    toast.success('Bibliography entry added');
  };

  const handleDeleteEntry = (id: string) => {
    onEntriesChange(entries.filter((entry) => entry.id !== id));
    toast.success('Entry removed');
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all bibliography entries?')) {
      onEntriesChange([]);
      toast.success('Bibliography cleared');
    }
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Bibliography Builder</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage sources and citations for your manuscript
          </p>
        </div>
        <div className="flex gap-2">
          {onOpenFullEditor && !isEditing && (
            <button
              onClick={onOpenFullEditor}
              className="px-4 py-2 bg-secondary/70 text-white rounded-lg font-label font-bold text-sm"
            >
              Full Editor
            </button>
          )}
          {!isEditing ? (
            <button
              onClick={onEditToggle}
              className="px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary text-white rounded-lg font-label font-bold text-sm disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={onEditToggle}
                className="px-4 py-2 bg-surface-container-high text-primary rounded-lg"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              Add Source
            </label>
            <input
              type="text"
              placeholder="Title"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
            />
            <input
              type="text"
              placeholder="Authors (e.g., 'Smith, J. & Jones, A.')"
              value={authorsInput}
              onChange={(e) => setAuthorsInput(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
            />
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Year (e.g., 2024)"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
              />
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as BibliographyEntry['source_type'])}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
              >
                {['book', 'journal', 'website', 'magazine', 'newspaper', 'other'].map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddEntry}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Add Source
            </button>
          </div>

          {entries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Sources ({entries.length})
                </p>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear All
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 text-sm">
                        <p className="font-bold text-primary line-clamp-1">{entry.title}</p>
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">
                          {entry.authors} ({entry.year})
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary capitalize">
                          {entry.source_type}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="flex-shrink-0 p-1 hover:bg-red-100 rounded text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Sources</p>
            <p className="text-primary font-semibold">{entries.length}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Types</p>
            <p className="text-primary font-semibold">
              {entries.length > 0
                ? [...new Set(entries.map((e) => e.source_type))].length
                : '0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Status</p>
            <p className="text-primary font-semibold">{entries.length > 0 ? 'Ready' : 'Empty'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
