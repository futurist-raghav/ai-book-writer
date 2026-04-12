'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useBookStore } from '@/stores/book-store';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loading, Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { calculateReadingLevel, calculateWritingStreak } from '@/lib/writing-metrics';
import { WritingGoalsWidget } from '@/components/writing-goals-widget';
import { ManuscriptHealthWidget } from '@/components/manuscript-health-widget';

export default function ProjectOverviewPage() {
  const queryClient = useQueryClient();
  const { selectedBook, selectBook } = useBookStore();
  const [introDraft, setIntroDraft] = useState('');
  const [exportFormat, setExportFormat] = useState('docx');
  const [synopsisLength, setSynopsisLength] = useState<'one_page' | 'three_page' | 'full'>('one_page');
  const [synopsisDraft, setSynopsisDraft] = useState('');

  const {
    data: booksData,
    isLoading: booksLoading,
    isError: booksError,
    error: booksErrorValue,
    refetch: refetchBooks,
  } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiClient.books.list({ limit: 50 }),
  });

  useEffect(() => {
    const books = booksData?.data?.items || [];
    if (!books.length) {
      if (selectedBook) {
        selectBook(null);
      }
      return;
    }

    const activeBooks = books.filter((candidate: any) => ['in_progress', 'review'].includes(String(candidate.status)));
    const selectedInList = selectedBook
      ? books.find((candidate: any) => candidate.id === selectedBook.id)
      : null;

    if (selectedInList && String(selectedInList.status) !== 'draft') {
      return;
    }

    if (activeBooks.length) {
      selectBook(activeBooks[0]);
      return;
    }

    if (selectedBook) {
      selectBook(null);
    }
  }, [booksData, selectedBook, selectBook]);

  const book = selectedBook;

  const {
    data: bookDetailsData,
    isLoading: bookDetailsLoading,
    isError: bookDetailsError,
    error: bookDetailsErrorValue,
    refetch: refetchBookDetails,
  } = useQuery({
    queryKey: ['book', book?.id],
    queryFn: () => apiClient.books.get(book!.id),
    enabled: !!book?.id,
  });

  // Call all hooks BEFORE any early returns (Rules of Hooks)
  useEffect(() => {
    if (bookDetailsData?.data && book) {
      setIntroDraft(bookDetailsData.data.introduction || '');
    }
  }, [bookDetailsData, book]);

  useEffect(() => {
    const storedSynopsis = (bookDetailsData?.data?.project_metadata as any)?.generated_synopsis?.[synopsisLength]?.text || '';
    setSynopsisDraft(storedSynopsis);
  }, [bookDetailsData, synopsisLength]);

  const saveIntroMutation = useMutation({
    mutationFn: () => book ? apiClient.books.updateFrontMatter(book.id, { introduction: introDraft }) : Promise.reject(),
    onSuccess: () => {
      toast.success('Book introduction saved.');
      if (book) {
        queryClient.invalidateQueries({ queryKey: ['book', book.id] });
      }
    },
    onError: () => {
      toast.error('Failed to save introduction.');
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => book ? apiClient.books.export(book.id, exportFormat, { include_toc: true, include_front_matter: true }) : Promise.reject(),
    onSuccess: (response) => {
      const url = response?.data?.download_url;
      toast.success(`Export queued in ${exportFormat.toUpperCase()}.`);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    onError: () => {
      toast.error('Book export failed.');
    },
  });

  const generateSynopsisMutation = useMutation({
    mutationFn: () => book ? apiClient.books.generateSynopsis(book.id, { length: synopsisLength }) : Promise.reject(),
    onSuccess: (response) => {
      const synopsis = response?.data?.synopsis;
      if (typeof synopsis === 'string') {
        setSynopsisDraft(synopsis);
      }
      toast.success('Project synopsis generated.');
      if (book) {
        queryClient.invalidateQueries({ queryKey: ['book', book.id] });
      }
    },
    onError: () => {
      toast.error('Failed to generate synopsis.');
    },
  });

  // Now safe to have early returns after all hooks are defined
  if (booksLoading) {
    return <Loading message="Loading project..." />;
  }

  if (booksError) {
    return (
      <div className="max-w-6xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load projects"
          error={booksErrorValue}
          onRetry={() => void refetchBooks()}
        />
      </div>
    );
  }

  const bookDetails = bookDetailsData?.data;
  const aiEnhancementEnabled = Boolean((book as any)?.ai_enhancement_enabled ?? bookDetails?.ai_enhancement_enabled);
  const chapters = bookDetails?.chapters?.sort((a: any, b: any) => a.order_index - b.order_index).map((c: any) => c.chapter) || [];
  const tags = Array.isArray(bookDetails?.tags) ? bookDetails.tags : [];
  const contextBrief = bookDetails?.project_context || bookDetails?.description;
  const knownEntityNames = (() => {
    const settings = (bookDetails?.project_settings as Record<string, unknown>) || {};
    const unifiedEntities = Array.isArray(settings.entities) ? settings.entities : [];
    const characters = Array.isArray(settings.characters) ? settings.characters : [];
    const worldEntities = Array.isArray(settings.world_entities) ? settings.world_entities : [];
    const entityPool = unifiedEntities.length > 0 ? unifiedEntities : [...characters, ...worldEntities];
    const names = new Set<string>();

    for (const entity of entityPool) {
      const entityName = String(entity?.name || '').trim();
      if (entityName) {
        names.add(entityName);
      }

      if (Array.isArray(entity?.aliases)) {
        for (const alias of entity.aliases) {
          const aliasName = String(alias || '').trim();
          if (aliasName) {
            names.add(aliasName);
          }
        }
      }
    }

    return [...names];
  })();

  // Calculate writing stats
  const eventCount = Number((bookDetails as any)?.event_count ?? (book as any)?.event_count ?? 0);
  const totalWordCount = bookDetails?.word_count || book?.word_count || 0;
  const averageWordsPerChapter = book.chapter_count > 0 ? Math.round((book.word_count || 0) / book.chapter_count) : 0;
  const averageMinutesPerChapter = book.chapter_count > 0 ? Math.round((Math.ceil(totalWordCount / 200) * 60) / book.chapter_count) : 0;
  const progress = bookDetails?.target_word_count 
    ? Math.round((totalWordCount / bookDetails.target_word_count) * 100)
    : null;
  const readingTime = Math.ceil(totalWordCount / 200); // Average 200 words per minute
  const readingLevel = calculateReadingLevel(
    chapters
      .map((ch: any) => ch.compiled_content || '')
      .join(' ')
  );
  const chapterEditDates = chapters
    .map((chapter: any) => chapter.updated_at || chapter.created_at)
    .filter((date: any): date is string => Boolean(date));
  const chapterEditTimestamps = chapterEditDates
    .map((date) => new Date(date).getTime())
    .filter((value) => Number.isFinite(value));
  const mostRecentChapterEdit = chapterEditTimestamps.length > 0
    ? new Date(Math.max(...chapterEditTimestamps))
    : null;
  const { streak: writingStreak } = calculateWritingStreak(chapterEditDates);
  const maxChapterWordCount = chapters.reduce(
    (max: number, chapter: any) => Math.max(max, Number(chapter.word_count || 0)),
    0
  );
  const synopsisMeta = ((bookDetails?.project_metadata as any)?.generated_synopsis || {})[synopsisLength] || null;
  const synopsisLengthLabel =
    synopsisLength === 'one_page'
      ? '1 Page'
      : synopsisLength === 'three_page'
        ? '3 Pages'
        : 'Full';

  if (!book) {
    return (
      <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center mt-8">
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-6">
          <span className="material-symbols-outlined text-3xl">book</span>
        </div>
        <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No active project selected</h3>
        <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed mb-8">
          Select an active project from Projects. Drafts and archived items are intentionally excluded from the current manuscript workspace.
        </p>
        <Link href="/dashboard/books" className="bg-surface-container-lowest border border-outline-variant/20 text-primary px-6 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95">
          Select Project
        </Link>
      </div>
    );
  }

  if (bookDetailsError) {
    return (
      <div className="max-w-6xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load project details"
          error={bookDetailsErrorValue}
          onRetry={() => void refetchBookDetails()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Hero Title Area (Asymmetric Layout) */}
      <div className="mb-20 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
        <div className="md:col-span-8">
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-4">Project Overview</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body">
            {book.title}
          </h2>
        </div>
        <div className="md:col-span-4 flex flex-col items-start md:items-end pb-2">
          <div className="flex items-center gap-3 bg-surface-container-low p-2 px-4 rounded-full border border-white/40 shadow-sm" title="Project Level AI Wording Preference">
            <span className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">AI Enhancement</span>
            <div className={`w-10 h-5 rounded-full relative shadow-inner ${aiEnhancementEnabled ? 'bg-secondary' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${aiEnhancementEnabled ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Writing Statistics Dashboard */}
      <div className="mb-12 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl p-6 border border-secondary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-secondary text-2xl">description</span>
            <span className="font-label text-[10px] text-secondary font-bold uppercase tracking-widest">Word Count</span>
          </div>
          <p className="text-3xl font-body font-semibold text-primary">{(bookDetails?.word_count || book?.word_count || 0).toLocaleString()}</p>
          <p className="text-[11px] text-on-surface-variant mt-2">
            {bookDetails?.target_word_count ? `${progress}% of ${bookDetails.target_word_count.toLocaleString()} words` : 'No target set'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-tertiary/10 to-tertiary/5 rounded-xl p-6 border border-tertiary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-tertiary text-2xl">menu_book</span>
            <span className="font-label text-[10px] text-tertiary font-bold uppercase tracking-widest">Chapters</span>
          </div>
          <p className="text-3xl font-body font-semibold text-primary">{book.chapter_count}</p>
          <p className="text-[11px] text-on-surface-variant mt-2">
            {chapters.length > 0 ? `Avg ${averageWordsPerChapter} words/chapter` : 'No chapters yet'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-primary-container/10 to-primary-container/5 rounded-xl p-6 border border-primary-container/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-primary-container text-2xl">schedule</span>
            <span className="font-label text-[10px] text-primary-container font-bold uppercase tracking-widest">Reading Time</span>
          </div>
          <p className="text-3xl font-body font-semibold text-primary">{readingTime}h</p>
          <p className="text-[11px] text-on-surface-variant mt-2">
            ~{averageMinutesPerChapter} min per chapter
          </p>
        </div>

        <div className="bg-gradient-to-br from-error/10 to-error/5 rounded-xl p-6 border border-error/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-error text-2xl">dataset</span>
            <span className="font-label text-[10px] text-error font-bold uppercase tracking-widest">Story Beats</span>
          </div>
          <p className="text-3xl font-body font-semibold text-primary">{eventCount}</p>
          <p className="text-[11px] text-on-surface-variant mt-2">
            Plot events & notes captured
          </p>
        </div>
      </div>

      {/* Reading Level & Manuscript Stats */}
      <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl p-6 border border-secondary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-secondary text-2xl">analytics</span>
            <span className="font-label text-[10px] text-secondary font-bold uppercase tracking-widest">Reading Level</span>
          </div>
          <p className="text-2xl font-body font-semibold text-primary">
            {readingLevel.charAt(0).toUpperCase() + readingLevel.slice(1).replace('_', ' ')}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-2">
            {readingLevel === 'elementary' && 'Great for younger readers (K-3 grade)'}
            {readingLevel === 'middle_school' && 'Suitable for middle school readers (4-6 grade)'}
            {readingLevel === 'high_school' && 'Suitable for high school readers (7-9 grade)'}
            {readingLevel === 'college' && 'Suitable for college-level readers (10-12 grade)'}
            {readingLevel === 'professional' && 'Suitable for professional/academic readers (13+ grade)'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-tertiary/10 to-tertiary/5 rounded-xl p-6 border border-tertiary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-tertiary text-2xl">info</span>
            <span className="font-label text-[10px] text-tertiary font-bold uppercase tracking-widest">Manuscript Info</span>
          </div>
          <div className="space-y-2">
            <p className="text-sm"><span className="font-bold">Total Reading Time:</span> ~{readingTime} hours</p>
            <p className="text-sm"><span className="font-bold">Average Chapter:</span> ~{averageWordsPerChapter} words</p>
            <p className="text-sm"><span className="font-bold">Estimated Pages:</span> ~{Math.round((book.word_count || 0) / 250)} (250 words/page)</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-primary text-2xl">local_fire_department</span>
            <span className="font-label text-[10px] text-primary font-bold uppercase tracking-widest">Writing Streak</span>
          </div>
          <p className="text-2xl font-body font-semibold text-primary">
            {writingStreak} day{writingStreak === 1 ? '' : 's'}
          </p>
          <div className="text-[11px] text-on-surface-variant mt-2 space-y-1">
            <p>{writingStreak > 0 ? 'Keep the momentum going.' : 'Write today to start a streak.'}</p>
            <p>
              {mostRecentChapterEdit
                ? `Last chapter edit: ${formatDate(mostRecentChapterEdit.toISOString())}`
                : 'No chapter edits yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Writing Goals Widget */}
      <div className="mb-12">
        <WritingGoalsWidget 
          dailyTarget={(bookDetails?.project_settings as any)?.daily_writing_goal || 0}
          wordCountToday={0}
          lastEditDates={chapterEditDates}
        />
      </div>

      {/* Manuscript Health Widget */}
      <div className="mb-12">
        <ManuscriptHealthWidget chapters={chapters} knownEntityNames={knownEntityNames} />
      </div>

      {/* Synopsis Generator */}
      <div className="mb-12 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">Project Synopsis</p>
            <p className="text-xs text-on-surface-variant mt-1">
              Generate pitch-ready synopsis drafts in multiple lengths.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={synopsisLength}
              onChange={(event) => setSynopsisLength(event.target.value as 'one_page' | 'three_page' | 'full')}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs font-label uppercase tracking-wide text-on-surface"
            >
              <option value="one_page">1 Page</option>
              <option value="three_page">3 Pages</option>
              <option value="full">Full</option>
            </select>
            <button
              onClick={() => generateSynopsisMutation.mutate()}
              disabled={generateSynopsisMutation.isPending || chapters.length === 0}
              className="rounded-lg bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-wide text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generateSynopsisMutation.isPending ? 'Generating...' : `Generate ${synopsisLengthLabel}`}
            </button>
          </div>
        </div>

        {synopsisMeta?.generated_at ? (
          <p className="mb-3 text-[11px] text-on-surface-variant">
            Last generated: {formatDate(synopsisMeta.generated_at)}
            {typeof synopsisMeta.chapter_count === 'number' ? ` using ${synopsisMeta.chapter_count} chapter(s)` : ''}
          </p>
        ) : null}

        {chapters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant/30 p-4 text-sm text-on-surface-variant">
            Add at least one chapter to generate a project synopsis.
          </div>
        ) : synopsisDraft ? (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-outline-variant/20 bg-surface-container-high/30 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{synopsisDraft}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/30 p-4 text-sm text-on-surface-variant">
            No synopsis generated for this length yet.
          </div>
        )}
      </div>

      {/* Chapter Word Count Breakdown */}
      <div className="mb-12 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-widest text-primary">Chapter Word Breakdown</p>
            <p className="text-xs text-on-surface-variant mt-1">Compare chapter lengths and balance manuscript pacing.</p>
          </div>
          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">
            {chapters.length} chapters
          </span>
        </div>

        {chapters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant/30 p-6 text-sm text-on-surface-variant">
            Add chapters to see word-count distribution.
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chapter: any) => {
              const chapterWordCount = Number(chapter.word_count || 0);
              const relativeWidth = maxChapterWordCount > 0
                ? Math.max(2, Math.round((chapterWordCount / maxChapterWordCount) * 100))
                : 0;
              const shareOfBook = totalWordCount > 0
                ? Math.round((chapterWordCount / totalWordCount) * 100)
                : 0;

              return (
                <div key={chapter.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-primary truncate">{chapter.title}</p>
                    <p className="text-xs text-on-surface-variant whitespace-nowrap">
                      {chapterWordCount.toLocaleString()} words ({shareOfBook}%)
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
                      style={{ width: `${relativeWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Themes & Settings */}
        <div className="md:col-span-4 flex flex-col gap-8">
          {/* Context Brief Card */}
          <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden group min-h-[250px]">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-6xl">temp_preferences_custom</span>
            </div>
            <h3 className="font-label text-xs font-extrabold uppercase tracking-widest text-primary-container mb-6">Context Brief</h3>
            <div className="space-y-6 relative z-10">
              <div>
                <p className="font-label text-[10px] text-on-surface-variant font-bold mb-2">Core Themes</p>
                <div className="flex flex-wrap gap-2">
                  {tags.length > 0 ? (
                    tags.map((tag: string) => (
                      <span key={tag} className="px-3 py-1 bg-secondary-container text-on-secondary-fixed-variant text-[10px] font-bold rounded-full font-label">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-full font-label">
                      No themes yet
                    </span>
                  )}
                </div>
              </div>
              {contextBrief ? (
                <p className="text-sm italic leading-relaxed text-on-surface-variant opacity-80">
                  "{contextBrief}"
                </p>
              ) : (
                <p className="text-sm italic leading-relaxed text-on-surface-variant opacity-60">
                  Add project context in Manage Projects to guide chapter drafting and AI rewrites.
                </p>
              )}
            </div>
          </div>

          {/* Project Settings CTA */}
          <Link href="/dashboard/books" className="w-full group bg-surface-container-highest hover:bg-surface-container-lowest transition-all p-6 rounded-xl flex items-center justify-between border border-transparent hover:border-outline-variant/15">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-white flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined">settings</span>
              </div>
              <div className="text-left">
                <p className="font-label text-sm font-bold text-primary">Project Settings</p>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Customize & organize</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>

          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 space-y-4">
            <h3 className="font-label text-xs font-extrabold uppercase tracking-widest text-primary">Book Introduction</h3>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px]"
              value={introDraft}
              onChange={(event) => setIntroDraft(event.target.value)}
              placeholder="Write the opening introduction that appears before your chapters."
            />
            <button
              type="button"
              disabled={saveIntroMutation.isPending}
              onClick={() => saveIntroMutation.mutate()}
              className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
            >
              {saveIntroMutation.isPending ? <Spinner className="w-3 h-3 mr-1 inline-block" /> : null}
              Save Introduction
            </button>
          </div>
        </div>

        {/* Right Column: Manuscript Structure */}
        <div className="md:col-span-8">
          <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10 min-h-[100%]">
            <div className="flex justify-between items-center mb-12">
              <h3 className="font-label text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Table Of Contents</h3>
              <span className="font-label text-[10px] text-on-surface-variant opacity-60">
                {book.chapter_count} Chapters • {book.word_count.toLocaleString()} words
              </span>
            </div>

            <div className="mb-8 rounded-lg border border-outline-variant/10 p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-label text-xs font-bold text-primary uppercase tracking-wider">Book Export</p>
                <p className="text-xs text-on-surface-variant">Export this selected project with TOC and front-matter.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value)}
                >
                  <option value="docx">DOCX (Word)</option>
                  <option value="pdf">PDF (Print-ready)</option>
                  <option value="epub">EPUB (E-reader)</option>
                  <option value="html">HTML (Web)</option>
                  <option value="markdown">Markdown</option>
                  <option value="fountain">Fountain (Screenwriting)</option>
                  <option value="txt">Plain Text</option>
                </select>
                <button
                  type="button"
                  disabled={exportMutation.isPending}
                  onClick={() => exportMutation.mutate()}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {exportMutation.isPending ? <Spinner className="w-3 h-3 mr-1 inline-block" /> : null}
                  Export Book
                </button>
              </div>
            </div>

            {bookDetailsLoading ? (
              <div className="py-12 flex justify-center"><Spinner className="w-6 h-6 text-primary" /></div>
            ) : (
              <div className="space-y-4">
                {chapters.length === 0 ? (
                  <div className="text-center py-10 opacity-60">
                    <p className="font-body italic text-lg text-primary">No chapters mapped to this project yet.</p>
                  </div>
                ) : (
                  chapters.map((chapter: any, idx: number) => (
                    <Link key={chapter.id} href={`/dashboard/chapters/${chapter.id}`} className="group flex items-center justify-between p-6 rounded-lg hover:bg-surface-container-low transition-all cursor-pointer border border-transparent hover:border-outline-variant/10">
                      <div className="flex items-center gap-6">
                        <span className="font-label text-xs font-medium text-on-surface-variant opacity-40 w-6">
                          {chapter.chapter_number.toString().padStart(2, '0')}
                        </span>
                        <div>
                          <h4 className="text-xl font-body italic text-primary group-hover:text-secondary transition-colors">{chapter.title}</h4>
                          <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                            {chapter.word_count} words • Updated {formatDate(chapter.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-on-surface-variant hover:text-primary">edit_note</span>
                      </div>
                    </Link>
                  ))
                )}

                {/* New Chapter CTA */}
                <Link href="/dashboard/chapters" className="mt-8 border-2 border-dashed border-outline-variant/30 rounded-lg p-10 flex flex-col items-center justify-center text-center group hover:border-secondary/40 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-4 group-hover:bg-secondary-container group-hover:text-on-secondary-container transition-all">
                    <span className="material-symbols-outlined">add</span>
                  </div>
                  <p className="font-label text-xs font-bold text-primary uppercase tracking-widest">New Chapter</p>
                  <p className="font-label text-[10px] text-on-surface-variant mt-2 max-w-[180px]">Expand your manuscript with a fresh chapter</p>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
