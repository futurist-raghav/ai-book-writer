'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

interface FlowEvent {
  id: string;
  book_id: string;
  title: string;
  description?: string;
  event_type: string;
  timeline_position: number;
  duration?: number;
  status: 'planned' | 'in_progress' | 'completed' | 'archived';
  order_index: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
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

  const [formData, setFormData] = useState<Partial<FlowEvent>>({
    event_type: 'beat',
    title: '',
    description: '',
    metadata: {},
  });

  const projectType = (selectedBook?.project_type || 'novel') as ProjectType;
  const config = ProjectTypeConfigService.getConfig(projectType);
  const flowPageName = config.flowPageName;
  const projectCategory = getProjectCategory(projectType);
  const flowTypes = FLOW_ITEM_TYPES[projectCategory] || FLOW_ITEM_TYPES.generic;

  // Fetch flow events from backend API
  const {
    data: eventsData,
    isLoading: eventsLoading,
    isError: eventsError,
    error: eventsErrorValue,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['flowEvents', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.flowEvents.list(selectedBook.id) : null),
    enabled: !!selectedBook?.id,
  });

  // Fetch timeline data for timeline view
  const { data: timelineData } = useQuery({
    queryKey: ['flowTimeline', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.flowEvents.getTimeline(selectedBook.id) : null),
    enabled: !!selectedBook?.id && viewMode === 'timeline',
  });

  // Fetch dependency graph
  const { data: dependencyData } = useQuery({
    queryKey: ['flowDependencies', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.flowEvents.getDependencyGraph(selectedBook.id) : null),
    enabled: !!selectedBook?.id,
  });

  const flows: FlowEvent[] = useMemo(() => {
    return (eventsData?.data?.items || eventsData?.data || []) as FlowEvent[];
  }, [eventsData]);

  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      if (selectedType && f.event_type !== selectedType) return false;
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        return f.title?.toLowerCase().includes(lower) || f.description?.toLowerCase().includes(lower);
      }
      return true;
    });
  }, [flows, selectedType, searchQuery]);

  // Create flow event
  const createMutation = useMutation({
    mutationFn: (data: Partial<FlowEvent>) =>
      selectedBook?.id
        ? apiClient.flowEvents.create(selectedBook.id, {
            title: data.title || '',
            description: data.description,
            event_type: data.event_type || 'beat',
            timeline_position: data.timeline_position || 0,
            duration: data.duration,
            status: data.status || 'planned',
            metadata: data.metadata,
          })
        : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('Event created');
      queryClient.invalidateQueries({ queryKey: ['flowEvents', selectedBook?.id] });
      queryClient.invalidateQueries({ queryKey: ['flowTimeline', selectedBook?.id] });
      setIsCreating(false);
      setEditingId(null);
      setFormData({ event_type: 'beat', title: '', description: '', metadata: {} });
    },
    onError: () => {
      toast.error('Failed to create event');
    },
  });

  // Update flow event
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<FlowEvent> }) =>
      selectedBook?.id
        ? apiClient.flowEvents.update(selectedBook.id, data.id, {
            title: data.updates.title,
            description: data.updates.description,
            event_type: data.updates.event_type,
            timeline_position: data.updates.timeline_position,
            duration: data.updates.duration,
            status: data.updates.status,
            metadata: data.updates.metadata,
          })
        : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('Event updated');
      queryClient.invalidateQueries({ queryKey: ['flowEvents', selectedBook?.id] });
      queryClient.invalidateQueries({ queryKey: ['flowTimeline', selectedBook?.id] });
      setIsCreating(false);
      setEditingId(null);
      setFormData({ event_type: 'beat', title: '', description: '', metadata: {} });
    },
    onError: () => {
      toast.error('Failed to update event');
    },
  });

  // Delete flow event
  const deleteMutation = useMutation({
    mutationFn: (eventId: string) =>
      selectedBook?.id ? apiClient.flowEvents.delete(selectedBook.id, eventId) : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('Event deleted');
      queryClient.invalidateQueries({ queryKey: ['flowEvents', selectedBook?.id] });
      queryClient.invalidateQueries({ queryKey: ['flowTimeline', selectedBook?.id] });
    },
    onError: () => {
      toast.error('Failed to delete event');
    },
  });

  const handleSaveFlow = async () => {
    if (!formData.title?.trim()) {
      toast.error('Title is required');
      return;
    }

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        updates: formData,
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleDeleteFlow = async (id: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleEditFlow = (flow: FlowEvent) => {
    setFormData(flow);
    setEditingId(flow.id);
    setIsCreating(true);
  };

  if (eventsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="max-w-6xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load flow data"
          error={eventsErrorValue}
          onRetry={() => void refetchEvents()}
        />
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
            setFormData({ event_type: flowTypes[0] || 'beat', title: '', description: '', metadata: {} });
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
              setFormData({ event_type: flowTypes[0] || 'beat', title: '', description: '', metadata: {} });
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
            .sort((a, b) => (a.timeline_position || 0) - (b.timeline_position || 0))
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
                      {flow.event_type && (
                        <span className="inline-block px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold uppercase tracking-tighter mb-2">
                          {flow.event_type.replace('-', ' ')}
                        </span>
                      )}
                      {flow.description && (
                        <p className="text-sm text-on-surface-variant line-clamp-3">{flow.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {(flow.metadata?.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(flow.metadata?.tags || []).map((tag: string) => (
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
                </div>
                {flow.event_type && (
                  <span className="inline-block px-2 py-1 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold uppercase tracking-tighter">
                    {flow.event_type.replace('-', ' ')}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex-1">
                {flow.description && <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-4">{flow.description}</p>}
              </div>

              {/* Tags */}
              {(flow.metadata?.tags || []).length > 0 && (
                <div className="px-4 py-3 bg-surface-container-lowest border-t border-outline-variant/10 flex flex-wrap gap-2">
                  {(flow.metadata?.tags || []).map((tag: string) => (
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
                  setFormData({ event_type: 'beat', title: '', description: '', metadata: {} });
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
                  value={formData.event_type || flowTypes[0] || 'milestone'}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
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
                    setFormData({ event_type: 'beat', title: '', description: '', metadata: {} });
                  }}
                  className="px-4 py-2 rounded-lg border border-outline-variant/20 text-primary font-label text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFlow}
                  disabled={createMutation.isPending || updateMutation.isPending || !formData.title?.trim()}
                  className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {createMutation.isPending || updateMutation.isPending ? <Spinner className="w-3 h-3 mr-2 inline-block" /> : null}
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
