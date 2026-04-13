'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface CitationSuggestion {
  position: number;
  context: string;
  suggestion_text: string;
  reason: string;
  suggested_field: string;
  confidence: number;
}

interface CitationSuggestionsResponse {
  suggestions: CitationSuggestion[];
  total_suggestions: number;
  message: string;
}

interface CitationSuggestionsModalProps {
  chapterId: string;
  onApply?: (suggestions: CitationSuggestion[]) => void;
  onCancel?: () => void;
}

export function CitationSuggestionsModal({
  chapterId,
  onApply,
  onCancel,
}: CitationSuggestionsModalProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/chapters/${chapterId}/suggest-citations`);
      return response.data as CitationSuggestionsResponse;
    },
    onError: () => {
      toast.error('Could not generate citation suggestions');
    },
  });

  const data = suggestMutation.data;
  const isLoading = suggestMutation.isPending;
  const hasError = suggestMutation.isError;

  const triggerAnalysis = () => {
    suggestMutation.mutate();
  };

  const handleSelectAll = () => {
    if (data?.suggestions) {
      setSelectedSuggestions(new Set(data.suggestions.map((_, i) => i)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedSuggestions(new Set());
  };

  const handleToggleSuggestion = (index: number) => {
    const newSet = new Set(selectedSuggestions);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedSuggestions(newSet);
  };

  const handleApply = () => {
    if (data?.suggestions) {
      const selected = data.suggestions.filter((_, i) => selectedSuggestions.has(i));
      onApply?.(selected);
      toast.success(`${selected.length} citation suggestion(s) ready for review`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-4 text-primary">Citation Suggestions</h2>

        {!data ? (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant mb-4">
              Analyzing chapter for places where citations would strengthen your writing...
            </p>
            <button
              onClick={triggerAnalysis}
              disabled={isLoading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? 'Analyzing...' : 'Start Analysis'}
            </button>
          </div>
        ) : hasError ? (
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to analyze for citations</p>
            <button
              onClick={triggerAnalysis}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        ) : data.suggestions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-on-surface-variant mb-4">{data.message}</p>
            <button
              onClick={onCancel}
              className="rounded-lg bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">{data.message}</p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSelectAll}
                className="rounded-md border border-outline-variant/30 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container-low"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="rounded-md border border-outline-variant/30 bg-white px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
              >
                Clear
              </button>
              <span className="ml-auto text-xs text-on-surface-variant pt-2">
                {selectedSuggestions.size} of {data.suggestions.length} selected
              </span>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto border border-outline-variant/10 rounded-lg p-3">
              {data.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleToggleSuggestion(index)}
                  className={`p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                    selectedSuggestions.has(index)
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.has(index)}
                      onChange={() => handleToggleSuggestion(index)}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-semibold text-sm text-primary">
                          "{suggestion.suggestion_text}"
                        </p>
                        <span className="text-[10px] font-bold text-secondary ml-2 whitespace-nowrap">
                          {Math.round(suggestion.confidence * 100)}% sure
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mb-2">
                        {suggestion.context}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <div className="bg-surface-container rounded px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                          {suggestion.reason}
                        </div>
                        <div className="bg-surface-container rounded px-2 py-0.5 text-[11px] text-secondary">
                          {suggestion.suggested_field}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={onCancel}
                className="rounded-lg border border-outline-variant/30 bg-white px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={selectedSuggestions.size === 0}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                Review Selected ({selectedSuggestions.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
