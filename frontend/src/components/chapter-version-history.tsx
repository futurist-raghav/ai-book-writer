/**
 * Chapter Version History Sidebar
 * Displays list of chapter versions with timestamps, names, and actions
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

interface ChapterVersionHistorySidebarProps {
  chapterId: string;
  onVersionSelect?: (versionId: string) => void;
  onRevert?: (versionId: string) => void;
}

interface ChapterVersion {
  id: string;
  title?: string;
  word_count?: number;
  version_name?: string;
  change_description?: string;
  is_auto_snapshot: boolean;
  created_at: string;
}

interface PaginatedResponse {
  items: ChapterVersion[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function ChapterVersionHistorySidebar({
  chapterId,
  onVersionSelect,
  onRevert,
}: ChapterVersionHistorySidebarProps) {
  const [page, setPage] = useState(1);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['chapter-versions', chapterId, page],
    queryFn: async () => {
      const response = await apiClient.chapters.versions.list(chapterId, {
        page,
        page_size: 20,
      });
      return response.data as PaginatedResponse;
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => apiClient.chapters.versions.delete(chapterId, versionId),
    onSuccess: () => {
      toast.success('Version deleted');
      queryClient.invalidateQueries({ queryKey: ['chapter-versions', chapterId] });
    },
    onError: () => {
      toast.error('Failed to delete version');
    },
  });

  const revertMutation = useMutation({
    mutationFn: (versionId: string) => apiClient.chapters.versions.revertTo(chapterId, versionId),
    onSuccess: () => {
      toast.success('Chapter reverted to this version');
      setSelectedVersionId(null);
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-versions', chapterId] });
      onRevert?.(selectedVersionId || '');
    },
    onError: () => {
      toast.error('Failed to revert chapter');
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Spinner className="w-6 h-6 text-primary mb-2" />
        <p className="text-xs text-on-surface-variant">Loading versions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-error">Failed to load versions</p>
      </div>
    );
  }

  const versions = data?.items || [];
  const totalPages = data?.total_pages || 1;

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest rounded-xl border border-outline-variant/10">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant/10">
        <h3 className="font-label text-xs font-bold uppercase tracking-widest text-primary mb-1">
          Version History
        </h3>
        <p className="text-[10px] text-on-surface-variant">
          {data?.total || 0} versions saved
        </p>
      </div>

      {/* Version List */}
      {versions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-on-surface-variant text-center">
            No versions yet. Save your chapter to create the first snapshot.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-4">
            {versions.map((version) => {
              const isSelected = selectedVersionId === version.id;
              const isExpanded = expandedVersionId === version.id;

              return (
                <div
                  key={version.id}
                  className={`rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-secondary bg-secondary/10'
                      : 'border-outline-variant/20 bg-surface-container-high hover:bg-surface-container-high/80'
                  }`}
                >
                  {/* Version Item Header */}
                  <button
                    onClick={() => {
                      setSelectedVersionId(version.id);
                      onVersionSelect?.(version.id);
                      setExpandedVersionId(isExpanded ? null : version.id);
                    }}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-label text-xs font-semibold text-on-surface truncate">
                          {version.version_name || formatDate(version.created_at)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant mt-1">
                          {version.word_count} words
                          {version.is_auto_snapshot ? ' • Auto' : ' • Manual'}
                        </p>
                      </div>
                      <span
                        className="material-symbols-outlined text-lg text-on-surface-variant transition-transform flex-shrink-0"
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        expand_more
                      </span>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-outline-variant/10 px-3 py-3 space-y-3 bg-surface-container-low/50">
                      {version.change_description && (
                        <div>
                          <p className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                            Changes
                          </p>
                          <p className="text-xs text-on-surface-variant italic">
                            {version.change_description}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                          Created
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => revertMutation.mutate(version.id)}
                          disabled={revertMutation.isPending}
                          className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold bg-secondary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {revertMutation.isPending && <Spinner className="inline w-2 h-2 mr-1" />}
                          Revert
                        </button>

                        <button
                          onClick={() => deleteVersionMutation.mutate(version.id)}
                          disabled={deleteVersionMutation.isPending}
                          className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold bg-error/20 text-error hover:bg-error/30 disabled:opacity-50 transition-colors"
                        >
                          {deleteVersionMutation.isPending && <Spinner className="inline w-2 h-2 mr-1" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-outline-variant/10 p-3 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 text-xs rounded hover:bg-surface-container-high disabled:opacity-50"
          >
            ← Prev
          </button>
          <span className="text-xs text-on-surface-variant">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 text-xs rounded hover:bg-surface-container-high disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
