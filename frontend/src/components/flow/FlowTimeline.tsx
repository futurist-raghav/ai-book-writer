/**
 * Flow Timeline Component
 * 
 * Displays events in chronological order with dependency indicators
 * for Gantt-style timeline visualization.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { FlowEvent, FlowDependency } from '@/lib/api-client';

interface FlowTimelineProps {
  events: FlowEvent[];
  dependencies?: FlowDependency[];
  onEventClick?: (eventId: string) => void;
  onEventHover?: (eventId: string | null) => void;
  isLoading?: boolean;
  error?: string;
}

interface TimelineEvent extends FlowEvent {
  blockedBy: string[];
  blocking: string[];
}

/**
 * Flow Timeline Component
 * Renders events sorted by timeline_position with visual dependency indicators
 */
export function FlowTimeline({
  events,
  dependencies = [],
  onEventClick,
  onEventHover,
  isLoading,
  error,
}: FlowTimelineProps) {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Build dependency map for quick lookup
  const dependencyMap = useMemo(() => {
    const map = new Map<string, { blockedBy: string[]; blocking: string[] }>();

    // Initialize all events
    events.forEach((event) => {
      if (!map.has(event.id)) {
        map.set(event.id, { blockedBy: [], blocking: [] });
      }
    });

    // Process dependencies
    dependencies.forEach((dep) => {
      const fromEntry = map.get(dep.from_event_id) || {
        blockedBy: [],
        blocking: [],
      };
      const toEntry = map.get(dep.to_event_id) || { blockedBy: [], blocking: [] };

      fromEntry.blocking.push(dep.to_event_id);
      toEntry.blockedBy.push(dep.from_event_id);

      map.set(dep.from_event_id, fromEntry);
      map.set(dep.to_event_id, toEntry);
    });

    return map;
  }, [events, dependencies]);

  // Sort events by timeline_position
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timeline_position - b.timeline_position),
    [events]
  );

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    if (sortedEvents.length === 0) {
      return { min: 0, max: 1000 };
    }
    const positions = sortedEvents.map((e) => e.timeline_position);
    return {
      min: Math.min(...positions),
      max: Math.max(...positions),
    };
  }, [sortedEvents]);

  const timelineSpan = timelineRange.max - timelineRange.min || 1;

  // Event status style
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'in_progress':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-900';
      case 'blocked':
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  // Event type icon
  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'act':
        return '🎬';
      case 'scene':
        return '📽️';
      case 'beat':
        return '⚡';
      case 'milestone':
        return '🎯';
      case 'subplot':
        return '🌿';
      case 'chapter':
        return '📖';
      default:
        return '📌';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Error loading timeline: {error}
      </div>
    );
  }

  if (sortedEvents.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">No timeline events yet</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Timeline Header */}
      <div className="flex items-center gap-2 px-4">
        <h3 className="font-semibold text-gray-900">Timeline</h3>
        <span className="text-sm text-gray-500">
          {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline Events */}
      <div className="space-y-3">
        {sortedEvents.map((event) => {
          const deps = dependencyMap.get(event.id) || {
            blockedBy: [],
            blocking: [],
          };
          const isHovered = hoveredEventId === event.id;
          const isRelated = hoveredEventId
            ? deps.blockedBy.includes(hoveredEventId) ||
              deps.blocking.includes(hoveredEventId)
            : false;

          // Calculate relative position
          const relativePosition = (event.timeline_position - timelineRange.min) / timelineSpan;

          return (
            <div
              key={event.id}
              className="group"
              onMouseEnter={() => {
                setHoveredEventId(event.id);
                onEventHover?.(event.id);
              }}
              onMouseLeave={() => {
                setHoveredEventId(null);
                onEventHover?.(null);
              }}
            >
              {/* Timeline Bar */}
              <div className="flex items-start gap-3">
                {/* Position Indicator */}
                <div className="pt-1 text-sm font-mono text-gray-400 w-16">
                  {event.timeline_position}
                </div>

                {/* Event Card */}
                <button
                  onClick={() => onEventClick?.(event.id)}
                  className={`
                    flex-1 px-4 py-3 rounded-lg border-2 transition-all
                    ${getStatusColor(event.status)}
                    ${isHovered ? 'ring-2 ring-offset-2 ring-blue-400 shadow-lg' : 'shadow'}
                    ${isRelated && !isHovered ? 'opacity-40' : ''}
                    hover:shadow-md active:scale-98
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {/* Event Type Icon */}
                      <span className="text-lg mt-0.5">{getEventTypeIcon(event.event_type)}</span>

                      {/* Event Info */}
                      <div className="flex-1 text-left">
                        <h4 className="font-semibold text-sm">{event.title}</h4>
                        {event.description && (
                          <p className="text-xs opacity-75 line-clamp-1 mt-0.5">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
                          <span>{event.event_type}</span>
                          {event.duration && <span>•</span>}
                          {event.duration && <span>{event.duration}d</span>}
                        </div>
                      </div>
                    </div>

                    {/* Dependency Indicators */}
                    {(deps.blockedBy.length > 0 || deps.blocking.length > 0) && (
                      <div className="flex items-center gap-1 text-xs opacity-75">
                        {deps.blockedBy.length > 0 && (
                          <span title={`Blocked by ${deps.blockedBy.length} event(s)`}>
                            ⬅️ {deps.blockedBy.length}
                          </span>
                        )}
                        {deps.blocking.length > 0 && (
                          <span title={`Blocking ${deps.blocking.length} event(s)`}>
                            ➡️ {deps.blocking.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>

                {/* Status Badge */}
                <div className="pt-1 text-xs font-medium px-2 py-1 rounded bg-gray-100 whitespace-nowrap">
                  {event.status}
                </div>
              </div>

              {/* Dependency Links (only show when event is hovered) */}
              {isHovered && deps.blockedBy.length > 0 && (
                <div className="mt-2 ml-19 pl-2 border-l-2 border-orange-300 text-xs text-orange-600 space-y-1">
                  <div className="font-semibold">Blocked by:</div>
                  {deps.blockedBy.map((depId) => {
                    const depEvent = events.find((e) => e.id === depId);
                    return (
                      <div key={depId} className="text-orange-500">
                        ← {depEvent?.title || 'Unknown'}
                      </div>
                    );
                  })}
                </div>
              )}

              {isHovered && deps.blocking.length > 0 && (
                <div className="mt-2 ml-19 pl-2 border-l-2 border-purple-300 text-xs text-purple-600 space-y-1">
                  <div className="font-semibold">Blocks:</div>
                  {deps.blocking.map((depId) => {
                    const depEvent = events.find((e) => e.id === depId);
                    return (
                      <div key={depId} className="text-purple-500">
                        → {depEvent?.title || 'Unknown'}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Timeline Scale */}
      <div className="mt-6 px-4 py-2 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-600">
          Range: {timelineRange.min} → {timelineRange.max} (span: {timelineSpan})
        </div>
      </div>
    </div>
  );
}

export default FlowTimeline;
