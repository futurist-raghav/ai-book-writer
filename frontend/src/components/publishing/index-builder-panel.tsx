'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, RotateCcw } from 'lucide-react';

interface IndexEntry {
  term: string;
  pages: string; // e.g., "5, 12-15, 23"
}

interface IndexBuilderPanelProps {
  entries: IndexEntry[];
  mode: 'auto' | 'manual';
  onModeChange: (mode: 'auto' | 'manual') => void;
  onEntriesChange: (entries: IndexEntry[]) => void;
  isEditing: boolean;
  onEditToggle: () => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
}

export function IndexBuilderPanel({
  entries,
  mode,
  onModeChange,
  onEntriesChange,
  isEditing,
  onEditToggle,
  onSave,
  isSaving = false,
}: IndexBuilderPanelProps) {
  const [termInput, setTermInput] = useState('');
  const [pagesInput, setPagesInput] = useState('');

  const handleAddEntry = () => {
    if (!termInput.trim() || !pagesInput.trim()) {
      toast.error('Enter both index term and pages');
      return;
    }

    const newEntry: IndexEntry = {
      term: termInput.trim(),
      pages: pagesInput.trim(),
    };

    onEntriesChange([...entries, newEntry]);
    setTermInput('');
    setPagesInput('');
    toast.success('Index entry added');
  };

  const handleDeleteEntry = (index: number) => {
    onEntriesChange(entries.filter((_, i) => i !== index));
    toast.success('Entry removed');
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all index entries?')) {
      onEntriesChange([]);
      toast.success('Index cleared');
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
          <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Index Builder</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {mode === 'auto'
              ? 'Auto-generated index from key concepts'
              : 'Manually create subject index with page references'}
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={onEditToggle}
            className="px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Mode</p>
            <div className="flex gap-2">
              {(['auto', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  className={`px-3 py-1 rounded-lg text-sm font-bold uppercase transition-colors ${
                    mode === m
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low text-primary border border-outline-variant/20'
                  }`}
                >
                  {m === 'auto' ? 'Auto' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
              Add Index Entry
            </label>
            <input
              type="text"
              placeholder="Index term (e.g., 'Chapter 1: Arrival')"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
            />
            <input
              type="text"
              placeholder="Page references (e.g., '5, 12-15, 23')"
              value={pagesInput}
              onChange={(e) => setPagesInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
            />
            <button
              onClick={handleAddEntry}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {entries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Entries ({entries.length})
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
                {entries.map((entry, index) => (
                  <div key={`${entry.term}-${index}`} className="rounded-lg bg-surface-container-low p-3 border border-outline-variant/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-primary">{entry.term}</p>
                        <p className="text-xs text-on-surface-variant mt-1">pp. {entry.pages}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(index)}
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
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Mode</p>
            <p className="text-primary font-semibold capitalize">{mode}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Entries</p>
            <p className="text-primary font-semibold">{entries.length}</p>
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
