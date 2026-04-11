/**
 * Suggestion Mode Component
 * 
 * Track Changes style interface for accepting/rejecting text suggestions.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface Suggestion {
  id: string;
  chapter_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  original_position: number;
  original_text: string;
  suggested_text: string;
  context_before?: string;
  context_after?: string;
  change_type: 'edit' | 'insert' | 'delete';
  confidence_score: number;
  reason?: string;
  is_accepted: boolean;
  is_rejected: boolean;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface SuggestionListProps {
  chapterId: string;
  onApply?: (suggestion: Suggestion) => void;
}

/**
 * List and manage all suggestions for a chapter
 */
export const SuggestionList: React.FC<SuggestionListProps> = ({
  chapterId,
  onApply,
}) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // Fetch suggestions
  const { data: suggestionsData, isLoading } = useQuery(
    ['suggestions', chapterId, statusFilter],
    async () => {
      const response = await api.get(
        `/api/v1/chapters/${chapterId}/suggestions?status_filter=${statusFilter}`
      );
      return response;
    }
  );

  const suggestions = useMemo(
    () => suggestionsData?.suggestions ?? [],
    [suggestionsData]
  );

  const resolveMutation = useMutation(
    async ({ suggestionId, action }: { suggestionId: string; action: 'accept' | 'reject' }) => {
      await api.patch(`/api/v1/chapters/${chapterId}/suggestions/${suggestionId}`, {
        action,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suggestions', chapterId]);
      },
    }
  );

  const batchResolveMutation = useMutation(
    async (action: 'accept' | 'reject') => {
      await api.post(`/api/v1/chapters/${chapterId}/suggestions/batch-resolve`, {
        action,
        suggestion_ids: Array.from(selectedSuggestions),
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suggestions', chapterId]);
        setSelectedSuggestions(new Set());
      },
    }
  );

  const handleToggleSuggestion = useCallback((id: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(suggestions.map((s) => s.id)));
    }
  }, [suggestions, selectedSuggestions.size]);

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading suggestions...</div>;
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {statusFilter === 'pending' ? 'No pending suggestions' : `No ${statusFilter} suggestions`}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
            statusFilter === 'pending'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending ({suggestionsData?.pending_count ?? 0})
        </button>
        <button
          onClick={() => setStatusFilter('accepted')}
          className={`px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
            statusFilter === 'accepted'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Accepted ({suggestionsData?.accepted_count ?? 0})
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-3 py-2 border-b-2 text-sm font-medium transition-colors ${
            statusFilter === 'rejected'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Rejected ({suggestionsData?.rejected_count ?? 0})
        </button>
      </div>

      {/* Batch actions */}
      {statusFilter === 'pending' && suggestions.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <input
            type="checkbox"
            checked={selectedSuggestions.size === suggestions.length}
            onChange={handleSelectAll}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {selectedSuggestions.size > 0
              ? `${selectedSuggestions.size} selected`
              : 'Select all suggestions'}
          </span>
          {selectedSuggestions.size > 0 && (
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                onClick={() => batchResolveMutation.mutate('accept')}
                disabled={batchResolveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                ✓ Accept All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchResolveMutation.mutate('reject')}
                disabled={batchResolveMutation.isPending}
              >
                ✕ Reject All
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Suggestions list */}
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} className="border-l-4 border-yellow-500">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                {statusFilter === 'pending' && (
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(suggestion.id)}
                    onChange={() => handleToggleSuggestion(suggestion.id)}
                    className="w-4 h-4 mt-1 flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {suggestion.change_type}
                    </Badge>
                    {suggestion.confidence_score < 100 && (
                      <Badge variant="outline">
                        {suggestion.confidence_score}% confidence
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    By {suggestion.author_name}
                  </p>
                  {suggestion.reason && (
                    <p className="text-xs text-gray-500 italic mt-1">{suggestion.reason}</p>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Original text */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Original:</p>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm">
                  <span className="line-through text-red-700">{suggestion.original_text}</span>
                </div>
              </div>

              {/* Suggested replacement */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Suggestion:</p>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm">
                  <span className="text-green-700">{suggestion.suggested_text}</span>
                </div>
              </div>

              {/* Context */}
              {(suggestion.context_before || suggestion.context_after) && (
                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs text-gray-600 dark:text-gray-400">
                  {suggestion.context_before && (
                    <p>
                      <span className="text-gray-500">Before:</span> "{suggestion.context_before}"
                    </p>
                  )}
                  {suggestion.context_after && (
                    <p>
                      <span className="text-gray-500">After:</span> "{suggestion.context_after}"
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              {statusFilter === 'pending' && (
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resolveMutation.mutate({
                        suggestionId: suggestion.id,
                        action: 'reject',
                      })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      resolveMutation.mutate({
                        suggestionId: suggestion.id,
                        action: 'accept',
                      });
                      onApply?.(suggestion);
                    }}
                    disabled={resolveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Accept
                  </Button>
                </div>
              )}

              {/* Status badges */}
              {suggestion.is_accepted && (
                <Badge className="bg-green-500 text-white w-fit">✓ Accepted</Badge>
              )}
              {suggestion.is_rejected && (
                <Badge className="bg-red-500 text-white w-fit">✕ Rejected</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/**
 * Inline suggestion marker in editor
 */
interface InlineSuggestionMarkerProps {
  suggestion: Suggestion;
  onClick?: () => void;
}

export const InlineSuggestionMarker: React.FC<InlineSuggestionMarkerProps> = ({
  suggestion,
  onClick,
}) => {
  const colors = {
    edit: 'bg-yellow-100 text-yellow-800',
    insert: 'bg-green-100 text-green-800',
    delete: 'bg-red-100 text-red-800',
  };

  return (
    <span
      onClick={onClick}
      className={`inline-block px-1 rounded text-xs font-bold cursor-pointer opacity-70 hover:opacity-100 transition ${
        colors[suggestion.change_type]
      }`}
      title={`${suggestion.author_name}: ${suggestion.reason || suggestion.change_type}`}
    >
      ✎
    </span>
  );
};

/**
 * Suggestion panel for sidebar
 */
interface SuggestionPanelProps {
  chapterId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({
  chapterId,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-lg flex flex-col z-40">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Suggestions (Track Changes)</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <SuggestionList chapterId={chapterId} />
      </div>
    </div>
  );
};

export default SuggestionList;
