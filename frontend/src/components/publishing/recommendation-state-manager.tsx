'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';

interface RecommendationWithState {
  id: string;
  issue_category: string;
  priority: 'low' | 'medium' | 'high';
  fix_guidance: string;
  tool_reference?: string;
  wcag_level?: string;
  state: 'open' | 'in-progress' | 'resolved';
  resolved_at?: string;
}

interface RecommendationStateManagerProps {
  recommendations: RecommendationWithState[];
  onStateChange: (recommendationId: string, newState: 'open' | 'in-progress' | 'resolved') => void;
  onBulkStateChange?: (recommendationIds: string[], newState: 'open' | 'in-progress' | 'resolved') => void;
  isLoading?: boolean;
}

export function RecommendationStateManager({
  recommendations,
  onStateChange,
  onBulkStateChange,
  isLoading,
}: RecommendationStateManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionState, setBulkActionState] = useState<'open' | 'in-progress' | 'resolved'>('resolved');

  const handleToggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recommendations.map((r) => r.id)));
    }
  };

  const handleBulkUpdate = () => {
    if (selectedIds.size === 0) {
      toast.error('Select recommendations first');
      return;
    }
    onBulkStateChange?.(Array.from(selectedIds), bulkActionState);
    setSelectedIds(new Set());
    toast.success(`Updated ${selectedIds.size} recommendations`);
  };

  const stateColors: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    open: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    'in-progress': {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: <Clock className="w-4 h-4" />,
    },
    resolved: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      icon: <CheckCircle className="w-4 h-4" />,
    },
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  };

  const groupedByCategory = recommendations.reduce(
    (acc, rec) => {
      if (!acc[rec.issue_category]) {
        acc[rec.issue_category] = [];
      }
      acc[rec.issue_category].push(rec);
      return acc;
    },
    {} as Record<string, RecommendationWithState[]>
  );

  const resolvedCount = recommendations.filter((r) => r.state === 'resolved').length;
  const inProgressCount = recommendations.filter((r) => r.state === 'in-progress').length;
  const openCount = recommendations.filter((r) => r.state === 'open').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Open</p>
          <p className="text-lg font-bold text-red-700">{openCount}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">In Progress</p>
          <p className="text-lg font-bold text-amber-700">{inProgressCount}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Resolved</p>
          <p className="text-lg font-bold text-green-700">{resolvedCount}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Progress</p>
          <p className="text-lg font-bold text-primary">
            {Math.round((resolvedCount / recommendations.length) * 100)}%
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-blue-700">{selectedIds.size} selected</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={bulkActionState}
                onChange={(e) => setBulkActionState(e.target.value as any)}
                className="px-2 py-1 text-sm rounded-lg border border-blue-300 bg-white text-blue-700 font-bold"
              >
                <option value="open">Mark Open</option>
                <option value="in-progress">Mark In Progress</option>
                <option value="resolved">Mark Resolved</option>
              </select>
              <button
                onClick={handleBulkUpdate}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-700 text-white rounded-lg text-sm font-bold hover:bg-blue-800 disabled:opacity-50"
              >
                Update
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={isLoading}
                className="px-3 py-1 bg-white text-blue-700 rounded-lg text-sm font-bold border border-blue-700 hover:bg-blue-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations by Category */}
      <div className="space-y-4">
        {Object.entries(groupedByCategory).map(([category, recs]) => (
          <div key={category} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-primary capitalize">{category.replace(/_/g, ' ')}</h4>
              <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                {recs.length}
              </span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recs.map((rec) => {
                const colors = stateColors[rec.state];
                const isSelected = selectedIds.has(rec.id);
                return (
                  <div
                    key={rec.id}
                    className={`rounded-lg border-2 p-3 transition-all ${
                      isSelected ? `${colors.border} ${colors.bg}` : 'border-outline-variant/10 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelection(rec.id)}
                        className="w-4 h-4 mt-1 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <div className={`flex items-center gap-1 ${colors.text}`}>
                            {colors.icon}
                            <span className="text-xs font-bold uppercase">{rec.state}</span>
                          </div>
                          <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${priorityColors[rec.priority]}`}>
                            {rec.priority}
                          </span>
                          {rec.wcag_level && (
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                              WCAG {rec.wcag_level}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-primary font-semibold mb-1">{rec.fix_guidance}</p>
                        {rec.tool_reference && (
                          <p className="text-xs text-on-surface-variant">
                            <span className="font-bold">Tool:</span> {rec.tool_reference}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {(['open', 'in-progress', 'resolved'] as const).map((state) => (
                          <button
                            key={state}
                            onClick={() => onStateChange(rec.id, state)}
                            disabled={isLoading}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                              rec.state === state
                                ? `${stateColors[state].bg} ${stateColors[state].text} ring-2 ring-offset-1 ring-primary`
                                : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/20 hover:border-primary/30'
                            }`}
                          >
                            {state === 'in-progress' ? 'IP' : state.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Select all checkbox at bottom */}
      {recommendations.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/10">
          <input
            type="checkbox"
            checked={selectedIds.size === recommendations.length && recommendations.length > 0}
            onChange={handleSelectAll}
            className="w-4 h-4 cursor-pointer"
          />
          <label className="text-sm text-on-surface-variant cursor-pointer">
            {selectedIds.size === recommendations.length && recommendations.length > 0
              ? 'Deselect All'
              : `Select All (${recommendations.length})`}
          </label>
        </div>
      )}
    </div>
  );
}
