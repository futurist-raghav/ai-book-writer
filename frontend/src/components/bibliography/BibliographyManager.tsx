/**
 * Bibliography Manager Component
 * Manage sources and citations for a project
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

interface BibliographySource {
  id: string;
  title: string;
  authors?: string;
  year?: number;
  source_url?: string;
  source_type: 'book' | 'article' | 'website' | 'journal' | 'other';
  citation_formats?: Record<string, string>; // { "APA": "...", "MLA": "..." }
  notes?: string;
}

interface ChapterCitation {
  id: string;
  chapter_id: string;
  bibliography_id: string;
  citation_number: number;
  page_number?: string;
  context_offset?: number;
  context_snippet?: string;
}

interface BibliographyManagerProps {
  bookId: string;
  onSourceAdded?: (source: BibliographySource) => void;
  onSourceDeleted?: (sourceId: string) => void;
}

/**
 * BibliographyManager: UI for managing project sources
 */
export const BibliographyManager: React.FC<BibliographyManagerProps> = ({
  bookId,
  onSourceAdded,
  onSourceDeleted,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'APA' | 'MLA' | 'Chicago'>('APA');
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: new Date().getFullYear(),
    source_url: '',
    source_type: 'book' as const,
    notes: '',
  });

  // Fetch bibliography sources
  const { data: sources = [], isLoading, refetch } = useQuery({
    queryKey: ['bibliography', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/bibliography`);
      if (!response.ok) throw new Error('Failed to fetch sources');
      return response.json();
    },
  });

  // Create source mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/v1/books/${bookId}/bibliography`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create source');
      return response.json();
    },
    onSuccess: (data) => {
      onSourceAdded?.(data);
      refetch();
      setFormData({
        title: '',
        authors: '',
        year: new Date().getFullYear(),
        source_url: '',
        source_type: 'book',
        notes: '',
      });
      setShowForm(false);
    },
  });

  // Delete source mutation
  const deleteMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/v1/books/${bookId}/bibliography/${sourceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete source');
      return response.json();
    },
    onSuccess: (_, sourceId) => {
      onSourceDeleted?.(sourceId);
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">📚 Bibliography</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showForm ? '✕ Cancel' : '+ Add Source'}
          </button>
        </div>

        {/* Add Source Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Book, article, or website title"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Source Type *</label>
                <select
                  value={formData.source_type}
                  onChange={(e) =>
                    setFormData({ ...formData, source_type: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="book">Book</option>
                  <option value="article">Article</option>
                  <option value="website">Website</option>
                  <option value="journal">Journal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Authors</label>
                <input
                  type="text"
                  value={formData.authors}
                  onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Smith, John; Doe, Jane"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Year</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">URL</label>
                <input
                  type="url"
                  value={formData.source_url}
                  onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="https://example.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Any additional notes about this source"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                {createMutation.isPending ? 'Saving...' : 'Save Source'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Sources List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {sources.length} Source{sources.length !== 1 ? 's' : ''}
        </h3>

        {isLoading ? (
          <p className="text-gray-500">Loading sources...</p>
        ) : sources.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded border border-gray-200">
            <p className="text-gray-500 mb-2">No sources yet</p>
            <p className="text-sm text-gray-400">Add your first source to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source: BibliographySource) => (
              <div key={source.id} className="p-4 border border-gray-200 rounded hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{source.title}</h4>
                    {source.authors && (
                      <p className="text-sm text-gray-600">{source.authors}</p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {source.source_type}
                      </span>
                      {source.year && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {source.year}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Delete this source?')) {
                        deleteMutation.mutate(source.id);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 font-semibold"
                  >
                    ✕
                  </button>
                </div>

                {source.source_url && (
                  <p className="text-xs text-blue-500 mb-2">
                    <a href={source.source_url} target="_blank" rel="noreferrer">
                      {source.source_url}
                    </a>
                  </p>
                )}

                {source.notes && (
                  <p className="text-xs text-gray-600 italic">{source.notes}</p>
                )}

                {/* Citation Format Display */}
                {source.citation_formats && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <details>
                      <summary className="text-xs font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                        📋 Citation Formats
                      </summary>
                      <div className="mt-2 space-y-1 text-xs bg-gray-50 p-2 rounded">
                        {Object.entries(source.citation_formats).map(([format, text]) => (
                          <div key={format}>
                            <p className="font-semibold text-gray-700">{format}:</p>
                            <code className="text-gray-600">{text}</code>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Citation Format Reference */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Supported Citation Formats</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>APA:</strong> Author (Year). Title. Publisher.</li>
          <li>• <strong>MLA:</strong> Author. "Title." Publisher, Year.</li>
          <li>• <strong>Chicago:</strong> Author. Title. Publisher, Year.</li>
          <li>• <strong>IEEE:</strong> [#] Initials. Surname, Title in Quotes, Publisher, Year.</li>
        </ul>
      </div>
    </div>
  );
};
