'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface GlossaryExtractionProps {
  bookId: string;
  onComplete?: () => void;
}

interface ExtractionCandidate {
  term: string;
  frequency: number;
  confidence: number;
  part_of_speech?: string;
  sample_context?: string;
  chapter_mentions?: Record<string, number>;
  from_chapters?: string[];
}

interface ExtractionResponse {
  candidates: ExtractionCandidate[];
  analyzed_chapters: number;
  total_terms_found: number;
  extraction_time_ms: number;
  note: string;
}

export function GlossaryExtractor({ bookId, onComplete }: GlossaryExtractionProps) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65);
  const [maxTerms, setMaxTerms] = useState(100);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'confidence' | 'frequency'>('confidence');
  const [extractionData, setExtractionData] = useState<ExtractionResponse | null>(null);
  const queryClient = useQueryClient();

  // Extract glossary candidates
  const extractMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/books/${bookId}/glossary/extract`, {
        confidence_threshold: confidenceThreshold,
        max_terms: maxTerms,
      });
      return response.data as ExtractionResponse;
    },
    onSuccess: (data) => {
      setExtractionData(data);
    },
    onError: () => {
      alert('Could not extract glossary terms');
    },
  });

  // Confirm extraction
  const confirmMutation = useMutation({
    mutationFn: async () => {
      const termsArray = Array.from(selectedTerms);
      await api.post(`/books/${bookId}/glossary/confirm-extraction`, {
        terms: termsArray,
      });
      return termsArray.length;
    },
    onSuccess: (count) => {
      alert(`Added ${count} terms to glossary`);
      setSelectedTerms(new Set());
      setExtractionData(null);
      queryClient.invalidateQueries({ queryKey: ['glossary', bookId] });
      if (onComplete) {
        onComplete();
      }
    },
    onError: () => {
      alert('Could not save glossary terms');
    },
  });

  const data = extractionData;
  const candidates = data?.candidates || [];

  // Sort candidates
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (sortBy === 'confidence') {
      return b.confidence - a.confidence;
    }
    return b.frequency - a.frequency;
  });

  const toggleTerm = (term: string) => {
    const newSelected = new Set(selectedTerms);
    if (newSelected.has(term)) {
      newSelected.delete(term);
    } else {
      newSelected.add(term);
    }
    setSelectedTerms(newSelected);
  };

  const toggleAll = () => {
    if (selectedTerms.size === sortedCandidates.length) {
      setSelectedTerms(new Set());
    } else {
      setSelectedTerms(new Set(sortedCandidates.map((c) => c.term)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary">Glossary Extraction</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Extract glossary terms from your manuscript. AI analyzes capitalization patterns, definitions,
          and term frequency.
        </p>
      </div>

      {/* Controls */}
      {!data ? (
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-on-surface">
                Confidence Threshold
              </label>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Minimum confidence to include (0.0 - 1.0)
              </p>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="mt-2 w-full"
              />
              <div className="mt-1 text-sm font-semibold text-primary">{confidenceThreshold.toFixed(2)}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface">
                Maximum Terms
              </label>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Limit results to avoid overwhelming options
              </p>
              <input
                type="number"
                min="10"
                max="500"
                value={maxTerms}
                onChange={(e) => setMaxTerms(parseInt(e.target.value, 10))}
                className="mt-2 w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending}
            className="mt-6 rounded-lg bg-primary px-6 py-2 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {extractMutation.isPending ? 'Extracting...' : 'Extract Glossary Terms'}
          </button>
        </div>
      ) : (
        <>
          {/* Results Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-secondary/10 p-4">
              <p className="text-sm font-medium text-on-surface">Terms Found</p>
              <p className="mt-1 text-2xl font-bold text-secondary">{data.total_terms_found}</p>
            </div>
            <div className="rounded-lg bg-tertiary/10 p-4">
              <p className="text-sm font-medium text-on-surface">Chapters Analyzed</p>
              <p className="mt-1 text-2xl font-bold text-tertiary">{data.analyzed_chapters}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-sm font-medium text-on-surface">Extraction Time</p>
              <p className="mt-1 text-2xl font-bold text-primary">{data.extraction_time_ms}ms</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedTerms.size === sortedCandidates.length && sortedCandidates.length > 0}
                onChange={toggleAll}
                className="rounded"
              />
              <span className="text-sm font-medium text-on-surface">
                {selectedTerms.size} of {sortedCandidates.length} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-on-surface-variant">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'confidence' | 'frequency')}
                className="rounded border border-outline bg-surface-container-lowest px-2 py-1 text-sm"
              >
                <option value="confidence">Confidence</option>
                <option value="frequency">Frequency</option>
              </select>
            </div>
          </div>

          {/* Term List */}
          <div className="space-y-2">
            {sortedCandidates.length === 0 ? (
              <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest/60 p-6 text-center text-sm text-on-surface-variant">
                No terms found matching your criteria. Try lowering the confidence threshold.
              </div>
            ) : (
              sortedCandidates.map((candidate) => (
                <div
                  key={candidate.term}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedTerms.has(candidate.term)
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-outline-variant/15 bg-surface-container-lowest/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTerms.has(candidate.term)}
                    onChange={() => toggleTerm(candidate.term)}
                    className="mt-1 h-4 w-4 flex-shrink-0 rounded"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-primary">{candidate.term}</span>
                      {candidate.part_of_speech && (
                        <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-medium text-secondary">
                          {candidate.part_of_speech}
                        </span>
                      )}
                      <span className="rounded-full bg-tertiary/20 px-2 py-0.5 text-xs font-medium text-tertiary">
                        {(candidate.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {candidate.frequency} mention{candidate.frequency === 1 ? '' : 's'}
                      </span>
                    </div>

                    {candidate.sample_context && (
                      <p className="mt-2 text-xs text-on-surface-variant line-clamp-2">
                        "{candidate.sample_context.substring(0, 120)}..."
                      </p>
                    )}

                    {candidate.chapter_mentions && Object.keys(candidate.chapter_mentions).length > 0 && (
                      <div className="mt-2 text-xs text-on-surface-variant">
                        Appears in {Object.keys(candidate.chapter_mentions).length} chapter
                        {Object.keys(candidate.chapter_mentions).length === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setExtractionData(null)}
              className="rounded-lg border border-outline bg-surface-container-lowest px-6 py-2 font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={selectedTerms.size === 0 || confirmMutation.isPending}
              className="flex-1 rounded-lg bg-primary px-6 py-2 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {confirmMutation.isPending
                ? `Adding ${selectedTerms.size} terms...`
                : `Add ${selectedTerms.size} terms to glossary`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
