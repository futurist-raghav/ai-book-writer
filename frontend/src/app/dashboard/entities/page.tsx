'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { useBookStore } from '@/stores/book-store';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  details?: string;
  role?: string;
  age?: string;
  aliases?: string[];
  traits?: string[];
  backstory?: string;
  motivations?: string[];
  relationships?: Array<{ entityId: string; type: string; description?: string }>;
  tags?: string[];
  source?: 'character' | 'location';
}

interface EntityEvent {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  location?: string;
  people?: Array<string | { name?: string; relationship?: string }>;
}

const ENTITY_TYPE_STYLES: Record<string, { icon: string; colorClass: string; bgClass: string; borderClass: string }> = {
  character: {
    icon: 'person',
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/30',
  },
  persona: {
    icon: 'person_outline',
    colorClass: 'text-secondary',
    bgClass: 'bg-secondary/10',
    borderClass: 'border-secondary/30',
  },
  location: {
    icon: 'location_on',
    colorClass: 'text-secondary',
    bgClass: 'bg-secondary/10',
    borderClass: 'border-secondary/30',
  },
  concept: {
    icon: 'lightbulb',
    colorClass: 'text-tertiary',
    bgClass: 'bg-tertiary/10',
    borderClass: 'border-tertiary/30',
  },
  theory: {
    icon: 'science',
    colorClass: 'text-tertiary',
    bgClass: 'bg-tertiary/10',
    borderClass: 'border-tertiary/30',
  },
  method: {
    icon: 'construction',
    colorClass: 'text-error',
    bgClass: 'bg-error/10',
    borderClass: 'border-error/30',
  },
  researcher: {
    icon: 'person_search',
    colorClass: 'text-primary-container',
    bgClass: 'bg-primary-container/10',
    borderClass: 'border-primary-container/30',
  },
  institution: {
    icon: 'school',
    colorClass: 'text-secondary-container',
    bgClass: 'bg-secondary-container/10',
    borderClass: 'border-secondary-container/30',
  },
  faction: {
    icon: 'groups',
    colorClass: 'text-tertiary',
    bgClass: 'bg-tertiary/10',
    borderClass: 'border-tertiary/30',
  },
  item: {
    icon: 'card_giftcard',
    colorClass: 'text-error',
    bgClass: 'bg-error/10',
    borderClass: 'border-error/30',
  },
  setting: {
    icon: 'landscape',
    colorClass: 'text-secondary',
    bgClass: 'bg-secondary/10',
    borderClass: 'border-secondary/30',
  },
  motif: {
    icon: 'auto_stories',
    colorClass: 'text-secondary-container',
    bgClass: 'bg-secondary-container/10',
    borderClass: 'border-secondary-container/30',
  },
  symbol: {
    icon: 'diamond',
    colorClass: 'text-tertiary',
    bgClass: 'bg-tertiary/10',
    borderClass: 'border-tertiary/30',
  },
  default: {
    icon: 'tag',
    colorClass: 'text-on-surface-variant',
    bgClass: 'bg-surface-container-high/10',
    borderClass: 'border-outline-variant/30',
  },
};

function getEntityTypeStyle(type: string) {
  return ENTITY_TYPE_STYLES[type] || ENTITY_TYPE_STYLES.default;
}

