'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit,
  Download,
  Layers,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading, Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author_name?: string;
  description?: string;
  chapter_count: number;
  word_count: number;
  status: string;
  created_at: string;
}

export default function BooksPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiClient.books.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string }) => apiClient.books.create(data),
    onSuccess: () => {
      toast.success('Book created');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setIsCreating(false);
      setNewBookTitle('');
    },
    onError: () => {
      toast.error('Failed to create book');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.delete(id),
    onSuccess: () => {
      toast.success('Book deleted');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => {
      toast.error('Failed to delete book');
    },
  });

  const exportMutation = useMutation({
    mutationFn: ({ id, format }: { id: string; format: string }) =>
      apiClient.books.export(id, format),
    onSuccess: () => {
      toast.success('Export started. Check back soon!');
    },
    onError: () => {
      toast.error('Failed to start export');
    },
  });

  const handleCreateBook = () => {
    if (!newBookTitle.trim()) return;
    createMutation.mutate({ title: newBookTitle });
  };

  if (isLoading) {
    return <Loading message="Loading books..." />;
  }

  const books: Book[] = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Books</h1>
          <p className="text-muted-foreground">
            Assemble chapters into complete books
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Book
        </Button>
      </div>

      {/* Create Book Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Book</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Book title..."
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBook()}
              />
              <Button onClick={handleCreateBook} disabled={createMutation.isPending}>
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

      {/* Books Grid */}
      {books.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No books yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first book to start assembling your chapters
            </p>
            <Button className="mt-4" onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Book
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onDelete={() => deleteMutation.mutate(book.id)}
              onExport={(format) =>
                exportMutation.mutate({ id: book.id, format })
              }
              isDeleting={deleteMutation.isPending}
              isExporting={exportMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({
  book,
  onDelete,
  onExport,
  isDeleting,
  isExporting,
}: {
  book: Book;
  onDelete: () => void;
  onExport: (format: string) => void;
  isDeleting: boolean;
  isExporting: boolean;
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    review: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    published: 'bg-purple-100 text-purple-700',
  };

  const exportFormats = ['pdf', 'epub', 'docx', 'markdown', 'html'];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              statusColors[book.status] || statusColors.draft
            }`}
          >
            {book.status.replace('_', ' ')}
          </span>
        </div>
        <CardTitle className="mt-2">{book.title}</CardTitle>
        {book.subtitle && (
          <CardDescription>{book.subtitle}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {book.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {book.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {book.chapter_count} chapters
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {book.word_count.toLocaleString()} words
          </span>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {formatDate(book.created_at)}
            </span>
            <div className="flex items-center gap-1">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting || book.chapter_count === 0}
                >
                  {isExporting ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-md border bg-card p-1 shadow-lg">
                    {exportFormats.map((format) => (
                      <button
                        key={format}
                        className="w-full rounded px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          onExport(format);
                          setShowExportMenu(false);
                        }}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
