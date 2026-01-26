'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Mic, FileText, BookOpen, Clock, TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: audioData, isLoading: audioLoading } = useQuery({
    queryKey: ['audio'],
    queryFn: () => apiClient.audio.list({ limit: 5 }),
  });

  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiClient.books.list({ limit: 5 }),
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiClient.events.list({ limit: 10 }),
  });

  const isLoading = audioLoading || booksLoading || eventsLoading;

  if (isLoading) {
    return <Loading message="Loading dashboard..." />;
  }

  const audioFiles = audioData?.data?.items || [];
  const books = booksData?.data?.items || [];
  const events = eventsData?.data?.items || [];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your writing progress.
          </p>
        </div>
        <Link href="/dashboard/audio">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Recording
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Recordings"
          value={audioFiles.length.toString()}
          description="Audio files uploaded"
          icon={<Mic className="h-4 w-4" />}
        />
        <StatsCard
          title="Events"
          value={events.length.toString()}
          description="Story events extracted"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatsCard
          title="Books"
          value={books.length.toString()}
          description="Books in progress"
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatsCard
          title="This Week"
          value="3"
          description="New recordings"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Recordings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Recordings</CardTitle>
              <CardDescription>Your latest audio uploads</CardDescription>
            </div>
            <Link href="/dashboard/audio">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {audioFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Mic className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No recordings yet</p>
                <Link href="/dashboard/audio">
                  <Button variant="link" className="mt-2">
                    Upload your first recording
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {audioFiles.slice(0, 5).map((audio: { id: string; title: string; status: string; created_at: string }) => (
                  <div
                    key={audio.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Mic className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{audio.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(audio.created_at)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={audio.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Books */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Books</CardTitle>
              <CardDescription>Books in progress</CardDescription>
            </div>
            <Link href="/dashboard/books">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {books.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No books yet</p>
                <Link href="/dashboard/books">
                  <Button variant="link" className="mt-2">
                    Create your first book
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {books.slice(0, 5).map((book: { id: string; title: string; chapter_count: number; word_count: number }) => (
                  <div
                    key={book.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{book.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {book.chapter_count} chapters • {book.word_count.toLocaleString()} words
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    uploaded: 'bg-blue-100 text-blue-700',
    transcribing: 'bg-yellow-100 text-yellow-700',
    transcribed: 'bg-green-100 text-green-700',
    processing: 'bg-purple-100 text-purple-700',
    processed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        statusColors[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
}
