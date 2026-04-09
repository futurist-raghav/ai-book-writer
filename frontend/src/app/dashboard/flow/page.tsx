'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

interface Flow {
  id: string;
  title?: string;
  summary?: string;
  description?: string;
  type?: string;
  tags?: string[];
  people?: Array<string | { name: string; relationship?: string }>;
  location?: string;
  is_featured: boolean;
  order_index: number;
  created_at?: string;
  flow_date?: string;
}

const FLOW_ITEM_TYPES = {
  novel: ['major-event', 'turning-point', 'climax', 'character-arc', 'twist', 'resolution'],
  screenplay: ['act-break', 'scene-transition', 'plot-point', 'reversal', 'climax', 'resolution'],
  research: ['thesis-statement', 'evidence', 'counterargument', 'synthesis', 'conclusion', 'implications'],
  academic: ['introduction', 'literature-review', 'methodology', 'analysis', 'discussion', 'conclusion'],
  songwriting: ['verse', 'chorus', 'bridge', 'refrain', 'outro', 'final-chorus'],
  textbook: ['lesson-intro', 'concept', 'example', 'exercise', 'review', 'assessment'],
  generic: ['milestone', 'checkpoint', 'transition', 'highlight', 'note', 'reflection'],
};

type ProjectCategory = 'novel' | 'screenplay' | 'research' | 'academic' | 'songwriting' | 'textbook' | 'generic';

function getProjectCategory(projectType: ProjectType): ProjectCategory {
  if (projectType.includes('screenplay') || projectType.includes('script')) return 'screenplay';
  if (projectType.includes('research') || projectType.includes('paper')) return 'research';
  if (projectType.includes('thesis') || projectType.includes('textbook')) return 'academic';
  if (projectType.includes('songwriting')) return 'songwriting';
  if (projectType.includes('textbook')) return 'textbook';
  return 'novel';
}

