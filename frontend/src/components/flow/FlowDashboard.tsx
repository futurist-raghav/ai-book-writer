/**
 * Flow Dashboard
 * 
 * Main dashboard component for flow management
 * Integrates timeline, dependency graph, and event editor
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FlowEvent, FlowDependency } from '@/lib/api-client';
import { FlowTimeline } from './FlowTimeline';
import { DependencyGraphEditor } from './DependencyGraphEditor';
import { FlowEventEditor } from './FlowEventEditor';

interface FlowDashboardProps {
  bookId: string;
  events: FlowEvent[];
  dependencies: FlowDependency[];
  onEventCreate?: (event: Partial<FlowEvent>) => void;
  onEventUpdate?: (eventId: string, data: Partial<FlowEvent>) => void;
  onDependencyCreate?: (fromId: string, toId: string) => void;
  onDependencyDelete?: (depId: string) => void;
  isLoading?: boolean;
  error?: string;
}

type ViewMode = 'timeline' | 'graph' | 'editor';

/**
 * Flow Dashboard
 * Main orchestration component for flow management
 */
export function FlowDashboard({
  bookId,
  events,
  dependencies,
  onEventCreate,
  onEventUpdate,
  onDependencyCreate,
  onDependencyDelete,
  isLoading,
  error,
}: FlowDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showStats, setShowStats] = useState(true);

  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  // Calculate statistics
  const stats = {
    totalEvents: events.length,
    completedEvents: events.filter((e) => e.status === 'completed').length,
    inProgress: events.filter((e) => e.status === 'in_progress').length,
    totalDependencies: dependencies.length,
    eventTypes: [...new Set(events.map((e) => e.event_type))].length,
  };

  const completionPercent =
    stats.totalEvents > 0 ? Math.round((stats.completedEvents / stats.totalEvents) * 100) : 0;

  return (
    <div className="w-full space-y-6 bg-white p-6 rounded-lg">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Flow Management</h1>
          <p className="text-gray-600 mt-1">
            Organize and track events, dependencies, and timeline
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          {(['timeline', 'graph', 'editor'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === 'editor') {
                  setIsEditing(true);
                }
              }}
              className={`
                px-4 py-2 rounded font-medium transition
                ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-700 hover:text-gray-900'
                }
              `}
            >
              {mode === 'timeline' && '📅 Timeline'}
              {mode === 'graph' && '🔗 Graph'}
              {mode === 'editor' && '✏️ Editor'}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Events */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Events</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{stats.totalEvents}</div>
          </div>

          {/* Completed */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Completed</div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {stats.completedEvents}
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-600 font-medium">In Progress</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">{stats.inProgress}</div>
          </div>

          {/* Dependencies */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">Dependencies</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">
              {stats.totalDependencies}
            </div>
          </div>

          {/* Completion % */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="text-sm text-indigo-600 font-medium">Completion</div>
            <div className="text-2xl font-bold text-indigo-900 mt-1">{completionPercent}%</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div>
            <FlowTimeline
              events={events}
              dependencies={dependencies}
              onEventClick={(eventId) => {
                setSelectedEventId(eventId);
                setViewMode('editor');
                setIsEditing(true);
              }}
              onEventHover={(eventId) => setSelectedEventId(eventId)}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Graph View */}
        {viewMode === 'graph' && (
          <div>
            <DependencyGraphEditor
              events={events}
              dependencies={dependencies}
              onAddDependency={(fromId, toId) => {
                onDependencyCreate?.(fromId, toId);
              }}
              onRemoveDependency={(depId) => {
                onDependencyDelete?.(depId);
              }}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Editor View */}
        {viewMode === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event List */}
            <div className="lg:col-span-1">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Events</h3>
                <div className="space-y-1 max-h-96 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setIsEditing(true);
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded text-sm transition
                        ${
                          selectedEventId === event.id
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div
                        className={`
                        text-xs mt-0.5
                        ${
                          selectedEventId === event.id ? 'text-blue-100' : 'text-gray-500'
                        }
                      `}
                      >
                        {event.event_type} • {event.status}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Add Event Button */}
                {!isEditing && (
                  <button
                    onClick={() => {
                      setSelectedEventId(null);
                      setIsEditing(true);
                    }}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium mt-4"
                  >
                    + New Event
                  </button>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              {isEditing ? (
                <div className="border rounded-lg p-6 bg-gray-50">
                  <FlowEventEditor
                    event={selectedEvent || undefined}
                    bookId={bookId}
                    onSave={(data) => {
                      if (selectedEvent) {
                        onEventUpdate?.(selectedEvent.id, data);
                      } else {
                        onEventCreate?.(data);
                      }
                      setIsEditing(false);
                      setSelectedEventId(null);
                    }}
                    onCancel={() => {
                      setIsEditing(false);
                      setSelectedEventId(null);
                    }}
                    isLoading={isLoading}
                  />
                </div>
              ) : selectedEvent ? (
                <div className="border rounded-lg p-6 bg-gray-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h2>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Type</div>
                      <div className="font-semibold text-gray-900">
                        {selectedEvent.event_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Status</div>
                      <div className="font-semibold text-gray-900">{selectedEvent.status}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Timeline Position</div>
                      <div className="font-semibold text-gray-900">
                        {selectedEvent.timeline_position}
                      </div>
                    </div>
                    {selectedEvent.duration && (
                      <div>
                        <div className="text-sm text-gray-600">Duration</div>
                        <div className="font-semibold text-gray-900">
                          {selectedEvent.duration} days
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedEvent.description && (
                    <div>
                      <div className="text-sm text-gray-600">Description</div>
                      <p className="text-gray-900 mt-1">{selectedEvent.description}</p>
                    </div>
                  )}

                  {selectedEvent.content && (
                    <div>
                      <div className="text-sm text-gray-600">Content</div>
                      <p className="text-gray-900 mt-1 line-clamp-3">{selectedEvent.content}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                  <div className="text-gray-600">
                    <div className="text-4xl mb-2">📝</div>
                    <p>Select an event or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-4 text-sm text-gray-500">
        <div>
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-gray-600 hover:text-gray-900"
          >
            {showStats ? 'Hide' : 'Show'} Statistics
          </button>
        </div>
        <div>Last updated: {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
}

export default FlowDashboard;
