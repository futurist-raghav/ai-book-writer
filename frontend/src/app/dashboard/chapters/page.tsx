'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

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
  pov_character?: string;
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
  chapter_count?: number;
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

function getProjectOrderIndex(chapter: Chapter, projectId: string): number {
  const assoc = chapter.projects?.find((project) => project.id === projectId);
  if (typeof assoc?.order_index === 'number') {
    return assoc.order_index;
  }
  return chapter.chapter_number;
}

function reorderIds(ids: string[], fromId: string, toId: string): string[] {
  const fromIndex = ids.indexOf(fromId);
  const toIndex = ids.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ids;
  }

  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getHttpStatus(error: unknown): number | null {
  if (error instanceof AxiosError) {
    return error.response?.status ?? null;
  }

  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
  return typeof status === 'number' ? status : null;
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
  const [orderedChapterIds, setOrderedChapterIds] = useState<string[]>([]);
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [bulkWorkflowStatus, setBulkWorkflowStatus] = useState('draft');
  const [bulkChapterType, setBulkChapterType] = useState('chapter');

  // Get dynamic labels based on project type
  const projectType = (selectedBook?.project_type || 'novel') as ProjectType;
  const config = ProjectTypeConfigService.getConfig(projectType);
  const structureUnitName = config.structureUnitName; // e.g., "Chapters", "Scenes", "Lessons"
  const pluralName = structureUnitName.endsWith('s') ? structureUnitName : `${structureUnitName}s`;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['chapters', selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => {
      try {
        return await apiClient.chapters.list({ limit: 100 });
      } catch (queryError) {
        if (getHttpStatus(queryError) === 404) {
          return {
            data: {
              items: [],
              total: 0,
              page: 1,
              pages: 1,
            },
            meta: {
              chaptersApiUnavailable: true,
            },
          } as any;
        }

        throw queryError;
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, queryError) => getHttpStatus(queryError) !== 404 && failureCount < 2,
  });

  const {
    data: booksData,
    isLoading: booksLoading,
    isError: booksError,
    error: booksErrorValue,
    refetch: refetchBooks,
  } = useQuery({
    queryKey: ['books', 'for-chapter-form'],
    queryFn: () => apiClient.books.list({ limit: 100, status: 'draft,in_progress,review' }),
    staleTime: 2 * 60 * 1000,
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

  const statusMutation = useMutation({
    mutationFn: ({ chapterId, workflowStatus }: { chapterId: string; workflowStatus: string }) =>
      apiClient.chapters.update(chapterId, { workflow_status: workflowStatus }),
    onSuccess: () => {
      toast.success('Chapter status updated');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to update chapter status');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (chapterIds: string[]) => apiClient.books.reorderChapters(selectedProjectId, chapterIds),
    onSuccess: () => {
      toast.success('Chapter order updated');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      queryClient.invalidateQueries({ queryKey: ['book', selectedProjectId] });
    },
    onError: () => {
      toast.error('Failed to reorder chapters');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { chapterIds: string[]; workflowStatus?: string; chapterType?: string }) => {
      return Promise.all(
        payload.chapterIds.map((chapterId) =>
          apiClient.chapters.update(chapterId, {
            workflow_status: payload.workflowStatus,
            chapter_type: payload.chapterType,
          })
        )
      );
    },
    onSuccess: (_, payload) => {
      toast.success(`Updated ${payload.chapterIds.length} chapters`);
      setSelectedChapterIds([]);
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to apply bulk update');
    },
  });

  const povMutation = useMutation({
    mutationFn: ({ chapterId, povCharacter }: { chapterId: string; povCharacter?: string }) =>
      apiClient.chapters.update(chapterId, { pov_character: povCharacter }),
    onSuccess: () => {
      toast.success('POV updated');
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
    },
    onError: () => {
      toast.error('Failed to update POV');
    },
  });

  const handleCreateChapter = () => {
    if (chaptersApiUnavailable) {
      toast.error('Chapter service is currently unavailable in this deployment.');
      return;
    }

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
  const chaptersApiUnavailable = Boolean((data as any)?.meta?.chaptersApiUnavailable);
  const projects: ProjectOption[] = booksData?.data?.items || [];
  const assignableProjects = projects.filter((project) => !['archived', 'completed', 'published'].includes(String(project.status)));
  const selectedProject = assignableProjects.find((project) => project.id === selectedProjectId);
  const selectedProjectChapterCount = Number(selectedProject?.chapter_count || 0);
  const workflowOptions = Array.from(new Set(chapters.map((chapter) => chapter.workflow_status).filter(Boolean))) as string[];
  const chapterTypeOptions = Array.from(new Set(chapters.map((chapter) => chapter.chapter_type).filter(Boolean))) as string[];

  const allProjectChapters = selectedProjectId
    ? chapters.filter((chapter) => Array.isArray(chapter.projects) && chapter.projects.some((project) => project.id === selectedProjectId))
    : [];

  const canReorder =
    !chaptersApiUnavailable &&
    Boolean(selectedProjectId) &&
    workflowFilter === 'all' &&
    chapterTypeFilter === 'all' &&
    !searchQuery.trim();

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

  useEffect(() => {
    const sortedIds = [...allProjectChapters]
      .sort((a, b) => getProjectOrderIndex(a, selectedProjectId) - getProjectOrderIndex(b, selectedProjectId))
      .map((chapter) => chapter.id);

    setOrderedChapterIds((prev) => {
      if (prev.length === sortedIds.length && prev.every((id, index) => id === sortedIds[index])) {
        return prev;
      }
      return sortedIds;
    });

    setSelectedChapterIds((prev) => prev.filter((id) => sortedIds.includes(id)));
  }, [allProjectChapters, selectedProjectId]);

  const orderedProjectChapters = orderedChapterIds
    .map((id) => allProjectChapters.find((chapter) => chapter.id === id))
    .filter((chapter): chapter is Chapter => Boolean(chapter));

  const projectScopedChapters = orderedProjectChapters.filter((chapter) => {
    if (workflowFilter !== 'all' && chapter.workflow_status !== workflowFilter) {
      return false;
    }
    if (chapterTypeFilter !== 'all' && chapter.chapter_type !== chapterTypeFilter) {
      return false;
    }
    if (!searchQuery.trim()) {
      return true;
    }
    const lowerQuery = searchQuery.toLowerCase();
    return (
      chapter.title.toLowerCase().includes(lowerQuery) ||
      (chapter.subtitle && chapter.subtitle.toLowerCase().includes(lowerQuery)) ||
      (chapter.summary && chapter.summary.toLowerCase().includes(lowerQuery)) ||
      (chapter.pov_character && chapter.pov_character.toLowerCase().includes(lowerQuery))
    );
  });

  const allVisibleSelected =
    projectScopedChapters.length > 0 && projectScopedChapters.every((chapter) => selectedChapterIds.includes(chapter.id));

  const handleDropOnChapter = (targetChapterId: string) => {
    if (!canReorder || !draggingChapterId || !selectedProjectId) {
      return;
    }
    const nextOrder = reorderIds(orderedChapterIds, draggingChapterId, targetChapterId);
    if (nextOrder === orderedChapterIds) {
      return;
    }
    setOrderedChapterIds(nextOrder);
    reorderMutation.mutate(nextOrder);
    setDraggingChapterId(null);
  };

  const handleBulkApply = () => {
    if (chaptersApiUnavailable) {
      toast.error('Bulk editing is unavailable because chapter APIs are not currently reachable.');
      return;
    }

    if (selectedChapterIds.length === 0) {
      toast.error('Select at least one chapter for bulk update');
      return;
    }

    bulkUpdateMutation.mutate({
      chapterIds: selectedChapterIds,
      workflowStatus: bulkWorkflowStatus,
      chapterType: bulkChapterType,
    });
  };

  if (isLoading || booksLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="w-8 h-8 text-primary" /></div>;
  }

  if (isError) {
    return (
      <div className="dashboard-shell">
        <QueryErrorState
          title="Unable to load chapters"
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (booksError) {
    return (
      <div className="dashboard-shell">
        <QueryErrorState
          title="Unable to load projects"
          error={booksErrorValue}
          onRetry={() => void refetchBooks()}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      {/* Hero Header */}
      <div className="mb-20 flex justify-between items-end">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-4">Workspace Index</p>
          <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body">
            Project {pluralName}
          </h2>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-container px-6 py-3 font-label text-sm font-bold text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">{isCreating ? 'close' : 'add'}</span>
          {isCreating ? 'Cancel' : `New ${structureUnitName}`}
        </button>
      </div>

      <div className="mb-8">
        <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Selected Project</label>
        <select
          className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm font-label text-on-surface transition-colors focus:border-secondary focus:ring-secondary/50 md:w-[420px]"
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
          <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Search {pluralName}</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">search</span>
            <input
              type="text"
              placeholder="Search by title, subtitle, or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low py-3 pl-10 pr-4 text-sm font-label text-on-surface transition-colors focus:border-secondary focus:ring-secondary/50 md:w-[420px]"
            />
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg bg-surface-container-high px-3 py-2 text-xs font-label text-on-surface"
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
          className="rounded-lg bg-surface-container-high px-3 py-2 text-xs font-label text-on-surface"
          value={chapterTypeFilter}
          onChange={(event) => setChapterTypeFilter(event.target.value)}
        >
          <option value="all">All {structureUnitName.toLowerCase()} types</option>
          {chapterTypeOptions.map((chapterType) => (
            <option key={chapterType} value={chapterType}>
              {formatTag(chapterType)}
            </option>
          ))}
        </select>
      </div>

      {selectedProjectId ? (
        <div className="elevated-panel mb-8 space-y-3 rounded-xl p-4">
          {chaptersApiUnavailable ? (
            <div className="rounded-lg border border-warning/40 bg-warning/12 px-3 py-2 text-xs text-on-surface">
              Chapter endpoints are unavailable in the current backend deployment. You can still navigate the dashboard, but chapter editing actions are temporarily disabled.
              {selectedProjectChapterCount > 0 ? ` This project reports ${selectedProjectChapterCount} chapter(s).` : ''}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {canReorder
                ? 'Drag and drop chapters to reorder'
                : 'Clear filters and search to enable drag-and-drop reorder'}
            </p>
            {reorderMutation.isPending ? (
              <span className="font-label text-[10px] uppercase tracking-wider text-secondary">Saving order...</span>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr_auto] md:items-center">
            <label className="inline-flex items-center gap-2 text-xs font-label text-on-surface-variant">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedChapterIds(projectScopedChapters.map((chapter) => chapter.id));
                  } else {
                    setSelectedChapterIds([]);
                  }
                }}
                className="h-4 w-4 rounded"
              />
              Select Visible ({selectedChapterIds.length})
            </label>

            <select
              value={bulkWorkflowStatus}
              onChange={(event) => setBulkWorkflowStatus(event.target.value)}
              className="rounded-lg bg-surface-container-high px-3 py-2 text-xs font-label text-on-surface"
            >
              <option value="idea">Bulk workflow: idea</option>
              <option value="outline">Bulk workflow: outline</option>
              <option value="draft">Bulk workflow: draft</option>
              <option value="revision">Bulk workflow: revision</option>
              <option value="final">Bulk workflow: final</option>
            </select>

            <select
              value={bulkChapterType}
              onChange={(event) => setBulkChapterType(event.target.value)}
              className="rounded-lg bg-surface-container-high px-3 py-2 text-xs font-label text-on-surface"
            >
              <option value="chapter">Bulk type: chapter</option>
              <option value="scene">Bulk type: scene</option>
              <option value="interlude">Bulk type: interlude</option>
              <option value="prologue">Bulk type: prologue</option>
              <option value="epilogue">Bulk type: epilogue</option>
            </select>

            <button
              onClick={handleBulkApply}
              disabled={chaptersApiUnavailable || bulkUpdateMutation.isPending || selectedChapterIds.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {bulkUpdateMutation.isPending ? 'Applying...' : 'Apply Bulk Edit'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Creation Form */}
      {isCreating && (
        <div className="elevated-panel mb-12 rounded-xl p-8 transition-all">
          <div className="mb-6">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Create {structureUnitName}</h3>
            <p className="font-label text-xs text-on-surface-variant mt-1">Create a clean writing workspace under the selected project.</p>
          </div>
          
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Title</label>
              <input
                className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm font-label text-on-surface transition-colors focus:border-secondary focus:ring-secondary/50"
                placeholder={`e.g., ${structureUnitName} Title`}
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChapter()}
              />
            </div>
            
            <button 
              onClick={handleCreateChapter} 
              disabled={chaptersApiUnavailable || createMutation.isPending || !newChapterTitle.trim() || !selectedProjectId}
              className="flex h-[46px] items-center justify-center rounded-lg bg-secondary px-8 py-3 font-label text-sm font-bold text-secondary-foreground shadow-sm transition-all hover:bg-secondary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Chapters List */}
      {!selectedProjectId ? (
        <div className="elevated-panel flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/45 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl">folder_open</span>
          </div>
          <h3 className="mb-2 font-label text-sm font-bold uppercase tracking-widest text-on-surface">Select a project</h3>
          <p className="max-w-sm font-label text-sm leading-relaxed text-on-surface-variant">
            Chapters are scoped per project. Choose a project first to view and create chapters.
          </p>
        </div>
      ) : projectScopedChapters.length === 0 ? (
        <div className="elevated-panel flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/45 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl">layers</span>
          </div>
          <h3 className="mb-2 font-label text-sm font-bold uppercase tracking-widest text-on-surface">No {structureUnitName.toLowerCase()} yet</h3>
          <p className="mb-8 max-w-sm font-label text-sm leading-relaxed text-on-surface-variant">
            Start writing by creating your first {structureUnitName.toLowerCase()}. You can organize and structure your project later.
          </p>
          <button 
            onClick={() => setIsCreating(true)}
            className="rounded-lg bg-primary px-6 py-3 font-label text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
          >
            + Create {structureUnitName}
          </button>
        </div>
      ) : (
        <div className="elevated-panel rounded-xl p-10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-label text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Project {pluralName}</h3>
            <span className="font-label text-[10px] text-on-surface-variant opacity-60">{projectScopedChapters.length} items</span>
          </div>

          <div className="space-y-4">
            {projectScopedChapters.map((chapter) => (
              <div
                key={chapter.id}
                draggable={canReorder}
                onDragStart={(event) => {
                  if (!canReorder) return;
                  setDraggingChapterId(chapter.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  if (canReorder) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropOnChapter(chapter.id);
                }}
                onDragEnd={() => setDraggingChapterId(null)}
                className={`theme-chip group flex flex-col justify-between rounded-xl p-6 transition-all md:flex-row md:items-center ${
                  draggingChapterId === chapter.id
                    ? 'border border-secondary/40 opacity-70'
                    : 'border border-transparent hover:border-outline-variant/30 hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-start md:items-center gap-6">
                  <div className="flex items-center gap-3 pt-1 md:pt-0">
                    <input
                      type="checkbox"
                      checked={selectedChapterIds.includes(chapter.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedChapterIds((prev) => (prev.includes(chapter.id) ? prev : [...prev, chapter.id]));
                        } else {
                          setSelectedChapterIds((prev) => prev.filter((id) => id !== chapter.id));
                        }
                      }}
                      className="h-4 w-4 rounded"
                    />
                    <span
                      className={`material-symbols-outlined text-lg ${canReorder ? 'cursor-grab text-on-surface-variant' : 'text-on-surface-variant/30'}`}
                      title={canReorder ? 'Drag to reorder' : 'Reordering disabled while filters/search are active'}
                    >
                      drag_indicator
                    </span>
                  </div>

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
                        <select
                          value={chapter.workflow_status}
                          onChange={(e) => statusMutation.mutate({ chapterId: chapter.id, workflowStatus: e.target.value })}
                          disabled={statusMutation.isPending}
                          className="cursor-pointer rounded-full bg-tertiary-container/65 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-on-tertiary-container transition-colors hover:bg-tertiary-container disabled:opacity-50"
                          title="Change workflow status"
                        >
                          <option value="idea">Idea</option>
                          <option value="outline">Outline</option>
                          <option value="draft">Draft</option>
                          <option value="revision">Revision</option>
                          <option value="final">Final</option>
                        </select>
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
                      {chapter.pov_character ? (
                        <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          POV: {chapter.pov_character}
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
                  <button
                    onClick={() => {
                      const nextPov = prompt('Set POV character for this chapter', chapter.pov_character || '');
                      if (nextPov !== null) {
                        povMutation.mutate({ chapterId: chapter.id, povCharacter: nextPov.trim() || undefined });
                      }
                    }}
                    disabled={chaptersApiUnavailable || povMutation.isPending}
                    className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary-container hover:text-on-primary-container disabled:opacity-50"
                    title="Set POV"
                  >
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </button>

                  <Link href={`/dashboard/chapters/${chapter.id}`}>
                    <button className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-primary hover:text-primary-foreground" title="Open Workspace">
                      <span className="material-symbols-outlined text-[20px]">edit_note</span>
                    </button>
                  </Link>
                  <button
                    onClick={() => compileMutation.mutate(chapter.id)}
                    disabled={chaptersApiUnavailable || compileMutation.isPending}
                    className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50"
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
                    disabled={chaptersApiUnavailable || deleteMutation.isPending}
                    className="theme-chip flex h-10 w-10 items-center justify-center rounded-full text-error hover:bg-error hover:text-on-error disabled:opacity-50"
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
