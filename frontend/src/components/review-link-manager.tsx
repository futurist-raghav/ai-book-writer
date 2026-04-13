'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface ReviewLink {
  link_id: string;
  book_id: string;
  review_url: string;
  share_code: string;
  chapters_included: number;
  expires_at: string;
  created_at: string;
  status: string;
  viewer_count: number;
  comment_count: number;
  allow_comments: boolean;
}

interface ReviewLinkManagerProps {
  bookId: string;
  onClose?: () => void;
}

interface ReviewFeedback {
  total_comments: number;
  reviewer_count: number;
  feedback_by_type: Record<string, number>;
}

export function ReviewLinkManager({ bookId, onClose }: ReviewLinkManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [allowComments, setAllowComments] = useState(true);

  // Fetch review links
  const { data: reviewLinks, refetch: refetchLinks, isLoading } = useQuery({
    queryKey: ['reviewLinks', bookId],
    queryFn: async () => {
      const response = await api.get(`/books/${bookId}/review-links`);
      return response.data as ReviewLink[];
    },
  });

  // Fetch feedback
  const { data: feedback } = useQuery<ReviewFeedback>({
    queryKey: ['reviewFeedback', bookId],
    queryFn: async () => {
      const response = await api.get(`/books/${bookId}/review-feedback`);
      return response.data as ReviewFeedback;
    },
  });

  // Create review link
  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/books/${bookId}/review-links`, {
        book_id: bookId,
        expires_in_days: expiresInDays,
        allow_comments: allowComments,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchLinks();
      setShowCreateForm(false);
    },
  });

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Create New Link */}
      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90"
          >
            Create Review Link for Beta Readers
          </button>
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold text-on-surface">New Review Link</h3>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Link Expires In: {expiresInDays} days
              </label>
              <input
                type="range"
                min="1"
                max="180"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
                className="w-4 h-4 rounded border-outline"
              />
              <span className="text-sm text-on-surface">Allow beta readers to leave comments</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Link'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-medium text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Links List */}
      {isLoading ? (
        <p className="text-on-surface-variant">Loading review links...</p>
      ) : (
        <div className="space-y-3">
          {reviewLinks && reviewLinks.length > 0 ? (
            reviewLinks.map((link) => (
              <div
                key={link.link_id}
                className="border border-outline-variant/30 rounded-lg p-4 bg-surface-container-lowest"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-on-surface">Share Code: {link.share_code}</h4>
                    <p className="text-xs text-on-surface-variant">
                      Created {new Date(link.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      link.status === 'active'
                        ? 'bg-green-100 text-green-900'
                        : link.status === 'expired'
                        ? 'bg-red-100 text-red-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {link.status}
                  </span>
                </div>

                {/* Share URL */}
                <div className="mb-3 p-3 bg-white rounded border border-outline-variant/20">
                  <p className="text-xs text-on-surface-variant mb-1">Share this link with beta readers:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-surface-container-lowest p-2 rounded font-mono text-primary">
                      {link.review_url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(link.review_url)}
                      className="px-3 py-1 bg-primary text-on-primary rounded text-xs font-medium hover:bg-primary/90"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                  <div className="bg-primary/10 rounded p-2">
                    <p className="text-on-surface-variant text-xs">Chapters</p>
                    <p className="font-semibold text-primary">{link.chapters_included}</p>
                  </div>
                  <div className="bg-primary/10 rounded p-2">
                    <p className="text-on-surface-variant text-xs">Viewers</p>
                    <p className="font-semibold text-primary">{link.viewer_count}</p>
                  </div>
                  <div className="bg-primary/10 rounded p-2">
                    <p className="text-on-surface-variant text-xs">Comments</p>
                    <p className="font-semibold text-primary">{link.comment_count}</p>
                  </div>
                  <div className="bg-primary/10 rounded p-2">
                    <p className="text-on-surface-variant text-xs">Expires</p>
                    <p className="font-semibold text-primary text-[10px]">
                      {new Date(link.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Settings */}
                <div className="text-xs text-on-surface-variant">
                  {link.allow_comments ? '✓ Comments enabled' : '✗ Comments disabled'}
                </div>
              </div>
            ))
          ) : (
            <p className="text-on-surface-variant">No review links created yet.</p>
          )}
        </div>
      )}

      {/* Feedback Summary */}
      {feedback && feedback.total_comments > 0 && (
        <div className="bg-secondary/5 rounded-lg p-4 border border-secondary/20">
          <h3 className="font-semibold text-on-surface mb-3">Beta Reader Feedback ({feedback.total_comments})</h3>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-on-surface-variant">Reviewers</p>
              <p className="font-semibold text-secondary">{feedback.reviewer_count}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Feedback Types</p>
              <div className="flex gap-1 flex-wrap text-xs mt-1">
                {Object.entries(feedback.feedback_by_type).map(([type, count]) => (
                  <span key={type} className="bg-secondary/20 text-secondary px-2 py-1 rounded">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              // Download feedback as CSV/JSON
              const feedbackJson = JSON.stringify(feedback, null, 2);
              const blob = new Blob([feedbackJson], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'beta-feedback.json';
              a.click();
            }}
            className="w-full rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-medium text-on-surface hover:bg-surface-container text-sm"
          >
            Download Feedback Report
          </button>
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-medium text-on-surface hover:bg-surface-container"
        >
          Close
        </button>
      )}
    </div>
  );
}
