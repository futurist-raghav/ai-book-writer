/**
 * Enhanced Flow Dashboard Pro - v2
 * Integrates all P2.3 features + shortcuts + drag-and-drop + cycle detection + export
 * 
 * Features:
 * - P2.2 base views (Overview, Timeline, Graph)
 * - P2.3 advanced views (Gantt with drag-drop, Filter, Analytics, Bulk)
 * - Keyboard shortcuts (Cmd+F, Cmd+E, etc.)
 * - Cycle detection with UI warnings
 * - Export/Import capabilities
 */

import React, { useState, useCallback } from 'react';
import { FlowEvent, FlowDependency } from '@/types/flow';
import { GanttChart } from './GanttChart';
import { DraggableGanttChart } from './DraggableGanttChart';
import { FlowFilter, applyFilters, FlowFilterState } from './FlowFilter';
import { BulkOperations } from './BulkOperations';
import { FlowAnalytics } from './FlowAnalytics';
import { FlowDashboard } from './FlowDashboard';
import { useFlowKeyboardShortcuts } from './FlowKeyboardShortcuts';
import { detectCycles, wouldCreateCycle } from './CycleDetection';
import { downloadCSV, downloadJSON, downloadHTML } from './TimelineExport';

export interface EnhancedFlowDashboardProProps {
  bookId: string;
  events: FlowEvent[];
  dependencies: FlowDependency[];
  onEventCreate?: (event: Partial<FlowEvent>) => void;
  onEventUpdate?: (eventId: string, data: Partial<FlowEvent>) => void;
  onEventReorder?: (eventId: string, newPosition: number) => void;
  onBatchStatusChange?: (eventIds: string[], newStatus: string) => void;
  onBatchDelete?: (eventIds: string[]) => void;
  onDependencyCreate?: (fromId: string, toId: string) => void;
  onDependencyDelete?: (depId: string) => void;
  isLoading?: boolean;
  error?: string;
}

type ViewMode = 'overview' | 'gantt' | 'gantt-drag' | 'analytics' | 'bulk' | 'timeline' | 'graph';

/**
 * EnhancedFlowDashboardPro: All-in-one flow management dashboard
 */
