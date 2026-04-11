/**
 * React Query hooks for analytics data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  VelocityData,
  ProductivityData,
  PacingData,
  ChapterBreakdownItem,
  FullAnalyticsResponse,
} from '@/types/analytics';

const ANALYTICS_QUERY_KEYS = {
  all: ['analytics'] as const,
  byBook: (bookId: string) => [...ANALYTICS_QUERY_KEYS.all, bookId] as const,
  velocity: (bookId: string) => [...ANALYTICS_QUERY_KEYS.byBook(bookId), 'velocity'] as const,
  productivity: (bookId: string) => [...ANALYTICS_QUERY_KEYS.byBook(bookId), 'productivity'] as const,
  pacing: (bookId: string) => [...ANALYTICS_QUERY_KEYS.byBook(bookId), 'pacing'] as const,
  chapterBreakdown: (bookId: string) => [...ANALYTICS_QUERY_KEYS.byBook(bookId), 'breakdown'] as const,
  full: (bookId: string) => [...ANALYTICS_QUERY_KEYS.byBook(bookId), 'full'] as const,
};

/**
 * Get writing velocity (words per day) for a book
 */
export function useWritingVelocity(bookId: string | null, days: number = 30) {
  return useQuery<VelocityData>({
    queryKey: ANALYTICS_QUERY_KEYS.velocity(bookId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/books/${bookId}/velocity?days=${days}`);
      return res.data;
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get productivity metrics (days written, sessions/week, consistency)
 */
export function useProductivityMetrics(bookId: string | null, days: number = 30) {
  return useQuery<ProductivityData>({
    queryKey: ANALYTICS_QUERY_KEYS.productivity(bookId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/books/${bookId}/productivity?days=${days}`);
      return res.data;
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get pacing analysis (progress, estimated completion)
 */
export function usePacingAnalysis(bookId: string | null) {
  return useQuery<PacingData>({
    queryKey: ANALYTICS_QUERY_KEYS.pacing(bookId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/books/${bookId}/pacing`);
      return res.data;
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get word count breakdown by chapter
 */
export function useChapterBreakdown(bookId: string | null) {
  return useQuery<ChapterBreakdownItem[]>({
    queryKey: ANALYTICS_QUERY_KEYS.chapterBreakdown(bookId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/books/${bookId}/chapter-breakdown`);
      return res.data;
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get comprehensive analytics dashboard
 */
export function useFullAnalytics(bookId: string | null, days: number = 30) {
  return useQuery<FullAnalyticsResponse>({
    queryKey: ANALYTICS_QUERY_KEYS.full(bookId || ''),
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/books/${bookId}/full?days=${days}`);
      return res.data;
    },
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to invalidate analytics caches (useful after chapter updates)
 */
export function useInvalidateAnalytics() {
  const queryClient = useQueryClient();
  return (bookId: string) => {
    queryClient.invalidateQueries({
      queryKey: ANALYTICS_QUERY_KEYS.byBook(bookId),
    });
  };
}