export default function FlowPage() {
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();

  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Flow>>({
    type: 'milestone',
    title: '',
    description: '',
    tags: [],
  });

  const projectType = (selectedBook?.project_type || 'novel') as ProjectType;
  const config = ProjectTypeConfigService.getConfig(projectType);
  const flowPageName = config.flowPageName;
  const projectCategory = getProjectCategory(projectType);
  const flowTypes = FLOW_ITEM_TYPES[projectCategory] || FLOW_ITEM_TYPES.generic;

  // Fetch book details (flow stored in project_settings)
  const { data: bookData, isLoading: bookLoading } = useQuery({
    queryKey: ['book', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.books.get(selectedBook.id) : null),
    enabled: !!selectedBook?.id,
  });

  // Fetch events as fallback
  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.events.list({ limit: 100 }),
  });

  const flows: Flow[] = useMemo(() => {
    try {
      const settings = bookData?.data?.project_settings || {};
      const stored = settings.flow_items as Flow[] | undefined;
      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }
      // Fallback: convert events to flow items
      const events = eventsData?.data?.items || [];
      return events.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.content || e.summary,
        type: e.category || 'milestone',
        tags: e.tags || [],
        people: e.people || [],
        location: e.location,
        is_featured: e.is_featured || false,
        order_index: e.order_index || 0,
        created_at: e.created_at,
        flow_date: e.event_date,
      }));
    } catch {
      return [];
    }
  }, [bookData, eventsData]);

  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      if (selectedType && f.type !== selectedType) return false;
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        return f.title?.toLowerCase().includes(lower) || f.description?.toLowerCase().includes(lower);
      }
      return true;
    });
  }, [flows, selectedType, searchQuery]);

  const saveFlows = useMutation({
    mutationFn: (updatedFlows: Flow[]) =>
      selectedBook?.id
        ? apiClient.books.update(selectedBook.id, {
            project_settings: {
              ...(bookData?.data?.project_settings || {}),
              flow_items: updatedFlows,
            },
          })
        : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('Flow saved');
      queryClient.invalidateQueries({ queryKey: ['book', selectedBook?.id] });
      setIsCreating(false);
      setEditingId(null);
      setFormData({ type: 'milestone', title: '', description: '', tags: [] });
    },
    onError: () => {
      toast.error('Failed to save flow');
    },
  });

  const handleSaveFlow = async () => {
    if (!formData.title?.trim()) {
      toast.error('Title is required');
      return;
    }

    const updatedFlows = editingId
      ? flows.map((f) => (f.id === editingId ? { ...f, ...formData } : f))
      : [
          ...flows,
          {
            ...formData,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
            type: formData.type || 'milestone',
            title: formData.title,
            description: formData.description || '',
            tags: formData.tags || [],
            is_featured: false,
            order_index: flows.length,
          } as Flow,
        ];

    await saveFlows.mutateAsync(updatedFlows);
  };

  const handleDeleteFlow = async (id: string) => {
    const updatedFlows = flows.filter((f) => f.id !== id);
    await saveFlows.mutateAsync(updatedFlows);
  };

  const handleEditFlow = (flow: Flow) => {
    setFormData(flow);
    setEditingId(flow.id);
    setIsCreating(true);
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    const updatedFlows = flows.map((f) => (f.id === id ? { ...f, is_featured: !featured } : f));
    await saveFlows.mutateAsync(updatedFlows);
  };

  if (bookLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Header */}
      <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Project Progression</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body mb-2">
            {flowPageName}
          </h2>
          <p className="font-label text-sm text-on-surface-variant max-w-2xl">
            Map the progression and key moments in your {projectType}. Organize milestones, plot points, and transitions in sequence.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ type: flowTypes[0] || 'milestone', title: '', description: '', tags: [] });
            setEditingId(null);
            setIsCreating(true);
          }}
          className="w-fit rounded-lg bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 font-label text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined inline mr-2">add</span>
          Add to Flow
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-8 flex gap-2 border-b border-outline-variant/20">
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            viewMode === 'timeline'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined inline mr-2 text-sm">timeline</span>
          Timeline
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            viewMode === 'grid'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined inline mr-2 text-sm">dashboard</span>
          Grid
        </button>
      </div>

      {/* Search & Filter */}
      {filteredFlows.length > 0 && (
        <div className="mb-8 grid md:grid-cols-2 gap-4">
          <div>
            <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
              Search Flow Items
            </label>
            <input
              type="text"
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:border-secondary transition-colors"
            />
          </div>
          <div>
            <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
              Filter Type
            </label>
            <select
              value={selectedType || 'all'}
              onChange={(e) => setSelectedType(e.target.value === 'all' ? null : e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:border-secondary transition-colors"
            >
              <option value="all">All Types</option>
              {flowTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace('-', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Flow Items */}
      {filteredFlows.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">timeline</span>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">
            No {flowPageName.toLowerCase()} yet
          </h3>
          <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed mb-6">
            Build your {flowPageName.toLowerCase()} by adding key moments, transitions, and milestones.
          </p>
          <button
            onClick={() => {
              setFormData({ type: flowTypes[0] || 'milestone', title: '', description: '', tags: [] });
              setEditingId(null);
              setIsCreating(true);
            }}
            className="px-6 py-3 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
          >
            Create First Item
          </button>
        </div>
      ) : viewMode === 'timeline' ? (
        // Timeline View
        <div className="space-y-3">
          {filteredFlows
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map((flow, index) => (
              <div
                key={flow.id}
                className="relative flex gap-4 py-4 px-6 bg-surface-container-lowest rounded-lg border border-outline-variant/10 hover:border-secondary/30 transition-all group"
              >
                {/* Timeline Badge */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-secondary text-white font-label font-bold text-sm flex items-center justify-center">
                    {index + 1}
                  </div>
                  {index < filteredFlows.length - 1 && <div className="w-1 h-8 bg-secondary/30" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-body font-semibold text-primary mb-1">{flow.title}</h3>
                      {flow.type && (
                        <span className="inline-block px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold uppercase tracking-tighter mb-2">
                          {flow.type.replace('-', ' ')}
                        </span>
                      )}
                      {flow.description && (
                        <p className="text-sm text-on-surface-variant line-clamp-3">{flow.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleFeatured(flow.id, flow.is_featured)}
                      className={`flex-shrink-0 transition-all ${flow.is_featured ? 'text-secondary' : 'text-on-surface-variant/40'}`}
                      title={flow.is_featured ? 'Unstar' : 'Star'}
                    >
                      <span className="material-symbols-outlined">star</span>
                    </button>
                  </div>

                  {/* Tags */}
                  {(flow.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {flow.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 rounded-full bg-tertiary/10 text-tertiary text-[9px] font-bold uppercase tracking-tighter"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handleEditFlow(flow)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFlow(flow.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFlows.map((flow) => (
            <div
              key={flow.id}
              className="bg-white rounded-xl border border-outline-variant/10 overflow-hidden hover:shadow-lg transition-all hover:border-secondary/30 flex flex-col"
            >
              {/* Header */}
              <div className="bg-surface-container-lowest p-4 border-b border-outline-variant/10">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-body font-semibold text-primary line-clamp-2 flex-1">{flow.title}</h3>
                  <button
                    onClick={() => handleToggleFeatured(flow.id, flow.is_featured)}
                    className={`transition-all ${flow.is_featured ? 'text-secondary' : 'text-on-surface-variant/40'}`}
                  >
                    <span className="material-symbols-outlined">star</span>
                  </button>
                </div>
                {flow.type && (
                  <span className="inline-block px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold uppercase tracking-tighter">
                    {flow.type.replace('-', ' ')}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex-1">
                {flow.description && <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-4">{flow.description}</p>}
              </div>

              {/* Tags */}
              {(flow.tags || []).length > 0 && (
                <div className="px-4 py-3 bg-surface-container-lowest border-t border-outline-variant/10 flex flex-wrap gap-2">
                  {flow.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 rounded-full bg-tertiary/10 text-tertiary text-[9px] font-bold uppercase tracking-tighter">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="p-4 border-t border-outline-variant/10 flex gap-2">
                <button
                  onClick={() => handleEditFlow(flow)}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-label text-[10px] font-bold uppercase tracking-tight transition-all"
                >
                  <span className="material-symbols-outlined text-sm inline mr-1">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteFlow(flow.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">
                {editingId ? 'Edit' : 'Add to'} {flowPageName}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setFormData({ type: 'milestone', title: '', description: '', tags: [] });
                }}
                className="text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Item Type
                </label>
                <select
                  value={formData.type || flowTypes[0] || 'milestone'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary transition-colors"
                >
                  {flowTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace('-', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Item title..."
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary transition-colors"
                />
              </div>

              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this item in the flow..."
                  rows={4}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary transition-colors"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-outline-variant/10">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingId(null);
                    setFormData({ type: 'milestone', title: '', description: '', tags: [] });
                  }}
                  className="px-4 py-2 rounded-lg border border-outline-variant/20 text-primary font-label text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFlow}
                  disabled={saveFlows.isPending || !formData.title?.trim()}
                  className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saveFlows.isPending ? <Spinner className="w-3 h-3 mr-2 inline-block" /> : null}
                  {editingId ? 'Update' : 'Add'} Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
