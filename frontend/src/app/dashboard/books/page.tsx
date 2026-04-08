'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
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

const ACTIVE_STATUSES = ['in_progress', 'review'];
const ARCHIVED_STATUSES = ['archived', 'completed', 'published'];

type ViewFilter = 'active' | 'archived' | 'drafts';
type SortBy = 'updated_at' | 'created_at' | 'word_count' | 'title';

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
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const statusFilter = statusFilterForView(viewFilter);
  const apiSortBy = toApiSortBy(sortBy);

  const { data, isLoading } = useQuery({
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
    router.push('/dashboard');
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
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
                <option value="novel">Novel</option>
                <option value="short_story">Short Story</option>
                <option value="screenplay">Screenplay</option>
                <option value="technical_manual">Technical Manual</option>
                <option value="academic_paper">Academic Paper</option>
                <option value="poetry_collection">Poetry Collection</option>
                <option value="blog_series">Blog Series</option>
                <option value="custom">Custom</option>
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
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No projects to show</h3>
          <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed mb-8">
            {viewFilter === 'active'
              ? 'No active projects found. Create one or restore from archived projects.'
              : viewFilter === 'archived'
                ? 'No archived projects found. Archive a project to see it here.'
                : 'No draft projects found. Create a draft idea to continue later.'}
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-surface-container-lowest border border-outline-variant/20 text-primary px-6 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-label text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Project Catalog</h3>
            <span className="font-label text-[10px] text-on-surface-variant opacity-60">{totalProjects} items • page {page} of {Math.max(totalPages, 1)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProjects.map((book) => {
              const archived = ARCHIVED_STATUSES.includes(String(book.status));
              const progress = getProgress(book);
              const lastEdited = book.updated_at ? new Date(book.updated_at) : new Date(book.created_at);
              const daysAgo = Math.floor((new Date().getTime() - lastEdited.getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={book.id} className="group relative rounded-2xl overflow-hidden bg-white border border-outline-variant/10 hover:border-secondary/30 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col h-full">
                  {/* Header with cover color/image */}
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
                    
                    {/* Pinned badge */}
                    {book.is_pinned && (
                      <div className="absolute top-2 right-2 bg-secondary text-white px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">keep</span>
                        <span className="text-[8px] font-bold uppercase">Pinned</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-5 flex flex-col">
                    <button 
                      onClick={() => handleOpenWorkspace(book)} 
                      className="text-left mb-3 group/title"
                    >
                      <h3 className="text-lg font-body italic text-primary group-hover/title:text-secondary transition-colors line-clamp-2">
                        {book.title}
                      </h3>
                    </button>

                    {/* Status badges */}
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

                    {/* Word count and last edited */}
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

                    {/* Progress bar */}
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

                    {/* Action buttons */}
                    <div className="flex gap-1.5 mt-auto pt-4 border-t border-outline-variant/10">
                      <button
                        onClick={() => handleOpenWorkspace(book)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-label font-bold text-[10px] uppercase tracking-tight transition-all active:scale-95"
                        title={archived ? 'View' : 'Open'}
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        {archived ? 'View' : 'Open'}
                      </button>

                      <button
                        onClick={() => duplicateMutation.mutate(book.id)}
                        disabled={duplicateMutation.isPending}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all disabled:opacity-50"
                        title="Duplicate"
                      >
                        {duplicateMutation.isPending && duplicateMutation.variables === book.id ? (
                          <Spinner className="w-4 h-4" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                        )}
                      </button>

                      {archived ? (
                        <button
                          onClick={() => restoreMutation.mutate(book.id)}
                          disabled={restoreMutation.isPending}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white transition-all disabled:opacity-50"
                          title="Restore"
                        >
                          {restoreMutation.isPending && restoreMutation.variables === book.id ? (
                            <Spinner className="w-4 h-4" />
                          ) : (
                            <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => archiveMutation.mutate(book.id)}
                          disabled={archiveMutation.isPending}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-all disabled:opacity-50"
                          title="Archive"
                        >
                          {archiveMutation.isPending && archiveMutation.variables === book.id ? (
                            <Spinner className="w-4 h-4" />
                          ) : (
                            <span className="material-symbols-outlined text-sm">inbox</span>
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
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-white transition-all disabled:opacity-50"
                        title="Delete"
                      >
                        {deleteMutation.isPending && deleteMutation.variables === book.id ? (
                          <Spinner className="w-4 h-4" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">delete</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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
