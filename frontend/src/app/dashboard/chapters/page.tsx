'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';

interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  chapter_number: number;
  description?: string;
  chapter_type?: string;
  workflow_status?: string;
  word_count_target?: number;
  target_progress_percent?: number;
  timeline_position?: string;
  compiled_content?: string;
  ai_enhancement_enabled?: boolean;
  word_count: number;
  event_count: number;
  status: string;
  created_at: string;
  projects?: Array<{ id: string; title: string; order_index: number }>;
}

interface ProjectOption {
  id: string;
  title: string;
  status: string;
  ai_enhancement_enabled?: boolean;
}

function formatTag(value?: string): string {
  if (!value) return 'unspecified';
  return value.replaceAll('_', ' ');
}

function chapterProgress(chapter: Chapter): number | null {
  if (typeof chapter.target_progress_percent === 'number') {
    return Math.max(0, Math.min(100, Math.round(chapter.target_progress_percent)));
  }

  if (!chapter.word_count_target || chapter.word_count_target <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((chapter.word_count / chapter.word_count_target) * 100)));
}

export default function ChaptersPage() {
  const queryClient = useQueryClient();
  const { selectedBook, selectBook } = useBookStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(selectedBook?.id || '');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [chapterTypeFilter, setChapterTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['chapters', workflowFilter, chapterTypeFilter],
    queryFn: () =>
      apiClient.chapters.list({
        limit: 100,
        workflow_status: workflowFilter !== 'all' ? workflowFilter : undefined,
        chapter_type: chapterTypeFilter !== 'all' ? chapterTypeFilter : undefined,
      }),
  });

  const { data: booksData } = useQuery({
    queryKey: ['books', 'for-chapter-form'],
    queryFn: () => apiClient.books.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      chapter_number: number;
      projectId: string;
      aiEnhancementEnabled: boolean;
    }) => {
      const chapterResponse = await apiClient.chapters.create({
        title: payload.title,
        chapter_number: payload.chapter_number,
        ai_enhancement_enabled: payload.aiEnhancementEnabled,
      });

      await apiClient.books.addChapter(payload.projectId, chapterResponse.data.id);

      return chapterResponse;
    },
    onSuccess: () => {
      toast.success('Chapter project created');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setIsCreating(false);
      setNewChapterTitle('');
      setSelectedProjectId('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to create chapter');
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
    if (!selectedProjectId) {
      toast.error('Select a project first');
      return;
    }

    const chapters: Chapter[] = data?.data?.items || [];
    const nextNumber = Math.max(...chapters.map((chapter) => chapter.chapter_number), 0) + 1;
    const selectedProject = assignableProjects.find((project) => project.id === selectedProjectId);
    createMutation.mutate({
      title: newChapterTitle,
      chapter_number: nextNumber,
      projectId: selectedProjectId,
      aiEnhancementEnabled: Boolean(selectedProject?.ai_enhancement_enabled ?? true),
    });
  };

  const chapters: Chapter[] = data?.data?.items || [];
  const projects: ProjectOption[] = booksData?.data?.items || [];
  const assignableProjects = projects.filter((project) => !['archived', 'completed', 'published'].includes(String(project.status)));
  const workflowOptions = Array.from(new Set(chapters.map((chapter) => chapter.workflow_status).filter(Boolean))) as string[];
  const chapterTypeOptions = Array.from(new Set(chapters.map((chapter) => chapter.chapter_type).filter(Boolean))) as string[];

  useEffect(() => {
    if (!selectedProjectId && assignableProjects.length > 0) {
      const fallbackProject = selectedBook && assignableProjects.some((project) => project.id === selectedBook.id)
        ? selectedBook
        : assignableProjects[0];

      setSelectedProjectId(fallbackProject.id);
      if (!selectedBook || selectedBook.id !== fallbackProject.id) {
        selectBook(fallbackProject as any);
      }
    }
  }, [assignableProjects, selectedBook, selectedProjectId, selectBook]);

  const projectScopedChapters = selectedProjectId
    ? chapters
        .filter((chapter) => Array.isArray(chapter.projects) && chapter.projects.some((project) => project.id === selectedProjectId))
        .filter((chapter) => {
          if (!searchQuery.trim()) return true;
          const lowerQuery = searchQuery.toLowerCase();
          return (
            chapter.title.toLowerCase().includes(lowerQuery) ||
            (chapter.subtitle && chapter.subtitle.toLowerCase().includes(lowerQuery)) ||
            (chapter.summary && chapter.summary.toLowerCase().includes(lowerQuery))
          );
        })
    : [];

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Hero Header */}
      <div className="mb-20 flex justify-between items-end">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-4">Workspace Index</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body">
            Project Chapters
          </h2>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-6 py-3 rounded-lg font-label font-bold text-sm shadow-md hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">{isCreating ? 'close' : 'add'}</span>
          {isCreating ? 'Cancel' : 'New Chapter'}
        </button>
      </div>

      <div className="mb-8">
        <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Selected Project</label>
        <select
          className="w-full md:w-[420px] bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
          value={selectedProjectId}
          onChange={(event) => {
            const nextProject = assignableProjects.find((project) => project.id === event.target.value);
            setSelectedProjectId(event.target.value);
            if (nextProject) {
              selectBook(nextProject as any);
            }
          }}
        >
          <option value="">Select a project</option>
          {assignableProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>

      {/* Search Bar */}
      {selectedProjectId && (
        <div className="mb-8">
          <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Search Chapters</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">search</span>
            <input
              type="text"
              placeholder="Search by title, subtitle, or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-[420px] bg-surface-container-low border border-outline-variant/20 rounded-lg pl-10 pr-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
            />
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <select
          className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
          value={workflowFilter}
          onChange={(event) => setWorkflowFilter(event.target.value)}
        >
          <option value="all">All workflow stages</option>
          {workflowOptions.map((workflow) => (
            <option key={workflow} value={workflow}>
              {formatTag(workflow)}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 rounded-lg bg-surface-container-high text-xs font-label text-primary"
          value={chapterTypeFilter}
          onChange={(event) => setChapterTypeFilter(event.target.value)}
        >
          <option value="all">All chapter types</option>
          {chapterTypeOptions.map((chapterType) => (
            <option key={chapterType} value={chapterType}>
              {formatTag(chapterType)}
            </option>
          ))}
        </select>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10 mb-12 transition-all">
          <div className="mb-6">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Create Chapter</h3>
            <p className="font-label text-xs text-on-surface-variant mt-1">Create a clean writing workspace under the selected project.</p>
          </div>
          
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Title</label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-label focus:ring-secondary/50 focus:border-secondary transition-colors"
                placeholder="e.g., Chapter Title"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChapter()}
              />
            </div>
            
            <button 
              onClick={handleCreateChapter} 
              disabled={createMutation.isPending || !newChapterTitle.trim() || !selectedProjectId}
              className="bg-secondary text-white px-8 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:bg-secondary/90 transition-all disabled:opacity-50 h-[46px] flex items-center justify-center"
            >
              {createMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Chapters List */}
      {!selectedProjectId ? (
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-6">
            <span className="material-symbols-outlined text-3xl">folder_open</span>
          </div>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">Select a project</h3>
          <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed">
            Chapters are scoped per project. Choose a project first to view and create chapters.
          </p>
        </div>
      ) : projectScopedChapters.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-6">
            <span className="material-symbols-outlined text-3xl">layers</span>
          </div>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No chapters yet</h3>
          <p className="font-label text-xs text-on-surface-variant max-w-sm leading-relaxed mb-8">
            This project has no chapters yet. Create your first chapter workspace.
          </p>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-surface-container-lowest border border-outline-variant/20 text-primary px-6 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            Create Chapter Project
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_4px_20px_rgba(25,28,29,0.04)] border border-outline-variant/10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-label text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Project Chapters</h3>
            <span className="font-label text-[10px] text-on-surface-variant opacity-60">{projectScopedChapters.length} items</span>
          </div>

          <div className="space-y-4">
            {projectScopedChapters
              .sort((a, b) => a.chapter_number - b.chapter_number)
              .map((chapter) => (
                <div key={chapter.id} className="group flex flex-col md:flex-row md:items-center justify-between p-6 rounded-lg hover:bg-surface-container-low transition-all border border-transparent hover:border-outline-variant/10">
                  <div className="flex items-start md:items-center gap-6">
                    <span className="font-label text-xs font-medium text-on-surface-variant opacity-40 pt-1 md:pt-0">
                      {chapter.chapter_number.toString().padStart(2, '0')}
                    </span>
                    <div>
                      <Link href={`/dashboard/chapters/${chapter.id}`}>
                        <h4 className="text-2xl font-body italic text-primary group-hover:text-secondary transition-colors cursor-pointer inline-block">
                          {chapter.title}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest bg-surface-container-high px-2 py-0.5 rounded-full">
                          {chapter.status.replace('_', ' ')}
                        </span>
                        {chapter.workflow_status ? (
                          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest bg-surface-container-high px-2 py-0.5 rounded-full">
                            {formatTag(chapter.workflow_status)}
                          </span>
                        ) : null}
                        {chapter.chapter_type ? (
                          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest bg-surface-container-high px-2 py-0.5 rounded-full">
                            {formatTag(chapter.chapter_type)}
                          </span>
                        ) : null}
                        {chapter.timeline_position ? (
                          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">
                            {chapter.timeline_position}
                          </span>
                        ) : null}
                        <span className="font-label text-[10px] text-on-surface-variant opacity-60 uppercase tracking-widest">
                          {chapter.word_count.toLocaleString()} words • {formatDate(chapter.created_at)}
                        </span>
                      </div>

                      <div className="mt-3">
                        {chapter.word_count_target ? (
                          <>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Goal Progress</span>
                              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                                {chapterProgress(chapter)}% of {chapter.word_count_target.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-72 max-w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className="h-full rounded-full bg-secondary"
                                style={{ width: `${chapterProgress(chapter) || 0}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant opacity-70">No target word count</span>
                        )}
                      </div>

                      {chapter.summary ? (
                        <p className="mt-3 max-w-2xl font-body text-sm text-on-surface-variant/80 leading-relaxed line-clamp-2">
                          {chapter.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 md:mt-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-10 md:ml-0">
                    <Link href={`/dashboard/chapters/${chapter.id}`}>
                      <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:bg-primary hover:text-white transition-colors" title="Open Workspace">
                        <span className="material-symbols-outlined text-[20px]">edit_note</span>
                      </button>
                    </Link>
                    <button 
                      onClick={() => compileMutation.mutate(chapter.id)}
                      disabled={compileMutation.isPending}
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:bg-secondary hover:text-white transition-colors disabled:opacity-50" 
                      title="Compile"
                    >
                      {compileMutation.isPending && compileMutation.variables === chapter.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this chapter?')) {
                          deleteMutation.mutate(chapter.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-error shadow-sm hover:bg-error hover:text-white transition-colors disabled:opacity-50" 
                      title="Delete"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === chapter.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
