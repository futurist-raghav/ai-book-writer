'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { useBookStore } from '@/stores/book-store';

interface WorldEntity {
  id: string;
  name: string;
  type: 'location' | 'faction' | 'item' | 'rule' | 'lore';
  description?: string;
  details?: string;
  relationships?: string[];
  tags?: string[];
}

interface WorldEvent {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  location?: string;
}

const ENTITY_TYPES: Array<{ value: WorldEntity['type']; label: string; icon: string; colorClass: string; bgClass: string; borderClass: string }> = [
  { value: 'location', label: 'Location', icon: 'location_on', colorClass: 'text-secondary', bgClass: 'bg-secondary/10', borderClass: 'border-secondary/30' },
  { value: 'faction', label: 'Faction', icon: 'groups', colorClass: 'text-tertiary', bgClass: 'bg-tertiary/10', borderClass: 'border-tertiary/30' },
  { value: 'item', label: 'Item', icon: 'card_giftcard', colorClass: 'text-error', bgClass: 'bg-error/10', borderClass: 'border-error/30' },
  { value: 'rule', label: 'Rule/System', icon: 'rule', colorClass: 'text-primary-container', bgClass: 'bg-primary-container/10', borderClass: 'border-primary-container/30' },
  { value: 'lore', label: 'Lore', icon: 'menu_book', colorClass: 'text-secondary-container', bgClass: 'bg-secondary-container/10', borderClass: 'border-secondary-container/30' },
];

function getEntityTypeInfo(type: WorldEntity['type']) {
  return ENTITY_TYPES.find((t) => t.value === type) || ENTITY_TYPES[0];
}

