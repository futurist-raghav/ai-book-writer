'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Suggestion {
  id: string;
  author: { name: string; avatar?: string };
  suggestion_type: string;
  text_before: string;
  text_after: string;
  reason?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  position: number;
  length: number;
}

interface SuggestionPanelProps {
  chapterId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SuggestionStatusBadge = ({ status }: { status: string }) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status as keyof typeof colors] || ''}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const SuggestionCard = ({
  suggestion,
  onAccept,
  onReject,
  isLoading,
}: {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
  isLoading: boolean;
}) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-3 mb-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              {suggestion.author?.name || 'Unknown'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
            </span>
          </div>
          <span className="inline-block text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded mb-2">
            {suggestion.suggestion_type}
          </span>
        </div>
        <SuggestionStatusBadge status={suggestion.status} />
      </div>

      {/* Diff Display */}
      <div className="text-sm space-y-1 mb-2 font-mono text-xs">
        <div className="flex gap-2">
          <span className="text-gray-500 dark:text-gray-400">Before:</span>
          <span className="bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 px-2 py-1 rounded line-through">
            {suggestion.text_before || '(empty)'}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 dark:text-gray-400">After:</span>
          <span className="bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 px-2 py-1 rounded">
            {suggestion.text_after || '(empty)'}
          </span>
        </div>
      </div>

      {suggestion.reason && (
        <p className="text-xs text-gray-600 dark:text-gray-400 italic mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          "{suggestion.reason}"
        </p>
      )}

      {/* Action Buttons */}
      {suggestion.status === 'pending' && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={onAccept}
            disabled={isLoading}
            className="flex-1 text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="flex-1 text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
};

export function SuggestionPanel({ chapterId, isOpen, onClose }: SuggestionPanelProps) {
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // Fetch suggestions
  const { data: suggestionsData, isLoading } = useQuery({
    queryKey: ['suggestions', chapterId, filterStatus],
    queryFn: async () => {
      const response = await apiClient.chapters.suggestions.list(chapterId, {
        status: filterStatus,
      });
      return (response.data as any).items || [];
    },
    enabled: isOpen,
  });

  // Accept suggestion mutation
  const acceptMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      apiClient.chapters.suggestions.accept(chapterId, suggestionId),
    onSuccess: () => {
      toast.success('Suggestion accepted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to accept suggestion');
    },
  });

  // Reject suggestion mutation
  const rejectMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      apiClient.chapters.suggestions.reject(chapterId, suggestionId),
    onSuccess: () => {
      toast.success('Suggestion rejected');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject suggestion');
    },
  });

  // Batch accept
  const batchAcceptMutation = useMutation({
    mutationFn: () =>
      apiClient.chapters.suggestions.batchAccept(
        chapterId,
        Array.from(selectedSuggestions)
      ),
    onSuccess: () => {
      toast.success(`Accepted ${selectedSuggestions.size} suggestions`);
      setSelectedSuggestions(new Set());
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to accept suggestions');
    },
  });

  // Batch reject
  const batchRejectMutation = useMutation({
    mutationFn: () =>
      apiClient.chapters.suggestions.batchReject(
        chapterId,
        Array.from(selectedSuggestions)
      ),
    onSuccess: () => {
      toast.success(`Rejected ${selectedSuggestions.size} suggestions`);
      setSelectedSuggestions(new Set());
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject suggestions');
    },
  });

  const suggestions = (suggestionsData || []) as Suggestion[];
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const toggleSelectAll = () => {
    if (selectedSuggestions.size === pendingSuggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(
        new Set(pendingSuggestions.map((s) => s.id))
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Suggestions ({suggestions.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 flex">
          {['pending', 'accepted', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition ${
                filterStatus === status
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              No {filterStatus} suggestions
            </p>
          ) : (
            <div>
              {/* Batch Controls for Pending */}
              {filterStatus === 'pending' && pendingSuggestions.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.size === pendingSuggestions.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedSuggestions.size} selected
                    </span>
                  </div>
                  {selectedSuggestions.size > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => batchAcceptMutation.mutate()}
                        disabled={batchAcceptMutation.isPending}
                        className="text-xs px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition disabled:opacity-50"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={() => batchRejectMutation.mutate()}
                        disabled={batchRejectMutation.isPending}
                        className="text-xs px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition disabled:opacity-50"
                      >
                        Reject All
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Suggestions List */}
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex gap-2 items-start">
                  {filterStatus === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.has(suggestion.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedSuggestions);
                        if (e.target.checked) {
                          newSet.add(suggestion.id);
                        } else {
                          newSet.delete(suggestion.id);
                        }
                        setSelectedSuggestions(newSet);
                      }}
                      className="w-4 h-4 mt-2"
                    />
                  )}
                  <div className="flex-1">
                    <SuggestionCard
                      suggestion={suggestion}
                      onAccept={() => acceptMutation.mutate(suggestion.id)}
                      onReject={() => rejectMutation.mutate(suggestion.id)}
                      isLoading={acceptMutation.isPending || rejectMutation.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
