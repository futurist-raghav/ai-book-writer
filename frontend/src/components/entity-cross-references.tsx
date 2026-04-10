'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

interface ChapterReference {
  chapter_id: string;
  chapter_title: string;
  chapter_number: number;
  mention_count: number;
  context_snippet?: string | null;
  extraction_metadata?: Record<string, unknown> | null;
}

interface EntityChaptersResponse {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  total_mentions: number;
  chapters: ChapterReference[];
}

interface EntityCrossReferencesProps {
  bookId: string;
  entityId: string;
  entityName: string;
  onNavigateToChapter?: (chapterId: string, chapterTitle: string) => void;
}

export function EntityCrossReferences({
  bookId,
  entityId,
  entityName,
  onNavigateToChapter,
}: EntityCrossReferencesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    data: crossReferencesResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['entity-cross-references', bookId, entityId],
    queryFn: async () => {
      const response = await apiClient.entities.getChapters(bookId, entityId);
      return response.data as EntityChaptersResponse;
    },
    enabled: !!bookId && !!entityId,
  });

  const chapters = crossReferencesResponse?.chapters || [];
  const totalMentions = crossReferencesResponse?.total_mentions || 0;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Spinner className="w-3 h-3" />
        <span>Loading references...</span>
      </div>
    );
  }

  if (isError || chapters.length === 0) {
    return (
      <div className="text-xs text-on-surface-variant">
        Not yet mentioned in any chapters
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-high transition-colors text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-secondary group-hover:text-secondary-container">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
          <span className="text-xs font-label font-bold uppercase tracking-tight text-secondary">
            Appears in {chapters.length} chapter{chapters.length === 1 ? '' : 's'} • {totalMentions} mention
            {totalMentions === 1 ? '' : 's'}
          </span>
        </div>
      </button>

      {/* Chapter List */}
      {isExpanded && (
        <div className="space-y-2 pl-2 border-l-2 border-secondary/20">
          {chapters.map((chapter) => (
            <div
              key={chapter.chapter_id}
              className="text-xs space-y-1 pb-3 border-b border-outline-variant/10 last:border-b-0 last:pb-0"
            >
              <button
                onClick={() => onNavigateToChapter?.(chapter.chapter_id, chapter.chapter_title)}
                className="flex items-start justify-between gap-2 w-full group hover:text-secondary transition-colors"
                title={`Navigate to Chapter ${chapter.chapter_number}`}
              >
                <span className="text-on-surface-variant group-hover:text-secondary font-label">
                  <span className="font-bold">Ch {chapter.chapter_number}:</span> {chapter.chapter_title}
                </span>
                <span className="badge-sm bg-secondary/10 text-secondary font-bold rounded px-1.5 py-0.5 flex-shrink-0">
                  {chapter.mention_count}x
                </span>
              </button>
              {chapter.context_snippet && (
                <p className="text-[10px] text-on-surface-variant/70 italic pl-4 line-clamp-2">
                  "{chapter.context_snippet}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
