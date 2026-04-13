'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';

interface Book {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover_image_url?: string;
  cover_color?: string;
  project_type?: string;
  book_type?: string;
  genres?: string[];
  labels?: string[];
  target_word_count?: number;
  target_progress_percent?: number;
  deadline_at?: string;
  is_pinned?: boolean;
  chapter_count: number;
  word_count: number;
  status: string;
  created_at: string;
  updated_at?: string;
  auto_create_chapters?: number;
  ai_enhancement_enabled?: boolean;
}

interface CollaboratorPreview {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

const ACTIVE_STATUSES = ['in_progress', 'review'];
const ARCHIVED_STATUSES = ['archived', 'completed', 'published'];

type ViewFilter = 'active' | 'archived' | 'drafts';
type SortBy = 'updated_at' | 'created_at' | 'word_count' | 'title';
type CatalogView = 'cards' | 'list';

function csvToList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatStatus(status: string): string {
  return status.replace('_', ' ');
}

function deriveProjectType(book: Book): string {
  return book.project_type || book.book_type || 'general';
}

function derivePrimaryGenre(book: Book): string {
  if (Array.isArray(book.genres) && book.genres.length > 0) {
    return book.genres[0];
  }
  return 'unclassified';
}

function getProgress(book: Book): number | null {
  if (typeof book.target_progress_percent === 'number') {
    return Math.max(0, Math.min(100, Math.round(book.target_progress_percent)));
  }

  if (!book.target_word_count || book.target_word_count <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((book.word_count / book.target_word_count) * 100)));
}

function statusFilterForView(view: ViewFilter): string {
  if (view === 'active') return ACTIVE_STATUSES.join(',');
  if (view === 'archived') return ARCHIVED_STATUSES.join(',');
  return 'draft';
}

function toApiSortBy(sortBy: SortBy): 'updated_at' | 'created_at' | 'title' | 'status' {
  if (sortBy === 'created_at') return 'created_at';
  if (sortBy === 'title') return 'title';
  return 'updated_at';
}

function getCollaboratorInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'C';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function normalizeCollaboratorItems(payload: unknown): CollaboratorPreview[] {
  const root = payload as Record<string, unknown> | null;
  const nestedData = (root?.data as Record<string, unknown> | undefined) || undefined;

  const rawItems =
    (Array.isArray(root?.items) ? root?.items : undefined) ||
    (Array.isArray(nestedData?.items) ? nestedData?.items : undefined) ||
    (Array.isArray(nestedData?.data) ? nestedData?.data : undefined) ||
    (Array.isArray(root?.data) ? (root?.data as unknown[]) : undefined) ||
    [];

  return rawItems
    .map((item, index) => {
      const value = item as Record<string, unknown>;
      const nameCandidate =
        (typeof value.user_name === 'string' && value.user_name) ||
        (typeof value.name === 'string' && value.name) ||
        (typeof value.user_email === 'string' && value.user_email) ||
        (typeof value.email === 'string' && value.email) ||
        '';

      const name = nameCandidate.trim();
      if (!name) return null;

      return {
        id: String(value.id || value.user_id || `collaborator-${index}`),
        name,
        email:
          (typeof value.user_email === 'string' && value.user_email) ||
          (typeof value.email === 'string' && value.email) ||
          undefined,
        role: typeof value.role === 'string' ? value.role : undefined,
      } as CollaboratorPreview;
    })
    .filter((item): item is CollaboratorPreview => Boolean(item));
}

