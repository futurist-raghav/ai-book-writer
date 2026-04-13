/**
 * React Query hooks for public sharing and feedback
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { PublicShare, BookFeedback, BookRating, PublicShareDetail } from '@/types/public-share';
import { toast } from 'sonner';

const PUBLIC_SHARE_QUERY_KEYS = {
  all: ['public-share'] as const,
  shares: () => [...PUBLIC_SHARE_QUERY_KEYS.all, 'shares'] as const,
  share: (bookId: string) => [...PUBLIC_SHARE_QUERY_KEYS.shares(), bookId] as const,
  feedback: (token: string) => [...PUBLIC_SHARE_QUERY_KEYS.all, 'feedback', token] as const,
  ratings: (token: string) => [...PUBLIC_SHARE_QUERY_KEYS.all, 'ratings', token] as const,
};

/**
 * Create a public share link
 */
export function useCreatePublicShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookId,
      allowComments = true,
      allowRatings = true,
    }: {
      bookId: string;
      allowComments?: boolean;
      allowRatings?: boolean;
    }) => {
      const response = await api.post('/public/shares', {
        allow_comments: allowComments,
        allow_ratings: allowRatings,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: PUBLIC_SHARE_QUERY_KEYS.share(variables.bookId),
      });
      toast.success('Public share link created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create share link');
    },
  });
}

/**
 * Get public share for a book
 */
export function usePublicShare(bookId: string | null) {
  return useQuery<PublicShare>({
    queryKey: PUBLIC_SHARE_QUERY_KEYS.share(bookId || ''),
    queryFn: async () => {
      const response = await api.get(`/public/shares/${bookId}`);
      return response.data;
    },
    enabled: !!bookId,
  });
}

/**
 * Update public share settings
 */
export function useUpdatePublicShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookId,
      isActive,
      allowComments,
      allowRatings,
    }: {
      bookId: string;
      isActive: boolean;
      allowComments: boolean;
      allowRatings: boolean;
    }) => {
      const response = await api.patch(`/public/shares/${bookId}`, {
        is_active: isActive,
        allow_comments: allowComments,
        allow_ratings: allowRatings,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: PUBLIC_SHARE_QUERY_KEYS.share(variables.bookId),
      });
      toast.success('Share settings updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update share');
    },
  });
}

/**
 * Submit feedback on a public share
 */
export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      shareToken,
      feedback,
    }: {
      shareToken: string;
      feedback: {
        reader_name?: string;
        reader_email?: string;
        rating?: number;
        title?: string;
        content: string;
        feedback_type?: string;
      };
    }) => {
      const response = await api.post(`/public/shares/${shareToken}/feedback`, feedback);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: PUBLIC_SHARE_QUERY_KEYS.feedback(variables.shareToken),
      });
      toast.success('Feedback submitted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit feedback');
    },
  });
}

/**
 * Get feedback for a public share
 */
export function useFeedback(shareToken: string | null) {
  return useQuery<BookFeedback[]>({
    queryKey: PUBLIC_SHARE_QUERY_KEYS.feedback(shareToken || ''),
    queryFn: async () => {
      const response = await api.get(`/public/shares/${shareToken}/feedback`);
      return response.data;
    },
    enabled: !!shareToken,
  });
}

/**
 * Get ratings for a public share
 */
export function usePublicRatings(shareToken: string | null) {
  return useQuery<BookRating>({
    queryKey: PUBLIC_SHARE_QUERY_KEYS.ratings(shareToken || ''),
    queryFn: async () => {
      const response = await api.get(`/public/shares/${shareToken}/ratings`);
      return response.data;
    },
    enabled: !!shareToken,
  });
}
