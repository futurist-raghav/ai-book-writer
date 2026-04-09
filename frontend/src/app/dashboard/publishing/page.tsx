'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiClient } from '@/lib/api-client';
import { useProjectContext } from '@/stores/project-context';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';

interface ExportFormat {
  format: 'pdf' | 'epub' | 'docx' | 'markdown' | 'latex' | 'fountain' | 'html' | 'json';
  label: string;
  description: string;
  supported: boolean;
  extension: string;
}

type ExportSettings = {
  includeFrontMatter: boolean;
  includeBackMatter: boolean;
  includeToc: boolean;
  pageSize: string;
  fontSize: number;
  fontFamily: string;
};

interface ExportProfile {
  id: string;
  label: string;
  description: string;
  defaultFormat: ExportFormat['format'];
  options: ExportSettings;
  isBuiltIn?: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { format: 'pdf', label: 'PDF', description: 'Professional print-ready PDF with formatting', supported: true, extension: 'pdf' },
  { format: 'epub', label: 'EPUB', description: 'Digital eBook format for readers and platforms', supported: true, extension: 'epub' },
  { format: 'docx', label: 'Word (DOCX)', description: 'Microsoft Word format for editing and collaboration', supported: true, extension: 'docx' },
  { format: 'markdown', label: 'Markdown', description: 'Plain text markdown for version control workflows', supported: true, extension: 'md' },
  { format: 'html', label: 'HTML', description: 'Web format for online publishing and embedding', supported: true, extension: 'html' },
  { format: 'latex', label: 'LaTeX', description: 'Academic typesetting format', supported: true, extension: 'tex' },
  { format: 'fountain', label: 'Fountain', description: 'Screenplay industry standard format', supported: true, extension: 'fountain' },
  { format: 'json', label: 'JSON', description: 'Structured data export (coming soon)', supported: false, extension: 'json' },
];

const BUILTIN_EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'novel-print',
    label: 'Novel Print',
    description: 'Balanced print layout for novels and memoirs.',
    defaultFormat: 'pdf',
    options: {
      includeFrontMatter: true,
      includeBackMatter: true,
      includeToc: true,
      pageSize: 'letter',
      fontSize: 12,
      fontFamily: 'serif',
    },
    isBuiltIn: true,
  },
  {
    id: 'academic-paper',
    label: 'Academic Paper',
    description: 'A4 layout focused on citations and structure.',
    defaultFormat: 'pdf',
    options: {
      includeFrontMatter: false,
      includeBackMatter: true,
      includeToc: true,
      pageSize: 'a4',
      fontSize: 11,
      fontFamily: 'serif',
    },
    isBuiltIn: true,
  },
  {
    id: 'editing-pass',
    label: 'Editing Pass',
    description: 'DOCX export tuned for editor collaboration.',
    defaultFormat: 'docx',
    options: {
      includeFrontMatter: true,
      includeBackMatter: true,
      includeToc: true,
      pageSize: 'letter',
      fontSize: 12,
      fontFamily: 'serif',
    },
    isBuiltIn: true,
  },
];

