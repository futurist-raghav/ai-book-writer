'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loading, Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useBookStore } from '@/stores/book-store';
import { WorkspaceCustomizationPanel } from '@/components/workspace-customization/WorkspaceCustomizationPanel';
import { CustomFieldManager } from '@/components/custom-fields';
import { ImportManager } from '@/components/import/ImportManager';

interface ProjectFormState {
  title: string;
  description: string;
  project_context: string;
  book_type: string;
  genres_csv: string;
  tags_csv: string;
  default_writing_form: string;
  default_chapter_tone: string;
  ai_enhancement_enabled: boolean;
  status: string;
  project_settings: {
    narrative_pov: string;
    tense: string;
    target_audience: string;
    language_register: string;
    cultural_lens: string;
    content_boundaries: string;
    sensitivity_notes: string;
    research_requirements: string;
    illustration_plan: string;
    default_chapter_type: string;
    default_workflow_status: string;
    default_timeline_position: string;
    default_word_count_target: string;
  };
}

const ACTIVE_STATUSES = ['in_progress', 'review'];
const NON_DRAFT_STATUSES = ['in_progress', 'review', 'archived', 'completed', 'published'];

export default function ProjectSettingsPage() {
  const queryClient = useQueryClient();
  const { selectedBook, selectBook } = useBookStore();
  const [form, setForm] = useState<ProjectFormState | null>(null);

  const csvToList = (value: string) =>
    value
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);

  const {
    data: booksData,
    isLoading: booksLoading,
    isError: booksError,
    error: booksErrorValue,
    refetch: refetchBooks,
  } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiClient.books.list({ limit: 100 }),
  });

  useEffect(() => {
    const books = booksData?.data?.items || [];
    if (!books.length) {
      if (selectedBook) {
        selectBook(null);
      }
      return;
    }

    const available = books.filter((candidate: any) => NON_DRAFT_STATUSES.includes(String(candidate.status)));
    const stillValid = selectedBook && available.some((candidate: any) => candidate.id === selectedBook.id);
    if (stillValid) {
      return;
    }

    const preferred =
      available.find((candidate: any) => ACTIVE_STATUSES.includes(String(candidate.status))) ||
      available[0] ||
      null;

    selectBook(preferred);
  }, [booksData, selectedBook, selectBook]);

  const project = selectedBook && String(selectedBook.status) !== 'draft' ? selectedBook : null;

  const {
    data: projectDetailsData,
    isLoading: projectDetailsLoading,
    isError: projectDetailsError,
    error: projectDetailsErrorValue,
    refetch: refetchProjectDetails,
  } = useQuery({
    queryKey: ['book', project?.id],
    queryFn: () => apiClient.books.get(project!.id),
    enabled: !!project?.id,
  });

  useEffect(() => {
    const details = projectDetailsData?.data;
    if (!details) {
      return;
    }

    setForm({
      title: details.title || '',
      description: details.description || '',
      project_context: details.project_context || '',
      book_type: details.book_type || '',
      genres_csv: Array.isArray(details.genres) ? details.genres.join(', ') : '',
      tags_csv: Array.isArray(details.tags) ? details.tags.join(', ') : '',
      default_writing_form: details.default_writing_form || '',
      default_chapter_tone: details.default_chapter_tone || '',
      ai_enhancement_enabled: !!details.ai_enhancement_enabled,
      status: details.status || 'in_progress',
      project_settings: {
        narrative_pov: details.project_settings?.narrative_pov || '',
        tense: details.project_settings?.tense || '',
        target_audience: details.project_settings?.target_audience || '',
        language_register: details.project_settings?.language_register || '',
        cultural_lens: details.project_settings?.cultural_lens || '',
        content_boundaries: details.project_settings?.content_boundaries || '',
        sensitivity_notes: details.project_settings?.sensitivity_notes || '',
        research_requirements: details.project_settings?.research_requirements || '',
        illustration_plan: details.project_settings?.illustration_plan || '',
        default_chapter_type: details.project_settings?.default_chapter_type || 'chapter',
        default_workflow_status: details.project_settings?.default_workflow_status || 'draft',
        default_timeline_position: details.project_settings?.default_timeline_position || '',
        default_word_count_target: details.project_settings?.default_word_count_target || '',
      },
    });
  }, [projectDetailsData]);

  const updateMutation = useMutation({
    mutationFn: (payload: ProjectFormState) =>
      apiClient.books.update(project!.id, {
        title: payload.title,
        description: payload.description || undefined,
        project_context: payload.project_context || undefined,
        book_type: payload.book_type || undefined,
        genres: csvToList(payload.genres_csv),
        tags: csvToList(payload.tags_csv),
        project_settings: payload.project_settings,
        default_writing_form: payload.default_writing_form || undefined,
        default_chapter_tone: payload.default_chapter_tone || undefined,
        ai_enhancement_enabled: payload.ai_enhancement_enabled,
        status: payload.status,
      }),
    onSuccess: (response) => {
      toast.success('Project settings updated');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book', project?.id] });
      selectBook(response.data as any);
    },
    onError: () => {
      toast.error('Failed to update project settings');
    },
  });

  if (booksLoading) {
    return <Loading message="Loading project settings..." />;
  }

  if (booksError) {
    return (
      <div className="max-w-5xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load projects"
          error={booksErrorValue}
          onRetry={() => void refetchBooks()}
        />
      </div>
    );
  }

  // Auto-select first active/non-draft project if none selected
  if (!project && !booksLoading) {
    const books = booksData?.data?.items || [];
    const nonDraftBooks = books.filter((b: any) => NON_DRAFT_STATUSES.includes(String(b.status)));
    if (nonDraftBooks.length > 0 && !selectedBook) {
      selectBook(nonDraftBooks[0]);
      return <Loading message="Loading project settings..." />;
    }
  }

  if (!project) {
    return (
      <div className="max-w-5xl mx-auto pt-8 pb-24">
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-6">
            <span className="material-symbols-outlined text-3xl">tune</span>
          </div>
          <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-2">No project selected</h3>
          <p className="font-label text-xs text-on-surface-variant max-w-md leading-relaxed mb-8">
            Project Settings works on an active or archived project. Select one from Projects first.
          </p>
          <Link
            href="/dashboard/books"
            className="bg-surface-container-lowest border border-outline-variant/20 text-primary px-6 py-3 rounded-lg font-label font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            Open Project Selector
          </Link>
        </div>
      </div>
    );
  }

  if (projectDetailsLoading || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (projectDetailsError) {
    return (
      <div className="max-w-5xl mx-auto pt-8 pb-24">
        <QueryErrorState
          title="Unable to load project settings"
          error={projectDetailsErrorValue}
          onRetry={() => void refetchProjectDetails()}
        />
      </div>
    );
  }

  const archived = ['archived', 'completed', 'published'].includes(String(form.status));

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Current Manuscript Controls</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-primary font-body">Project Settings</h1>
          <p className="font-label text-sm text-on-surface-variant mt-4 max-w-3xl">
            You are editing settings for {project.title}. These defaults guide chapter creation, AI rewrites, and workspace behavior.
          </p>
        </div>
        <Link
          href="/dashboard/books"
          className="w-fit px-4 py-2 rounded-lg border border-outline-variant/20 font-label text-xs font-bold uppercase tracking-wider text-primary hover:bg-surface-container-low transition-colors"
        >
          Change Project
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 space-y-4">
          <div>
            <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Metadata</h2>
            <p className="font-label text-xs text-on-surface-variant mt-1">Core project identity and context.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_title">Project Title</Label>
            <Input
              id="project_title"
              value={form.title}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
              placeholder="Project title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_description">Description</Label>
            <Textarea
              id="project_description"
              value={form.description}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
              placeholder="Short description for this project"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_context">Project Context Brief</Label>
            <Textarea
              id="project_context"
              value={form.project_context}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, project_context: event.target.value } : prev))}
              placeholder="Context instructions for AI and chapter drafting"
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book_type">Book Type</Label>
            <Input
              id="book_type"
              value={form.book_type}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, book_type: event.target.value } : prev))}
              placeholder="novel, memoir, poetry, technical, mythology, erotica, fantasy..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="genres_csv">Genres (comma-separated)</Label>
            <Input
              id="genres_csv"
              value={form.genres_csv}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, genres_csv: event.target.value } : prev))}
              placeholder="fantasy, romance, historical, spiritual, satire"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags_csv">Theme Tags (comma-separated)</Label>
            <Input
              id="tags_csv"
              value={form.tags_csv}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, tags_csv: event.target.value } : prev))}
              placeholder="politics, desire, war, spirituality, trauma, healing"
            />
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 space-y-4">
          <div>
            <h2 className="font-label text-sm font-bold text-primary uppercase tracking-widest">Writing Defaults</h2>
            <p className="font-label text-xs text-on-surface-variant mt-1">Applied when creating new chapter workspaces.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writing_form">Default Writing Form</Label>
            <select
              id="writing_form"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.default_writing_form}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, default_writing_form: event.target.value } : prev))}
            >
              <option value="">Not set</option>
              <option value="narrative">narrative</option>
              <option value="memoir">memoir</option>
              <option value="chronological">chronological</option>
              <option value="descriptive">descriptive</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter_tone">Default Chapter Tone</Label>
            <select
              id="chapter_tone"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.default_chapter_tone}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, default_chapter_tone: event.target.value } : prev))}
            >
              <option value="">Not set</option>
              <option value="neutral">neutral</option>
              <option value="reflective">reflective</option>
              <option value="dramatic">dramatic</option>
              <option value="analytical">analytical</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_status">Project Status</Label>
            <select
              id="project_status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.status}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, status: event.target.value } : prev))}
            >
              <option value="in_progress">in progress</option>
              <option value="review">review</option>
              <option value="archived">archived</option>
              <option value="completed">completed</option>
              <option value="published">published</option>
            </select>
          </div>

          <div className="space-y-3 border rounded-md p-4">
            <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Workspace Controls</h3>
            <p className="text-xs text-on-surface-variant">These chapter workspace defaults were moved out of the chapter screen for a cleaner writing experience.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="default_chapter_type">Default Chapter Type</Label>
                <select
                  id="default_chapter_type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.project_settings.default_chapter_type}
                  onChange={(event) => setForm((prev) => (prev ? {
                    ...prev,
                    project_settings: { ...prev.project_settings, default_chapter_type: event.target.value },
                  } : prev))}
                >
                  <option value="chapter">chapter</option>
                  <option value="scene">scene</option>
                  <option value="interlude">interlude</option>
                  <option value="flashback">flashback</option>
                  <option value="prologue">prologue</option>
                  <option value="epilogue">epilogue</option>
                  <option value="appendix">appendix</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_workflow_status">Default Workflow Status</Label>
                <select
                  id="default_workflow_status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.project_settings.default_workflow_status}
                  onChange={(event) => setForm((prev) => (prev ? {
                    ...prev,
                    project_settings: { ...prev.project_settings, default_workflow_status: event.target.value },
                  } : prev))}
                >
                  <option value="idea">idea</option>
                  <option value="outline">outline</option>
                  <option value="draft">draft</option>
                  <option value="revision">revision</option>
                  <option value="final">final</option>
                </select>
              </div>

              <Input
                value={form.project_settings.default_timeline_position}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, default_timeline_position: event.target.value },
                } : prev))}
                placeholder="Default timeline position (e.g. Act 2 Midpoint)"
              />

              <Input
                type="number"
                min={1}
                value={form.project_settings.default_word_count_target}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, default_word_count_target: event.target.value },
                } : prev))}
                placeholder="Default chapter target words"
              />
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-4">
            <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Inclusive Writing Profile</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                value={form.project_settings.narrative_pov}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, narrative_pov: event.target.value },
                } : prev))}
                placeholder="Narrative POV (first/third/multi)"
              />
              <Input
                value={form.project_settings.tense}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, tense: event.target.value },
                } : prev))}
                placeholder="Tense (past/present/mixed)"
              />
              <Input
                value={form.project_settings.target_audience}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, target_audience: event.target.value },
                } : prev))}
                placeholder="Target audience"
              />
              <Input
                value={form.project_settings.language_register}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, language_register: event.target.value },
                } : prev))}
                placeholder="Language register"
              />
              <Input
                value={form.project_settings.cultural_lens}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, cultural_lens: event.target.value },
                } : prev))}
                placeholder="Cultural lens and representation goals"
              />
              <Input
                value={form.project_settings.content_boundaries}
                onChange={(event) => setForm((prev) => (prev ? {
                  ...prev,
                  project_settings: { ...prev.project_settings, content_boundaries: event.target.value },
                } : prev))}
                placeholder="Content boundaries"
              />
            </div>

            <Textarea
              value={form.project_settings.sensitivity_notes}
              onChange={(event) => setForm((prev) => (prev ? {
                ...prev,
                project_settings: { ...prev.project_settings, sensitivity_notes: event.target.value },
              } : prev))}
              placeholder="Sensitivity and inclusivity notes for AI + editorial workflow"
              rows={3}
            />

            <Textarea
              value={form.project_settings.research_requirements}
              onChange={(event) => setForm((prev) => (prev ? {
                ...prev,
                project_settings: { ...prev.project_settings, research_requirements: event.target.value },
              } : prev))}
              placeholder="Research requirements and source expectations"
              rows={3}
            />

            <Textarea
              value={form.project_settings.illustration_plan}
              onChange={(event) => setForm((prev) => (prev ? {
                ...prev,
                project_settings: { ...prev.project_settings, illustration_plan: event.target.value },
              } : prev))}
              placeholder="Illustration expectations: style language, frequency, chapter integration"
              rows={3}
            />
          </div>

          <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={form.ai_enhancement_enabled}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, ai_enhancement_enabled: event.target.checked } : prev))}
            />
            <span>Enable project-level AI wording enhancement by default for all chapter workspaces.</span>
          </label>

          <p className="text-xs text-on-surface-variant">
            Chapter-level AI toggles were removed from the writing workspace to keep the chapter page focused and uncluttered.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="button"
              disabled={updateMutation.isPending || !form.title.trim()}
              onClick={() => updateMutation.mutate(form)}
            >
              {updateMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Save Project Settings
            </Button>

            {archived ? (
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ ...form, status: 'in_progress' })}
              >
                Restore To Active
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ ...form, status: 'archived' })}
              >
                Archive Project
              </Button>
            )}
          </div>
        </section>
      </div>

      {/* Workspace Customization Section */}
      <div className="mt-8">
        <WorkspaceCustomizationPanel bookId={project.id} />
      </div>

      {/* Custom Fields Section */}
      <div className="mt-8">
        <CustomFieldManager bookId={project.id} />
      </div>

      {/* Import/Export Section */}
      <div className="mt-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Import Manuscript</h2>
          <p className="text-gray-600 mb-6">
            Import chapters from DOCX, Markdown, Fountain, or text files into your project.
          </p>
          <ImportManager onImportComplete={() => {
            refetchBooks();
          }} />
        </div>
      </div>
    </div>
  );
}
