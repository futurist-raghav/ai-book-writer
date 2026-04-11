'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

interface RatingStats {
  average_rating: number;
  total_ratings: number;
  distribution: {
    [key: number]: number; // 1-5: count
  };
}

interface RatingsProps {
  shareUrl: string;
  allowRatings: boolean;
}

export function RatingsSection({ shareUrl, allowRatings }: RatingsProps) {
  const [userRating, setUserRating] = React.useState<number>(0);
  const [hoverRating, setHoverRating] = React.useState<number>(0);

  // Fetch ratings
  const { data: ratingStats, refetch } = useQuery({
    queryKey: ['ratings', shareUrl],
    queryFn: async () => {
      const response = await apiClient.get(`/share/${shareUrl}/ratings`);
      return response.data as RatingStats;
    },
    enabled: allowRatings,
  });

  // Submit rating mutation
  const submitRatingMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (rating === 0) return;
      const response = await apiClient.post(`/share/${shareUrl}/ratings`, {
        rating,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Thank you for rating!');
      refetch();
    },
    onError: () => {
      toast.error('Failed to submit rating');
    },
  });

  if (!allowRatings) {
    return null;
  }

  const stats = ratingStats || { average_rating: 0, total_ratings: 0, distribution: {} };
  const avgRating = stats.average_rating || 0;
  const totalRatings = stats.total_ratings || 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Rate This Book</h3>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Rating Input */}
        <div>
          <p className="text-sm text-gray-600 mb-4">How would you rate this book?</p>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => submitRatingMutation.mutate(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                disabled={submitRatingMutation.isPending}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoverRating || userRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          {userRating > 0 && (
            <p className="text-sm text-gray-600">
              You rated: <span className="font-medium">{userRating} star{userRating !== 1 ? 's' : ''}</span>
            </p>
          )}
        </div>

        {/* Rating Stats */}
        <div>
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{avgRating.toFixed(1)}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(avgRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Based on {totalRatings} rating{totalRatings !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Distribution */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution?.[star] || 0;
              const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 w-12">
                    {star} star
                  </span>
                  <div className="flex-grow bg-gray-100 rounded-full h-2">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
