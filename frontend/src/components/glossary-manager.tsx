'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { glossaryApiMethods } from '@/lib/glossary-api';
import { GlossaryEntryResponse, GlossaryEntryCreate } from '@/types/glossary';
import { toast } from 'sonner';

interface GlossaryManagerProps {
  bookId: string;
  onExport?: (entries: GlossaryEntryResponse[]) => void;
}

export function GlossaryManager({ bookId, onExport }: GlossaryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDefinition, setEditDefinition] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newEntry, setNewEntry] = useState<Partial<GlossaryEntryCreate>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  // Fetch glossary entries
  const {
    data: glossaryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['glossary', bookId],
    queryFn: () => glossaryApiMethods.list(bookId),
  });

  const entries: GlossaryEntryResponse[] = glossaryData?.entries || [];
  const filteredEntries = entries.filter(
    (entry) =>
      entry.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.definition && entry.definition.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Update entry
  const updateMutation = useMutation({
    mutationFn: ({ id, definition }: { id: string; definition: string }) =>
      glossaryApiMethods.update(bookId, id, { definition }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary', bookId] });
      setEditingId(null);
      toast.success('Entry updated');
    },
    onError: () => {
      toast.error('Failed to update entry');
    },
  });

  // Delete entry
  const deleteMutation = useMutation({
    mutationFn: (id: string) => glossaryApiMethods.delete(bookId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary', bookId] });
      toast.success('Entry deleted');
    },
    onError: () => {
      toast.error('Failed to delete entry');
    },
  });

  // Create entry
  const createMutation = useMutation({
    mutationFn: (entry: GlossaryEntryCreate) => glossaryApiMethods.create(bookId, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary', bookId] });
      setNewEntry({});
      setShowAddForm(false);
      toast.success('Entry added');
    },
    onError: () => {
      toast.error('Failed to add entry');
    },
  });

  const handleEdit = (entry: GlossaryEntryResponse) => {
    setEditingId(entry.id);
    setEditDefinition(entry.definition || '');
  };

  const handleSaveEdit = (id: string) => {
    updateMutation.mutate({ id, definition: editDefinition });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this glossary entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddEntry = () => {
    if (!newEntry.term?.trim()) {
      toast.error('Please enter a term');
      return;
    }
    createMutation.mutate(newEntry as GlossaryEntryCreate);
  };

  const handleExport = () => {
    onExport?.(entries);
    toast.success('Glossary exported');
  };

  if (isLoading) {
    return <div className="p-8 text-center text-on-surface-variant">Loading glossary...</div>;
  }

  if (isError) {
    return <div className="p-8 text-center text-red-600">Error loading glossary</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">Glossary ({entries.length} terms)</h2>
        {entries.length > 0 && (
          <button
            onClick={handleExport}
            className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-bold text-white hover:opacity-90"
          >
            Export to Back Matter
          </button>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search terms..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
      />

      {/* Add Entry Form */}
      {showAddForm && (
        <div className="space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4">
          <input
            type="text"
            placeholder="New term..."
            value={newEntry.term || ''}
            onChange={(e) => setNewEntry({ ...newEntry, term: e.target.value })}
            className="w-full rounded border border-outline-variant/10 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          <textarea
            placeholder="Definition..."
            value={newEntry.definition || ''}
            onChange={(e) => setNewEntry({ ...newEntry, definition: e.target.value })}
            className="w-full rounded border border-outline-variant/10 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none h-16"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddEntry}
              disabled={createMutation.isPending}
              className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 rounded-lg border border-outline-variant/30 bg-white px-2 py-1.5 text-sm font-bold text-on-surface hover:bg-surface-container-low"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-on-surface-variant mb-4">
            {searchTerm ? 'No glossary entries match your search' : 'No glossary entries yet'}
          </p>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white hover:opacity-90"
            >
              Add Entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-3 hover:border-primary/20 transition-colors"
            >
              {editingId === entry.id ? (
                // Edit Mode
                <div className="space-y-2">
                  <p className="font-semibold text-primary text-sm">{entry.term}</p>
                  <textarea
                    value={editDefinition}
                    onChange={(e) => setEditDefinition(e.target.value)}
                    className="w-full rounded border border-outline-variant/10 bg-white px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none h-20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(entry.id)}
                      disabled={updateMutation.isPending}
                      className="flex-1 rounded-sm bg-primary px-2 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 rounded-sm border border-outline-variant/30 bg-white px-2 py-1 text-xs font-bold text-on-surface hover:bg-surface-container-low"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-primary mb-1">{entry.term}</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {entry.definition || '(no definition)'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="rounded-sm border border-outline-variant/30 bg-white px-2 py-1 text-xs font-bold text-primary hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="rounded-sm border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Entry Button (when not in form mode) */}
      {!showAddForm && filteredEntries.length > 0 && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10"
        >
          + Add Entry
        </button>
      )}
    </div>
  );
}
