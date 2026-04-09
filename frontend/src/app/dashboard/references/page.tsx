'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

interface Reference {
  id: string;
  title: string;
  author?: string;
  url?: string;
  source_type: 'book' | 'article' | 'website' | 'paper' | 'video' | 'other';
  citation_format: 'APA' | 'MLA' | 'Chicago' | 'IEEE' | 'Harvard';
  citation_text: string;
  notes?: string;
  linked_chapters?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface Citation {
  text: string;
  format: 'APA' | 'MLA' | 'Chicago' | 'IEEE' | 'Harvard';
}

export default function ReferencesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [citationFormat, setCitationFormat] = useState<'APA' | 'MLA' | 'Chicago' | 'IEEE' | 'Harvard'>('APA');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  
  const [newReferenceTitle, setNewReferenceTitle] = useState('');
  const [newReferenceAuthor, setNewReferenceAuthor] = useState('');
  const [newReferenceUrl, setNewReferenceUrl] = useState('');
  const [newReferenceSourceType, setNewReferenceSourceType] = useState<'book' | 'article' | 'website' | 'paper' | 'video' | 'other'>('article');
  const [newReferenceNotes, setNewReferenceNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['references', searchQuery],
    queryFn: () => apiClient.references.list({ search: searchQuery }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      author?: string;
      source_type: 'book' | 'article' | 'website' | 'paper' | 'video' | 'other';
      url?: string;
      notes?: string;
      chapter_id?: string;
      extracted_text?: string;
    }) => apiClient.references.create(payload),
    onSuccess: () => {
      toast.success('Reference added');
      queryClient.invalidateQueries({ queryKey: ['references'] });
      setIsCreating(false);
      setNewReferenceTitle('');
      setNewReferenceAuthor('');
      setNewReferenceUrl('');
      setNewReferenceSourceType('article');
      setNewReferenceNotes('');
    },
    onError: () => {
      toast.error('Failed to add reference');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.references.delete(id),
    onSuccess: () => {
      toast.success('Reference deleted');
      queryClient.invalidateQueries({ queryKey: ['references'] });
    },
    onError: () => {
      toast.error('Failed to delete reference');
    },
  });

  const handleAddReference = () => {
    if (!newReferenceTitle.trim()) return;
    
    createMutation.mutate({
      title: newReferenceTitle.trim(),
      author: newReferenceAuthor.trim() || undefined,
      url: newReferenceUrl.trim() || undefined,
      source_type: newReferenceSourceType,
      notes: newReferenceNotes.trim() || undefined,
    });
  };

  const references: Reference[] = data?.data?.items || [];
  const filteredReferences = references.filter(ref => 
    sourceTypeFilter === 'all' || ref.source_type === sourceTypeFilter
  );

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Header */}
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Writing Support</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body">References</h2>
          <p className="font-label text-sm text-on-surface-variant mt-4 max-w-2xl">
            Manage your sources, citations, and research materials. Build bibliographies automatically in APA, MLA, Chicago, IEEE, and Harvard formats.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="w-fit flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 rounded-lg font-label font-bold text-sm shadow-md hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">{isCreating ? 'close' : 'add'}</span>
          {isCreating ? 'Cancel' : 'Add Reference'}
        </button>
      </div>

      {/* Controls */}
      <div className="mb-8 bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-5 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-lg">search</span>
          <input
            type="text"
            placeholder="Search references..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-12 pr-4 py-3 font-body text-sm placeholder:text-on-surface-variant/50 focus:border-secondary focus:ring-secondary/20 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
          >
            <option value="all">All sources</option>
            <option value="book">Books</option>
            <option value="article">Articles</option>
            <option value="website">Websites</option>
            <option value="paper">Papers</option>
            <option value="video">Videos</option>
          </select>

          <select
            value={citationFormat}
            onChange={(e) => setCitationFormat(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
          >
            <option value="APA">APA Format</option>
            <option value="MLA">MLA Format</option>
            <option value="Chicago">Chicago Format</option>
            <option value="IEEE">IEEE Format</option>
            <option value="Harvard">Harvard Format</option>
          </select>
        </div>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10 mb-10">
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-6">Add New Reference</h3>
          
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Title *</label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                placeholder="Reference title"
                value={newReferenceTitle}
                onChange={(e) => setNewReferenceTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Author/Creator</label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                placeholder="Author name"
                value={newReferenceAuthor}
                onChange={(e) => setNewReferenceAuthor(e.target.value)}
              />
            </div>

            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Source Type</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                value={newReferenceSourceType}
                onChange={(e) => setNewReferenceSourceType(e.target.value as any)}
              >
                <option value="article">Article</option>
                <option value="book">Book</option>
                <option value="website">Website</option>
                <option value="paper">Research Paper</option>
                <option value="video">Video</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">URL</label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                placeholder="https://..."
                type="url"
                value={newReferenceUrl}
                onChange={(e) => setNewReferenceUrl(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Notes</label>
              <textarea
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors min-h-[100px] resize-none"
                placeholder="Any relevant notes about this reference..."
                value={newReferenceNotes}
                onChange={(e) => setNewReferenceNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAddReference}
              disabled={createMutation.isPending || !newReferenceTitle.trim()}
              className="bg-secondary text-white px-6 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:bg-secondary/90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {createMutation.isPending && <Spinner className="w-4 h-4" />}
              Add Reference
            </button>
          </div>
        </div>
      )}

      {/* References List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-8 h-8 text-primary" />
          </div>
        ) : filteredReferences.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant/20">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-4">library_books</span>
            <p className="text-on-surface-variant text-sm mb-6">No references found. Build your research library by adding sources.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all inline-block"
            >
              + Add Reference
            </button>
          </div>
        ) : (
          filteredReferences.map((ref) => (
            <div key={ref.id} className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-5 hover:bg-surface-container-high transition-colors group">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-primary mb-1">{ref.title}</h3>
                  {ref.author && <p className="text-xs text-on-surface-variant">{ref.author}</p>}
                  <span className="inline-block mt-2 px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded uppercase">
                    {ref.source_type}
                  </span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(ref.id)}
                  disabled={deleteMutation.isPending}
                  className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>

              {ref.notes && <p className="text-[0.875rem] text-on-surface-variant mb-3 italic">{ref.notes}</p>}

              {ref.url && (
                <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-secondary text-xs font-medium hover:underline block mb-2">
                  {ref.url}
                </a>
              )}

              <div className="bg-surface-container-low rounded p-3 font-mono text-[11px] text-on-surface-variant break-words overflow-auto max-h-20">
                {ref.citation_text || `${ref.author || 'Unknown'}. ${ref.title}. ${new Date(ref.created_at).getFullYear()}.`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
