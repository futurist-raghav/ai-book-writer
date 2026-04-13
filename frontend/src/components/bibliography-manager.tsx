/**
 * Bibliography Manager - P2.4
 * Sidebar panel for managing bibliography entries for a book
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, Bibliography } from '@/lib/api-client';
import { toast } from 'sonner';

interface BibliographyManagerProps {
  bookId: string;
  onSelectCitation?: (bibliography: Bibliography) => void;
}

interface NewBibliographyState {
  title: string;
  authors: string[];
  year?: number;
  source_type: string;
  source_url: string;
}

export function BibliographyManager({ bookId, onSelectCitation }: BibliographyManagerProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newBibData, setNewBibData] = useState<NewBibliographyState>({
    title: '',
    authors: [''],
    year: undefined,
    source_type: 'article',
    source_url: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch bibliography for book
  const { data: bibData, isLoading, error } = useQuery({
    queryKey: ['bibliography', bookId],
    queryFn: () => apiClient.bibliography.list(bookId),
    enabled: !!bookId,
  });

  const entries = useMemo(() => {
    const items = (bibData?.data?.items || bibData?.data || []) as Bibliography[];
    if (!searchQuery) return items;
    return items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.authors?.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [bibData, searchQuery]);

  // Create bibliography entry
  const createMutation = useMutation({
    mutationFn: () => {
      const authors = newBibData.authors.filter(a => a.trim());
      return apiClient.bibliography.create(bookId, {
        title: newBibData.title,
        authors: authors.length > 0 ? authors : undefined,
        year: newBibData.year,
        source_type: newBibData.source_type,
        source_url: newBibData.source_url || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Bibliography entry added');
      setNewBibData({ title: '', authors: [''], year: undefined, source_type: 'article', source_url: '' });
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ['bibliography', bookId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add bibliography');
    },
  });

  // Delete bibliography entry
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.bibliography.delete(bookId, id),
    onSuccess: () => {
      toast.success('Bibliography entry deleted');
      queryClient.invalidateQueries({ queryKey: ['bibliography', bookId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete bibliography');
    },
  });

  return (
    <div className="flex flex-col h-full bg-surface-container rounded-lg border border-outline-variant/20">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
        <h3 className="font-label text-xs font-bold uppercase text-primary">Bibliography</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
          title="Add source"
        >
          <span className="material-symbols-outlined text-sm">add</span>
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="p-4 border-b border-outline-variant/20 bg-surface-container-lowest space-y-3">
          <input
            type="text"
            placeholder="Source title"
            value={newBibData.title}
            onChange={(e) => setNewBibData({ ...newBibData, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:border-primary outline-none"
          />
          
          <select
            value={newBibData.source_type}
            onChange={(e) => setNewBibData({ ...newBibData, source_type: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:border-primary outline-none"
          >
            <option value="book">Book</option>
            <option value="article">Article</option>
            <option value="website">Website</option>
            <option value="video">Video</option>
            <option value="other">Other</option>
          </select>

          <input
            type="text"
            placeholder="Author (comma-separated)"
            defaultValue={newBibData.authors[0]}
            onChange={(e) => setNewBibData({ ...newBibData, authors: [e.target.value] })}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:border-primary outline-none"
          />

          <input
            type="number"
            placeholder="Year"
            value={newBibData.year || ''}
            onChange={(e) => setNewBibData({ ...newBibData, year: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:border-primary outline-none"
          />

          <input
            type="url"
            placeholder="URL (optional)"
            value={newBibData.source_url}
            onChange={(e) => setNewBibData({ ...newBibData, source_url: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-sm focus:border-primary outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newBibData.title || createMutation.isPending}
              className="flex-1 px-3 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-tight hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {createMutation.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="flex-1 px-3 py-2 rounded-lg border border-outline-variant/30 text-on-surface-variant font-label text-xs font-bold uppercase tracking-tight hover:bg-surface-container transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-outline-variant/20">
        <input
          type="text"
          placeholder="Search sources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-outline-variant/30 text-xs focus:border-primary outline-none"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-on-surface-variant text-xs">Loading...</div>
        ) : error ? (
          <div className="p-4 text-center text-error text-xs">Failed to load bibliography</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-center text-on-surface-variant text-xs">No sources yet</div>
        ) : (
          <div className="space-y-2 p-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onSelectCitation?.(entry)}
                className="group p-3 rounded-lg border border-outline-variant/20 hover:border-primary/30 bg-surface-container-lowest hover:bg-surface-container cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-[10px] font-bold text-primary truncate">{entry.title}</p>
                    {entry.authors && entry.authors.length > 0 && (
                      <p className="text-[9px] text-on-surface-variant truncate">{entry.authors.join(', ')}</p>
                    )}
                    {entry.year && (
                      <p className="text-[9px] text-on-surface-variant/70">({entry.year})</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(entry.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-error/10 hover:text-error opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