export default function BooksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectBook } = useBookStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [autoChapters, setAutoChapters] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [createAsDraft, setCreateAsDraft] = useState(false);
  const [newProjectType, setNewProjectType] = useState('novel');
  const [newGenresCsv, setNewGenresCsv] = useState('');
  const [targetWordCount, setTargetWordCount] = useState('');
  const [pinOnCreate, setPinOnCreate] = useState(false);

  const [viewFilter, setViewFilter] = useState<ViewFilter>('active');
  const [sortBy, setSortBy] = useState<SortBy>('updated_at');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogView, setCatalogView] = useState<CatalogView>('cards');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const statusFilter = statusFilterForView(viewFilter);
  const apiSortBy = toApiSortBy(sortBy);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['books', 'list', viewFilter, sortBy, projectTypeFilter, genreFilter, page, pageSize],
    queryFn: () =>
      apiClient.books.list({
        page,
        limit: pageSize,
        status: statusFilter,
        project_type: projectTypeFilter !== 'all' ? projectTypeFilter : undefined,
        genre: genreFilter !== 'all' ? genreFilter : undefined,
        sort_by: apiSortBy,
        sort_order: 'desc',
      }),
  });

  useEffect(() => {
    setPage(1);
  }, [viewFilter, sortBy, projectTypeFilter, genreFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem('projects-catalog-view');
    if (saved === 'cards' || saved === 'list') {
      setCatalogView(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('projects-catalog-view', catalogView);
  }, [catalogView]);

  const { data: statusCounts } = useQuery({
    queryKey: ['books', 'status-counts'],
    queryFn: async () => {
      const [active, archived, drafts] = await Promise.all([
        apiClient.books.list({ limit: 1, status: ACTIVE_STATUSES.join(',') }),
        apiClient.books.list({ limit: 1, status: ARCHIVED_STATUSES.join(',') }),
        apiClient.books.list({ limit: 1, status: 'draft' }),
      ]);

      return {
        active: active.data?.total ?? 0,
        archived: archived.data?.total ?? 0,
        drafts: drafts.data?.total ?? 0,
      };
    },
  });

  const currentPageBooks = ((data?.data?.items || []) as Book[]).filter((book) => Boolean(book?.id));
  const currentPageBookIds = currentPageBooks.map((book) => book.id).sort().join(',');

  const { data: collaboratorPreviewsByBook = {} } = useQuery({
    queryKey: ['books', 'collaborator-previews', currentPageBookIds],
    enabled: currentPageBooks.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        currentPageBooks.map(async (book) => {
          try {
            const response = await apiClient.collaboration.membersByBook(book.id, {
              page: 1,
              limit: 6,
              accepted_only: true,
            });
            return [book.id, normalizeCollaboratorItems(response.data)] as const;
          } catch {
            return [book.id, [] as CollaboratorPreview[]] as const;
          }
        })
      );

      return Object.fromEntries(entries) as Record<string, CollaboratorPreview[]>;
    },
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      auto_create_chapters: number;
      ai_enhancement_enabled: boolean;
      status: string;
      project_type?: string;
      book_type?: string;
      genres?: string[];
      target_word_count?: number;
      is_pinned?: boolean;
    }) =>
      apiClient.books.create(payload),
    onSuccess: () => {
      toast.success(createAsDraft ? 'Draft idea created' : 'Main project created');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setIsCreating(false);
      setNewBookTitle('');
      setAutoChapters(0);
      setAiEnabled(true);
      setCreateAsDraft(false);
      setNewGenresCsv('');
      setTargetWordCount('');
      setPinOnCreate(false);
    },
    onError: () => {
      toast.error('Failed to create project');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.delete(id),
    onSuccess: () => {
      toast.success('Project deleted');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => {
      toast.error('Failed to delete project');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.archive(id),
    onSuccess: () => {
      toast.success('Project archived');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => {
      toast.error('Failed to archive project');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.restore(id),
    onSuccess: () => {
      toast.success('Project restored to active');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => {
      toast.error('Failed to restore project');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiClient.books.duplicate(id),
    onSuccess: () => {
      toast.success('Project duplicated');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => {
      toast.error('Failed to duplicate project');
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) => apiClient.books.pin(id, isPinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: () => {
      toast.error('Failed to update pin status');
    },
  });

  const handleCreateBook = () => {
    if (!newBookTitle.trim()) return;

    const parsedTarget = targetWordCount.trim() ? parseInt(targetWordCount.trim(), 10) : undefined;

    createMutation.mutate({
      title: newBookTitle.trim(),
      auto_create_chapters: autoChapters,
      ai_enhancement_enabled: aiEnabled,
      status: createAsDraft ? 'draft' : 'in_progress',
      project_type: newProjectType,
      book_type: newProjectType,
      genres: csvToList(newGenresCsv),
      target_word_count: parsedTarget && !Number.isNaN(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined,
      is_pinned: pinOnCreate,
    });
  };

  const handleOpenWorkspace = (book: Book) => {
    selectBook(book as any);
    if (typeof window !== 'undefined') {
      window.location.assign('/dashboard');
      return;
    }
    router.push('/dashboard');
  };

  const handleContinueWriting = async (book: Book) => {
    if (book.chapter_count === 0) {
      toast.error('No chapters yet. Create one to start writing.');
      return;
    }

    try {
      // Fetch chapters in pages (API enforces limit <= 100).
      const allChapters: any[] = [];
      const maxPages = 5;
      for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
        const chaptersResponse = await apiClient.chapters.list({ page: currentPage, limit: 100 });
        const pageItems = chaptersResponse.data?.items || [];
        allChapters.push(...pageItems);

        const totalPages = chaptersResponse.data?.pages || currentPage;
        if (currentPage >= totalPages || pageItems.length === 0) {
          break;
        }
      }
      
      // Filter chapters for this book and sort by updated_at descending
      const bookChapters = allChapters
        .filter((chapter: any) => 
          chapter.projects?.some((project: any) => project.id === book.id)
        )
        .sort((a: any, b: any) => {
          const aTime = new Date(a.updated_at || a.created_at).getTime();
          const bTime = new Date(b.updated_at || b.created_at).getTime();
          return bTime - aTime; // Most recent first
        });

      if (bookChapters.length === 0) {
        toast.error('No chapters found for this project.');
        return;
      }

      const lastChapter = bookChapters[0];
      selectBook(book as any);
      if (typeof window !== 'undefined') {
        window.location.assign(`/dashboard/chapters/${lastChapter.id}`);
        return;
      }
      router.push(`/dashboard/chapters/${lastChapter.id}`);
    } catch {
      toast.error('Failed to find last chapter. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load projects"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const books: Book[] = data?.data?.items || [];
  const totalProjects = data?.data?.total ?? 0;
  const totalPages = data?.data?.pages ?? 1;

  const projectTypeOptions = Array.from(new Set(books.map((book) => deriveProjectType(book)).filter(Boolean))).sort();
  const genreOptions = Array.from(
    new Set(
      books
        .flatMap((book) => (Array.isArray(book.genres) ? book.genres : []))
        .filter(Boolean)
    )
  ).sort();

  // Apply search filter locally
  const searchFilteredProjects = searchQuery.trim()
    ? books.filter((book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.subtitle && book.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.description && book.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : books;

  const visibleProjects =
    sortBy === 'word_count'
      ? [...searchFilteredProjects].sort((a, b) => {
          if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
            return a.is_pinned ? -1 : 1;
          }
          return b.word_count - a.word_count;
        })
      : searchFilteredProjects;

  const renderProjectActions = (book: Book, className: string, compact = false) => {
    const archived = ARCHIVED_STATUSES.includes(String(book.status));
    const actionTextClass = compact ? 'text-[9px]' : 'text-[10px]';
    const iconClass = compact ? 'text-xs' : 'text-sm';
    const iconButtonSize = compact ? 'w-9 h-9' : 'w-10 h-10';

    return (
      <div className={className}>
        <button
          onClick={() => handleContinueWriting(book)}
          disabled={book.chapter_count === 0}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white font-label font-bold uppercase tracking-tight transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${actionTextClass}`}
          title={book.chapter_count === 0 ? 'No chapters yet' : 'Continue to last chapter'}
        >
          <span className={`material-symbols-outlined ${iconClass}`}>auto_stories</span>
          Continue
        </button>

        <button
          onClick={() => handleOpenWorkspace(book)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-label font-bold uppercase tracking-tight transition-all active:scale-95 ${actionTextClass}`}
          title={archived ? 'View' : 'Open'}
        >
          <span className={`material-symbols-outlined ${iconClass}`}>edit</span>
          {archived ? 'View' : 'Open'}
        </button>

        <button
          onClick={() => duplicateMutation.mutate(book.id)}
          disabled={duplicateMutation.isPending}
          className={`${iconButtonSize} flex items-center justify-center rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all disabled:opacity-50`}
          title="Duplicate"
        >
          {duplicateMutation.isPending && duplicateMutation.variables === book.id ? (
            <Spinner className="w-4 h-4" />
          ) : (
            <span className={`material-symbols-outlined ${iconClass}`}>content_copy</span>
          )}
        </button>

        {archived ? (
          <button
            onClick={() => restoreMutation.mutate(book.id)}
            disabled={restoreMutation.isPending}
            className={`${iconButtonSize} flex items-center justify-center rounded-lg bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white transition-all disabled:opacity-50`}
            title="Restore"
          >
            {restoreMutation.isPending && restoreMutation.variables === book.id ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <span className={`material-symbols-outlined ${iconClass}`}>settings_backup_restore</span>
            )}
          </button>
        ) : (
          <button
            onClick={() => archiveMutation.mutate(book.id)}
            disabled={archiveMutation.isPending}
            className={`${iconButtonSize} flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-all disabled:opacity-50`}
            title="Archive"
          >
            {archiveMutation.isPending && archiveMutation.variables === book.id ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <span className={`material-symbols-outlined ${iconClass}`}>inbox</span>
            )}
          </button>
        )}

        <button
          onClick={() => {
            if (confirm('Delete this project permanently?')) {
              deleteMutation.mutate(book.id);
            }
          }}
          disabled={deleteMutation.isPending}
          className={`${iconButtonSize} flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all disabled:opacity-50`}
          title="Delete"
        >
          {deleteMutation.isPending && deleteMutation.variables === book.id ? (
            <Spinner className="w-4 h-4" />
          ) : (
            <span className={`material-symbols-outlined ${iconClass}`}>delete</span>
          )}
        </button>
      </div>
    );
  };

  const renderCollaboratorAvatars = (book: Book, compact = false) => {
    const collaborators = collaboratorPreviewsByBook[book.id] || [];
    if (collaborators.length === 0) {
      return null;
    }

    const visibleCollaborators = collaborators.slice(0, compact ? 3 : 4);
    const hiddenCount = Math.max(0, collaborators.length - visibleCollaborators.length);

    return (
      <div className={compact ? 'mt-2' : 'mb-3'}>
        <div className="flex items-center gap-2">
          <span className="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Collaborators</span>
          <div className="flex items-center -space-x-2">
            {visibleCollaborators.map((collab, index) => (
              <div
                key={collab.id}
                title={collab.email ? `${collab.name} (${collab.email})` : collab.name}
                className={`flex items-center justify-center rounded-full border border-surface-container-lowest bg-secondary/15 text-secondary font-label font-bold ${
                  compact ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]'
                }`}
                style={{ zIndex: visibleCollaborators.length - index }}
              >
                {getCollaboratorInitials(collab.name)}
              </div>
            ))}
            {hiddenCount > 0 ? (
              <div
                className={`flex items-center justify-center rounded-full border border-surface-container-lowest bg-surface-container-high text-on-surface-variant font-label font-bold ${
                  compact ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]'
                }`}
                title={`${hiddenCount} more collaborator${hiddenCount === 1 ? '' : 's'}`}
                style={{ zIndex: 0 }}
              >
                +{hiddenCount}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Project Selection</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body">Projects</h2>
          <p className="font-label text-sm text-on-surface-variant mt-4 max-w-2xl">
            Select which project to work on in the manuscript workspace. Archived projects can also be viewed from here.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="w-fit flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 rounded-lg font-label font-bold text-sm shadow-md hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">{isCreating ? 'close' : 'add'}</span>
          {isCreating ? 'Cancel' : 'New Project'}
        </button>
      </div>

      <div className="mb-8 bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-5 flex flex-col gap-4">
        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-lg">search</span>
          <input
            type="text"
            placeholder="Search projects by title..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-12 pr-4 py-3 font-body text-sm placeholder:text-on-surface-variant/50 focus:border-secondary focus:ring-secondary/20 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewFilter('active')}
            className={`px-4 py-2 rounded-lg font-label text-xs font-bold uppercase tracking-wider transition-colors ${
              viewFilter === 'active'
                ? 'bg-primary text-white'
                : 'bg-surface-container-high text-primary hover:bg-surface-container-low'
            }`}
          >
            Active ({statusCounts?.active ?? 0})
          </button>
          <button
            onClick={() => setViewFilter('archived')}
            className={`px-4 py-2 rounded-lg font-label text-xs font-bold uppercase tracking-wider transition-colors ${
              viewFilter === 'archived'
                ? 'bg-primary text-white'
                : 'bg-surface-container-high text-primary hover:bg-surface-container-low'
            }`}
          >
            Archived ({statusCounts?.archived ?? 0})
          </button>
          <button
            onClick={() => setViewFilter('drafts')}
            className={`px-4 py-2 rounded-lg font-label text-xs font-bold uppercase tracking-wider transition-colors ${
              viewFilter === 'drafts'
                ? 'bg-primary text-white'
                : 'bg-surface-container-high text-primary hover:bg-surface-container-low'
            }`}
          >
            Drafts ({statusCounts?.drafts ?? 0})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
            value={projectTypeFilter}
            onChange={(event) => setProjectTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {projectTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
            value={genreFilter}
            onChange={(event) => setGenreFilter(event.target.value)}
          >
            <option value="all">All genres</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>

          <select
            className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
          >
            <option value="updated_at">Sort: Last modified</option>
            <option value="created_at">Sort: Date created</option>
            <option value="word_count">Sort: Word count</option>
            <option value="title">Sort: Title</option>
          </select>

          <div className="inline-flex overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-high">
            <button
              type="button"
              onClick={() => setCatalogView('cards')}
              className={`flex items-center gap-1.5 px-3 py-2 font-label text-xs font-bold uppercase tracking-wider transition-colors ${
                catalogView === 'cards'
                  ? 'bg-primary text-white'
                  : 'text-primary hover:bg-surface-container-low'
              }`}
              aria-label="Card view"
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              Cards
            </button>
            <button
              type="button"
              onClick={() => setCatalogView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 font-label text-xs font-bold uppercase tracking-wider transition-colors ${
                catalogView === 'list'
                  ? 'bg-primary text-white'
                  : 'text-primary hover:bg-surface-container-low'
              }`}
              aria-label="List view"
            >
              <span className="material-symbols-outlined text-sm">view_list</span>
              List
            </button>
          </div>

          <Link href="/dashboard/drafts" className="px-4 py-2 rounded-lg border border-outline-variant/20 font-label text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors">
            Open Drafts
          </Link>
        </div>
      </div>

      {isCreating && (
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10 mb-10 transition-all">
          <div className="mb-6">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Create Project</h3>
            <p className="font-label text-xs text-on-surface-variant mt-1">Create an active project or save an idea as draft.</p>
          </div>

          <div className="grid md:grid-cols-[2fr_1fr_auto] gap-4 items-end">
            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Project Title</label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                placeholder="e.g., The Lost City"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBook()}
              />
            </div>

            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Auto-create chapters</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                value={autoChapters}
                onChange={(e) => setAutoChapters(parseInt(e.target.value, 10))}
              >
                <option value={0}>0 chapters</option>
                <option value={5}>5 chapters</option>
                <option value={10}>10 chapters</option>
                <option value={20}>20 chapters</option>
              </select>
            </div>

            <button
              onClick={handleCreateBook}
              disabled={createMutation.isPending || !newBookTitle.trim()}
              className="bg-secondary text-white px-8 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:bg-secondary/90 transition-all disabled:opacity-50 h-[46px] flex items-center justify-center"
            >
              {createMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Create
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Project Type</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label"
                value={newProjectType}
                onChange={(event) => setNewProjectType(event.target.value)}
              >
                <optgroup label="Fiction & Creative">
                  <option value="novel">Novel</option>
                  <option value="memoir">Memoir</option>
                  <option value="short_story_collection">Short Story Collection</option>
                  <option value="poetry_collection">Poetry Collection</option>
                  <option value="fanfiction">Fanfiction</option>
                  <option value="interactive_fiction">Interactive Fiction</option>
                </optgroup>
                <optgroup label="Screenplay & Visual">
                  <option value="screenplay">Screenplay</option>
                  <option value="tv_series_bible">TV Series Bible</option>
                  <option value="graphic_novel_script">Graphic Novel Script</option>
                  <option value="comic_script">Comic Script</option>
                </optgroup>
                <optgroup label="Audio & Music">
                  <option value="songwriting_project">Songwriting Project</option>
                  <option value="podcast_script">Podcast Script</option>
                  <option value="audiobook_script">Audiobook Script</option>
                </optgroup>
                <optgroup label="Academic & Research">
                  <option value="research_paper">Research Paper</option>
                  <option value="thesis_dissertation">Thesis/Dissertation</option>
                  <option value="k12_textbook">K-12 Textbook</option>
                  <option value="college_textbook">College Textbook</option>
                  <option value="academic_course">Academic Course</option>
                </optgroup>
                <optgroup label="Professional & Technical">
                  <option value="technical_documentation">Technical Documentation</option>
                  <option value="business_book">Business Book</option>
                  <option value="management_book">Management Book</option>
                  <option value="self_help_book">Self-Help Book</option>
                  <option value="legal_document">Legal Document</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="personal_journal">Personal Journal</option>
                  <option value="experimental">Experimental</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Genres</label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label"
                placeholder="fantasy, mystery"
                value={newGenresCsv}
                onChange={(event) => setNewGenresCsv(event.target.value)}
              />
            </div>

            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Target Word Count</label>
              <input
                type="number"
                min={1}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label"
                placeholder="80000"
                value={targetWordCount}
                onChange={(event) => setTargetWordCount(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group w-max">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <div className="w-5 h-5 border-2 border-outline-variant rounded transition-colors peer-checked:bg-secondary peer-checked:border-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-white opacity-0 peer-checked:opacity-100 font-bold">check</span>
                </div>
              </div>
              <span className="font-label text-xs text-on-surface-variant group-hover:text-primary transition-colors">Enable AI enhancement by default for this project</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group w-max">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={createAsDraft}
                  onChange={(e) => setCreateAsDraft(e.target.checked)}
                />
                <div className="w-5 h-5 border-2 border-outline-variant rounded transition-colors peer-checked:bg-secondary peer-checked:border-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-white opacity-0 peer-checked:opacity-100 font-bold">check</span>
                </div>
              </div>
              <span className="font-label text-xs text-on-surface-variant group-hover:text-primary transition-colors">Create as Draft idea instead of active project</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group w-max">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={pinOnCreate}
                  onChange={(event) => setPinOnCreate(event.target.checked)}
                />
                <div className="w-5 h-5 border-2 border-outline-variant rounded transition-colors peer-checked:bg-secondary peer-checked:border-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-white opacity-0 peer-checked:opacity-100 font-bold">check</span>
                </div>
              </div>
              <span className="font-label text-xs text-on-surface-variant group-hover:text-primary transition-colors">Pin this project when created</span>
            </label>
          </div>
        </div>
      )}

      {visibleProjects.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-6">
            <span className="material-symbols-outlined text-3xl">book</span>
          </div>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">{viewFilter === 'active' ? 'No active projects' : viewFilter === 'archived' ? 'No archived projects' : 'No draft projects'}</h3>
          <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed mb-8">
            {viewFilter === 'active'
              ? 'Get started by creating your first project. You can restore archived projects at any time.'
              : viewFilter === 'archived'
                ? 'No projects have been archived yet. Archive a project from the active list to see it here.'
                : 'No draft projects found. Create a draft idea to explore concepts before starting a full project.'}
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-primary text-white px-6 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:opacity-90 transition-all active:scale-95"
          >
            + Create Project
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-label text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Project Catalog</h3>
            <span className="font-label text-[10px] text-on-surface-variant opacity-60">{totalProjects} items • page {page} of {Math.max(totalPages, 1)}</span>
          </div>

          {catalogView === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleProjects.map((book) => {
                const progress = getProgress(book);
                const lastEdited = book.updated_at ? new Date(book.updated_at) : new Date(book.created_at);
                const daysAgo = Math.floor((new Date().getTime() - lastEdited.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={book.id} className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:border-secondary/35 hover:shadow-lg">
                    <div
                      className="h-24 w-full relative overflow-hidden bg-gradient-to-br flex items-center justify-center"
                      style={{
                        background: book.cover_color
                          ? `linear-gradient(135deg, ${book.cover_color}dd 0%, ${book.cover_color} 100%)`
                          : 'linear-gradient(135deg, #536878 0%, #8b9ba8 100%)'
                      }}
                    >
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 opacity-90">
                          <span className="material-symbols-outlined text-4xl text-white">auto_stories</span>
                          <span className="text-[10px] text-white font-bold uppercase tracking-wider">{book.status}</span>
                        </div>
                      )}

                      {book.is_pinned && (
                        <div className="absolute top-2 right-2 bg-secondary text-white px-2 py-1 rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">keep</span>
                          <span className="text-[8px] font-bold uppercase">Pinned</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-5 flex flex-col">
                      <button
                        onClick={() => handleOpenWorkspace(book)}
                        className="text-left mb-3 group/title"
                      >
                        <h3 className="text-lg font-body italic text-primary group-hover/title:text-secondary transition-colors line-clamp-2">
                          {book.title}
                        </h3>
                      </button>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="inline-block font-label text-[8px] text-on-secondary-container bg-secondary-container px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">
                          {deriveProjectType(book).replace('_', ' ')}
                        </span>
                        <span className="inline-block font-label text-[8px] text-on-tertiary-container bg-tertiary-container px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">
                          {derivePrimaryGenre(book)}
                        </span>
                        <span className="inline-block font-label text-[8px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">
                          {book.chapter_count} ch
                        </span>
                      </div>

                      {renderCollaboratorAvatars(book)}

                      <div className="mb-3 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-label text-on-surface-variant font-bold uppercase tracking-tight">Word Count</span>
                          <span className="font-body text-primary font-semibold">{book.word_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-label text-on-surface-variant font-bold uppercase tracking-tight">Last edited</span>
                          <span className="font-body text-on-surface-variant text-[10px]">
                            {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
                          </span>
                        </div>
                      </div>

                      {book.target_word_count && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-label text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Goal Progress</span>
                            <span className="font-label text-[10px] font-bold uppercase tracking-tight text-primary">{progress}%</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-secondary to-secondary-container transition-all duration-300"
                              style={{ width: `${progress || 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-on-surface-variant opacity-70 mt-1 block">
                            {Math.round((book.word_count / book.target_word_count) * 100)}% of {book.target_word_count.toLocaleString()} words
                          </span>
                        </div>
                      )}

                      {book.deadline_at && (
                        <div className="mb-4">
                          {(() => {
                            const deadline = new Date(book.deadline_at);
                            const now = new Date();
                            const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            const isOverdue = daysRemaining < 0;
                            const isUrgent = daysRemaining <= 7 && daysRemaining > 0;

                            return (
                              <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${
                                isOverdue ? 'bg-error/10' : isUrgent ? 'bg-error-container/50' : 'bg-tertiary-container/30'
                              }`}>
                                <span className="font-label text-[9px] font-bold uppercase tracking-tight text-on-surface-variant">Deadline</span>
                                <span className={`font-label text-[10px] font-bold uppercase tracking-tight ${
                                  isOverdue ? 'text-error' : isUrgent ? 'text-error-container' : 'text-tertiary'
                                }`}>
                                  {isOverdue
                                    ? `${Math.abs(daysRemaining)}d overdue`
                                    : daysRemaining === 0
                                      ? 'Today'
                                      : daysRemaining === 1
                                        ? 'Tomorrow'
                                        : `${daysRemaining}d left`
                                  }
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {renderProjectActions(book, 'flex gap-1.5 mt-auto pt-4 border-t border-outline-variant/10')}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleProjects.map((book) => {
                const progress = getProgress(book);
                const lastEdited = book.updated_at ? new Date(book.updated_at) : new Date(book.created_at);

                return (
                  <div key={book.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br"
                          style={{
                            background: book.cover_color
                              ? `linear-gradient(135deg, ${book.cover_color}dd 0%, ${book.cover_color} 100%)`
                              : 'linear-gradient(135deg, #536878 0%, #8b9ba8 100%)'
                          }}
                        >
                          {book.cover_image_url ? (
                            <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="material-symbols-outlined text-2xl text-white">auto_stories</span>
                            </div>
                          )}

                          {book.is_pinned ? (
                            <span className="absolute right-1 top-1 material-symbols-outlined text-sm text-white">keep</span>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <button onClick={() => handleOpenWorkspace(book)} className="text-left">
                            <h3 className="line-clamp-1 text-lg font-body italic text-primary hover:text-secondary transition-colors">
                              {book.title}
                            </h3>
                          </button>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-block rounded-full bg-secondary-container px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-tight text-on-secondary-container">
                              {deriveProjectType(book).replace('_', ' ')}
                            </span>
                            <span className="inline-block rounded-full bg-tertiary-container px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-tight text-on-tertiary-container">
                              {derivePrimaryGenre(book)}
                            </span>
                            <span className="inline-block rounded-full bg-surface-container-high px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-tight text-on-surface-variant">
                              {formatStatus(book.status)}
                            </span>
                          </div>

                          {renderCollaboratorAvatars(book, true)}

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
                            <span>{book.word_count.toLocaleString()} words</span>
                            <span>{book.chapter_count} chapters</span>
                            <span>Updated {formatDate(lastEdited.toISOString())}</span>
                          </div>

                          {book.target_word_count ? (
                            <div className="mt-2 max-w-xl">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="font-label text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Goal Progress</span>
                                <span className="font-label text-[10px] font-bold uppercase tracking-tight text-primary">{progress}%</span>
                              </div>
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-secondary to-secondary-container"
                                  style={{ width: `${progress || 0}%` }}
                                />
                              </div>
                            </div>
                          ) : null}

                          {book.deadline_at ? (
                            <div className="mt-2 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                              {(() => {
                                const deadline = new Date(book.deadline_at);
                                const now = new Date();
                                const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                                if (daysRemaining < 0) {
                                  return `Deadline: ${Math.abs(daysRemaining)}d overdue`;
                                }

                                if (daysRemaining === 0) {
                                  return 'Deadline: today';
                                }

                                if (daysRemaining === 1) {
                                  return 'Deadline: tomorrow';
                                }

                                return `Deadline: ${daysRemaining}d left`;
                              })()}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="xl:min-w-[320px]">
                        {renderProjectActions(book, 'flex flex-wrap justify-start xl:justify-end gap-1.5', true)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border border-outline-variant/20 text-xs font-label font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg border border-outline-variant/20 text-xs font-label font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
