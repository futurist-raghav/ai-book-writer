'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';

const VIEWBOX_WIDTH = 1120;
const VIEWBOX_HEIGHT = 640;
const NODE_RADIUS = 40;

const RELATIONSHIP_TYPES = [
  'ally',
  'enemy',
  'family',
  'mentor',
  'rival',
  'friend',
  'romantic',
  'colleague',
  'other',
];

export interface RelationshipMapEntity {
  id: string;
  name: string;
  type: string;
  relationships?: Array<{ entityId: string; type: string; description?: string }>;
}

interface RelationshipEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  type: string;
  description?: string;
  relationIndex: number;
}

interface NodePosition {
  x: number;
  y: number;
}

interface EntityRelationshipMapProps {
  entities: RelationshipMapEntity[];
  onSaveEntities: (updatedEntities: RelationshipMapEntity[]) => Promise<void>;
  isSaving?: boolean;
}

const ENTITY_TYPE_STROKE: Record<string, string> = {
  character: '#6b4cd3',
  persona: '#6b4cd3',
  person: '#6b4cd3',
  location: '#19857b',
  setting: '#19857b',
  concept: '#c06c00',
  object: '#c06c00',
  faction: '#7b4cbf',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getNodeStrokeColor(type: string): string {
  return ENTITY_TYPE_STROKE[type.toLowerCase()] || '#5f6368';
}

function buildEdges(entities: RelationshipMapEntity[]): RelationshipEdge[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const edges: RelationshipEdge[] = [];

  entities.forEach((sourceEntity) => {
    (sourceEntity.relationships || []).forEach((relation, relationIndex) => {
      const target = byId.get(relation.entityId);
      if (!target) {
        return;
      }

      edges.push({
        id: `${sourceEntity.id}:${relation.entityId}:${relationIndex}`,
        sourceId: sourceEntity.id,
        targetId: relation.entityId,
        sourceName: sourceEntity.name,
        targetName: target.name,
        type: relation.type || 'other',
        description: relation.description,
        relationIndex,
      });
    });
  });

  return edges;
}

export function EntityRelationshipMap({
  entities,
  onSaveEntities,
  isSaving = false,
}: EntityRelationshipMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [newSourceId, setNewSourceId] = useState<string>('');
  const [newTargetId, setNewTargetId] = useState<string>('');
  const [newRelationshipType, setNewRelationshipType] = useState<string>('ally');
  const [newRelationshipDescription, setNewRelationshipDescription] = useState<string>('');

  const [edgeTypeDraft, setEdgeTypeDraft] = useState<string>('');
  const [edgeDescriptionDraft, setEdgeDescriptionDraft] = useState<string>('');

  const entityTypeOptions = useMemo(() => {
    return Array.from(new Set(entities.map((entity) => entity.type))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [entities]);

  const filteredEntities = useMemo(() => {
    if (selectedTypeFilter === 'all') {
      return entities;
    }

    return entities.filter((entity) => entity.type === selectedTypeFilter);
  }, [entities, selectedTypeFilter]);

  const allEdges = useMemo(() => buildEdges(entities), [entities]);

  const visibleEntityIds = useMemo(() => new Set(filteredEntities.map((entity) => entity.id)), [filteredEntities]);

  const visibleEdges = useMemo(() => {
    return allEdges.filter(
      (edge) => visibleEntityIds.has(edge.sourceId) && visibleEntityIds.has(edge.targetId)
    );
  }, [allEdges, visibleEntityIds]);

  const selectedEdge = useMemo(
    () => allEdges.find((edge) => edge.id === selectedEdgeId) || null,
    [allEdges, selectedEdgeId]
  );

  useEffect(() => {
    setPositions((previous) => {
      const next: Record<string, NodePosition> = { ...previous };
      let changed = false;

      entities.forEach((entity, index) => {
        if (next[entity.id]) {
          return;
        }

        const angle = (index / Math.max(entities.length, 1)) * Math.PI * 2;
        const ringRadius = Math.min(VIEWBOX_WIDTH, VIEWBOX_HEIGHT) * 0.32;
        next[entity.id] = {
          x: VIEWBOX_WIDTH / 2 + Math.cos(angle) * ringRadius,
          y: VIEWBOX_HEIGHT / 2 + Math.sin(angle) * ringRadius,
        };
        changed = true;
      });

      Object.keys(next).forEach((entityId) => {
        if (entities.some((entity) => entity.id === entityId)) {
          return;
        }

        delete next[entityId];
        changed = true;
      });

      return changed ? next : previous;
    });

    if (!newSourceId && entities.length > 0) {
      setNewSourceId(entities[0].id);
    }

    if (!newTargetId && entities.length > 1) {
      setNewTargetId(entities[1].id);
    }
  }, [entities, newSourceId, newTargetId]);

  useEffect(() => {
    if (!selectedEdge) {
      setEdgeTypeDraft('');
      setEdgeDescriptionDraft('');
      return;
    }

    setEdgeTypeDraft(selectedEdge.type || 'other');
    setEdgeDescriptionDraft(selectedEdge.description || '');
  }, [selectedEdge]);

  const toSvgPoint = (clientX: number, clientY: number): NodePosition | null => {
    if (!svgRef.current) {
      return null;
    }

    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;

    return { x, y };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeId) {
      return;
    }

    const point = toSvgPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    setPositions((previous) => ({
      ...previous,
      [draggingNodeId]: {
        x: clamp(point.x, NODE_RADIUS, VIEWBOX_WIDTH - NODE_RADIUS),
        y: clamp(point.y, NODE_RADIUS, VIEWBOX_HEIGHT - NODE_RADIUS),
      },
    }));
  };

  const handlePointerUp = () => {
    setDraggingNodeId(null);
  };

  const handleAddRelationship = async () => {
    if (!newSourceId || !newTargetId || newSourceId === newTargetId) {
      return;
    }

    const sourceEntity = entities.find((entity) => entity.id === newSourceId);
    if (!sourceEntity) {
      return;
    }

    const duplicate = (sourceEntity.relationships || []).some(
      (relation) =>
        relation.entityId === newTargetId &&
        relation.type.toLowerCase() === newRelationshipType.toLowerCase()
    );

    if (duplicate) {
      return;
    }

    const updatedEntities = entities.map((entity) => {
      if (entity.id !== newSourceId) {
        return entity;
      }

      return {
        ...entity,
        relationships: [
          ...(entity.relationships || []),
          {
            entityId: newTargetId,
            type: newRelationshipType,
            description: newRelationshipDescription.trim() || undefined,
          },
        ],
      };
    });

    await onSaveEntities(updatedEntities);
    setNewRelationshipDescription('');
  };

  const handleSaveEdgeEdit = async () => {
    if (!selectedEdge) {
      return;
    }

    const updatedEntities = entities.map((entity) => {
      if (entity.id !== selectedEdge.sourceId) {
        return entity;
      }

      const nextRelationships = [...(entity.relationships || [])];
      const relation = nextRelationships[selectedEdge.relationIndex];
      if (!relation) {
        return entity;
      }

      nextRelationships[selectedEdge.relationIndex] = {
        ...relation,
        type: edgeTypeDraft || relation.type,
        description: edgeDescriptionDraft.trim() || undefined,
      };

      return {
        ...entity,
        relationships: nextRelationships,
      };
    });

    await onSaveEntities(updatedEntities);
  };

  const handleDeleteEdge = async () => {
    if (!selectedEdge) {
      return;
    }

    const updatedEntities = entities.map((entity) => {
      if (entity.id !== selectedEdge.sourceId) {
        return entity;
      }

      return {
        ...entity,
        relationships: (entity.relationships || []).filter(
          (_relation, index) => index !== selectedEdge.relationIndex
        ),
      };
    });

    await onSaveEntities(updatedEntities);
    setSelectedEdgeId(null);
  };

  const handleExportImage = () => {
    if (!svgRef.current || typeof window === 'undefined') {
      return;
    }

    const serializer = new XMLSerializer();
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const svgString = serializer.serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = VIEWBOX_WIDTH;
      canvas.height = VIEWBOX_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(blobUrl);
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, VIEWBOX_WIDTH, VIEWBOX_HEIGHT);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(blobUrl);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'entity-relationship-map.png';
      link.click();
    };

    image.src = blobUrl;
  };

  const hasMinimumEntities = filteredEntities.length >= 2;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Filter Entity Type
          </label>
          <select
            value={selectedTypeFilter}
            onChange={(event) => setSelectedTypeFilter(event.target.value)}
            className="rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-label"
          >
            <option value="all">All Types</option>
            {entityTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <button
            onClick={handleExportImage}
            disabled={!hasMinimumEntities}
            className="rounded-lg bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            Export PNG
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-white p-3">
        {!hasMinimumEntities ? (
          <div className="flex min-h-[420px] items-center justify-center text-center text-sm text-on-surface-variant">
            Add at least two entities in this filter to render a relationship map.
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="h-[460px] w-full rounded-lg bg-surface-container-lowest"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {visibleEdges.map((edge) => {
              const sourcePosition = positions[edge.sourceId];
              const targetPosition = positions[edge.targetId];
              if (!sourcePosition || !targetPosition) {
                return null;
              }

              const midX = (sourcePosition.x + targetPosition.x) / 2;
              const midY = (sourcePosition.y + targetPosition.y) / 2;
              const isSelected = selectedEdgeId === edge.id;

              return (
                <g key={edge.id}>
                  <line
                    x1={sourcePosition.x}
                    y1={sourcePosition.y}
                    x2={targetPosition.x}
                    y2={targetPosition.y}
                    stroke={isSelected ? '#3f51b5' : '#a1a7b3'}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <line
                    x1={sourcePosition.x}
                    y1={sourcePosition.y}
                    x2={targetPosition.x}
                    y2={targetPosition.y}
                    stroke="transparent"
                    strokeWidth={16}
                    onClick={() => setSelectedEdgeId(edge.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <g onClick={() => setSelectedEdgeId(edge.id)} style={{ cursor: 'pointer' }}>
                    <rect
                      x={midX - 36}
                      y={midY - 11}
                      rx={8}
                      width={72}
                      height={22}
                      fill={isSelected ? '#dbe2ff' : '#f0f2f5'}
                      stroke={isSelected ? '#3f51b5' : '#c0c6d0'}
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#364049"
                    >
                      {edge.type.slice(0, 11)}
                    </text>
                  </g>
                </g>
              );
            })}

            {filteredEntities.map((entity) => {
              const position = positions[entity.id];
              if (!position) {
                return null;
              }

              const strokeColor = getNodeStrokeColor(entity.type);

              return (
                <g
                  key={entity.id}
                  transform={`translate(${position.x}, ${position.y})`}
                  onPointerDown={(event) => {
                    setDraggingNodeId(entity.id);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  style={{ cursor: draggingNodeId === entity.id ? 'grabbing' : 'grab' }}
                >
                  <circle r={NODE_RADIUS} fill="#ffffff" stroke={strokeColor} strokeWidth={3} />
                  <text textAnchor="middle" y={4} fontSize="11" fontWeight="700" fill="#1f2a33">
                    {entity.name.length > 16 ? `${entity.name.slice(0, 16)}...` : entity.name}
                  </text>
                  <text
                    textAnchor="middle"
                    y={NODE_RADIUS + 16}
                    fontSize="10"
                    fontWeight="700"
                    fill={strokeColor}
                  >
                    {entity.type}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
        <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Create Relationship
        </p>
        <div className="grid gap-3 md:grid-cols-5">
          <select
            value={newSourceId}
            onChange={(event) => setNewSourceId(event.target.value)}
            className="rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-label"
          >
            <option value="">From entity</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>

          <select
            value={newTargetId}
            onChange={(event) => setNewTargetId(event.target.value)}
            className="rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-label"
          >
            <option value="">To entity</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>

          <select
            value={newRelationshipType}
            onChange={(event) => setNewRelationshipType(event.target.value)}
            className="rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-label"
          >
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={newRelationshipDescription}
            onChange={(event) => setNewRelationshipDescription(event.target.value)}
            placeholder="Optional description"
            className="rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs font-label"
          />

          <button
            onClick={() => void handleAddRelationship()}
            disabled={
              isSaving ||
              !newSourceId ||
              !newTargetId ||
              newSourceId === newTargetId
            }
            className="rounded-lg bg-secondary px-3 py-2 font-label text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {isSaving ? <Spinner className="mr-1 inline-block h-3 w-3" /> : null}
            Add Link
          </button>
        </div>
      </div>

      {selectedEdge ? (
        <div className="rounded-xl border border-outline-variant/20 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Edit Relationship: {selectedEdge.sourceName} {'->'} {selectedEdge.targetName}
            </p>
            <button
              onClick={() => setSelectedEdgeId(null)}
              className="text-xs font-bold uppercase tracking-wider text-primary"
            >
              Close
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={edgeTypeDraft}
              onChange={(event) => setEdgeTypeDraft(event.target.value)}
              className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-xs font-label"
            >
              {RELATIONSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={edgeDescriptionDraft}
              onChange={(event) => setEdgeDescriptionDraft(event.target.value)}
              placeholder="Optional note"
              className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-xs font-label"
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => void handleSaveEdgeEdit()}
                disabled={isSaving || !edgeTypeDraft.trim()}
                className="rounded-lg bg-primary px-3 py-2 font-label text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {isSaving ? <Spinner className="mr-1 inline-block h-3 w-3" /> : null}
                Save
              </button>
              <button
                onClick={() => void handleDeleteEdge()}
                disabled={isSaving}
                className="rounded-lg bg-error/10 px-3 py-2 font-label text-xs font-bold uppercase tracking-wider text-error disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