export default function WorldBuildingPage() {
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();

  const [activeTab, setActiveTab] = useState<'entities' | 'discovered'>('entities');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<WorldEntity>({
    id: '',
    name: '',
    type: 'location',
    description: '',
    details: '',
    relationships: [],
    tags: [],
  });

  // Fetch book details for world entities
  const { data: bookData, isLoading: bookLoading } = useQuery({
    queryKey: ['book', selectedBook?.id],
    queryFn: () => selectedBook?.id ? apiClient.books.get(selectedBook.id) : null,
    enabled: !!selectedBook?.id,
  });

  // Fetch events for discovered locations
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'world-building'],
    queryFn: async () => {
      const listResponse = await apiClient.events.list({ limit: 100 });
      const events = listResponse.data.items || [];
      const details = await Promise.allSettled(events.map((event: any) => apiClient.events.get(event.id)));
      return details
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map((result) => result.value.data);
    },
  });

  const worldEntities: WorldEntity[] = useMemo(() => {
    try {
      const settings = bookData?.data?.project_settings || {};
      const stored = settings.world_entities as WorldEntity[] | undefined;
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }, [bookData]);

  const saveWorldEntities = useMutation({
    mutationFn: (entities: WorldEntity[]) => 
      selectedBook?.id 
        ? apiClient.books.update(selectedBook.id, {
            project_settings: {
              ...(bookData?.data?.project_settings || {}),
              world_entities: entities,
            },
          })
        : Promise.reject('No book selected'),
    onSuccess: () => {
      toast.success('World entity saved.');
      queryClient.invalidateQueries({ queryKey: ['book', selectedBook?.id] });
      setShowForm(false);
      setEditingId(null);
      setFormData({ id: '', name: '', type: 'location', description: '', details: '', relationships: [], tags: [] });
    },
    onError: () => {
      toast.error('Failed to save world entity.');
    },
  });

  const handleSaveEntity = async () => {
    if (!formData.name.trim()) {
      toast.error('Entity name is required.');
      return;
    }

    const newEntities = editingId
      ? worldEntities.map((e) => (e.id === editingId ? { ...formData, id: editingId } : e))
      : [...worldEntities, { ...formData, id: Date.now().toString() }];

    await saveWorldEntities.mutateAsync(newEntities);
  };

  const handleDeleteEntity = async (id: string) => {
    const newEntities = worldEntities.filter((e) => e.id !== id);
    await saveWorldEntities.mutateAsync(newEntities);
  };

  const handleEditEntity = (entity: WorldEntity) => {
    setFormData(entity);
    setEditingId(entity.id);
    setShowForm(true);
  };

  // Extract locations from events
  const events = (eventsData || []) as WorldEvent[];
  const discoveredLocations = Array.from(
    new Set(
      events
        .map((event) => event.location)
        .filter((location) => typeof location === 'string' && location.trim().length > 0)
    )
  ) as string[];

  const isLoading = bookLoading || eventsLoading;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body mb-2">World Building</h2>
          <p className="font-label text-sm text-on-surface-variant">Define locations, factions, items, rules, and mythology for your story.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ id: '', name: '', type: 'location', description: '', details: '', relationships: [], tags: [] });
          }}
          className="w-fit rounded-lg bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 font-label text-xs font-bold uppercase tracking-wider shadow-md hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined inline mr-2">add</span>
          New Entity
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-2 border-b border-outline-variant/20">
        <button
          onClick={() => setActiveTab('entities')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'entities'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          World Entities ({worldEntities.length})
        </button>
        <button
          onClick={() => setActiveTab('discovered')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'discovered'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Discovered Locations ({discoveredLocations.length})
        </button>
      </div>

      {/* Entity Form Modal */}
      {showForm && (
        <div className="mb-8 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">
              {editingId ? 'Edit Entity' : 'Create World Entity'}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Entity Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., The Obsidian Tower, House Meridian"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Entity Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as WorldEntity['type'] })}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={(formData.tags || []).join(', ')}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                placeholder="e.g., medieval, magic, fortress"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Quick description of this world element..."
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Detailed Notes
            </label>
            <textarea
              value={formData.details || ''}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              placeholder="Comprehensive details, history, mechanics, atmosphere..."
              rows={4}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-outline-variant/10">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-lg border border-outline-variant/20 text-primary font-label text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEntity}
              disabled={saveWorldEntities.isPending || !formData.name.trim()}
              className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saveWorldEntities.isPending ? <Spinner className="w-3 h-3 mr-2 inline-block" /> : null}
              {editingId ? 'Update' : 'Create'} Entity
            </button>
          </div>
        </div>
      )}

      {/* Entities Tab */}
      {activeTab === 'entities' && (
        <div>
          {worldEntities.length === 0 ? (
            <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-12 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">public</span>
              <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No world entities yet</h3>
              <p className="font-label text-xs text-on-surface-variant max-w-sm text-center mb-6">Create detailed world entries for locations, factions, items, rules, and mythology.</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Create First Entity
              </button>
            </div>
          ) : (
            <div>
              {ENTITY_TYPES.map((typeInfo) => {
                const entitiesOfType = worldEntities.filter((e) => e.type === typeInfo.value);
                if (entitiesOfType.length === 0) return null;

                return (
                  <div key={typeInfo.value} className="mb-10">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-outline-variant/20">
                      <span className={`material-symbols-outlined ${typeInfo.colorClass}`}>{typeInfo.icon}</span>
                      <h3 className={`font-label text-sm font-bold uppercase tracking-widest ${typeInfo.colorClass}`}>
                        {typeInfo.label} ({entitiesOfType.length})
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {entitiesOfType.map((entity) => (
                        <div key={entity.id} className="bg-white rounded-xl border border-outline-variant/10 overflow-hidden hover:shadow-lg transition-all hover:border-primary/30">
                          {/* Header */}
                          <div className={`p-6 border-b border-outline-variant/10 ${typeInfo.bgClass}`}>
                            <h4 className="text-lg font-body italic text-primary mb-1">{entity.name}</h4>
                            <p className={`text-xs font-label font-bold uppercase tracking-tight ${typeInfo.colorClass}`}>{typeInfo.label}</p>
                          </div>

                          {/* Content */}
                          <div className="p-6 space-y-4">
                            {entity.description && (
                              <div>
                                <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Description</p>
                                <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-3">{entity.description}</p>
                              </div>
                            )}

                            {(entity.tags || []).length > 0 && (
                              <div>
                                <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Tags</p>
                                <div className="flex flex-wrap gap-2">
                                  {entity.tags?.map((tag) => (
                                    <span key={tag} className={`px-2.5 py-1 rounded-full ${typeInfo.bgClass} ${typeInfo.colorClass} text-[9px] font-bold uppercase tracking-tighter`}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {entity.details && (
                              <div>
                                <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Details</p>
                                <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-2">{entity.details}</p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="bg-surface-container-lowest p-4 border-t border-outline-variant/10 flex gap-2">
                            <button
                              onClick={() => handleEditEntity(entity)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-label text-[10px] font-bold uppercase tracking-tight transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEntity(entity.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Discovered Tab */}
      {activeTab === 'discovered' && (
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
          {discoveredLocations.length === 0 ? (
            <p className="font-label text-sm text-on-surface-variant text-center py-8">No locations discovered in events. Add location fields to events to discover them here.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoveredLocations.map((location) => (
                  <div key={location} className="p-4 rounded-lg bg-white border border-outline-variant/10 hover:border-secondary/30 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-body text-lg italic text-primary">{location}</p>
                        <p className="text-xs text-on-surface-variant font-label mt-1">From event data</p>
                      </div>
                      <span className="material-symbols-outlined text-secondary">location_on</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-white rounded-lg border border-outline-variant/10">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Tip: Create Detailed Profiles</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">Click "New Entity" to create a detailed location entry with atmosphere, history, and significance notes.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
