'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText,
  Star,
  Trash2,
  Edit,
  Search,
  Filter,
  Tag,
  Calendar,
  MapPin,
  Users,
  BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate, truncate } from '@/lib/utils';

interface Event {
  id: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  category?: string;
  tags?: string[];
  location?: string;
  people?: Array<string | { name: string; relationship?: string }>;
  sentiment?: string;
  is_featured: boolean;
  order_index: number;
  created_at?: string;
  event_date?: string;
}

type EventType = 'story-event' | 'character-moment' | 'research-note' | 'plot-development' | 'dialogue' | 'authors-note';

const EVENT_TYPES: Array<{ value: EventType; label: string; icon: string; color: string }> = [
  { value: 'story-event', label: 'Story Event', icon: 'bookmark', color: 'secondary' },
  { value: 'character-moment', label: 'Character Moment', icon: 'person', color: 'tertiary' },
  { value: 'research-note', label: 'Research Note', icon: 'lightbulb', color: 'primary' },
  { value: 'plot-development', label: 'Plot Development', icon: 'git-branch', color: 'error' },
  { value: 'dialogue', label: 'Dialogue', icon: 'message-circle', color: 'primary-container' },
  { value: 'authors-note', label: "Author's Note", icon: 'sticky-note', color: 'secondary-container' },
];

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

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

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: () => apiClient.chapters.list({ limit: 100 }),
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

  // Move all hooks BEFORE the conditional return (rules of hooks)
  const events: Event[] = data?.data?.items || [];
  const categories: string[] = categoriesData?.data || [];
  const chapters = chaptersData?.data?.items || [];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Search filter
      if (normalizedQuery) {
        const searchableText = [event.title, event.summary, event.content]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join(' ')
          .toLowerCase();
        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory && event.category !== selectedCategory) {
        return false;
      }

      // Type filter (based on category mapping for now)
      if (selectedType) {
        // Map event type to category for filtering
        const typeCategories: Record<EventType, string> = {
          'story-event': 'story',
          'character-moment': 'character',
          'research-note': 'research',
          'plot-development': 'plot',
          'dialogue': 'dialogue',
          'authors-note': 'author-note',
        };
        if (event.category !== typeCategories[selectedType]) {
          return false;
        }
      }

      return true;
    });
  }, [events, normalizedQuery, selectedCategory, selectedType]);

  // Group events by date for timeline view
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Event[]> = {};
    filteredEvents.forEach((event) => {
      const dateStr = event.event_date || event.created_at || 'undated';
      const dateKey = new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    return groups;
  }, [filteredEvents]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedByDate).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [groupedByDate]);

  if (isLoading) {
    return <Loading message="Loading events..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Story Events</h1>
          <p className="text-muted-foreground">
            Narrative events extracted from your recordings ({filteredEvents.length})
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Timeline
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Grid
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-on-surface/60">Event Type</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedType === null ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              All Types
            </Button>
            {EVENT_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={selectedType === type.value ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-on-surface/60">Category</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.slice(0, 8).map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Events Display */}
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
      ) : viewMode === 'timeline' ? (
        // Timeline View
        <div className="space-y-8">
          {sortedDates.map((dateKey) => (
            <div key={dateKey} className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/20">
                <Calendar className="h-4 w-4 text-secondary" />
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-on-surface/60">
                  {dateKey}
                </h3>
              </div>
              <div className="space-y-3 pl-4 border-l-2 border-secondary/30">
                {(groupedByDate[dateKey] || []).map((event) => (
                  <EventTimelineItem
                    key={event.id}
                    event={event}
                    onDelete={() => deleteMutation.mutate(event.id)}
                    onToggleFeature={() =>
                      featureMutation.mutate({
                        id: event.id,
                        featured: !event.is_featured,
                      })
                    }
                    chapters={chapters}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Grid View
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
              chapters={chapters}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventTimelineItem({
  event,
  onDelete,
  onToggleFeature,
  chapters,
  isDeleting,
}: {
  event: Event;
  onDelete: () => void;
  onToggleFeature: () => void;
  chapters: any[];
  isDeleting: boolean;
}) {
  const eventType = EVENT_TYPES.find(
    (t) => event.category?.toLowerCase() === t.label.toLowerCase().replace(' ', '-')
  );

  const previewText = event.summary || event.content || 'No summary available';

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-white p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {eventType && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                eventType.color === 'secondary' 
                  ? 'bg-secondary/10 text-secondary'
                  : eventType.color === 'tertiary'
                  ? 'bg-tertiary/10 text-tertiary'  
                  : eventType.color === 'error'
                  ? 'bg-error/10 text-error'
                  : eventType.color === 'primary-container'
                  ? 'bg-primary-container/10 text-primary-container'
                  : 'bg-secondary-container/10 text-secondary-container'
              }`}>
                {eventType.label}
              </span>
            )}
            {event.is_featured && (
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            )}
          </div>
          <h4 className="font-semibold text-base text-text">
            {event.title?.trim() || 'Untitled event'}
          </h4>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleFeature}
        >
          <Star
            className={`h-4 w-4 ${
              event.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            }`}
          />
        </Button>
      </div>

      <p className="text-sm text-text/70 line-clamp-2 mb-2">{truncate(previewText, 120)}</p>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-3 text-xs text-text/50 mb-3">
        {event.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.location}
          </div>
        )}
        {event.people && Array.isArray(event.people) && event.people.length > 0 && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {typeof event.people[0] === 'string'
              ? event.people.slice(0, 2).join(', ')
              : event.people.slice(0, 1).map((p: any) => p.name || p).join(', ')}
            {event.people.length > 1 && <span>+{event.people.length - 1}</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Edit"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function EventCard({
  event,
  onDelete,
  onToggleFeature,
  chapters,
  isDeleting,
}: {
  event: Event;
  onDelete: () => void;
  onToggleFeature: () => void;
  chapters: any[];
  isDeleting: boolean;
}) {
  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    negative: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-gray-700',
    mixed: 'bg-yellow-100 text-yellow-700',
  };

  const eventType = EVENT_TYPES.find(
    (t) => event.category?.toLowerCase() === t.label.toLowerCase().replace(' ', '-')
  );

  const previewText = event.summary || event.content || 'No summary yet for this event.';

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Type Header */}
      {eventType && (
        <div className={`px-6 py-3 border-b border-outline-variant/10 ${
          eventType.color === 'secondary'
            ? 'bg-secondary/5'
            : eventType.color === 'tertiary'
            ? 'bg-tertiary/5'
            : eventType.color === 'error'
            ? 'bg-error/5'
            : eventType.color === 'primary-container'
            ? 'bg-primary-container/5'
            : 'bg-secondary-container/5'
        }`}>
          <p className={`text-xs font-label font-bold uppercase tracking-tight ${eventType.color === 'secondary' 
            ? 'text-secondary'
            : eventType.color === 'tertiary'
            ? 'text-tertiary'  
            : eventType.color === 'error'
            ? 'text-error'
            : eventType.color === 'primary-container'
            ? 'text-primary-container'
            : 'text-secondary-container'
          }`}>
            {eventType.label}
          </p>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{event.title?.trim() || 'Untitled event'}</CardTitle>
            {event.event_date && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(event.event_date).toLocaleDateString()}
              </p>
            )}
          </div>
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
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <p className="flex-1 text-sm text-muted-foreground mb-3">
          {truncate(previewText, 150)}
        </p>

        {/* Metadata */}
        <div className="space-y-2 mb-3 text-xs text-muted-foreground">
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              <span>{event.location}</span>
            </div>
          )}
          {event.people && Array.isArray(event.people) && event.people.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              <span>
                {typeof event.people[0] === 'string'
                  ? event.people.slice(0, 2).join(', ')
                  : event.people.slice(0, 1).map((p: any) => p.name || p).join(', ')}
                {event.people.length > 1 && ` +${event.people.length - 1}`}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {Array.isArray(event.tags) && event.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {event.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {event.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{event.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-3">
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
              {event.created_at ? formatDate(event.created_at) : 'Unknown date'}
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
