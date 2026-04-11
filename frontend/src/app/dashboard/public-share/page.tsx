'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useBookStore } from '@/stores/book-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Share2, Eye, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface ShareSettings {
  is_public: boolean;
  allow_comments: boolean;
  allow_ratings: boolean;
  share_url: string;
  created_at: string;
}

export default function PublicSharePage() {
  const router = useRouter();
  const { selectedBook } = useBookStore();
  const [shareSettings, setShareSettings] = useState<ShareSettings | null>(null);
  const [copied, setCopied] = useState(false);

  if (!selectedBook) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">No Project Selected</h2>
          <p className="mt-2 text-gray-600">Please select a project to share.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Fetch share settings for current book
  const { data: shareData, isLoading } = useQuery({
    queryKey: ['public-share', selectedBook.id],
    queryFn: async () => {
      try {
        const response = await api.get(`/books/${selectedBook.id}/public-share`);
        return response.data;
      } catch {
        return null;
      }
    },
  });

  React.useEffect(() => {
    if (shareData) {
      setShareSettings(shareData);
    }
  }, [shareData]);

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/books/${selectedBook.id}/public-share`, {
        allow_comments: true,
        allow_ratings: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setShareSettings(data);
      toast.success('Public share link created!');
    },
    onError: () => {
      toast.error('Failed to create share link');
    },
  });

  const updateShareMutation = useMutation({
    mutationFn: async (settings: Partial<ShareSettings>) => {
      const response = await api.put(`/books/${selectedBook.id}/public-share`, settings);
      return response.data;
    },
    onSuccess: (data) => {
      setShareSettings(data);
      toast.success('Share settings updated');
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });

  const handleCopyLink = () => {
    if (shareSettings?.share_url) {
      navigator.clipboard.writeText(shareSettings.share_url);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTogglePublic = () => {
    if (shareSettings) {
      updateShareMutation.mutate({
        is_public: !shareSettings.is_public,
      });
    }
  };

  const handleToggleComments = () => {
    if (shareSettings) {
      updateShareMutation.mutate({
        allow_comments: !shareSettings.allow_comments,
      });
    }
  };

  const handleToggleRatings = () => {
    if (shareSettings) {
      updateShareMutation.mutate({
        allow_ratings: !shareSettings.allow_ratings,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Share Your Book</h1>
          <p className="mt-2 text-gray-600">
            Create a public link to share your book with readers and collect feedback
          </p>
        </div>

        {/* Share Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-8">
          {!shareSettings ? (
            <div className="text-center">
              <Globe className="mx-auto h-12 w-12 text-gray-400" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                Create a Public Share Link
              </h2>
              <p className="mt-2 text-gray-600">
                Generate a shareable link for "{selectedBook.title}" to allow readers to view and provide feedback
              </p>
              <Button
                onClick={() => createShareMutation.mutate()}
                disabled={createShareMutation.isPending}
                className="mt-6 gap-2"
              >
                <Share2 className="h-4 w-4" />
                {createShareMutation.isPending ? 'Creating...' : 'Create Share Link'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Share Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Public Share Link
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={shareSettings.share_url}
                    readOnly
                    className="bg-gray-50 text-gray-600"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="gap-2"
                  >
                    <Copy className={`h-4 w-4 ${copied ? 'text-green-600' : ''}`} />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Share this link with readers to let them preview your book
                </p>
              </div>

              {/* Share Settings */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Settings</h3>
                <div className="space-y-4">
                  {/* Public Status */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      {shareSettings.is_public ? (
                        <Globe className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Lock className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {shareSettings.is_public ? 'Book is Public' : 'Book is Private'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {shareSettings.is_public
                            ? 'Anyone with the link can view your book'
                            : 'Only you can view this book'}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleTogglePublic}
                      variant={shareSettings.is_public ? 'default' : 'outline'}
                      disabled={updateShareMutation.isPending}
                    >
                      {shareSettings.is_public ? 'Make Private' : 'Make Public'}
                    </Button>
                  </div>

                  {/* Comments */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">Allow Reader Comments</p>
                      <p className="text-sm text-gray-600">
                        Readers can leave comments and feedback on your book
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={shareSettings.allow_comments}
                      onChange={handleToggleComments}
                      disabled={updateShareMutation.isPending}
                      className="h-5 w-5 rounded border-gray-300"
                    />
                  </div>

                  {/* Ratings */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">Allow Ratings (1-5 Stars)</p>
                      <p className="text-sm text-gray-600">
                        Readers can rate your book and see aggregate ratings
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={shareSettings.allow_ratings}
                      onChange={handleToggleRatings}
                      disabled={updateShareMutation.isPending}
                      className="h-5 w-5 rounded border-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Share Info */}
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex gap-3">
                  <Eye className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium">Readers can:</p>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      <li>Preview your book</li>
                      {shareSettings.allow_comments && <li>Leave comments and feedback</li>}
                      {shareSettings.allow_ratings && <li>Rate your book</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
