'use client';

import React, { useState } from 'react';
import { useBookStore } from '@/stores/book-store';
import { useFullAnalytics, useWritingVelocity, useProductivityMetrics, usePacingAnalysis } from '@/hooks/useAnalytics';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { TrendingUp, Zap, Calendar, Target, BarChart3 } from 'lucide-react';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { VelocityLineChart, ChapterDistributionPie, ChapterComparisonBar } from '@/components/analytics-charts';

export default function AnalyticsPage() {
  const selectedBook = useBookStore((state) => state.selectedBook);
  const selectedBookId = selectedBook?.id || null;
  const [days, setDays] = useState(30);

  const { data: fullAnalytics, isLoading, isError, error, refetch } = useFullAnalytics(selectedBookId, days);
  const { data: velocity } = useWritingVelocity(selectedBookId, days);
  const { data: productivity } = useProductivityMetrics(selectedBookId, days);
  const { data: pacing } = usePacingAnalysis(selectedBookId);

  if (!selectedBookId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">Please select a book first</p>
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => refetch()}
        title="Failed to load analytics"
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-gray-600 dark:text-gray-400">Analytics</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Writing Analytics & Insights
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Track your writing progress, productivity, and pacing.
            </p>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            {[7, 14, 30, 90].map((d) => (
              <Button
                key={d}
                variant={days === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDays(d)}
                disabled={isLoading}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl space-y-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
              ))}
            </div>
          ) : (
            <>
              {/* Metrics Grid */}
              <div className="grid gap-4 md:grid-cols-4">
                {/* Writing Velocity */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Words/Day</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {velocity?.avg_words_per_day.toLocaleString() || 0}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    {velocity?.total_words.toLocaleString() || 0} words in {days} days
                  </p>
                </div>

                {/* Productivity */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Days Written</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {productivity?.days_written || 0}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    {productivity?.consistency_score || 0}% consistent
                  </p>
                </div>

                {/* Sessions Per Week */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sessions/Week</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {productivity?.sessions_per_week.toFixed(1) || 0}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-yellow-600" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Keep the momentum going!
                  </p>
                </div>

                {/* Progress */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Progress</p>
                      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {pacing?.progress_percent.toFixed(1) || 0}%
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-purple-600" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    {pacing?.words_remaining.toLocaleString() || 0} words left
                  </p>
                </div>
              </div>

              {/* Pacing Section */}
              {pacing && pacing.word_count_goal > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Pacing</h2>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {pacing.current_word_count.toLocaleString()} / {pacing.word_count_goal.toLocaleString()} words
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {pacing.progress_percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                        style={{ width: `${Math.min(100, pacing.progress_percent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Estimated Completion */}
                  {pacing.estimated_completion_date && (
                    <div className="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
                      <p className="text-sm text-blue-900 dark:text-blue-200">
                        <strong>Estimated Completion:</strong>{' '}
                        {pacing.estimated_days_to_completion ? (
                          <>
                            {pacing.estimated_days_to_completion.toFixed(0)} days from now
                            {' '}
                            ({new Date(pacing.estimated_completion_date).toLocaleDateString()})
                          </>
                        ) : (
                          'Keep writing to estimate completion date'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Charts */}
              {velocity && <VelocityLineChart data={velocity} />}

              {fullAnalytics?.chapter_breakdown && fullAnalytics.chapter_breakdown.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <ChapterDistributionPie data={fullAnalytics.chapter_breakdown} />
                  <ChapterComparisonBar data={fullAnalytics.chapter_breakdown} />
                </div>
              )}

              {/* Chapter Breakdown */}
              {fullAnalytics?.chapter_breakdown && fullAnalytics.chapter_breakdown.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chapter Breakdown</h2>

                  <div className="mt-4 space-y-2">
                    {fullAnalytics.chapter_breakdown.map((chapter) => (
                      <div key={chapter.chapter_id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Chapter {chapter.chapter_number}: {chapter.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {chapter.type} • {chapter.status}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {chapter.word_count.toLocaleString()} words
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