export const EnhancedFlowDashboardPro: React.FC<EnhancedFlowDashboardProProps> = ({
  bookId,
  events,
  dependencies,
  onEventCreate,
  onEventUpdate,
  onEventReorder,
  onBatchStatusChange,
  onBatchDelete,
  onDependencyCreate,
  onDependencyDelete,
  isLoading,
  error,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [filters, setFilters] = useState<FlowFilterState>({
    types: [],
    statuses: [],
    dateRange: {},
    searchQuery: '',
  });
  const [showCycleWarning, setShowCycleWarning] = useState(false);
  const [cycleDetails, setCycleDetails] = useState<string[]>([]);
  const filterInputRef = React.useRef<HTMLInputElement>(null);

  // Apply filters
  const filteredEvents = applyFilters(events, filters);

  // Detect cycles
  const cycleDetection = detectCycles(dependencies, events);

  // Keyboard shortcuts handler
  const { handleKeyDown } = useFlowKeyboardShortcuts(
    {
      onFilterFocus: () => {
        filterInputRef.current?.focus();
      },
      onExport: () => {
        downloadCSV(filteredEvents, dependencies);
      },
      onSelectAll: () => {
        // TODO: Connect to bulk operations
      },
      onClearSelection: () => {
        // TODO: Clear selections
      },
      onDeleteSelected: () => {
        // TODO: Trigger bulk delete
      },
      onToggleGantt: () => {
        setViewMode(viewMode === 'gantt' ? 'overview' : 'gantt');
      },
      onToggleAnalytics: () => {
        setViewMode(viewMode === 'analytics' ? 'overview' : 'analytics');
      },
    },
    true
  );

  // Attach keyboard listener
  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle event reorder
  const handleEventReorder = useCallback(
    (eventId: string, newPosition: number) => {
      onEventReorder?.(eventId, newPosition);
    },
    [onEventReorder]
  );

  // Validate dependency before creation
  const handleDependencyCreate = useCallback(
    (fromId: string, toId: string) => {
      if (wouldCreateCycle(fromId, toId, dependencies)) {
        alert('❌ This would create a circular dependency!');
        return;
      }
      onDependencyCreate?.(fromId, toId);
    },
    [dependencies, onDependencyCreate]
  );

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-semibold">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 p-4 rounded-lg">
      {/* Cycle Warning */}
      {cycleDetection.hasCycles && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-semibold">
            ⚠️ {cycleDetection.cycles.length} circular {cycleDetection.cycles.length === 1 ? 'dependency' : 'dependencies'} detected
          </p>
        </div>
      )}

      {/* Header with View Toggles */}
      <div className="mb-6 flex flex-wrap gap-2 items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === 'overview'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Overview
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === 'timeline'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📅 Timeline
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === 'gantt'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 Gantt
          </button>
          <button
            onClick={() => setViewMode('gantt-drag')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === 'gantt-drag'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ✋ Drag-Drop
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === 'analytics'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📈 Analytics
          </button>
          <button
            onClick={() => setViewMode('bulk')}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              viewMode === 'bulk'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ☑️ Bulk Ops
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => downloadCSV(filteredEvents, dependencies)}
            className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            title="Cmd+E"
          >
            📥 CSV
          </button>
          <button
            onClick={() => downloadJSON(filteredEvents, dependencies)}
            className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            📥 JSON
          </button>
          <button
            onClick={() => downloadHTML(filteredEvents, dependencies)}
            className="px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
          >
            📥 HTML
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {(viewMode === 'gantt' || viewMode === 'gantt-drag' || viewMode === 'bulk' ||
        viewMode === 'analytics') && (
        <div className="mb-4">
          <FlowFilter
            filters={filters}
            onFilterChange={setFilters}
            filterInputRef={filterInputRef}
          />
        </div>
      )}

      {/* Main Content Areas */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <p>Loading flow events...</p>
          </div>
        ) : viewMode === 'overview' ? (
          <FlowDashboard
            events={filteredEvents}
            dependencies={dependencies}
            onEventCreate={onEventCreate}
            onEventUpdate={onEventUpdate}
            onDependencyCreate={handleDependencyCreate}
            onDependencyDelete={onDependencyDelete}
          />
        ) : viewMode === 'gantt' ? (
          <GanttChart
            events={filteredEvents}
            dependencies={dependencies}
            onEventClick={(eventId) => {
              const event = filteredEvents.find((e) => e.id === eventId);
              if (event) {
                console.log('Selected event:', event);
              }
            }}
          />
        ) : viewMode === 'gantt-drag' ? (
          <DraggableGanttChart
            events={filteredEvents}
            dependencies={dependencies}
            onEventReorder={handleEventReorder}
            onEventClick={(eventId) => {
              const event = filteredEvents.find((e) => e.id === eventId);
              if (event) {
                console.log('Selected event:', event);
              }
            }}
          />
        ) : viewMode === 'analytics' ? (
          <FlowAnalytics events={filteredEvents} />
        ) : viewMode === 'bulk' ? (
          <BulkOperations
            events={filteredEvents}
            onBatchStatusChange={onBatchStatusChange}
            onBatchDelete={onBatchDelete}
          />
        ) : (
          <FlowDashboard
            events={filteredEvents}
            dependencies={dependencies}
            onEventCreate={onEventCreate}
            onEventUpdate={onEventUpdate}
            onDependencyCreate={handleDependencyCreate}
            onDependencyDelete={onDependencyDelete}
          />
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <p className="font-semibold">⌨️ Keyboard Shortcuts:</p>
        <p>Cmd/Ctrl+F to focus filter • Cmd/Ctrl+E to export CSV • Cmd/Ctrl+Shift+G for Gantt view • Cmd/Ctrl+Shift+K for analytics</p>
      </div>

      {/* Critical Path Info */}
      {cycleDetection.criticalPath.length > 0 && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded text-xs text-purple-800">
          <p className="font-semibold">📍 Critical Path ({cycleDetection.criticalPath.length} events):</p>
          <p className="mt-1">
            {cycleDetection.criticalPath.map((id) => {
              const event = events.find((e) => e.id === id);
              return event?.title || id;
            }).join(' → ')}
          </p>
        </div>
      )}
    </div>
  );
};
