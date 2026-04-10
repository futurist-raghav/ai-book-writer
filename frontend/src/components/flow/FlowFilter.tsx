/**
 * Flow Event Filter Component
 * 
 * Advanced filtering UI for events by type, status, date range
 */

'use client';

import React, { useState, useCallback } from 'react';
import { FlowEvent } from '@/lib/api-client';

export interface FlowFilterState {
  types: string[];
  statuses: string[];
  dateRange: { start?: string; end?: string };
  searchQuery: string;
}

interface FlowFilterProps {
  onFilterChange?: (filters: FlowFilterState) => void;
  isActive?: boolean;
}

interface FilterStats {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * Flow Event Filter Component
 * Provides multi-criteria filtering for timeline events
 */
export function FlowFilter({ onFilterChange, isActive }: FlowFilterProps) {
  const [filters, setFilters] = useState<FlowFilterState>({
    types: [],
    statuses: [],
    dateRange: {},
    searchQuery: '',
  });

  const [isExpanded, setIsExpanded] = useState(isActive ?? false);

  const eventTypes = ['act', 'scene', 'beat', 'milestone', 'subplot', 'chapter'];
  const eventStatuses = ['planned', 'in_progress', 'completed', 'blocked'];

  const handleTypeToggle = useCallback(
    (type: string) => {
      const newFilters = {
        ...filters,
        types: filters.types.includes(type)
          ? filters.types.filter((t) => t !== type)
          : [...filters.types, type],
      };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const handleStatusToggle = useCallback(
    (status: string) => {
      const newFilters = {
        ...filters,
        statuses: filters.statuses.includes(status)
          ? filters.statuses.filter((s) => s !== status)
          : [...filters.statuses, status],
      };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const handleDateChange = useCallback(
    (field: 'start' | 'end', value: string) => {
      const newFilters = {
        ...filters,
        dateRange: {
          ...filters.dateRange,
          [field]: value || undefined,
        },
      };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      const newFilters = {
        ...filters,
        searchQuery: query,
      };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const handleReset = useCallback(() => {
    const emptyFilters: FlowFilterState = {
      types: [],
      statuses: [],
      dateRange: {},
      searchQuery: '',
    };
    setFilters(emptyFilters);
    onFilterChange?.(emptyFilters);
  }, [onFilterChange]);

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.searchQuery.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition"
        >
          <span>🔍 Filter Events</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
              {(filters.types.length +
                filters.statuses.length +
                (filters.dateRange.start ? 1 : 0) +
                (filters.dateRange.end ? 1 : 0)) + 
                (filters.searchQuery ? 1 : 0)}
            </span>
          )}
          <span className={`text-gray-400 transition ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
          >
            Reset
          </button>
        )}
      </div>

      {/* Filters (Expanded) */}
      {isExpanded && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Search
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">🔎</span>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search events..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Event Types */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Event Types
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {eventTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type)}
                    onChange={() => handleTypeToggle(type)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {eventStatuses.map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(status)}
                    onChange={() => handleStatusToggle(status)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {status === 'in_progress' ? 'In Progress' : status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Timeline Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={filters.dateRange.start || ''}
                onChange={(e) =>
                  handleDateChange('start', e.target.value)
                }
                placeholder="From"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                type="number"
                value={filters.dateRange.end || ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                placeholder="To"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filter events based on active filters
 */
export function applyFilters(events: FlowEvent[], filters: FlowFilterState): FlowEvent[] {
  return events.filter((event) => {
    // Type filter
    if (filters.types.length > 0 && !filters.types.includes(event.event_type)) {
      return false;
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(event.status)) {
      return false;
    }

    // Date range filter  
    if (filters.dateRange.start !== undefined) {
      if (event.timeline_position < parseInt(filters.dateRange.start)) {
        return false;
      }
    }
    if (filters.dateRange.end !== undefined) {
      if (
        event.timeline_position >
        parseInt(filters.dateRange.end)
      ) {
        return false;
      }
    }

    // Search filter
    if (filters.searchQuery.length > 0) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = event.title.toLowerCase().includes(query);
      const matchesDescription = event.description
        ?.toLowerCase()
        .includes(query);
      if (!matchesTitle && !matchesDescription) {
        return false;
      }
    }

    return true;
  });
}

export default FlowFilter;
