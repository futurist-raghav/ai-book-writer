'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  PublicComment,
  PublicRating,
  RatingsStats,
  CreateCommentRequest,
  CreateRatingRequest,
} from '@/types/public-comments';

// ============================================================================
// Comment Queries
// ============================================================================

export const usePublicComments = (shareToken: string | null) => {
  return useQuery({
    queryKey: ['public-comments', shareToken],
    queryFn: async () => {
      if (!shareToken) return [];
      const response = await api.get<PublicComment[]>(`/public/shares/${shareToken}/comments`);
      return response.data;
    },
    enabled: !!shareToken,
  });
};

// ============================================================================
// Comment Mutations
// ============================================================================

export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shareToken,
      data,
    }: {
      shareToken: string;
      data: CreateCommentRequest;
    }) => {
      const response = await api.post<PublicComment>(`/public/shares/${shareToken}/comments`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['public-comments', variables.shareToken],
      });
    },
  });
};

// ============================================================================
// Rating Queries
// ============================================================================

export const usePublicRatings = (shareToken: string | null) => {
  return useQuery({
    queryKey: ['public-ratings', shareToken],
    queryFn: async () => {
      if (!shareToken) return [];
      const response = await api.get<PublicRating[]>(`/public/shares/${shareToken}/ratings`);
      return response.data;
    },
    enabled: !!shareToken,
  });
};

export const useRatingsStats = (shareToken: string | null) => {
  return useQuery({
    queryKey: ['ratings-stats', shareToken],
    queryFn: async () => {
      if (!shareToken) return null;
      const response = await api.get<RatingsStats>(`/public/shares/${shareToken}/ratings/stats`);
      return response.data;
    },
    enabled: !!shareToken,
  });
};

// ============================================================================
// Rating Mutations
// ============================================================================

export const useCreateRating = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shareToken,
      data,
    }: {
      shareToken: string;
      data: CreateRatingRequest;
    }) => {
      const response = await api.post<PublicRating>(`/public/shares/${shareToken}/ratings`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['public-ratings', variables.shareToken],
      });
      queryClient.invalidateQueries({
        queryKey: ['ratings-stats', variables.shareToken],
      });
    },
  });
};
