/**
 * Enhanced Flow Dashboard - P2.3
 * 
 * Advanced flow management with Gantt charts, filtering, bulk operations, and analytics
 */

'use client';

import React, { useState, useMemo } from 'react';
import { FlowEvent, FlowDependency } from '@/lib/api-client';
import { GanttChart } from './GanttChart';
import { FlowFilter, FlowFilterState, applyFilters } from './FlowFilter';
import { BulkOperations } from './BulkOperations';
import { FlowAnalytics } from './FlowAnalytics';
import { FlowDashboard } from './FlowDashboard';

type ViewMode = 'overview' | 'gantt' | 'analytics' | 'bulk';

interface EnhancedFlowDashboardProps {
  bookId: string;
  events: FlowEvent[];
  dependencies: FlowDependency[];
  onEventCreate?: (event: Partial<FlowEvent>) => void;
  onEventUpdate?: (eventId: string, data: Partial<FlowEvent>) => void;
  onBatchStatusChange?: (eventIds: string[], newStatus: string) => void;
  onBatchDelete?: (eventIds: string[]) => void;
  onDependencyCreate?: (fromId: string, toId: string) => void;
  onDependencyDelete?: (depId: string) => void;
  isLoading?: boolean;
  error?: string;
}

/**
 * Enhanced Flow Dashboard - P2.3
 * Integrate Gantt charts, filtering, bulk operations, and analytics
 */
export function EnhancedFlowDashboard({
  bookId,
  events,
  dependencies,
  onEventCreate,
  onEventUpdate,
  onBatchStatusChange,
  onBatchDelete,
  onDependencyCreate,
  onDependencyDelete,
  isLoading,
  error,
}: EnhancedFlowDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [filters, setFilters] = useState<FlowFilterState>({
    types: [],
    statuses: [],
    dateRange: {},
    searchQuery: '',
  });

  // Apply filters
  const filteredEvents = useMemo(
    () => applyFilters(events, filters),
    [events, filters]
  );

  const filteredDependencies = useMemo(
    () =>
      dependencies.filter(
        (dep) =>
          filteredEvents.some((e) => e.id === dep.from_event_id) &&
          filteredEvents.some((e) => e.id === dep.to_event_id)
      ),
    [dependencies, filteredEvents]
  );

  const hasActiveFilters = Boolean(
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.searchQuery.length > 0
  );

  return (
    <div className="w-full space-y-6 bg-gray-50 min-h-screen p-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Header with View Modes */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Flow Management</h1>
          <div className="text-sm text-gray-600">
            {events.length} events
            {hasActiveFilters && ` (${filteredEvents.length} filtered)`}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
          {(
            [
              { mode: 'overview' as const, label: '📋 Overview', icon: 'Overview' },
              { mode: 'gantt' as const, label: '📊 Gantt', icon: 'Gantt' },
              { mode: 'analytics' as const, label: '📈 Analytics', icon: 'Analytics' },
              { mode: 'bulk' as const, label: '✓ Bulk Ops', icon: 'Bulk' },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`
                px-4 py-2 rounded font-medium transition
                ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-700 hover:text-gray-900'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <FlowFilter onFilterChange={setFilters} isActive={hasActiveFilters} />
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            Showing {filteredEvents.length} of {events.length} events
          </div>
        )}
      </div>

      {/* View Content */}
      <div className="bg-white rounded-lg shadow-sm">
        {viewMode === 'overview' && (
          <div className="p-6">
            <FlowDashboard
              bookId={bookId}
              events={filteredEvents}
              dependencies={filteredDependencies}
              onEventCreate={onEventCreate}
              onEventUpdate={onEventUpdate}
              onDependencyCreate={onDependencyCreate}
              onDependencyDelete={onDependencyDelete}
              isLoading={isLoading}
            />
          </div>
        )}

        {viewMode === 'gantt' && (
          <div className="p-6">
            <GanttChart
              events={filteredEvents}
              dependencies={filteredDependencies}
              onEventClick={onEventCreate ? undefined : undefined}
              isLoading={isLoading}
            />
          </div>
        )}

        {viewMode === 'analytics' && (
          <div className="p-6">
            <FlowAnalytics events={filteredEvents} isLoading={isLoading} />
          </div>
        )}

        {viewMode === 'bulk' && (
          <div className="p-6">
            <BulkOperations
              events={filteredEvents}
              onBatchStatusChange={onBatchStatusChange}
              onBatchDelete={onBatchDelete}
              onBatchUpdate={
                onEventUpdate
                  ? (eventIds, data) => {
                      eventIds.forEach((eventId) => onEventUpdate(eventId, data));
                    }
                  : undefined
              }
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        <p>P2.3 Advanced Flow Visualization • {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

export default EnhancedFlowDashboard;
