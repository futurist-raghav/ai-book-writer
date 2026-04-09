/**
 * Reading Metrics Display
 * Shows reading time and reading level badges for projects
 */

'use client';

import { calculateReadingTime, calculateReadingLevel } from '@/lib/writing-metrics';

interface ReadingMetricsProps {
  wordCount: number;
  readingLevel?: 'elementary' | 'middle_school' | 'high_school' | 'college' | 'professional';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ReadingMetrics({ wordCount, readingLevel = 'high_school', size = 'md', showLabel = true }: ReadingMetricsProps) {
  if (!wordCount || wordCount < 100) {
    return null;
  }

  const readingTime = calculateReadingTime(wordCount);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs gap-1';
      case 'lg':
        return 'px-3 py-2 text-sm gap-2';
      case 'md':
      default:
        return 'px-2.5 py-1.5 text-xs gap-1.5';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-base';
      case 'md':
      default:
        return 'text-sm';
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-2">
      {/* Reading Time */}
      <div
        className={`inline-flex items-center gap-1 rounded-full bg-primary-container text-on-primary-container font-label font-semibold ${getSizeClasses()}`}
      >
        <span className={`material-symbols-outlined ${getIconSize()}`}>schedule</span>
        {showLabel ? (
          <span>{readingTime} min read</span>
        ) : (
          <span>{readingTime}'</span>
        )}
      </div>

      {/* Reading Level */}
      <div
        className={`inline-flex items-center gap-1 rounded-full bg-secondary-container text-on-secondary-container font-label font-semibold ${getSizeClasses()}`}
      >
        <span className={`material-symbols-outlined ${getIconSize()}`}>school</span>
        <span>{formatReadingLevel(readingLevel)}</span>
      </div>
    </div>
  );
}

/**
 * Inline reading metrics for project cards
 */
export function ReadingMetricsInline({ wordCount }: { wordCount: number }) {
  if (!wordCount || wordCount < 100) {
    return null;
  }

  const readingTime = calculateReadingTime(wordCount);
  const readingLevel = calculateReadingLevel(wordCount);

  return (
    <div className="flex items-center gap-3 text-xs text-on-surface-variant">
      <div className="flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">schedule</span>
        <span>{readingTime} min</span>
      </div>
      <span className="text-outline-variant">•</span>
      <div className="flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">school</span>
        <span>{formatReadingLevel(readingLevel)}</span>
      </div>
    </div>
  );
}

/**
 * Reading level badge - compact version
 */
export function ReadingLevelBadge({ wordCount }: { wordCount: number }) {
  if (!wordCount || wordCount < 100) {
    return null;
  }

  const readingLevel = calculateReadingLevel(wordCount);

  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'elementary':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100';
      case 'middle_school':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100';
      case 'high_school':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100';
      case 'college':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-100';
      case 'professional':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-label text-xs font-semibold ${getBadgeColor(
        readingLevel
      )}`}
    >
      <span className="material-symbols-outlined text-sm">school</span>
      {formatReadingLevel(readingLevel)}
    </span>
  );
}

/**
 * Format reading level for display
 */
function formatReadingLevel(level: string): string {
  const levelMap: Record<string, string> = {
    elementary: 'Elementary',
    middle_school: 'Middle School',
    high_school: 'High School',
    college: 'College',
    professional: 'Professional',
  };
  return levelMap[level] || 'Unknown';
}
