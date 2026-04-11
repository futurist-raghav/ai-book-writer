'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface TextRewriteOption {
  type: string;
  original: string;
  rewritten: string;
  confidence: number;
  unified_diff: string;
  word_count_change: number;
  tone_shift: string;
}

interface TextRewriteResponse {
  options: TextRewriteOption[];
  original_word_count: number;
  message: string;
}

interface RewriteWithDiffProps {
  chapterId: string;
  selectedText: string;
  onApply: (rewrittenText: string) => void;
  onCancel: () => void;
}

export function RewriteWithDiff({
  chapterId,
  selectedText,
  onApply,
  onCancel,
}: RewriteWithDiffProps) {
  const [rewriteType, setRewriteType] = useState<string>('improve');
  const [tone, setTone] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/chapters/${chapterId}/rewrite`, {
        text: selectedText,
        rewrite_type: rewriteType,
        tone: tone || undefined,
      });
      return response.data as TextRewriteResponse;
    },
    onError: () => {
      alert('Could not generate rewrites. Try again.');
    },
  });

  const data = rewriteMutation.data;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-4 text-primary">Rewrite Text</h2>

        {!data ? (
          <div className="space-y-4">
            {/* Original Text Preview */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Original Text
              </label>
              <div className="bg-surface-container-lowest rounded-lg p-3 text-sm max-h-32 overflow-y-auto border border-outline-variant/30">
                {selectedText}
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {selectedText.split(/\s+/).length} words
              </p>
            </div>

            {/* Rewrite Options */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'improve', label: 'Improve' },
                { value: 'formal', label: 'Formal' },
                { value: 'casual', label: 'Casual' },
                { value: 'shorter', label: 'Shorter' },
                { value: 'expand', label: 'Expand' },
                { value: 'show-dont-tell', label: 'Show, Don\'t Tell' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRewriteType(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rewriteType === opt.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Tone Override */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                Tone (optional)
              </label>
              <input
                type="text"
                placeholder="e.g., witty, serious, reflective"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={() => rewriteMutation.mutate()}
              disabled={rewriteMutation.isPending}
              className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {rewriteMutation.isPending ? 'Generating...' : 'Generate Rewrites'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-medium text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Display Rewrite Options */
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">{data.message}</p>

            {/* Tab Navigation */}
            <div className="flex gap-1 overflow-x-auto border-b border-outline-variant/30">
              {data.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOption(idx)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    selectedOption === idx
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {opt.type !== 'improve' ? opt.type.split('-').join(' ') : 'Improve'} ({Math.abs(opt.word_count_change)})
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {selectedOption !== null && data.options[selectedOption] && (
              <div className="space-y-3">
                {(() => {
                  const option = data.options[selectedOption];
                  return (
                    <>
                      {/* Diff Display */}
                      <div className="bg-surface-container-lowest rounded-lg p-3 border border-outline-variant/30 max-h-48 overflow-y-auto font-mono text-xs">
                        <pre className="whitespace-pre-wrap break-words text-on-surface">
                          {option.unified_diff || '(No diff available)'}
                        </pre>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-secondary/10 p-2">
                          <p className="text-on-surface-variant">Confidence</p>
                          <p className="font-semibold text-secondary">{(option.confidence * 100).toFixed(0)}%</p>
                        </div>
                        <div className="rounded bg-tertiary/10 p-2">
                          <p className="text-on-surface-variant">Word Count Change</p>
                          <p className={`font-semibold ${option.word_count_change > 0 ? 'text-tertiary' : 'text-secondary'}`}>
                            {option.word_count_change > 0 ? '+' : ''}{option.word_count_change}
                          </p>
                        </div>
                        <div className="rounded bg-primary/10 p-2">
                          <p className="text-on-surface-variant">Tone</p>
                          <p className="font-semibold text-primary text-[10px]">{option.tone_shift}</p>
                        </div>
                      </div>

                      {/* Full Rewritten Text Preview */}
                      <div>
                        <label className="block text-xs font-medium text-on-surface-variant mb-1">
                          Full Rewritten Text
                        </label>
                        <div className="bg-primary/5 rounded-lg p-3 text-sm max-h-32 overflow-y-auto border border-primary/20">
                          {option.rewritten}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApply(option.rewritten)}
                          className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90"
                        >
                          Apply This Version
                        </button>
                        <button
                          onClick={onCancel}
                          className="flex-1 rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-semibold text-on-surface hover:bg-surface-container"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
