'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';
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

  const { data, isLoading } = useQuery({
    queryKey: ['books', 'archive'],
    queryFn: () => apiClient.books.list({ limit: 100 }),
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

  const books = (data?.data?.items || []) as ArchivedProject[];
  const archived = books.filter((book) => ['archived', 'completed', 'published'].includes(String(book.status)));

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto pt-8 pb-24">
      <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body mb-2">Archive</h2>
      <p className="font-label text-sm text-on-surface-variant mb-10">Finished or archived projects.</p>

      <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
        {archived.length === 0 ? (
          <p className="font-label text-sm text-on-surface-variant">No archived projects yet.</p>
        ) : (
          <div className="space-y-3">
            {archived.map((book) => (
              <div key={book.id} className="rounded-lg p-4 hover:bg-surface-container-low transition-colors border border-transparent hover:border-outline-variant/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="font-body text-2xl italic text-primary">{book.title}</p>
                    <p className="font-label text-[11px] uppercase tracking-wide text-on-surface-variant mt-1">
                      Status: {String(book.status).replace('_', ' ')} • {book.chapter_count || 0} chapters • {book.word_count || 0} words • {formatDate(book.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreMutation.mutate(book.id)}
                      disabled={restoreMutation.isPending}
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:bg-secondary hover:text-white transition-colors disabled:opacity-50"
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
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-error shadow-sm hover:bg-error hover:text-white transition-colors disabled:opacity-50"
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
