'use client';

import React, { useState } from 'react';
import { useTemplateDetail, useTemplateReviews, useFavoriteTemplate, useUnfavoriteTemplate, useCreateTemplateReview } from '@/hooks/useMarketplace';
import { Button } from '@/components/ui/button';
import { Heart, Star, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function TemplatePage({ params }: PageProps) {
  const { id } = use(params);
  const [isFavorited, setIsFavorited] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewContent, setNewReviewContent] = useState('');
  const [reviewsSkip, setReviewsSkip] = useState(0);

  const { data: template, isLoading: isTemplateLoading } = useTemplateDetail(id);
  const { data: reviewsData, isLoading: isReviewsLoading } = useTemplateReviews(id, reviewsSkip, 10);

  const favoriteMutation = useFavoriteTemplate();
  const unfavoriteMutation = useUnfavoriteTemplate();
  const reviewMutation = useCreateTemplateReview();

  const handleFavorite = () => {
    if (isFavorited) {
      setIsFavorited(false);
      unfavoriteMutation.mutate(id);
    } else {
      setIsFavorited(true);
      favoriteMutation.mutate(id);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    reviewMutation.mutate(
      {
        templateId: id,
        rating: newReviewRating,
        title: newReviewTitle,
        content: newReviewContent,
      },
      {
        onSuccess: () => {
          setNewReviewRating(5);
          setNewReviewTitle('');
          setNewReviewContent('');
        },
      }
    );
  };

  const reviews = reviewsData?.reviews || [];
  const averageRating = reviewsData?.average_rating || 0;
  const totalReviews = reviewsData?.total_count || 0;

  if (isTemplateLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading template...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/dashboard/marketplace">
            <Button variant="outline" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Template not found</h2>
            <p className="mt-2 text-gray-600">The template you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/dashboard/marketplace">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{template.name}</h1>
              {template.is_verified && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                  ✓ Verified by moderators
                </div>
              )}
              <p className="mt-4 text-gray-600">{template.description}</p>
            </div>
            <button
              onClick={handleFavorite}
              disabled={favoriteMutation.isPending || unfavoriteMutation.isPending}
              className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <Heart
                className={`h-6 w-6 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Main Content */}
          <div className="md:col-span-2">
            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 font-semibold text-gray-900">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Content */}
            {template.sample_content && (
              <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Sample Content</h3>
                <div className="prose prose-sm max-w-none text-gray-600">
                  {template.sample_content}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <div className="mb-8">
              <h3 className="mb-6 text-2xl font-bold text-gray-900">Reviews ({totalReviews})</h3>

              {/* New Review Form */}
              <form onSubmit={handleSubmitReview} className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
                <h4 className="mb-4 font-semibold text-gray-900">Write a Review</h4>
                
                {/* Rating */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setNewReviewRating(rating)}
                        className="text-2xl transition-colors"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            rating <= newReviewRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title (optional)</label>
                  <Input
                    type="text"
                    value={newReviewTitle}
                    onChange={(e) => setNewReviewTitle(e.target.value)}
                    placeholder="Summarize your review"
                    maxLength={255}
                  />
                </div>

                {/* Content */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Review (optional)</label>
                  <Textarea
                    value={newReviewContent}
                    onChange={(e) => setNewReviewContent(e.target.value)}
                    placeholder="Share your experience with this template..."
                    rows={4}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Submit Review
                </Button>
              </form>

              {/* Reviews List */}
              {isReviewsLoading ? (
                <div className="text-center py-6 text-gray-500">Loading reviews...</div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {review.reviewer.name}
                            </span>
                          </div>
                          {review.title && (
                            <h4 className="mt-1 font-semibold text-gray-900">{review.title}</h4>
                          )}
                          {review.content && (
                            <p className="mt-2 text-gray-600">{review.content}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        {new Date(review.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
                  <p className="text-gray-600">No reviews yet. Be the first to review this template!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1">
            {/* Stats Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="space-y-6">
                {/* Rating */}
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-2xl font-bold text-gray-900">{averageRating.toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-gray-600">({totalReviews} reviews)</p>
                </div>

                {/* Usage Count */}
                <div>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Eye className="h-5 w-5 text-gray-400" />
                    <span className="text-lg font-semibold">{template.usage_count}</span>
                  </div>
                  <p className="text-sm text-gray-600">Uses</p>
                </div>

                {/* Category */}
                <div>
                  <p className="text-sm font-medium text-gray-500">Category</p>
                  <p className="mt-1 text-gray-900">{template.category}</p>
                </div>

                {/* Creator */}
                <div>
                  <p className="text-sm font-medium text-gray-500">Creator</p>
                  <p className="mt-1 text-gray-900">{template.creator?.name || 'Unknown'}</p>
                </div>

                {/* Created Date */}
                <div>
                  <p className="text-sm font-medium text-gray-500">Created</p>
                  <p className="mt-1 text-gray-900">
                    {new Date(template.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Use Template Button */}
                <Button className="w-full" size="lg">
                  Use This Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