export default function PublishingPage() {
  const queryClient = useQueryClient();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat['format']>('pdf');
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeFrontMatter: true,
    includeBackMatter: true,
    includeToc: true,
    pageSize: 'letter',
    fontSize: 12,
    fontFamily: 'serif',
  });
  const [customProfiles, setCustomProfiles] = useState<ExportProfile[]>([]);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [profileDescriptionInput, setProfileDescriptionInput] = useState('');

  const [publishingMode, setPublishingMode] = useState(false);
  const [matterMode, setMatterMode] = useState(false);
  const [isbnInput, setIsbnInput] = useState('');
  const [publisherInput, setPublisherInput] = useState('');
  const [imprintInput, setImprintInput] = useState('');
  const [publicationDateInput, setPublicationDateInput] = useState('');
  const [frontMatterDraft, setFrontMatterDraft] = useState({
    dedication: '',
    acknowledgments: '',
    preface: '',
    introduction: '',
  });
  const [backMatterDraft, setBackMatterDraft] = useState({
    epilogue: '',
    afterword: '',
    about_author: '',
  });

  // Get the current active book from context
  const projectContext = useProjectContext();
  const activeBookId = projectContext?.activeBook?.id;

  const {
    data: projectData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['project-publishing', activeBookId],
    queryFn: () => (activeBookId ? apiClient.books.get(activeBookId) : Promise.reject('No book selected')),
    enabled: !!activeBookId,
  });

  const getProjectSettings = () =>
    projectData?.data?.project_settings && typeof projectData.data.project_settings === 'object'
      ? (projectData.data.project_settings as Record<string, unknown>)
      : {};

  const exportMutation = useMutation({
    mutationFn: (data: { format: string; options?: Record<string, unknown> }) =>
      apiClient.books.export(activeBookId!, data.format, data.options),
    onSuccess: (response: any, variables: any) => {
      const payload = response?.data;
      const rawDownloadUrl = payload?.download_url;

      if (rawDownloadUrl) {
        let resolvedUrl = String(rawDownloadUrl);
        try {
          resolvedUrl = new URL(rawDownloadUrl, api.defaults.baseURL || window.location.origin).toString();
        } catch {
          resolvedUrl = String(rawDownloadUrl);
        }
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      }

      toast.success(`Exported to ${variables.format.toUpperCase()}`);
    },
    onError: () => toast.error('Export failed'),
  });

  const publishMutation = useMutation({
    mutationFn: (data: { isbn?: string; publisher?: string; imprint?: string; publication_date?: string }) => {
      const projectSettings = getProjectSettings();
      return apiClient.books.update(activeBookId!, {
        project_settings: {
          ...projectSettings,
          publishing_metadata: data,
        },
      });
    },
    onSuccess: () => {
      toast.success('Publishing data saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
      setPublishingMode(false);
    },
    onError: () => toast.error('Failed to save publishing data'),
  });

  const saveProfilesMutation = useMutation({
    mutationFn: (profiles: ExportProfile[]) => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      const projectSettings = getProjectSettings();
      const exportProfileTemplates = profiles.map((profile) => ({
        id: profile.id,
        label: profile.label,
        description: profile.description,
        defaultFormat: profile.defaultFormat,
        options: profile.options,
      }));

      return apiClient.books.update(activeBookId, {
        project_settings: {
          ...projectSettings,
          export_profile_templates: exportProfileTemplates,
        },
      });
    },
    onSuccess: (_response, profiles) => {
      setCustomProfiles(profiles);
      setProfileNameInput('');
      setProfileDescriptionInput('');
      toast.success('Export profiles saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
    },
    onError: () => toast.error('Failed to save export profiles'),
  });

  const matterMutation = useMutation({
    mutationFn: async () => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      await Promise.all([
        apiClient.books.updateFrontMatter(activeBookId, {
          dedication: frontMatterDraft.dedication || undefined,
          acknowledgments: frontMatterDraft.acknowledgments || undefined,
          preface: frontMatterDraft.preface || undefined,
          introduction: frontMatterDraft.introduction || undefined,
        }),
        apiClient.books.updateBackMatter(activeBookId, {
          epilogue: backMatterDraft.epilogue || undefined,
          afterword: backMatterDraft.afterword || undefined,
          about_author: backMatterDraft.about_author || undefined,
        }),
      ]);
    },
    onSuccess: () => {
      toast.success('Front and back matter saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
      setMatterMode(false);
    },
    onError: () => toast.error('Failed to save front/back matter'),
  });

  useEffect(() => {
    const project = projectData?.data;
    if (!project) {
      return;
    }

    const projectSettings =
      project.project_settings && typeof project.project_settings === 'object'
        ? (project.project_settings as Record<string, unknown>)
        : {};

    const publishingMetadata =
      project.project_settings && typeof project.project_settings === 'object'
        ? ((project.project_settings as Record<string, unknown>).publishing_metadata as
            | Record<string, unknown>
            | undefined)
        : undefined;

    const savedProfilesRaw = projectSettings.export_profile_templates;
    const formatLookup = new Set(EXPORT_FORMATS.map((format) => format.format));

    const savedProfiles = Array.isArray(savedProfilesRaw)
      ? savedProfilesRaw
          .map((profile) => {
            if (!profile || typeof profile !== 'object') {
              return null;
            }

            const candidate = profile as Record<string, any>;
            const formatCandidate = String(candidate.defaultFormat || '').toLowerCase();
            if (!formatLookup.has(formatCandidate as ExportFormat['format'])) {
              return null;
            }

            return {
              id: String(candidate.id || `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`),
              label: String(candidate.label || 'Custom Profile'),
              description: String(candidate.description || 'Saved export profile'),
              defaultFormat: formatCandidate as ExportFormat['format'],
              options: {
                includeFrontMatter: Boolean(candidate.options?.includeFrontMatter),
                includeBackMatter: Boolean(candidate.options?.includeBackMatter),
                includeToc: Boolean(candidate.options?.includeToc),
                pageSize: String(candidate.options?.pageSize || 'letter'),
                fontSize: Number(candidate.options?.fontSize || 12),
                fontFamily: String(candidate.options?.fontFamily || 'serif'),
              },
              isBuiltIn: false,
            } as ExportProfile;
          })
          .filter((profile): profile is ExportProfile => Boolean(profile))
      : [];

    setCustomProfiles(savedProfiles);

    setIsbnInput(String(publishingMetadata?.isbn || ''));
    setPublisherInput(String(publishingMetadata?.publisher || ''));
    setImprintInput(String(publishingMetadata?.imprint || ''));
    setPublicationDateInput(String(publishingMetadata?.publication_date || ''));

    setFrontMatterDraft({
      dedication: String(project.dedication || ''),
      acknowledgments: String(project.acknowledgments || ''),
      preface: String(project.preface || ''),
      introduction: String(project.introduction || ''),
    });
    setBackMatterDraft({
      epilogue: String(project.epilogue || ''),
      afterword: String(project.afterword || ''),
      about_author: String(project.about_author || ''),
    });
  }, [projectData]);

  const handleExport = (format: ExportFormat['format']) => {
    const project = projectData?.data;
    if (!project) {
      toast.error('No project loaded');
      return;
    }

    const formatConfig = EXPORT_FORMATS.find((item) => item.format === format);
    if (!formatConfig?.supported) {
      toast.error(`${formatConfig?.label || 'This format'} is not available yet.`);
      return;
    }

    exportMutation.mutate({
      format,
      options: {
        include_front_matter: exportSettings.includeFrontMatter,
        include_back_matter: exportSettings.includeBackMatter,
        include_toc: exportSettings.includeToc,
        page_size: exportSettings.pageSize,
        font_size: exportSettings.fontSize,
        font_family: exportSettings.fontFamily,
      },
    });
  };

  const handlePublish = () => {
    const project = projectData?.data;
    if (!project) return;

    publishMutation.mutate({
      isbn: isbnInput || undefined,
      publisher: publisherInput || undefined,
      imprint: imprintInput || undefined,
      publication_date: publicationDateInput || undefined,
    });
  };

  const selectedFormatConfig =
    EXPORT_FORMATS.find((format) => format.format === selectedFormat) || EXPORT_FORMATS[0];

  const applyProfile = (profile: ExportProfile) => {
    setSelectedFormat(profile.defaultFormat);
    setExportSettings(profile.options);
    toast.success(`Applied ${profile.label} profile`);
  };

  const saveCurrentProfile = () => {
    const profileLabel = profileNameInput.trim();
    if (!profileLabel) {
      toast.error('Add a profile name before saving.');
      return;
    }

    const nextProfiles: ExportProfile[] = [
      ...customProfiles,
      {
        id: `custom-${Date.now()}`,
        label: profileLabel,
        description: profileDescriptionInput.trim() || 'Saved custom export profile',
        defaultFormat: selectedFormat,
        options: exportSettings,
        isBuiltIn: false,
      },
    ];

    saveProfilesMutation.mutate(nextProfiles);
  };

  const deleteCustomProfile = (profileId: string) => {
    const nextProfiles = customProfiles.filter((profile) => profile.id !== profileId);
    saveProfilesMutation.mutate(nextProfiles);
  };

  const project = projectData?.data;
  const exportProfiles = [...BUILTIN_EXPORT_PROFILES, ...customProfiles];

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-24">
      {/* Header */}
      <div className="mb-12">
        <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary mb-3">Share Your Work</p>
        <h2 className="text-5xl md:text-7xl font-light tracking-tighter text-primary font-body mb-4">Publishing</h2>
        <p className="font-label text-sm text-on-surface-variant max-w-2xl">
          Export your manuscript in multiple formats: PDF for printing, EPUB for eBooks, DOCX for editing, and more. Prepare your project for publication.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : isError ? (
        <QueryErrorState
          title="Unable to load publishing data"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : !project ? (
        <div className="text-center py-12 bg-surface-container-lowest rounded-lg border border-dashed">
          <p className="text-on-surface-variant">No active project</p>
        </div>
      ) : (
        <>
          {/* Publishing Metadata */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Publishing Metadata</h3>
              {!publishingMode ? (
                <button
                  onClick={() => setPublishingMode(true)}
                  className="px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handlePublish}
                    disabled={publishMutation.isPending}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-label font-bold text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setPublishingMode(false)} className="px-4 py-2 bg-surface-container-high text-primary rounded-lg">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {publishingMode ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">ISBN</label>
                  <input
                    type="text"
                    placeholder="978-3-16-148410-0"
                    value={isbnInput}
                    onChange={(e) => setIsbnInput(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Publisher</label>
                  <input
                    type="text"
                    placeholder="Publisher name"
                    value={publisherInput}
                    onChange={(e) => setPublisherInput(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Imprint</label>
                  <input
                    type="text"
                    placeholder="Imprint name"
                    value={imprintInput}
                    onChange={(e) => setImprintInput(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Publication Date</label>
                  <input
                    type="date"
                    value={publicationDateInput}
                    onChange={(e) => setPublicationDateInput(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">ISBN</p>
                  <p className="text-primary font-semibold">{isbnInput || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Publisher</p>
                  <p className="text-primary font-semibold">{publisherInput || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Imprint</p>
                  <p className="text-primary font-semibold">{imprintInput || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Date</p>
                  <p className="text-primary font-semibold">{publicationDateInput || 'Not set'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Front / Back Matter */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Front & Back Matter</h3>
              {!matterMode ? (
                <button
                  onClick={() => setMatterMode(true)}
                  className="px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => matterMutation.mutate()}
                    disabled={matterMutation.isPending}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-label font-bold text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setMatterMode(false)} className="px-4 py-2 bg-surface-container-high text-primary rounded-lg">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {matterMode ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Dedication</label>
                  <textarea
                    rows={3}
                    value={frontMatterDraft.dedication}
                    onChange={(e) => setFrontMatterDraft((prev) => ({ ...prev, dedication: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Acknowledgments</label>
                  <textarea
                    rows={3}
                    value={frontMatterDraft.acknowledgments}
                    onChange={(e) => setFrontMatterDraft((prev) => ({ ...prev, acknowledgments: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Preface</label>
                  <textarea
                    rows={3}
                    value={frontMatterDraft.preface}
                    onChange={(e) => setFrontMatterDraft((prev) => ({ ...prev, preface: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Introduction</label>
                  <textarea
                    rows={3}
                    value={frontMatterDraft.introduction}
                    onChange={(e) => setFrontMatterDraft((prev) => ({ ...prev, introduction: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Epilogue</label>
                  <textarea
                    rows={3}
                    value={backMatterDraft.epilogue}
                    onChange={(e) => setBackMatterDraft((prev) => ({ ...prev, epilogue: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div>
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Afterword</label>
                  <textarea
                    rows={3}
                    value={backMatterDraft.afterword}
                    onChange={(e) => setBackMatterDraft((prev) => ({ ...prev, afterword: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">About Author</label>
                  <textarea
                    rows={3}
                    value={backMatterDraft.about_author}
                    onChange={(e) => setBackMatterDraft((prev) => ({ ...prev, about_author: e.target.value }))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                  />
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Front Matter</p>
                  <p className="text-primary font-semibold">
                    {frontMatterDraft.dedication || frontMatterDraft.acknowledgments || frontMatterDraft.preface || frontMatterDraft.introduction
                      ? 'Configured'
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Back Matter</p>
                  <p className="text-primary font-semibold">
                    {backMatterDraft.epilogue || backMatterDraft.afterword || backMatterDraft.about_author ? 'Configured' : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Ready for Export</p>
                  <p className="text-primary font-semibold">
                    {(frontMatterDraft.dedication || backMatterDraft.about_author) ? 'Yes' : 'Partial'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Export Formats */}
          <div className="mb-12">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Export Formats</h3>
              {saveProfilesMutation.isPending ? (
                <span className="text-xs text-on-surface-variant">Saving profile templates...</span>
              ) : null}
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {exportProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 text-left transition-colors hover:border-secondary/50"
                >
                  <button
                    onClick={() => applyProfile(profile)}
                    className="w-full text-left"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-primary">{profile.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${profile.isBuiltIn ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'}`}>
                        {profile.isBuiltIn ? 'Built-in' : 'Custom'}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{profile.description}</p>
                  </button>
                  {!profile.isBuiltIn ? (
                    <button
                      onClick={() => deleteCustomProfile(profile.id)}
                      disabled={saveProfilesMutation.isPending}
                      className="mt-3 text-xs font-bold uppercase tracking-wider text-error disabled:opacity-50"
                    >
                      Delete Profile
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mb-6 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <p className="mb-3 text-sm font-bold text-primary">Save current export settings as a template</p>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={profileNameInput}
                  onChange={(event) => setProfileNameInput(event.target.value)}
                  placeholder="Profile name"
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={profileDescriptionInput}
                  onChange={(event) => setProfileDescriptionInput(event.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm"
                />
                <button
                  onClick={saveCurrentProfile}
                  disabled={saveProfilesMutation.isPending}
                  className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Save Profile Template
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.format}
                  onClick={() => setSelectedFormat(fmt.format)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedFormat === fmt.format
                      ? 'border-secondary bg-secondary/5'
                      : 'border-outline-variant/20 bg-surface-container-lowest hover:border-secondary/50'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-primary">{fmt.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${fmt.supported ? 'bg-secondary/15 text-secondary' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                      {fmt.supported ? 'Ready' : 'Soon'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2">{fmt.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-primary">Selected: {selectedFormatConfig.label}</p>
                  <p className="text-xs text-on-surface-variant">{selectedFormatConfig.description}</p>
                </div>
                <button
                  onClick={() => handleExport(selectedFormatConfig.format)}
                  disabled={exportMutation.isPending || !selectedFormatConfig.supported}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {exportMutation.isPending ? 'Exporting...' : `Export .${selectedFormatConfig.extension}`}
                </button>
              </div>
              {!selectedFormatConfig.supported ? (
                <p className="text-xs text-on-surface-variant">This format is planned and will be enabled in a future export iteration.</p>
              ) : (
                <p className="text-xs text-on-surface-variant">This format is supported by backend export tasks and will open a download link when complete.</p>
              )}
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8">
            <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest mb-6">Export Options</h3>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.includeFrontMatter}
                  onChange={(e) =>
                    setExportSettings({ ...exportSettings, includeFrontMatter: e.target.checked })
                  }
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-sm font-semibold text-primary">Include Front Matter</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.includeBackMatter}
                  onChange={(e) =>
                    setExportSettings({ ...exportSettings, includeBackMatter: e.target.checked })
                  }
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-sm font-semibold text-primary">Include Back Matter</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.includeToc}
                  onChange={(e) => setExportSettings({ ...exportSettings, includeToc: e.target.checked })}
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className="text-sm font-semibold text-primary">Include Table of Contents</span>
              </label>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Page Size (PDF)</label>
                <select
                  value={exportSettings.pageSize}
                  onChange={(e) => setExportSettings({ ...exportSettings, pageSize: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm font-label"
                >
                  <option value="letter">Letter (8.5 × 11")</option>
                  <option value="a4">A4</option>
                  <option value="a5">A5</option>
                </select>
              </div>

              <div>
                <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Font Size</label>
                <select
                  value={exportSettings.fontSize}
                  onChange={(e) => setExportSettings({ ...exportSettings, fontSize: parseInt(e.target.value) })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm font-label"
                >
                  <option value={10}>10pt</option>
                  <option value={11}>11pt</option>
                  <option value={12}>12pt</option>
                  <option value={14}>14pt</option>
                </select>
              </div>

              <div>
                <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Font Family</label>
                <select
                  value={exportSettings.fontFamily}
                  onChange={(e) => setExportSettings({ ...exportSettings, fontFamily: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm font-label"
                >
                  <option value="serif">Serif</option>
                  <option value="sans-serif">Sans Serif</option>
                  <option value="monospace">Monospace</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
