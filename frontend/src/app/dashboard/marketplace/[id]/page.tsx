'use client';

export const runtime = 'edge';

import React, { useState } from 'react';
import { useTemplateDetail, useTemplateReviews, useFavoriteTemplate, useUnfavoriteTemplate, useCreateTemplateReview, useCreateBookFromTemplate } from '@/hooks/useMarketplace';
import { Button } from '@/components/ui/button';
import { Heart, Star, Eye, ArrowLeft, Download } from 'lucide-react';
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
  const createBookMutation = useCreateBookFromTemplate();

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
        <div className="text-on-surface-variant">Loading template...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/dashboard/marketplace">
            <Button variant="outline" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
          <div className="elevated-panel rounded-xl p-12 text-center">
            <h2 className="text-lg font-semibold text-on-surface">Template not found</h2>
            <p className="mt-2 text-on-surface-variant">The template you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant/35 bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/dashboard/marketplace">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-on-surface">{template.name}</h1>
              {template.is_verified && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success-container/60 px-3 py-1 text-sm font-medium text-success">
                  ✓ Verified by moderators
                </div>
              )}
              <p className="mt-4 text-on-surface-variant">{template.description}</p>
            </div>
            <button
              onClick={handleFavorite}
              disabled={favoriteMutation.isPending || unfavoriteMutation.isPending}
              className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-error/10 disabled:opacity-50"
            >
              <Heart
                className={`h-6 w-6 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-on-surface-variant'}`}
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
                <h3 className="mb-3 font-semibold text-on-surface">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {template.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-primary-container/55 px-3 py-1 text-sm font-medium text-on-primary-container"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Content */}
            {template.sample_content && (
              <div className="elevated-panel mb-8 rounded-xl p-6">
                <h3 className="mb-4 font-semibold text-on-surface">Sample Content</h3>
                <div className="prose prose-sm max-w-none text-on-surface-variant">
                  {template.sample_content}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <div className="mb-8">
              <h3 className="mb-6 text-2xl font-bold text-on-surface">Reviews ({totalReviews})</h3>

              {/* New Review Form */}
              <form onSubmit={handleSubmitReview} className="elevated-panel mb-8 rounded-xl p-6">
                <h4 className="mb-4 font-semibold text-on-surface">Write a Review</h4>
                
                {/* Rating */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-on-surface-variant">Rating</label>
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
                              : 'text-outline-variant'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-on-surface-variant">Title (optional)</label>
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
                  <label className="mb-2 block text-sm font-medium text-on-surface-variant">Review (optional)</label>
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
                <div className="py-6 text-center text-on-surface-variant">Loading reviews...</div>
              ) : reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review: typeof reviews[0]) => (
                    <div key={review.id} className="theme-chip rounded-lg p-4">
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
                                      : 'text-outline-variant'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium text-on-surface-variant">
                              {review.reviewer.name}
                            </span>
                          </div>
                          {review.title && (
                            <h4 className="mt-1 font-semibold text-on-surface">{review.title}</h4>
                          )}
                          {review.content && (
                            <p className="mt-2 text-on-surface-variant">{review.content}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-on-surface-variant">
                        {new Date(review.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="elevated-panel rounded-lg p-6 text-center">
                  <p className="text-on-surface-variant">No reviews yet. Be the first to review this template!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1">
            {/* Stats Card */}
            <div className="elevated-panel rounded-xl p-6">
              <div className="space-y-6">
                {/* Rating */}
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-2xl font-bold text-on-surface">{averageRating.toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">({totalReviews} reviews)</p>
                </div>

                {/* Usage Count */}
                <div>
                  <div className="flex items-center gap-2 text-on-surface">
                    <Eye className="h-5 w-5 text-on-surface-variant" />
                    <span className="text-lg font-semibold">{template.usage_count}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">Uses</p>
                </div>

                {/* Category */}
                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Category</p>
                  <p className="mt-1 text-on-surface">{template.category}</p>
                </div>

                {/* Creator */}
                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Creator</p>
                  <p className="mt-1 text-on-surface">{template.creator?.name || 'Unknown'}</p>
                </div>

                {/* Created Date */}
                <div>
                  <p className="text-sm font-medium text-on-surface-variant">Created</p>
                  <p className="mt-1 text-on-surface">
                    {new Date(template.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Use Template Button */}
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={() => createBookMutation.mutate(id)}
                  disabled={createBookMutation.isPending}
                >
                  <Download className="h-4 w-4" />
                  {createBookMutation.isPending ? 'Creating...' : 'Use This Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
