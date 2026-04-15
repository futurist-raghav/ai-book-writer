'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { EntityRelationshipMap } from '@/components/entity-relationship-map';
import { EntityCrossReferences } from '@/components/entity-cross-references';
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

interface DiscoveredEntityReference {
  chapter_id: string;
  chapter_title: string;
  chapter_number: number;
  chapter_order: number;
  mentions: number;
  context_snippet?: string | null;
}

interface DiscoveredEntity {
  id: string;
  name: string;
  entity_type: 'character' | 'location' | 'object';
  frequency: number;
  first_mention_chapter_id: string;
  first_mention_chapter_title: string;
  first_mention_chapter_number: number;
  first_mention_chapter_order: number;
  context_snippet?: string | null;
  references: DiscoveredEntityReference[];
}

function mapDiscoveredTypeToEntityType(
  discoveredType: DiscoveredEntity['entity_type'],
  allowedEntityTypes: string[]
): string {
  if (allowedEntityTypes.includes(discoveredType)) {
    return discoveredType;
  }

  if (discoveredType === 'character') {
    return (
      allowedEntityTypes.find((type) => ['character', 'persona', 'person', 'researcher'].includes(type)) ||
      allowedEntityTypes[0] ||
      'character'
    );
  }

  if (discoveredType === 'location') {
    return (
      allowedEntityTypes.find((type) => ['location', 'setting', 'place', 'institution'].includes(type)) ||
      allowedEntityTypes[0] ||
      'location'
    );
  }

  return (
    allowedEntityTypes.find((type) => ['item', 'object', 'prop', 'symbol', 'motif', 'concept'].includes(type)) ||
    allowedEntityTypes[0] ||
    'concept'
  );
}

function inferEntitySource(entityType: string): 'character' | 'location' {
  if (['character', 'persona', 'person', 'researcher'].includes(entityType)) {
    return 'character';
  }
  return 'location';
}

