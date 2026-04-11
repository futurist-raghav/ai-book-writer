'use client';

import React, { useState } from 'react';
import { useBookStore } from '@/stores/book-store';
import { usePublicShare, useCreatePublicShare, useUpdatePublicShare, useFeedback } from '@/hooks/usePublicShare';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Share2, Copy, Check, Eye, Settings, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function SharingPage() {
  const selectedBook = useBookStore((state) => state.selectedBook);
  const bookId = selectedBook?.id || null;

  const { data: share, isLoading } = usePublicShare(bookId);
  const { data: feedback } = useFeedback(share?.share_token || null);
  const createShare = useCreatePublicShare();
  const updateShare = useUpdatePublicShare();

  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!bookId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Select a book first</p>
      </div>
    );
  }

  const shareUrl = share ? `${window.location.origin}/share/${share.share_token}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const handleCreateShare = () => {
    createShare.mutate({ bookId });
  };

  const handleToggleShare = () => {
    if (share) {
      updateShare.mutate({
        bookId,
        isActive: !share.is_active,
        allowComments: share.allow_comments,
        allowRatings: share.allow_ratings,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-gray-600 dark:text-gray-400">Public Sharing</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
          <Share2 className="h-8 w-8 text-blue-600" />
          Public Sharing & Feedback
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Share your manuscript with readers and collect feedback
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl space-y-6">
          {!share ? (
            // Create Share CTA
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-950">
              <Share2 className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                No public share yet
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Create a public link to share your manuscript with readers
              </p>
              <Button onClick={handleCreateShare} disabled={createShare.isPending} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Public Share
              </Button>
            </div>
          ) : (
            <>
              {/* Share Link Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Share Link
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Share this link with readers: {share.view_count} views
                    </p>
                  </div>
                  {share.is_active ? (
                    <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/20 dark:text-green-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Share URL */}
                <div className="mt-4 flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="whitespace-nowrap"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-4 w-4" />
                    </a>
                  </Button>
                </div>

                {/* Toggle & Settings */}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant={share.is_active ? 'default' : 'outline'}
                    onClick={handleToggleShare}
                    disabled={updateShare.isPending}
                  >
                    {share.is_active ? 'Disable Share' : 'Enable Share'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>

                {/* Settings */}
                {showSettings && (
                  <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-800">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={share.allow_comments}
                        onChange={(e) =>
                          updateShare.mutate({
                            bookId,
                            isActive: share.is_active,
                            allowComments: e.target.checked,
                            allowRatings: share.allow_ratings,
                          })
                        }
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Allow comments
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={share.allow_ratings}
                        onChange={(e) =>
                          updateShare.mutate({
                            bookId,
                            isActive: share.is_active,
                            allowComments: share.allow_comments,
                            allowRatings: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Allow ratings
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Feedback Summary */}
              {feedback && feedback.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Reader Feedback ({feedback.length})
                  </h2>
                  <div className="mt-4 space-y-3">
                    {feedback.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {item.title && (
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.title}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                              {item.content}
                            </p>
                            <p className="mt-2 text-xs text-gray-500">
                              {item.reader_name || 'Anonymous'} • {item.feedback_type}
                            </p>
                          </div>
                          {item.rating && (
                            <div className="text-lg font-bold text-yellow-600">
                              ⭐ {item.rating}/5
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {feedback.length > 5 && (
                    <Button variant="outline" className="mt-4 w-full">
                      View All Feedback
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
