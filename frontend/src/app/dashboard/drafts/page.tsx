'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { toast } from 'sonner';
import { useBookStore } from '@/stores/book-store';
import { formatDate } from '@/lib/utils';

interface DraftProject {
  id: string;
  title: string;
  status: string;
  chapter_count: number;
  word_count: number;
  created_at: string;
}

export default function DraftsPage() {
  const queryClient = useQueryClient();
  const { selectBook } = useBookStore();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['books', 'drafts'],
    queryFn: () => apiClient.books.list({ limit: 100, status: 'draft' }),
  });

  const promoteMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.update(id, { status: 'in_progress' }),
    onSuccess: () => {
      toast.success('Draft moved to Projects');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => toast.error('Failed to move draft to projects'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.update(id, { status: 'archived' }),
    onSuccess: () => {
      toast.success('Draft archived');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => toast.error('Failed to archive draft'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.delete(id),
    onSuccess: () => {
      toast.success('Draft deleted');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => toast.error('Failed to delete draft'),
  });

  const drafts = (data?.data?.items || []) as DraftProject[];

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="max-w-5xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load drafts"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pt-8 pb-24">
      <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body mb-2">Drafts</h2>
      <p className="font-label text-sm text-on-surface-variant mb-10">Project ideas in draft. Promote any draft into an active project when ready.</p>

      <div className="elevated-panel rounded-2xl p-8">
        {drafts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-outline-variant/45 p-10 text-center">
            <p className="font-label text-sm text-on-surface-variant">No draft project ideas right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((project) => (
              <div key={project.id} className="theme-chip rounded-xl p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="font-body text-2xl italic text-on-surface">{project.title}</p>
                    <p className="font-label text-[11px] uppercase tracking-wide text-on-surface-variant mt-1">
                      Draft • {project.chapter_count || 0} chapters • {project.word_count || 0} words • {formatDate(project.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        selectBook(project as any);
                        if (typeof window !== 'undefined') {
                          window.location.assign('/dashboard');
                        }
                      }}
                      className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary hover:text-primary-foreground"
                      title="Open"
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                    <button
                      onClick={() => promoteMutation.mutate(project.id)}
                      disabled={promoteMutation.isPending}
                      className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50"
                      title="Move to Projects"
                    >
                      {promoteMutation.isPending && promoteMutation.variables === project.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                      )}
                    </button>
                    <button
                      onClick={() => archiveMutation.mutate(project.id)}
                      disabled={archiveMutation.isPending}
                      className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50"
                      title="Archive"
                    >
                      {archiveMutation.isPending && archiveMutation.variables === project.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this draft idea?')) {
                          deleteMutation.mutate(project.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-error hover:bg-error hover:text-on-error disabled:opacity-50"
                      title="Delete"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === project.id ? (
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
