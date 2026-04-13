'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface ArchivedProject {
  id: string;
  title: string;
  status: string;
  chapter_count: number;
  word_count: number;
  created_at: string;
}

export default function ArchivePage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['books', 'archive'],
    queryFn: () => apiClient.books.list({ limit: 100, status: 'archived,completed,published' }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.update(id, { status: 'in_progress' }),
    onSuccess: () => {
      toast.success('Project restored to active');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => toast.error('Failed to restore project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.delete(id),
    onSuccess: () => {
      toast.success('Archived project deleted');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => toast.error('Failed to delete archived project'),
  });

  const archived = (data?.data?.items || []) as ArchivedProject[];

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="max-w-5xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load archive"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pt-8 pb-24">
      <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body mb-2">Archive</h2>
      <p className="font-label text-sm text-on-surface-variant mb-10">Finished or archived projects.</p>

      <div className="elevated-panel rounded-2xl p-8">
        {archived.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/45 p-12 text-center">
            <span className="material-symbols-outlined mb-4 text-4xl text-on-surface-variant">archive</span>
            <h3 className="mb-2 font-label text-sm font-bold uppercase tracking-widest text-on-surface">No archived projects</h3>
            <p className="max-w-sm font-label text-sm leading-relaxed text-on-surface-variant">
              Archive your finished or inactive projects to keep your workspace organized. Archived projects can be restored anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {archived.map((book) => (
              <div key={book.id} className="theme-chip rounded-xl p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="font-body text-2xl italic text-on-surface">{book.title}</p>
                    <p className="font-label text-[11px] uppercase tracking-wide text-on-surface-variant mt-1">
                      Status: {String(book.status).replace('_', ' ')} • {book.chapter_count || 0} chapters • {book.word_count || 0} words • {formatDate(book.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreMutation.mutate(book.id)}
                      disabled={restoreMutation.isPending}
                      className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50"
                      title="Restore"
                    >
                      {restoreMutation.isPending && restoreMutation.variables === book.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">settings_backup_restore</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this archived project permanently?')) {
                          deleteMutation.mutate(book.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-error hover:bg-error hover:text-on-error disabled:opacity-50"
                      title="Delete"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === book.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
