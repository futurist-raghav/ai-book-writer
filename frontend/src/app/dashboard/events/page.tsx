'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText,
  Star,
  Trash2,
  Edit,
  Plus,
  Search,
  Filter,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate, truncate } from '@/lib/utils';

interface Event {
  id: string;
  title: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  location?: string;
  people?: string[];
  sentiment?: string;
  is_featured: boolean;
  order_index: number;
  created_at: string;
}

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['events', { category: selectedCategory }],
    queryFn: () =>
      apiClient.events.list({
        category: selectedCategory || undefined,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['event-categories'],
    queryFn: () => apiClient.events.categories(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.events.delete(id),
    onSuccess: () => {
      toast.success('Event deleted');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => {
      toast.error('Failed to delete event');
    },
  });

  const featureMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      apiClient.events.feature(id, featured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  if (isLoading) {
    return <Loading message="Loading events..." />;
  }

  const events: Event[] = data?.data?.items || [];
  const categories: string[] = categoriesData?.data || [];

  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Story Events</h1>
          <p className="text-muted-foreground">
            Narrative events extracted from your recordings
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={selectedCategory === null ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.slice(0, 5).map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No events found</p>
            <p className="text-sm text-muted-foreground">
              {events.length === 0
                ? 'Upload and transcribe audio to extract events'
                : 'Try adjusting your search or filters'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onDelete={() => deleteMutation.mutate(event.id)}
              onToggleFeature={() =>
                featureMutation.mutate({
                  id: event.id,
                  featured: !event.is_featured,
                })
              }
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  onDelete,
  onToggleFeature,
  isDeleting,
}: {
  event: Event;
  onDelete: () => void;
  onToggleFeature: () => void;
  isDeleting: boolean;
}) {
  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    negative: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-gray-700',
    mixed: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{event.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFeature}
          >
            <Star
              className={`h-4 w-4 ${
                event.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
              }`}
            />
          </Button>
        </div>
        {event.category && (
          <span className="inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {event.category}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="flex-1 text-sm text-muted-foreground">
          {truncate(event.summary || event.content, 150)}
        </p>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {event.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {event.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{event.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            {event.sentiment && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  sentimentColors[event.sentiment] || sentimentColors.neutral
                }`}
              >
                {event.sentiment}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(event.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
