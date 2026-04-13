/**
 * Flow Bulk Operations Component
 * 
 * Multi-select interface for batch operations on events
 */

'use client';

import React, { useState, useCallback } from 'react';
import { FlowEvent } from '@/lib/api-client';

interface BulkOperationsProps {
  events: FlowEvent[];
  onBatchStatusChange?: (eventIds: string[], newStatus: string) => void;
  onBatchDelete?: (eventIds: string[]) => void;
  onBatchUpdate?: (eventIds: string[], data: Partial<FlowEvent>) => void;
  isLoading?: boolean;
}

const eventStatuses = ['planned', 'in_progress', 'completed', 'blocked'];

/**
 * Flow Bulk Operations Component
 * Multi-select events and perform batch operations
 */
export function BulkOperations({
  events,
  onBatchStatusChange,
  onBatchDelete,
  onBatchUpdate,
  isLoading,
}: BulkOperationsProps) {
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isAllSelected = selectedEventIds.size === events.length && events.length > 0;
  const isIndeterminate =
    selectedEventIds.size > 0 && selectedEventIds.size < events.length;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(events.map((e) => e.id)));
    }
  }, [events, isAllSelected]);

  const handleSelectEvent = useCallback((eventId: string) => {
    setSelectedEventIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const handleBatchStatusChange = useCallback(
    (newStatus: string) => {
      if (selectedEventIds.size === 0) return;
      onBatchStatusChange?.(Array.from(selectedEventIds), newStatus);
      setSelectedEventIds(new Set());
    },
    [selectedEventIds, onBatchStatusChange]
  );

  const handleBatchDelete = useCallback(() => {
    if (selectedEventIds.size === 0) return;
    onBatchDelete?.(Array.from(selectedEventIds));
    setShowConfirmDelete(false);
    setSelectedEventIds(new Set());
  }, [selectedEventIds, onBatchDelete]);

  const selectedCount = selectedEventIds.size;
  const selectedEvents = events.filter((e) => selectedEventIds.has(e.id));

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">
              {selectedCount} event{selectedCount !== 1 ? 's' : ''} selected
            </h3>
            <button
              onClick={() => setSelectedEventIds(new Set())}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Selection
            </button>
          </div>

          {/* Batch Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Status Dropdown */}
            <div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchStatusChange(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm font-medium hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
              >
                <option value="">Change Status...</option>
                {eventStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Selection */}
            <button
              onClick={() => {
                const csv = selectedEvents
                  .map((e) => `"${e.title}","${e.event_type}","${e.status}",${e.timeline_position},${e.duration || 0}`)
                  .join('\n');
                const header = '"Title","Type","Status","Position","Duration"\n';
                const blob = new Blob([header + csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `flow-events-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium transition"
            >
              📥 Export CSV
            </button>

            {/* Delete Button */}
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition disabled:opacity-50"
            >
              🗑️ Delete ({selectedCount})
            </button>
          </div>

          {/* Selection List Preview */}
          <div className="mt-3 max-h-32 overflow-y-auto bg-white rounded border border-blue-100 p-2">
            <div className="text-xs text-gray-600 mb-2 font-semibold">Selected Events:</div>
            <div className="space-y-1">
              {selectedEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="text-xs text-gray-700 flex items-center justify-between px-2 py-1 bg-gray-50 rounded">
                  <span>{event.title}</span>
                  <button
                    onClick={() => handleSelectEvent(event.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {selectedCount > 5 && (
                <div className="text-xs text-gray-600 px-2 py-1 italic">
                  +{selectedCount - 5} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event List with Checkboxes */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 border-b px-4 py-3 flex items-center gap-3">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(node) => {
              if (node) {
                node.indeterminate = isIndeterminate;
              }
            }}
            onChange={handleSelectAll}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
          />
          <span className="font-semibold text-gray-700 flex-1">
            {events.length} Events
          </span>
          {selectedCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
              {selectedCount} selected
            </span>
          )}
        </div>

        {/* Event List */}
        <div className="divide-y max-h-96 overflow-y-auto">
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition cursor-pointer ${
                selectedEventIds.has(event.id) ? 'bg-blue-50' : ''
              }`}
              onClick={() => handleSelectEvent(event.id)}
            >
              <input
                type="checkbox"
                checked={selectedEventIds.has(event.id)}
                onChange={() => {}} // Handled by parent div click
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{event.title}</div>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <span>{event.event_type}</span>
                  <span>•</span>
                  <span>Pos: {event.timeline_position}</span>
                  {event.duration && (
                    <>
                      <span>•</span>
                      <span>{event.duration}d</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                    event.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : event.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-800'
                      : event.status === 'blocked'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {event.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {events.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            No events to select
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Delete Events?</h2>
              <p className="text-gray-600 mt-1">
                Are you sure you want to permanently delete {selectedCount} event
                {selectedCount !== 1 ? 's' : ''}? This cannot be undone.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              ⚠️ Any dependencies linked to these events will also be removed.
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkOperations;