function buildFallbackEntityId(source: 'character' | 'location', name: string, index: number): string {
  const normalizedName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeName = normalizedName || 'entity';
  return `${source}-${safeName}-${index}`;
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedBook } = useBookStore();

  const [activeTab, setActiveTab] = useState<'entities' | 'discovered' | 'relationships'>('entities');
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
  const {
    data: bookData,
    isLoading: bookLoading,
    isError: bookError,
    error: bookErrorValue,
    refetch: refetchBook,
  } = useQuery({
    queryKey: ['book', selectedBook?.id],
    queryFn: () => (selectedBook?.id ? apiClient.books.get(selectedBook.id) : null),
    enabled: !!selectedBook?.id,
  });

  const extractionAnchorChapterId = bookData?.data?.chapters?.[0]?.chapter?.id as string | undefined;

  // Fetch discovered entities from chapter extraction endpoint
  const {
    data: discoveredEntitiesData,
    isLoading: discoveredEntitiesLoading,
    isError: discoveredEntitiesError,
    error: discoveredEntitiesErrorValue,
    refetch: refetchDiscoveredEntities,
  } = useQuery({
    queryKey: ['chapters', 'extract-entities', selectedBook?.id, extractionAnchorChapterId],
    queryFn: async () => {
      if (!extractionAnchorChapterId) {
        return [];
      }

      const response = await apiClient.chapters.extractEntities(extractionAnchorChapterId);
      return response?.data?.entities || [];
    },
    enabled: !!extractionAnchorChapterId,
  });

  const entities: Entity[] = useMemo(() => {
    try {
      const settings = (bookData?.data?.project_settings || {}) as Record<string, unknown>;
      const unifiedEntities = Array.isArray(settings.entities) ? settings.entities : [];

      const normalizedUnifiedEntities = unifiedEntities
        .filter((entity): entity is Record<string, unknown> => typeof entity === 'object' && entity !== null)
        .map((entity, index) => {
          const name = typeof entity.name === 'string' ? entity.name.trim() : '';
          if (!name) {
            return null;
          }

          const rawType = typeof entity.type === 'string' ? entity.type.trim() : '';
          const rawSource =
            entity.source === 'character' || entity.source === 'location'
              ? entity.source
              : undefined;
          const resolvedType = rawType || (rawSource === 'character' ? 'character' : 'location');
          const resolvedSource = rawSource || inferEntitySource(resolvedType);
          const id =
            typeof entity.id === 'string' && entity.id.trim()
              ? entity.id.trim()
              : buildFallbackEntityId(resolvedSource, name, index);

          return {
            ...entity,
            id,
            name,
            type: resolvedType,
            source: resolvedSource,
          } as Entity;
        })
        .filter((entity): entity is Entity => Boolean(entity));

      if (normalizedUnifiedEntities.length > 0) {
        return normalizedUnifiedEntities;
      }

      const characters = Array.isArray(settings.characters) ? settings.characters : [];
      const worldEntities = Array.isArray(settings.world_entities) ? settings.world_entities : [];

      const normalizedCharacters = characters
        .filter((entity): entity is Record<string, unknown> => typeof entity === 'object' && entity !== null)
        .map((entity, index) => {
          const name = typeof entity.name === 'string' ? entity.name.trim() : '';
          if (!name) {
            return null;
          }

          const id =
            typeof entity.id === 'string' && entity.id.trim()
              ? entity.id.trim()
              : buildFallbackEntityId('character', name, index);

          return {
            ...entity,
            id,
            name,
            type: typeof entity.type === 'string' && entity.type.trim() ? entity.type.trim() : 'character',
            source: 'character' as const,
          } as Entity;
        })
        .filter((entity): entity is Entity => Boolean(entity));

      const normalizedWorldEntities = worldEntities
        .filter((entity): entity is Record<string, unknown> => typeof entity === 'object' && entity !== null)
        .map((entity, index) => {
          const name = typeof entity.name === 'string' ? entity.name.trim() : '';
          if (!name) {
            return null;
          }

          const id =
            typeof entity.id === 'string' && entity.id.trim()
              ? entity.id.trim()
              : buildFallbackEntityId('location', name, index);

          return {
            ...entity,
            id,
            name,
            type: typeof entity.type === 'string' && entity.type.trim() ? entity.type.trim() : 'location',
            source: 'location' as const,
          } as Entity;
        })
        .filter((entity): entity is Entity => Boolean(entity));

      return [...normalizedCharacters, ...normalizedWorldEntities];
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
      const normalizedEntities = updatedEntities.reduce<Entity[]>((acc, entity, index) => {
          const name = entity.name.trim();
          if (!name) {
            return acc;
          }

          const resolvedSource = entity.source || inferEntitySource(entity.type || 'location');
          const resolvedType = entity.type?.trim() || (resolvedSource === 'character' ? 'character' : 'location');
          const id = entity.id?.trim() || buildFallbackEntityId(resolvedSource, name, index);

          acc.push({
            ...entity,
            id,
            name,
            type: resolvedType,
            source: resolvedSource,
          });

          return acc;
        }, []);

      const unifiedEntities = normalizedEntities.map((entity) => ({ ...entity }));
      const characters = normalizedEntities
        .filter((entity) => entity.source === 'character')
        .map(({ source, ...rest }) => rest);
      const worldEntities = normalizedEntities
        .filter((entity) => entity.source === 'location')
        .map(({ source, ...rest }) => rest);

      return selectedBook?.id
        ? apiClient.books.update(selectedBook.id, {
            project_settings: {
              ...(bookData?.data?.project_settings || {}),
              entities: unifiedEntities,
              characters,
              world_entities: worldEntities,
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

  const handleNavigateToChapter = (chapterId: string, chapterTitle: string) => {
    if (selectedBook?.id) {
      router.push(`/dashboard/chapters/${chapterId}/workspace`);
    }
  };

  const handlePromoteDiscoveredEntity = async (discoveredEntity: DiscoveredEntity) => {
    const normalizedName = discoveredEntity.name.trim().toLowerCase();
    if (!normalizedName) {
      return;
    }

    const alreadyExists = entities.some((entity) => entity.name.trim().toLowerCase() === normalizedName);
    if (alreadyExists) {
      toast.message(`"${discoveredEntity.name}" is already in your entities list.`);
      return;
    }

    const preferredType = mapDiscoveredTypeToEntityType(
      discoveredEntity.entity_type,
      allowedEntityTypes
    );
    const firstReference = discoveredEntity.references?.[0];
    const summaryText = discoveredEntity.context_snippet || firstReference?.context_snippet || '';

    const newEntity: Entity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: discoveredEntity.name,
      type: preferredType,
      description: summaryText,
      source: inferEntitySource(preferredType),
      tags: [
        `discovered:${discoveredEntity.entity_type}`,
        `mentions:${discoveredEntity.frequency}`,
      ],
    };

    await saveEntities.mutateAsync([...entities, newEntity]);
  };

  const discoveredEntities = (discoveredEntitiesData || []) as DiscoveredEntity[];
  const discoveredCharacters = discoveredEntities.filter((entity) => entity.entity_type === 'character');
  const discoveredLocations = discoveredEntities.filter((entity) => entity.entity_type === 'location');
  const discoveredObjects = discoveredEntities.filter((entity) => entity.entity_type === 'object');
  const discoveredCount = discoveredEntities.length;
  const relationshipCount = entities.reduce(
    (total, entity) => total + (entity.relationships?.length || 0),
    0
  );

  const isLoading = bookLoading || (activeTab === 'discovered' && discoveredEntitiesLoading);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (bookError) {
    return (
      <div className="dashboard-shell">
        <QueryErrorState
          title="Unable to load entities"
          error={bookErrorValue}
          onRetry={() => void refetchBook()}
        />
      </div>
    );
  }

  if (discoveredEntitiesError && activeTab === 'discovered' && extractionAnchorChapterId) {
    return (
      <div className="dashboard-shell">
        <QueryErrorState
          title="Unable to load discovered entities"
          error={discoveredEntitiesErrorValue}
          onRetry={() => void refetchDiscoveredEntities()}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
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
          Discovered ({discoveredCount})
        </button>
        <button
          onClick={() => setActiveTab('relationships')}
          className={`px-4 py-3 font-label text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'relationships'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          Relationship Map ({relationshipCount})
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

                      {/* Cross-References */}
                      {selectedBook?.id && (
                        <div className="pt-2 border-t border-outline-variant/10">
                          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">References</p>
                          <EntityCrossReferences
                            bookId={selectedBook.id}
                            entityId={entity.id}
                            entityName={entity.name}
                            onNavigateToChapter={handleNavigateToChapter}
                          />
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
          {!extractionAnchorChapterId ? (
            <p className="font-label text-sm text-on-surface-variant text-center py-8">
              Add at least one chapter to run entity extraction.
            </p>
          ) : discoveredEntitiesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="w-7 h-7 text-primary" />
            </div>
          ) : discoveredCount === 0 ? (
            <p className="font-label text-sm text-on-surface-variant text-center py-8">
              No entities detected in chapter content yet. Add chapter material, then revisit this tab.
            </p>
          ) : (
            <>
              {discoveredCharacters.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-primary mb-4">
                    Discovered {entityConfig.characterLabel}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {discoveredCharacters.map((entity) => {
                      const alreadyExists = entities.some(
                        (existing) => existing.name.trim().toLowerCase() === entity.name.trim().toLowerCase()
                      );

                      return (
                        <div
                          key={entity.id}
                          className="rounded-xl border border-secondary/20 bg-secondary-container/10 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-label text-xs font-bold uppercase tracking-wider text-secondary">{entity.name}</p>
                              <p className="mt-1 text-[11px] text-on-surface-variant">
                                Mentioned {entity.frequency} time{entity.frequency === 1 ? '' : 's'}
                              </p>
                            </div>
                            <button
                              onClick={() => void handlePromoteDiscoveredEntity(entity)}
                              disabled={saveEntities.isPending || alreadyExists}
                              className="rounded-lg bg-secondary text-white px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
                            >
                              {alreadyExists ? 'Imported' : 'Promote'}
                            </button>
                          </div>

                          <p className="mt-3 text-xs text-on-surface-variant">
                            First mention: Chapter {entity.first_mention_chapter_number} - {entity.first_mention_chapter_title}
                          </p>
                          {entity.references.length > 1 ? (
                            <p className="mt-1 text-[11px] text-on-surface-variant">
                              Also in:{' '}
                              {entity.references
                                .slice(1, 4)
                                .map((reference) => `Ch ${reference.chapter_number}`)
                                .join(', ')}
                              {entity.references.length > 4 ? ` +${entity.references.length - 4}` : ''}
                            </p>
                          ) : null}
                          {entity.context_snippet ? (
                            <p className="mt-2 text-xs italic text-on-surface-variant line-clamp-3">
                              "{entity.context_snippet}"
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {discoveredLocations.length > 0 && (
                <div>
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-primary mb-4">
                    Discovered {entityConfig.locationLabel}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {discoveredLocations.map((entity) => {
                      const alreadyExists = entities.some(
                        (existing) => existing.name.trim().toLowerCase() === entity.name.trim().toLowerCase()
                      );

                      return (
                        <div
                          key={entity.id}
                          className="rounded-xl border border-tertiary/20 bg-tertiary-container/10 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-label text-xs font-bold uppercase tracking-wider text-tertiary">{entity.name}</p>
                              <p className="mt-1 text-[11px] text-on-surface-variant">
                                Mentioned {entity.frequency} time{entity.frequency === 1 ? '' : 's'}
                              </p>
                            </div>
                            <button
                              onClick={() => void handlePromoteDiscoveredEntity(entity)}
                              disabled={saveEntities.isPending || alreadyExists}
                              className="rounded-lg bg-tertiary text-white px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
                            >
                              {alreadyExists ? 'Imported' : 'Promote'}
                            </button>
                          </div>

                          <p className="mt-3 text-xs text-on-surface-variant">
                            First mention: Chapter {entity.first_mention_chapter_number} - {entity.first_mention_chapter_title}
                          </p>
                          {entity.references.length > 1 ? (
                            <p className="mt-1 text-[11px] text-on-surface-variant">
                              Also in:{' '}
                              {entity.references
                                .slice(1, 4)
                                .map((reference) => `Ch ${reference.chapter_number}`)
                                .join(', ')}
                              {entity.references.length > 4 ? ` +${entity.references.length - 4}` : ''}
                            </p>
                          ) : null}
                          {entity.context_snippet ? (
                            <p className="mt-2 text-xs italic text-on-surface-variant line-clamp-3">
                              "{entity.context_snippet}"
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {discoveredObjects.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-primary mb-4">
                    Discovered Objects
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {discoveredObjects.map((entity) => {
                      const alreadyExists = entities.some(
                        (existing) => existing.name.trim().toLowerCase() === entity.name.trim().toLowerCase()
                      );

                      return (
                        <div
                          key={entity.id}
                          className="rounded-xl border border-error/20 bg-error/10 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-label text-xs font-bold uppercase tracking-wider text-error">{entity.name}</p>
                              <p className="mt-1 text-[11px] text-on-surface-variant">
                                Mentioned {entity.frequency} time{entity.frequency === 1 ? '' : 's'}
                              </p>
                            </div>
                            <button
                              onClick={() => void handlePromoteDiscoveredEntity(entity)}
                              disabled={saveEntities.isPending || alreadyExists}
                              className="rounded-lg bg-error text-white px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
                            >
                              {alreadyExists ? 'Imported' : 'Promote'}
                            </button>
                          </div>

                          <p className="mt-3 text-xs text-on-surface-variant">
                            First mention: Chapter {entity.first_mention_chapter_number} - {entity.first_mention_chapter_title}
                          </p>
                          {entity.references.length > 1 ? (
                            <p className="mt-1 text-[11px] text-on-surface-variant">
                              Also in:{' '}
                              {entity.references
                                .slice(1, 4)
                                .map((reference) => `Ch ${reference.chapter_number}`)
                                .join(', ')}
                              {entity.references.length > 4 ? ` +${entity.references.length - 4}` : ''}
                            </p>
                          ) : null}
                          {entity.context_snippet ? (
                            <p className="mt-2 text-xs italic text-on-surface-variant line-clamp-3">
                              "{entity.context_snippet}"
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-8 p-4 bg-white rounded-lg border border-outline-variant/10">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Tip: Promote in One Click</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Use Promote to create a draft entity profile from a discovered mention, then enrich it with role, traits, and relationships.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Relationship Map Tab */}
      {activeTab === 'relationships' && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
          <EntityRelationshipMap
            entities={entities}
            isSaving={saveEntities.isPending}
            onSaveEntities={async (updatedEntities) => {
              await saveEntities.mutateAsync(updatedEntities as Entity[]);
            }}
          />
        </div>
      )}
    </div>
  );
}
