'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Layers,
  Plus,
  Trash2,
  Edit,
  FileText,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading, Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  chapter_number: number;
  synopsis?: string;
  compiled_content?: string;
  word_count: number;
  event_count: number;
  created_at: string;
}

export default function ChaptersPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['chapters'],
    queryFn: () => apiClient.chapters.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; chapter_number: number }) =>
      apiClient.chapters.create(data),
    onSuccess: () => {
      toast.success('Chapter created');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      setIsCreating(false);
      setNewChapterTitle('');
    },
    onError: () => {
      toast.error('Failed to create chapter');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.chapters.delete(id),
    onSuccess: () => {
      toast.success('Chapter deleted');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to delete chapter');
    },
  });

  const compileMutation = useMutation({
    mutationFn: (id: string) => apiClient.chapters.compile(id),
    onSuccess: () => {
      toast.success('Chapter compiled successfully');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to compile chapter');
    },
  });

  const handleCreateChapter = () => {
    if (!newChapterTitle.trim()) return;
    const chapters: Chapter[] = data?.data?.items || [];
    const nextNumber = chapters.length + 1;
    createMutation.mutate({ title: newChapterTitle, chapter_number: nextNumber });
  };

  if (isLoading) {
    return <Loading message="Loading chapters..." />;
  }

  const chapters: Chapter[] = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chapters</h1>
          <p className="text-muted-foreground">
            Organize your events into chapters
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Chapter
        </Button>
      </div>

      {/* Create Chapter Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Chapter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Chapter title..."
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChapter()}
              />
              <Button onClick={handleCreateChapter} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Spinner size="sm" className="mr-2" />
                ) : null}
                Create
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chapters List */}
      {chapters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No chapters yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first chapter to start organizing your story
            </p>
            <Button className="mt-4" onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Chapter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {chapters
            .sort((a, b) => a.chapter_number - b.chapter_number)
            .map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                onDelete={() => deleteMutation.mutate(chapter.id)}
                onCompile={() => compileMutation.mutate(chapter.id)}
                isDeleting={deleteMutation.isPending}
                isCompiling={compileMutation.isPending}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function ChapterCard({
  chapter,
  onDelete,
  onCompile,
  isDeleting,
  isCompiling,
}: {
  chapter: Chapter;
  onDelete: () => void;
  onCompile: () => void;
  isDeleting: boolean;
  isCompiling: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
          {chapter.chapter_number}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{chapter.title}</h3>
            {chapter.subtitle && (
              <span className="text-sm text-muted-foreground">
                — {chapter.subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {chapter.event_count} events
            </span>
            <span>{chapter.word_count.toLocaleString()} words</span>
            <span>{formatDate(chapter.created_at)}</span>
          </div>
          {chapter.synopsis && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
              {chapter.synopsis}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCompile}
            disabled={isCompiling || chapter.event_count === 0}
          >
            {isCompiling ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Compile
          </Button>
          <Button variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
