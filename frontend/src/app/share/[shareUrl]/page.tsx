'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CommentSection } from '@/components/public-share/comments-section';
import { RatingsSection } from '@/components/public-share/ratings-section';
import { Download, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface BookPage {
  book: {
    id: string;
    title: string;
    description: string;
    cover_url?: string;
    author?: string;
  };
  share: {
    allow_comments: boolean;
    allow_ratings: boolean;
  };
}

function BookViewContent() {
  const params = useParams();
  const shareUrl = params.shareUrl as string;

  // Fetch book data
  const { data: bookData, isLoading, error } = useQuery({
    queryKey: ['shared-book', shareUrl],
    queryFn: async () => {
      const response = await api.get(`/share/${shareUrl}`);
      return response.data as BookPage;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !bookData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Book Not Found</h1>
          <p className="text-gray-600">This book is no longer available to share.</p>
        </div>
      </div>
    );
  }

  const { book, share } = bookData;

  const handleDownload = async () => {
    try {
      toast.promise(
        api.get(`/share/${shareUrl}/download`, { responseType: 'blob' }),
        {
          loading: 'Preparing download...',
          success: (response) => {
            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${book.title}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return 'Book downloaded successfully!';
          },
          error: 'Failed to download book',
        }
      );
    } catch (err) {
      toast.error('Download failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-transparent to-secondary/5">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
            {book.author && (
              <p className="text-gray-600">by {book.author}</p>
            )}
          </div>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {book.cover_url && (
              <div className="rounded-lg overflow-hidden shadow-lg flex-shrink-0 mb-6">
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full aspect-[9/12] object-cover"
                />
              </div>
            )}

            {/* Quick Info */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">About This Book</h3>
              <p className="text-sm text-gray-700 mb-6">{book.description}</p>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ChevronRight className="h-4 w-4" />
                  <span>{share.allow_comments ? 'Comments enabled' : 'Comments disabled'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ChevronRight className="h-4 w-4" />
                  <span>{share.allow_ratings ? 'Ratings enabled' : 'Ratings disabled'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Ratings Section */}
            {share.allow_ratings && (
              <div>
                <RatingsSection shareUrl={shareUrl} allowRatings={share.allow_ratings} />
              </div>
            )}

            {/* Comments Section */}
            {share.allow_comments && (
              <div>
                <CommentSection shareUrl={shareUrl} allowComments={share.allow_comments} />
              </div>
            )}

            {/* No Engagement Message */}
            {!share.allow_comments && !share.allow_ratings && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                <p className="text-gray-600">
                  This book is being shared for viewing only. Comments and ratings are disabled.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicBookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <BookViewContent />
    </Suspense>
  );
}
