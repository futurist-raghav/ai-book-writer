/**
 * Chapter Version Diff Viewer
 * Displays unified diff between two versions with syntax highlighting
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

interface ChapterVersionDiffViewerProps {
  chapterId: string;
  fromVersionId: string;
  toVersionId: string;
}

interface DiffResponse {
  from_version_id: string;
  to_version_id: string;
  title_changed: boolean;
  summary_changed: boolean;
  content_diff: string;
  word_count_before?: number;
  word_count_after?: number;
  word_count_change: number;
}

export function ChapterVersionDiffViewer({
  chapterId,
  fromVersionId,
  toVersionId,
}: ChapterVersionDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'stats'>('unified');

  const { data, isLoading, error } = useQuery({
    queryKey: ['chapter-version-diff', chapterId, fromVersionId, toVersionId],
    queryFn: async () => {
      const response = await apiClient.chapters.versions.diff(
        chapterId,
        fromVersionId,
        toVersionId
      );
      return response.data as DiffResponse;
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Spinner className="w-6 h-6 text-primary mb-2" />
        <p className="text-xs text-on-surface-variant">Loading diff...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-error">Failed to load diff</p>
      </div>
    );
  }

  if (!data) return null;

  const diffLines = data.content_diff.split('\n').filter((line) => line.length > 0);
  const addedLines = diffLines.filter((line) => line.startsWith('+')).length;
  const removedLines = diffLines.filter((line) => line.startsWith('-')).length;

  return (
    <div className="space-y-4">
      {/* Header with Stats & View Toggle */}
      <div className="flex items-center justify-between bg-surface-container-high rounded-lg p-4">
        <div className="space-y-2">
          <h3 className="font-label text-sm font-bold text-primary">Version Changes</h3>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-on-surface-variant">Word count: </span>
              <span className="font-semibold text-on-surface">
                {data.word_count_before || 0} → {data.word_count_after || 0}
              </span>
            </div>
            {data.word_count_change > 0 && (
              <span className="text-secondary font-semibold">+{data.word_count_change} words</span>
            )}
            {data.word_count_change < 0 && (
              <span className="text-error font-semibold">{data.word_count_change} words</span>
            )}
            {data.word_count_change === 0 && (
              <span className="text-on-surface-variant">No change</span>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
              viewMode === 'unified'
                ? 'bg-primary text-white'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Diff
          </button>
          <button
            onClick={() => setViewMode('stats')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
              viewMode === 'stats'
                ? 'bg-primary text-white'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Stats
          </button>
        </div>
      </div>

      {/* Stats View */}
      {viewMode === 'stats' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container-high rounded-lg p-4">
            <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest mb-2">
              Added
            </p>
            <p className="text-2xl font-bold text-secondary">{addedLines}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              New lines added to content
            </p>
          </div>

          <div className="bg-surface-container-high rounded-lg p-4">
            <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest mb-2">
              Removed
            </p>
            <p className="text-2xl font-bold text-error">{removedLines}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              Lines removed from content
            </p>
          </div>

          <div className="bg-surface-container-high rounded-lg p-4">
            <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest mb-2">
              Changed
            </p>
            <p className="text-2xl font-bold text-tertiary">
              {data.title_changed || data.summary_changed ? 1 : 0}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {data.title_changed && 'Title changed. '}
              {data.summary_changed && 'Summary changed.'}
              {!data.title_changed && !data.summary_changed && 'No metadata changes.'}
            </p>
          </div>
        </div>
      )}

      {/* Unified Diff View */}
      {viewMode === 'unified' && (
        <div className="bg-surface-container-low rounded-lg border border-outline-variant/10 overflow-hidden">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="p-4 font-mono text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">
              {diffLines.map((line, idx) => {
                const isAddition = line.startsWith('+') && !line.startsWith('+++');
                const isRemoval = line.startsWith('-') && !line.startsWith('---');
                const isHeader = line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---');

                return (
                  <div
                    key={idx}
                    className={`${
                      isAddition
                        ? 'bg-secondary/20 text-secondary'
                        : isRemoval
                          ? 'bg-error/20 text-error'
                          : isHeader
                            ? 'bg-surface-container-highest text-on-surface-variant font-semibold'
                            : 'text-on-surface-variant'
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      )}

      {/* Empty State */}
      {diffLines.length === 0 && (
        <div className="p-8 text-center bg-surface-container-high rounded-lg">
          <p className="text-sm text-on-surface-variant italic">No differences found between versions.</p>
        </div>
      )}
    </div>
  );
}
