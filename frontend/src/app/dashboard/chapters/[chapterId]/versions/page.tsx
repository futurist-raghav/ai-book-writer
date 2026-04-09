'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Loading } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import Link from 'next/link';
import { ChapterVersionManagementPanel } from '@/components/chapter-version-panel';

export default function ChapterVersionsPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = use(params);

  const { data: chapterData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => apiClient.chapters.get(chapterId),
  });

  if (isLoading) {
    return <Loading message="Loading chapter..." />;
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto pt-8">
        <QueryErrorState
          title="Unable to load chapter"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const chapter = chapterData?.data;

  if (!chapter) {
    return (
      <div className="max-w-4xl mx-auto pt-8">
        <div className="text-center p-8">
          <p className="text-lg text-on-surface mb-4">Chapter not found</p>
          <Link href="/dashboard/chapters" className="text-secondary hover:underline">
            Back to chapters
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Breadcrumb Navigation */}
      <div className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link href="/dashboard/chapters" className="hover:text-secondary transition-colors">
          Chapters
        </Link>
        <span className="material-symbols-outlined text-lg">chevron_right</span>
        <Link
          href={`/dashboard/chapters/${chapterId}`}
          className="hover:text-secondary transition-colors"
        >
          {chapter.title}
        </Link>
        <span className="material-symbols-outlined text-lg">chevron_right</span>
        <span className="text-secondary">Version History</span>
      </div>

      {/* Version Management Panel */}
      <ChapterVersionManagementPanel
        chapterId={chapterId}
        chapterTitle={chapter.title}
        currentWordCount={chapter.word_count}
      />
    </div>
  );
}
