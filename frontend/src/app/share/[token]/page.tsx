'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useFeedback, usePublicRatings, useSubmitFeedback } from '@/hooks/usePublicShare';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Public book preview page - shareable link for readers to view manuscript
 * Route: /share/[token]
 */
export default function PublicSharePage() {
  const params = useParams();
  const shareToken = params.token as string;

  // Feedback data
  const { data: feedback, isLoading: feedbackLoading } = useFeedback(shareToken);
  const { data: ratings, isLoading: ratingsLoading } = usePublicRatings(shareToken);
  const submitFeedback = useSubmitFeedback();

  // Form state
  const [rating, setRating] = useState<number | null>(null);
  const [readerName, setReaderName] = useState('');
  const [readerEmail, setReaderEmail] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [feedbackType, setFeedbackType] = useState('general');
  const [submitted, setSubmitted] = useState(false);

  if (!shareToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
          <AlertCircle className="mb-2 h-5 w-5 text-red-600" />
          <p className="text-red-900 dark:text-red-200">Invalid share link</p>
        </div>
      </div>
    );
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please write some feedback');
      return;
    }

    submitFeedback.mutate(
      {
        shareToken,
        feedback: {
          rating: rating || undefined,
          reader_name: readerName || undefined,
          reader_email: readerEmail || undefined,
          title: title || undefined,
          content,
          feedback_type: feedbackType,
        },
      },
      {
        onSuccess: () => {
          setRating(null);
          setReaderName('');
          setReaderEmail('');
          setTitle('');
          setContent('');
          setSubmitted(true);
          setTimeout(() => setSubmitted(false), 3000);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-8 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Book Preview & Feedback
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Read the manuscript and share your thoughts with the author
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Manuscript Preview Column */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 dark:border-gray-800 dark:bg-gray-900">
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-center text-gray-500 dark:text-gray-400">
                  📖 Manuscript preview would load here
                </p>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-500">
                  [Full chapter content would render here in a reader-friendly format with proper typography]
                </p>
              </div>
            </div>
          </div>

          {/* Feedback Sidebar */}
          <div className="space-y-6">
            {/* Rating Summary */}
            {ratings && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <h3 className="font-semibold text-gray-900 dark:text-white">Reader Ratings</h3>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.round(ratings.average_rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {ratings.average_rating.toFixed(1)}/5
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {ratings.total_ratings} ratings
                </p>
              </div>
            )}

            {/* Feedback Form */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <h3 className="font-semibold text-gray-900 dark:text-white">Share Your Feedback</h3>

              {submitted && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                  <div className="flex items-center gap-2 text-sm text-green-900 dark:text-green-200">
                    <Check className="h-4 w-4" />
                    Thank you! Your feedback was submitted.
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} className="mt-4 space-y-4">
                {/* Rating */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(rating === star ? null : star)}
                        className="transition-all duration-200"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            rating && rating >= star
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name (optional)
                  </label>
                  <Input
                    value={readerName}
                    onChange={(e) => setReaderName(e.target.value)}
                    placeholder="Your name"
                    className="text-sm"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email (optional)
                  </label>
                  <Input
                    type="email"
                    value={readerEmail}
                    onChange={(e) => setReaderEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="text-sm"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Feedback Type
                  </label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="general">General Feedback</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="issue">Issue/Problem</option>
                    <option value="praise">Praise</option>
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Title (optional)
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Summary of feedback"
                    className="text-sm"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Feedback
                  </label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What did you think? What would you improve?"
                    rows={4}
                    className="text-sm"
                  />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={submitFeedback.isPending}
                  className="w-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {submitFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Recent Feedback Section */}
        {feedback && feedback.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Reader Feedback ({feedback.length})
            </h2>
            <div className="mt-4 space-y-4">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {item.title && (
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {item.title}
                        </h4>
                      )}
                      {item.reader_name && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.reader_name}
                        </p>
                      )}
                    </div>
                    {item.rating && (
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < item.rating!
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {item.content}
                  </p>
                  {item.feedback_type && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                      Type: {item.feedback_type}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
