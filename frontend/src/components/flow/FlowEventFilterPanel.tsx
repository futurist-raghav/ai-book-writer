'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface FilterCriteria {
  types?: string[];
  statuses?: ('planned' | 'in_progress' | 'completed' | 'archived')[];
  dateRange?: { from: string; to: string };
  searchQuery?: string;
}

interface FlowEventFilterPanelProps {
  eventTypes: string[];
  onFilter: (criteria: FilterCriteria) => void;
  activeFilters?: FilterCriteria;
}

export function FlowEventFilterPanel({
  eventTypes,
  onFilter,
  activeFilters = {},
}: FlowEventFilterPanelProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFilters] = useState<FilterCriteria>(() => {
    // Load filters from URL or props
    const type = searchParams.get('types')?.split(',').filter(Boolean);
    const status = searchParams.get('statuses')?.split(',').filter(Boolean) as (
      | 'planned'
      | 'in_progress'
      | 'completed'
      | 'archived'
    )[];
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const query = searchParams.get('q') || '';

    return {
      types: type || activeFilters.types || [],
      statuses: status || activeFilters.statuses || [],
      dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : activeFilters.dateRange,
      searchQuery: query || activeFilters.searchQuery || '',
    };
  });

  const statusOptions: ('planned' | 'in_progress' | 'completed' | 'archived')[] = [
    'planned',
    'in_progress',
    'completed',
    'archived',
  ];

  // Update URL params and call callback
  const updateFilters = (newFilters: FilterCriteria) => {
    setFilters(newFilters);

    // Build query string
    const params = new URLSearchParams();
    if (newFilters.types?.length) params.set('types', newFilters.types.join(','));
    if (newFilters.statuses?.length) params.set('statuses', newFilters.statuses.join(','));
    if (newFilters.dateRange?.from) params.set('dateFrom', newFilters.dateRange.from);
    if (newFilters.dateRange?.to) params.set('dateTo', newFilters.dateRange.to);
    if (newFilters.searchQuery) params.set('q', newFilters.searchQuery);

    router.push(`?${params.toString()}`);
    onFilter(newFilters);
  };

  const handleTypeChange = (type: string) => {
    const newTypes = filters.types?.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...(filters.types || []), type];
    updateFilters({ ...filters, types: newTypes });
  };

  const handleStatusChange = (status: 'planned' | 'in_progress' | 'completed' | 'archived') => {
    const newStatuses = filters.statuses?.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...(filters.statuses || []), status];
    updateFilters({ ...filters, statuses: newStatuses });
  };

  const handleDateFromChange = (date: string) => {
    updateFilters({
      ...filters,
      dateRange: { ...filters.dateRange, from: date } as any,
    });
  };

  const handleDateToChange = (date: string) => {
    updateFilters({
      ...filters,
      dateRange: { ...filters.dateRange, to: date } as any,
    });
  };

  const handleSearchChange = (query: string) => {
    updateFilters({ ...filters, searchQuery: query });
  };

  const handleClearAll = () => {
    const cleared: FilterCriteria = {
      types: [],
      statuses: [],
      dateRange: undefined,
      searchQuery: '',
    };
    updateFilters(cleared);
  };

  const activeFilterCount = [
    ...(filters.types || []),
    ...(filters.statuses || []),
    ...(filters.dateRange ? ['dateRange'] : []),
    ...(filters.searchQuery ? ['search'] : []),
  ].length;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-4 mb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">
          Filter Events
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearAll}
            className="px-2 py-1 rounded text-xs font-bold uppercase text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Clear All ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Title or description..."
            value={filters.searchQuery || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded px-3 py-2 text-sm font-body focus:border-secondary transition-colors"
          />
        </div>

        {/* Type Filter */}
        <div>
          <label className="block font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Type
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {eventTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.types?.includes(type) || false}
                  onChange={() => handleTypeChange(type)}
                  className="w-4 h-4 rounded border-outline-variant"
                />
                <span className="capitalize">{type.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Status
          </label>
          <div className="space-y-2">
            {statusOptions.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.statuses?.includes(status) || false}
                  onChange={() => handleStatusChange(status)}
                  className="w-4 h-4 rounded border-outline-variant"
                />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <label className="block font-label text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Timeline Range
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange?.from || ''}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded px-2 py-2 text-xs font-body focus:border-secondary transition-colors"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.dateRange?.to || ''}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded px-2 py-2 text-xs font-body focus:border-secondary transition-colors"
              placeholder="To"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