export default function EntitiesPage() {
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();

  const [activeTab, setActiveTab] = useState<'entities' | 'discovered'>('entities');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Entity>({
    id: '',
    name: '',
    type: 'character',
    description: '',
    details: '',
    role: '',
    age: '',
    aliases: [],
    traits: [],
    backstory: '',
    motivations: [],
    relationships: [],
    tags: [],
  });

  // Get project configuration
  const projectType = (selectedBook?.project_type || 'novel') as ProjectType;
  const config = ProjectTypeConfigService.getConfig(projectType);
  const entityConfig = config.entityConfig;
  const allowedEntityTypes = entityConfig.entityTypes;

  // Fetch book details
  const { data: bookData, isLoading: bookLoading } = useQuery({
    queryKey: ['book', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.books.get(selectedBook.id) : null),
    enabled: !!selectedBook?.id,
  });

  // Fetch events for discovered entities
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'entities'],
    queryFn: async () => {
      const listResponse = await apiClient.events.list({ limit: 100 });
      const events = listResponse.data.items || [];
      const details = await Promise.allSettled(events.map((event: any) => apiClient.events.get(event.id)));
      return details
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map((result) => result.value.data);
    },
  });

  const entities: Entity[] = useMemo(() => {
    try {
      const settings = bookData?.data?.project_settings || {};
      const characters = Array.isArray(settings.characters) ? settings.characters : [];
      const worldEntities = Array.isArray(settings.world_entities) ? settings.world_entities : [];

      return [
        ...characters.map((c: any) => ({
          ...c,
          type: c.type || 'character',
          source: 'character' as const,
        })),
        ...worldEntities.map((w: any) => ({
          ...w,
          type: w.type || 'location',
          source: 'location' as const,
        })),
      ];
    } catch {
      return [];
    }
  }, [bookData]);

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (entityTypeFilter !== 'all' && e.type !== entityTypeFilter) return false;
      if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        return e.name.toLowerCase().includes(lower) || (e.description && e.description.toLowerCase().includes(lower));
      }
      return true;
    });
  }, [entities, entityTypeFilter, searchQuery]);

  const saveEntities = useMutation({
    mutationFn: async (updatedEntities: Entity[]) => {
      const characters = updatedEntities.filter((e) => e.source === 'character');
      const worldEntities = updatedEntities.filter((e) => e.source === 'location');

      return selectedBook?.id
        ? apiClient.books.update(selectedBook.id, {
            project_settings: {
              ...(bookData?.data?.project_settings || {}),
              characters: characters.map(({ source, ...rest }) => rest),
              world_entities: worldEntities.map(({ source, ...rest }) => rest),
            },
          })
        : Promise.reject('No book selected');
    },
    onSuccess: () => {
      toast.success('Entity saved');
      queryClient.invalidateQueries({ queryKey: ['book', selectedBook?.id] });
      setShowForm(false);
      setEditingId(null);
      setFormData({
        id: '',
        name: '',
        type: 'character',
        description: '',
        details: '',
        role: '',
        age: '',
        aliases: [],
        traits: [],
        backstory: '',
        motivations: [],
        relationships: [],
        tags: [],
      });
    },
    onError: () => {
      toast.error('Failed to save entity');
    },
  });

  const handleSaveEntity = async () => {
    if (!formData.name.trim()) {
      toast.error('Entity name is required');
      return;
    }

    const defaultSource = allowedEntityTypes.includes('character') ? 'character' : 'location';
    const updatedEntities = editingId
      ? entities.map((e) => (e.id === editingId ? { ...formData, id: editingId, source: e.source } : e))
      : [
          ...entities,
          {
            ...formData,
            id: Date.now().toString(),
            source: (formData.source || defaultSource) as 'character' | 'location',
          },
        ];

    await saveEntities.mutateAsync(updatedEntities);
  };

  const handleDeleteEntity = async (id: string) => {
    const updatedEntities = entities.filter((e) => e.id !== id);
    await saveEntities.mutateAsync(updatedEntities);
  };

  const handleEditEntity = (entity: Entity) => {
    setFormData(entity);
    setEditingId(entity.id);
    setShowForm(true);
  };

  // Extract discovered entities from events
  const events = (eventsData || []) as EntityEvent[];
  const discoveredPeople = new Set<string>();
  const discoveredLocations = new Set<string>();

  events.forEach((event) => {
    const people = Array.isArray(event.people) ? event.people : [];
    people.forEach((person) => {
      const name = typeof person === 'string' ? person.trim() : person?.name?.trim();
      if (name) discoveredPeople.add(name);
    });
    if (event.location?.trim()) discoveredLocations.add(event.location.trim());
  });

  const isLoading = bookLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Project Entities</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body mb-2">
            {entityConfig.pageName}
          </h2>
          <p className="font-label text-sm text-on-surface-variant max-w-2xl">
            Manage {entityConfig.characterLabel.toLowerCase()}, {entityConfig.locationLabel.toLowerCase()}, and other entities for your project.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              id: '',
              name: '',
              type: allowedEntityTypes[0] || 'character',
              description: '',
              details: '',
              role: '',
              age: '',
              aliases: [],
              traits: [],
              backstory: '',
              motivations: [],
              relationships: [],
              tags: [],
            });
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
          Entities ({filteredEntities.length})
        </button>
        <button
          onClick={() => setActiveTab('discovered')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'discovered'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Discovered ({(discoveredPeople.size || 0) + (discoveredLocations.size || 0)})
        </button>
      </div>

      {/* Entity Form */}
      {showForm && (
        <div className="mb-8 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">
              {editingId ? 'Edit Entity' : 'Create Entity'}
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
                placeholder="e.g., Mira Sol"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>

            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Entity Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              >
                {allowedEntityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {formData.type.includes('character') || formData.type === 'persona' ? (
              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value={formData.role || ''}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Detective"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
                />
              </div>
            ) : null}

            {formData.type.includes('character') || formData.type === 'persona' ? (
              <div>
                <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Age
                </label>
                <input
                  type="text"
                  value={formData.age || ''}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="e.g., 32"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="General information about this entity..."
              rows={3}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
            />
          </div>

          {formData.type.includes('character') || formData.type === 'persona' ? (
            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Backstory
              </label>
              <textarea
                value={formData.backstory || ''}
                onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                placeholder="Background and history..."
                rows={4}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>
          ) : null}

          {formData.type.includes('character') || formData.type === 'persona' ? (
            <div>
              <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Traits (comma-separated)
              </label>
              <textarea
                value={(formData.traits || []).join(', ')}
                onChange={(e) => setFormData({ ...formData, traits: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                placeholder="e.g., intelligent, cautious, witty"
                rows={2}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:border-secondary focus:ring-secondary/20 transition-colors"
              />
            </div>
          ) : null}

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
              disabled={saveEntities.isPending || !formData.name.trim()}
              className="px-6 py-2 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saveEntities.isPending ? <Spinner className="w-3 h-3 mr-2 inline-block" /> : null}
              {editingId ? 'Update' : 'Create'} Entity
            </button>
          </div>
        </div>
      )}

      {/* Entities Tab */}
      {activeTab === 'entities' && (
        <>
          {filteredEntities.length > 0 && (
            <div className="mb-6 flex gap-4 flex-wrap">
              <div>
                <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
                  Filter Type
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary border border-outline-variant/20"
                >
                  <option value="all">All Types</option>
                  {allowedEntityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label focus:border-secondary focus:ring-secondary/20 transition-colors"
                />
              </div>
            </div>
          )}

          {filteredEntities.length === 0 ? (
            <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-12 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">entity_note</span>
              <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No entities yet</h3>
              <p className="font-label text-xs text-on-surface-variant max-w-sm text-center mb-6">Create entities to build your world—characters, locations, concepts, factions, items, and more. Reference them throughout your project.</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 rounded-lg bg-primary text-white font-label text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
              >
                + Create First Entity
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEntities.map((entity) => {
                const style = getEntityTypeStyle(entity.type);
                return (
                  <div key={entity.id} className="bg-white rounded-xl border border-outline-variant/10 overflow-hidden hover:shadow-lg transition-all hover:border-secondary/30">
                    {/* Header */}
                    <div className={`${style.bgClass} p-6 border-b border-outline-variant/10`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xl font-body italic text-primary flex-1">{entity.name}</h3>
                        <span className={`material-symbols-outlined text-sm ${style.colorClass}`}>{style.icon}</span>
                      </div>
                      <p className={`text-xs font-label font-bold uppercase tracking-tight ${style.colorClass}`}>
                        {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
                      </p>
                      {entity.role && (
                        <p className="text-xs text-on-surface-variant font-label mt-1">{entity.role}</p>
                      )}
                      {entity.age && (
                        <p className="text-xs text-on-surface-variant font-label">Age: {entity.age}</p>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      {entity.description && (
                        <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-3">{entity.description}</p>
                      )}

                      {(entity.traits || []).length > 0 && (
                        <div>
                          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Traits</p>
                          <div className="flex flex-wrap gap-2">
                            {entity.traits?.map((trait) => (
                              <span
                                key={trait}
                                className="px-2.5 py-1 rounded-full bg-secondary-container/30 text-secondary text-[9px] font-bold uppercase tracking-tighter"
                              >
                                {trait}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(entity.tags || []).length > 0 && (
                        <div>
                          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">Tags</p>
                          <div className="flex flex-wrap gap-2">
                            {entity.tags?.map((tag) => (
                              <span key={tag} className="px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary text-[9px] font-bold uppercase tracking-tighter">
                                {tag}
                              </span>
                            ))}
                          </div>
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
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Discovered Tab */}
      {activeTab === 'discovered' && (
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
          {discoveredPeople.size === 0 && discoveredLocations.size === 0 ? (
            <p className="font-label text-sm text-on-surface-variant text-center py-8">
              No entities detected in events. Create events with people and location metadata to auto-discover entities.
            </p>
          ) : (
            <>
              {discoveredPeople.size > 0 && (
                <div className="mb-8">
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-primary mb-4">
                    Discovered {entityConfig.characterLabel}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Array.from(discoveredPeople).map((name) => (
                      <div key={name} className="px-4 py-2 rounded-lg bg-secondary-container/20 border border-secondary/30 hover:bg-secondary-container/40 transition-all cursor-pointer group">
                        <p className="font-label text-xs font-bold text-secondary uppercase tracking-tight">{name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {discoveredLocations.size > 0 && (
                <div>
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-primary mb-4">
                    Discovered {entityConfig.locationLabel}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Array.from(discoveredLocations).map((location) => (
                      <div key={location} className="px-4 py-2 rounded-lg bg-tertiary-container/20 border border-tertiary/30 hover:bg-tertiary-container/40 transition-all cursor-pointer group">
                        <p className="font-label text-xs font-bold text-tertiary uppercase tracking-tight">{location}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 p-4 bg-white rounded-lg border border-outline-variant/10">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Tip: Import to Entities</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Click "New Entity" and create detailed profiles for discovered entities to assign roles, backstories, and relationships.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
