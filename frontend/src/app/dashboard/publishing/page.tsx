'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiClient } from '@/lib/api-client';
import { useProjectContext } from '@/stores/project-context';
import { Spinner } from '@/components/ui/spinner';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { GlossaryBuilderPanel } from '@/components/publishing/glossary-builder-panel';
import { IndexBuilderPanel } from '@/components/publishing/index-builder-panel';
import { BibliographyManagerPanel } from '@/components/publishing/bibliography-manager-panel';
import { RecommendationStateManager } from '@/components/publishing/recommendation-state-manager';

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

type TocMode = 'auto' | 'manual';

type TitlePageDraft = {
  title: string;
  subtitle: string;
  author: string;
  tagline: string;
};

type TocBuilderDraft = {
  mode: TocMode;
  entriesText: string;
};

interface ExportProfile {
  id: string;
  label: string;
  description: string;
  defaultFormat: ExportFormat['format'];
  options: ExportSettings;
  isBuiltIn?: boolean;
}

interface CompilePreviewSection {
  type: string;
  title: string;
  anchor: string;
  word_count: number;
  estimated_pages: number;
  excerpt: string;
  has_content: boolean;
  paragraph_count: number;
  longest_paragraph_words: number;
  long_paragraph_count: number;
  short_paragraph_count: number;
}

type PreviewMode = 'print' | 'ebook' | 'submission';

interface CompilePreviewResponse {
  book_id: string;
  title: string;
  author?: string;
  page_size: string;
  font_size: number;
  line_spacing: number;
  total_sections: number;
  total_word_count: number;
  estimated_pages: number;
  sections: CompilePreviewSection[];
  pagination: Array<{
    type: string;
    title: string;
    anchor: string;
    start_page: number;
    end_page: number;
  }>;
  layout_warnings: Array<{
    section: string;
    warning: string;
  }>;
  layout_diagnostics: {
    words_per_page: number;
    sections_with_short_content: number;
    sections_with_long_paragraphs: number;
  };
  preview_mode: PreviewMode;
  preview_html: string;
  generated_at: string;
}

interface AccessibilityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  section: string;
  message: string;
  recommendation: string;
}

interface AccessibilityHistoryScan {
  checked_at: string;
  accessibility_score: number;
  total_issues: number;
  wcag_level: string;
  issues_by_severity: {
    error: number;
    warning: number;
    info: number;
  };
}

interface AccessibilityHistoryResponse {
  total_scans: number;
  latest_score: number;
  previous_score: number | null;
  score_trend: 'improving' | 'declining' | 'stable' | null;
  scans: AccessibilityHistoryScan[];
}

interface AccessibilityRecommendation {
  id: string;
  title: string;
  description: string;
  issue_type: string;
  severity: 'error' | 'warning' | 'info';
  status: 'open' | 'in_progress' | 'resolved' | string;
  priority: number;
  implementation_difficulty: string;
  estimated_time_minutes: number;
  steps_to_fix: string;
}

interface WcagVersion {
  version: string;
  url: string;
  levels: string[];
}

interface WcagCheckGuide {
  id: string;
  name: string;
  criterion: string;
  level: string;
  description: string;
  tips?: string[];
  thresholds?: Record<string, string>;
}

interface AccessibilityTool {
  name: string;
  type: string;
  url: string;
}

interface WcagGuidelinesResponse {
  wcag_versions: WcagVersion[];
  accessibility_checks: WcagCheckGuide[];
  tools: AccessibilityTool[];
}

interface AccessibilityChecksResponse {
  book_id: string;
  checked_at: string;
  total_issues: number;
  issues_by_severity: {
    error: number;
    warning: number;
    info: number;
  };
  accessibility_score: number;
  wcag_level: string;
  wcag_aa_compliant: boolean;
  wcag_aaa_compliant: boolean;
  history_summary: AccessibilityHistoryResponse;
  recommendations: {
    total_recommendations: number;
    open_count: number;
    recommendations: AccessibilityRecommendation[];
  };
  issues: AccessibilityIssue[];
  checks: {
    images_checked: number;
    tables_checked: number;
    headings_checked: number;
    contrast_ratio: number | null;
    text_color: string;
    background_color: string;
    metadata_complete: boolean;
  };
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

const parseTocEntriesText = (rawText: string): Array<{ title: string; page?: string }> =>
  rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawTitle, ...rawPageParts] = line.split('|');
      const title = rawTitle.trim();
      const page = rawPageParts.join('|').trim();
      if (!title) {
        return null;
      }
      return page ? { title, page } : { title };
    })
    .filter((entry): entry is { title: string; page?: string } => Boolean(entry));

const serializeTocEntries = (entries: unknown): string => {
  if (!Array.isArray(entries)) {
    return '';
  }

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return '';
      }

      const candidate = entry as Record<string, unknown>;
      const title = String(candidate.title || '').trim();
      const page = String(candidate.page || '').trim();
      if (!title) {
        return '';
      }
      return page ? `${title} | ${page}` : title;
    })
    .filter(Boolean)
    .join('\n');
};

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
  const [compilePreview, setCompilePreview] = useState<CompilePreviewResponse | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('print');
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const [publishingMode, setPublishingMode] = useState(false);
  const [matterMode, setMatterMode] = useState(false);
  const [layoutBuilderMode, setLayoutBuilderMode] = useState(false);
  const [isbnInput, setIsbnInput] = useState('');
  const [publisherInput, setPublisherInput] = useState('');
  const [imprintInput, setImprintInput] = useState('');
  const [publicationDateInput, setPublicationDateInput] = useState('');
  const [titlePageDraft, setTitlePageDraft] = useState<TitlePageDraft>({
    title: '',
    subtitle: '',
    author: '',
    tagline: '',
  });
  const [tocBuilderDraft, setTocBuilderDraft] = useState<TocBuilderDraft>({
    mode: 'auto',
    entriesText: '',
  });
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
  const [glossaryEntries, setGlossaryEntries] = useState<Array<{ term: string; definition: string }>>([]);
  const [glossaryMode, setGlossaryMode] = useState<'auto' | 'manual'>('manual');
  const [glossaryEditMode, setGlossaryEditMode] = useState(false);
  const [indexEntries, setIndexEntries] = useState<Array<{ term: string; pages: string }>>([]);
  const [indexMode, setIndexMode] = useState<'auto' | 'manual'>('manual');
  const [indexEditMode, setIndexEditMode] = useState(false);
  const [bibliographyEntries, setBibliographyEntries] = useState<
    Array<{ id: string; title: string; authors: string; year: string; source_type: 'book' | 'journal' | 'website' | 'magazine' | 'newspaper' | 'other' }>
  >([]);
  const [bibliographyEditMode, setBibliographyEditMode] = useState(false);
  const [accessibilityChecks, setAccessibilityChecks] = useState<AccessibilityChecksResponse | null>(null);
  const [recommendationStates, setRecommendationStates] = useState<
    Record<string, 'open' | 'in-progress' | 'resolved'>
  >({});

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

  const { data: accessibilityHistoryData } = useQuery({
    queryKey: ['project-publishing-accessibility-history', activeBookId],
    queryFn: () =>
      activeBookId
        ? apiClient.books.accessibilityHistory(activeBookId)
        : Promise.reject('No book selected'),
    enabled: !!activeBookId,
    staleTime: 30_000,
  });

  const { data: wcagGuidelinesData } = useQuery({
    queryKey: ['project-publishing-accessibility-guidelines', activeBookId],
    queryFn: () =>
      activeBookId
        ? apiClient.books.accessibilityWcagGuidelines(activeBookId)
        : Promise.reject('No book selected'),
    enabled: !!activeBookId,
    staleTime: 5 * 60 * 1000,
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

  const layoutBuilderMutation = useMutation({
    mutationFn: () => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      const projectSettings = getProjectSettings();
      const publishingLayoutRaw = projectSettings.publishing_layout;
      const existingPublishingLayout =
        publishingLayoutRaw && typeof publishingLayoutRaw === 'object'
          ? (publishingLayoutRaw as Record<string, unknown>)
          : {};

      const manualTocEntries =
        tocBuilderDraft.mode === 'manual' ? parseTocEntriesText(tocBuilderDraft.entriesText) : [];

      return apiClient.books.update(activeBookId, {
        project_settings: {
          ...projectSettings,
          publishing_layout: {
            ...existingPublishingLayout,
            title_page: {
              title: titlePageDraft.title.trim(),
              subtitle: titlePageDraft.subtitle.trim(),
              author: titlePageDraft.author.trim(),
              tagline: titlePageDraft.tagline.trim(),
            },
            toc: {
              mode: tocBuilderDraft.mode,
              entries: manualTocEntries,
            },
          },
        },
      });
    },
    onSuccess: () => {
      toast.success('Title page and TOC settings saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
      setLayoutBuilderMode(false);
    },
    onError: () => toast.error('Failed to save title page and TOC settings'),
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

  const glossaryMutation = useMutation({
    mutationFn: () => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      const projectSettings = getProjectSettings();
      const publishingLayoutRaw = projectSettings.publishing_layout;
      const existingPublishingLayout =
        publishingLayoutRaw && typeof publishingLayoutRaw === 'object'
          ? (publishingLayoutRaw as Record<string, unknown>)
          : {};

      return apiClient.books.update(activeBookId, {
        project_settings: {
          ...projectSettings,
          publishing_layout: {
            ...existingPublishingLayout,
            glossary: {
              mode: glossaryMode,
              entries: glossaryEntries,
            },
          },
        },
      });
    },
    onSuccess: () => {
      toast.success('Glossary settings saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
      setGlossaryEditMode(false);
    },
    onError: () => toast.error('Failed to save glossary'),
  });

  const indexMutation = useMutation({
    mutationFn: () => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      const projectSettings = getProjectSettings();
      const publishingLayoutRaw = projectSettings.publishing_layout;
      const existingPublishingLayout =
        publishingLayoutRaw && typeof publishingLayoutRaw === 'object'
          ? (publishingLayoutRaw as Record<string, unknown>)
          : {};

      return apiClient.books.update(activeBookId, {
        project_settings: {
          ...projectSettings,
          publishing_layout: {
            ...existingPublishingLayout,
            index: {
              mode: indexMode,
              entries: indexEntries,
            },
          },
        },
      });
    },
    onSuccess: () => {
      toast.success('Index settings saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
      setIndexEditMode(false);
    },
    onError: () => toast.error('Failed to save index'),
  });

  const bibliographyMutation = useMutation({
    mutationFn: () => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      const projectSettings = getProjectSettings();
      const publishingLayoutRaw = projectSettings.publishing_layout;
      const existingPublishingLayout =
        publishingLayoutRaw && typeof publishingLayoutRaw === 'object'
          ? (publishingLayoutRaw as Record<string, unknown>)
          : {};

      return apiClient.books.update(activeBookId, {
        project_settings: {
          ...projectSettings,
          publishing_layout: {
            ...existingPublishingLayout,
            bibliography: {
              entries: bibliographyEntries,
            },
          },
        },
      });
    },
    onSuccess: () => {
      toast.success('Bibliography settings saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing', activeBookId] });
      setBibliographyEditMode(false);
    },
    onError: () => toast.error('Failed to save bibliography'),
  });

  const compilePreviewMutation = useMutation({
    mutationFn: (modeOverride?: PreviewMode) => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }

      return apiClient.books.compilePreview(activeBookId, {
        include_front_matter: exportSettings.includeFrontMatter,
        include_back_matter: exportSettings.includeBackMatter,
        include_toc: exportSettings.includeToc,
        page_size: exportSettings.pageSize,
        font_size: exportSettings.fontSize,
        line_spacing: 1.5,
        preview_mode: modeOverride || previewMode,
      });
    },
    onSuccess: (response) => {
      setCompilePreview(response.data as CompilePreviewResponse);
      toast.success('Compile preview generated');
    },
    onError: () => toast.error('Failed to generate compile preview'),
  });

  const accessibilityChecksMutation = useMutation({
    mutationFn: () => {
      if (!activeBookId) {
        throw new Error('No active project selected');
      }
      return apiClient.books.accessibilityChecks(activeBookId);
    },
    onSuccess: (response) => {
      setAccessibilityChecks(response.data as AccessibilityChecksResponse);
      queryClient.invalidateQueries({
        queryKey: ['project-publishing-accessibility-history', activeBookId],
      });
      toast.success('Accessibility checks complete');
    },
    onError: () => toast.error('Failed to run accessibility checks'),
  });

  useEffect(() => {
    setAccessibilityChecks(null);
  }, [activeBookId]);

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

    const publishingLayoutRaw = projectSettings.publishing_layout;
    const publishingLayout =
      publishingLayoutRaw && typeof publishingLayoutRaw === 'object'
        ? (publishingLayoutRaw as Record<string, unknown>)
        : {};
    const titlePageRaw = publishingLayout.title_page;
    const titlePageSettings =
      titlePageRaw && typeof titlePageRaw === 'object'
        ? (titlePageRaw as Record<string, unknown>)
        : {};
    const tocRaw = publishingLayout.toc;
    const tocSettings = tocRaw && typeof tocRaw === 'object' ? (tocRaw as Record<string, unknown>) : {};
    const tocMode: TocMode = String(tocSettings.mode || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';

    setTitlePageDraft({
      title: String(titlePageSettings.title || project.title || ''),
      subtitle: String(titlePageSettings.subtitle || ''),
      author: String(titlePageSettings.author || project.author_name || ''),
      tagline: String(titlePageSettings.tagline || ''),
    });
    setTocBuilderDraft({
      mode: tocMode,
      entriesText: serializeTocEntries(tocSettings.entries),
    });

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

    // Load glossary/index/bibliography from publishing layout
    const glossaryRaw = publishingLayout.glossary;
    const glossarySettings =
      glossaryRaw && typeof glossaryRaw === 'object' ? (glossaryRaw as Record<string, unknown>) : {};

    const indexRaw = publishingLayout.index;
    const indexSettings = indexRaw && typeof indexRaw === 'object' ? (indexRaw as Record<string, unknown>) : {};

    const bibliographyRaw = publishingLayout.bibliography;
    const bibliographySettings =
      bibliographyRaw && typeof bibliographyRaw === 'object'
        ? (bibliographyRaw as Record<string, unknown>)
        : {};

    setGlossaryMode((String(glossarySettings.mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual') as 'auto' | 'manual');
    setGlossaryEntries(
      Array.isArray(glossarySettings.entries)
        ? glossarySettings.entries.map((entry) => ({
            term: String(entry?.term || ''),
            definition: String(entry?.definition || ''),
          }))
        : []
    );

    setIndexMode((String(indexSettings.mode || 'manual').toLowerCase() === 'auto' ? 'auto' : 'manual') as 'auto' | 'manual');
    setIndexEntries(
      Array.isArray(indexSettings.entries)
        ? indexSettings.entries.map((entry) => ({
            term: String(entry?.term || ''),
            pages: String(entry?.pages || ''),
          }))
        : []
    );

    setBibliographyEntries(
      Array.isArray(bibliographySettings.entries)
        ? bibliographySettings.entries.map((entry) => ({
            id: String(entry?.id || `bib-${Date.now()}`),
            title: String(entry?.title || ''),
            authors: String(entry?.authors || ''),
            year: String(entry?.year || new Date().getFullYear().toString()),
            source_type: (String(entry?.source_type || 'other') as
              | 'book'
              | 'journal'
              | 'website'
              | 'magazine'
              | 'newspaper'
              | 'other') || 'other',
          }))
        : []
    );
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

  const handleGenerateCompilePreview = () => {
    compilePreviewMutation.mutate(previewMode);
  };

  const handleRunAccessibilityChecks = () => {
    accessibilityChecksMutation.mutate();
  };

  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode);
    compilePreviewMutation.mutate(mode);
  };

  const handleJumpToSection = (anchor: string) => {
    const container = previewContainerRef.current;
    if (!container) {
      return;
    }

    const target = container.querySelector(`#${anchor}`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
  const accessibilityHistory: AccessibilityHistoryResponse | null =
    accessibilityChecks?.history_summary ||
    ((accessibilityHistoryData?.data as AccessibilityHistoryResponse | undefined) ?? null);
  const wcagGuidelines: WcagGuidelinesResponse | null =
    (wcagGuidelinesData?.data as WcagGuidelinesResponse | undefined) ?? null;

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

          {/* Title Page + TOC Builder */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6 gap-3">
              <div>
                <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Title Page & TOC Builder</h3>
                <p className="text-xs text-on-surface-variant mt-1">Configure title-page presentation and choose automatic or manual table of contents flow.</p>
              </div>
              {!layoutBuilderMode ? (
                <button
                  onClick={() => setLayoutBuilderMode(true)}
                  className="px-4 py-2 bg-secondary text-white rounded-lg font-label font-bold text-sm"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => layoutBuilderMutation.mutate()}
                    disabled={layoutBuilderMutation.isPending}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-label font-bold text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setLayoutBuilderMode(false)} className="px-4 py-2 bg-surface-container-high text-primary rounded-lg">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {layoutBuilderMode ? (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Title</label>
                    <input
                      type="text"
                      value={titlePageDraft.title}
                      onChange={(e) => setTitlePageDraft((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Subtitle</label>
                    <input
                      type="text"
                      value={titlePageDraft.subtitle}
                      onChange={(e) => setTitlePageDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Author Line</label>
                    <input
                      type="text"
                      value={titlePageDraft.author}
                      onChange={(e) => setTitlePageDraft((prev) => ({ ...prev, author: e.target.value }))}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Tagline</label>
                    <input
                      type="text"
                      value={titlePageDraft.tagline}
                      onChange={(e) => setTitlePageDraft((prev) => ({ ...prev, tagline: e.target.value }))}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 items-start">
                  <div>
                    <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">TOC Mode</label>
                    <select
                      value={tocBuilderDraft.mode}
                      onChange={(e) => setTocBuilderDraft((prev) => ({ ...prev, mode: e.target.value as TocMode }))}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                    >
                      <option value="auto">Auto (from chapters)</option>
                      <option value="manual">Manual entries</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 text-xs text-on-surface-variant leading-relaxed">
                    Manual mode format: one item per line using <span className="font-semibold">Section Title | Page</span>.
                    <br />
                    Example: <span className="font-semibold">Prologue | i</span>
                  </div>
                </div>

                {tocBuilderDraft.mode === 'manual' ? (
                  <div>
                    <label className="block font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mb-2">Manual TOC Entries</label>
                    <textarea
                      rows={5}
                      value={tocBuilderDraft.entriesText}
                      onChange={(e) => setTocBuilderDraft((prev) => ({ ...prev, entriesText: e.target.value }))}
                      placeholder="Chapter 1: Arrival | 1\nChapter 2: Fall | 17"
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2 text-sm font-label"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Title Page</p>
                  <p className="text-primary font-semibold">{titlePageDraft.title ? 'Configured' : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">TOC Mode</p>
                  <p className="text-primary font-semibold">{tocBuilderDraft.mode === 'manual' ? 'Manual' : 'Automatic'}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-1">Manual Entries</p>
                  <p className="text-primary font-semibold">{tocBuilderDraft.entriesText ? `${tocBuilderDraft.entriesText.split('\n').filter(Boolean).length} entries` : 'None'}</p>
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

          {/* Glossary Builder */}
          <GlossaryBuilderPanel
            entries={glossaryEntries}
            mode={glossaryMode}
            onModeChange={setGlossaryMode}
            onEntriesChange={setGlossaryEntries}
            isEditing={glossaryEditMode}
            onEditToggle={() => setGlossaryEditMode(!glossaryEditMode)}
            onSave={async () => {
              return new Promise<void>((resolve) => {
                glossaryMutation.mutate(undefined, {
                  onSuccess: () => resolve(),
                  onError: () => resolve(),
                });
              });
            }}
            isSaving={glossaryMutation.isPending}
          />

          {/* Index Builder */}
          <IndexBuilderPanel
            entries={indexEntries}
            mode={indexMode}
            onModeChange={setIndexMode}
            onEntriesChange={setIndexEntries}
            isEditing={indexEditMode}
            onEditToggle={() => setIndexEditMode(!indexEditMode)}
            onSave={async () => {
              return new Promise<void>((resolve) => {
                indexMutation.mutate(undefined, {
                  onSuccess: () => resolve(),
                  onError: () => resolve(),
                });
              });
            }}
            isSaving={indexMutation.isPending}
          />

          {/* Bibliography Manager */}
          <BibliographyManagerPanel
            entries={bibliographyEntries}
            onEntriesChange={setBibliographyEntries}
            isEditing={bibliographyEditMode}
            onEditToggle={() => setBibliographyEditMode(!bibliographyEditMode)}
            onSave={async () => {
              return new Promise<void>((resolve) => {
                bibliographyMutation.mutate(undefined, {
                  onSuccess: () => resolve(),
                  onError: () => resolve(),
                });
              });
            }}
            isSaving={bibliographyMutation.isPending}
          />

          {/* Compile Preview */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 mb-8">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Compile Preview</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Preview pagination and section flow before export. This uses your current export options.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['print', 'ebook', 'submission'] as PreviewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handlePreviewModeChange(mode)}
                      disabled={compilePreviewMutation.isPending}
                      className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        previewMode === mode
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-low text-primary border border-outline-variant/20'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerateCompilePreview}
                disabled={compilePreviewMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {compilePreviewMutation.isPending ? 'Generating...' : compilePreview ? 'Regenerate Preview' : 'Generate Preview'}
              </button>
            </div>

            {compilePreview ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Sections</p>
                    <p className="text-lg font-bold text-primary">{compilePreview.total_sections}</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Words</p>
                    <p className="text-lg font-bold text-primary">{compilePreview.total_word_count.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Est. Pages</p>
                    <p className="text-lg font-bold text-primary">{compilePreview.estimated_pages}</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Layout</p>
                    <p className="text-lg font-bold text-primary">{compilePreview.page_size.toUpperCase()} / {compilePreview.font_size}pt</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Mode</p>
                    <p className="text-lg font-bold text-primary">{compilePreview.preview_mode.toUpperCase()}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Layout Diagnostics</p>
                  <div className="grid gap-3 md:grid-cols-3 text-xs text-primary">
                    <p>Words/page baseline: <span className="font-bold">{compilePreview.layout_diagnostics.words_per_page}</span></p>
                    <p>Short sections: <span className="font-bold">{compilePreview.layout_diagnostics.sections_with_short_content}</span></p>
                    <p>Long-paragraph sections: <span className="font-bold">{compilePreview.layout_diagnostics.sections_with_long_paragraphs}</span></p>
                  </div>
                </div>

                {compilePreview.layout_warnings.length > 0 ? (
                  <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">Layout Warnings</p>
                    <div className="space-y-1">
                      {compilePreview.layout_warnings.slice(0, 5).map((warning, index) => (
                        <p key={`${warning.section}-${index}`} className="text-xs text-amber-900">
                          {warning.section}: {warning.warning}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Page Map</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {compilePreview.pagination.map((entry) => (
                      <button
                        key={`${entry.type}-${entry.anchor}`}
                        onClick={() => handleJumpToSection(entry.anchor)}
                        className="block w-full text-left text-xs text-primary hover:underline"
                      >
                        {entry.title}: p.{entry.start_page}
                        {entry.end_page > entry.start_page ? `-${entry.end_page}` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Section Navigator</p>
                  <div className="flex flex-wrap gap-2">
                    {compilePreview.sections.map((section) => (
                      <button
                        key={section.anchor}
                        onClick={() => handleJumpToSection(section.anchor)}
                        className="rounded-full bg-white border border-outline-variant/20 px-3 py-1 text-[11px] font-semibold text-primary hover:border-primary/50"
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/20 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Preview Snippet</p>
                  <div
                    ref={previewContainerRef}
                    className="prose prose-sm max-w-none text-slate-900 max-h-80 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: compilePreview.preview_html }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-low p-5 text-sm text-on-surface-variant">
                Generate a preview to inspect page flow, section order, and potential widow/orphan risks.
              </div>
            )}
          </div>

          {/* Accessibility Checks */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 mb-8">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest">Accessibility Checks</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Run automated publishing checks for image alt text, heading order, tables, contrast, and metadata completeness.
                </p>
              </div>
              <button
                onClick={handleRunAccessibilityChecks}
                disabled={accessibilityChecksMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {accessibilityChecksMutation.isPending
                  ? 'Scanning...'
                  : accessibilityChecks
                    ? 'Re-run Checks'
                    : 'Run Checks'}
              </button>
            </div>

            {accessibilityChecks ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="rounded-lg border border-emerald-300/40 bg-emerald-50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Score</p>
                    <p className="text-lg font-bold text-emerald-800">{accessibilityChecks.accessibility_score}/100</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Total Issues</p>
                    <p className="text-lg font-bold text-primary">{accessibilityChecks.total_issues}</p>
                  </div>
                  <div className="rounded-lg border border-red-300/40 bg-red-50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-red-700 font-bold">Errors</p>
                    <p className="text-lg font-bold text-red-800">{accessibilityChecks.issues_by_severity.error}</p>
                  </div>
                  <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Warnings</p>
                    <p className="text-lg font-bold text-amber-800">{accessibilityChecks.issues_by_severity.warning}</p>
                  </div>
                  <div className="rounded-lg border border-blue-300/40 bg-blue-50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-blue-700 font-bold">Info</p>
                    <p className="text-lg font-bold text-blue-800">{accessibilityChecks.issues_by_severity.info}</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                    <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Scans</p>
                    <p className="text-lg font-bold text-primary">{accessibilityHistory?.total_scans || 1}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Compliance Snapshot</p>
                  <div className="grid gap-3 md:grid-cols-3 text-xs text-primary">
                    <p>
                      WCAG level:{' '}
                      <span className="font-bold">{accessibilityChecks.wcag_level}</span>
                    </p>
                    <p>
                      AA compliant:{' '}
                      <span className={`font-bold ${accessibilityChecks.wcag_aa_compliant ? 'text-green-700' : 'text-red-700'}`}>
                        {accessibilityChecks.wcag_aa_compliant ? 'Yes' : 'No'}
                      </span>
                    </p>
                    <p>
                      AAA compliant:{' '}
                      <span className={`font-bold ${accessibilityChecks.wcag_aaa_compliant ? 'text-green-700' : 'text-red-700'}`}>
                        {accessibilityChecks.wcag_aaa_compliant ? 'Yes' : 'No'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Scan Coverage</p>
                  <div className="grid gap-3 md:grid-cols-3 text-xs text-primary">
                    <p>Images scanned: <span className="font-bold">{accessibilityChecks.checks.images_checked}</span></p>
                    <p>Tables scanned: <span className="font-bold">{accessibilityChecks.checks.tables_checked}</span></p>
                    <p>Headings scanned: <span className="font-bold">{accessibilityChecks.checks.headings_checked}</span></p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 text-xs text-primary mt-3">
                    <p>
                      Contrast ratio ({accessibilityChecks.checks.text_color} on {accessibilityChecks.checks.background_color}):{' '}
                      <span className="font-bold">
                        {accessibilityChecks.checks.contrast_ratio !== null
                          ? `${accessibilityChecks.checks.contrast_ratio}:1`
                          : 'Unavailable'}
                      </span>
                    </p>
                    <p>
                      Metadata completeness:{' '}
                      <span className={`font-bold ${accessibilityChecks.checks.metadata_complete ? 'text-green-700' : 'text-amber-700'}`}>
                        {accessibilityChecks.checks.metadata_complete ? 'Complete' : 'Needs attention'}
                      </span>
                    </p>
                  </div>
                </div>

                {accessibilityHistory ? (
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Scan History</p>
                    <div className="grid gap-3 md:grid-cols-4 text-xs text-primary">
                      <p>Total scans: <span className="font-bold">{accessibilityHistory.total_scans}</span></p>
                      <p>Latest score: <span className="font-bold">{accessibilityHistory.latest_score}</span></p>
                      <p>
                        Previous score:{' '}
                        <span className="font-bold">
                          {accessibilityHistory.previous_score === null ? 'N/A' : accessibilityHistory.previous_score}
                        </span>
                      </p>
                      <p>
                        Trend:{' '}
                        <span className={`font-bold ${
                          accessibilityHistory.score_trend === 'improving'
                            ? 'text-green-700'
                            : accessibilityHistory.score_trend === 'declining'
                              ? 'text-red-700'
                              : 'text-primary'
                        }`}>
                          {accessibilityHistory.score_trend || 'N/A'}
                        </span>
                      </p>
                    </div>

                    {accessibilityHistory.scans.length > 0 ? (
                      <div className="mt-3 max-h-44 overflow-y-auto space-y-2">
                        {accessibilityHistory.scans.slice(0, 6).map((scan, index) => (
                          <div
                            key={`${scan.checked_at}-${index}`}
                            className="rounded-lg border border-outline-variant/20 bg-white p-2 text-xs text-primary"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold">{new Date(scan.checked_at).toLocaleString()}</p>
                              <p className="font-bold">Score {scan.accessibility_score}</p>
                            </div>
                            <p className="text-on-surface-variant">
                              {scan.total_issues} issues · WCAG level {scan.wcag_level}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Recommendations</p>
                  {(accessibilityChecks.recommendations?.recommendations || []).length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No recommendations generated for this scan.</p>
                  ) : (
                    <RecommendationStateManager
                      recommendations={(accessibilityChecks.recommendations?.recommendations || []).map((rec) => ({
                        id: rec.id,
                        issue_category: rec.title || 'General',
                        priority: (rec.priority === 'high' ? 'high' : rec.priority === 'low' ? 'low' : 'medium') as 'low' | 'medium' | 'high',
                        fix_guidance: rec.description || rec.steps_to_fix || 'Apply WCAG guidance',
                        tool_reference: rec.implementation_difficulty ? `${rec.implementation_difficulty} · ${String(rec.estimated_time_minutes)} min` : undefined,
                        wcag_level: rec.severity === 'error' ? 'AA' : rec.severity === 'warning' ? 'A' : undefined,
                        state: (recommendationStates[rec.id] || 'open') as 'open' | 'in-progress' | 'resolved',
                      }))}
                      onStateChange={(recId, newState) => {
                        setRecommendationStates((prev) => ({
                          ...prev,
                          [recId]: newState,
                        }));
                      }}
                    />
                  )}
                </div>

                {accessibilityChecks.total_issues === 0 ? (
                  <div className="rounded-lg border border-green-300/50 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-800">
                      No accessibility issues detected in this scan.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Detected Issues</p>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {accessibilityChecks.issues.map((issue) => (
                        <div key={issue.id} className="rounded-lg border border-outline-variant/20 bg-white p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">{issue.category.replace(/_/g, ' ')}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              issue.severity === 'error'
                                ? 'bg-red-100 text-red-800'
                                : issue.severity === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant mb-1">{issue.section}</p>
                          <p className="text-xs text-primary mb-1">{issue.message}</p>
                          <p className="text-xs text-on-surface-variant">Recommendation: {issue.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-low p-5 text-sm text-on-surface-variant">
                Run checks to validate accessibility readiness before exporting your manuscript.
              </div>
            )}

            {wcagGuidelines ? (
              <div className="mt-5 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">WCAG Guidance</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">References</p>
                    {wcagGuidelines.wcag_versions.map((version) => (
                      <a
                        key={version.version}
                        href={version.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs text-primary hover:border-primary/40"
                      >
                        <p className="font-semibold">{version.version}</p>
                        <p className="text-on-surface-variant">Levels: {version.levels.join(', ')}</p>
                      </a>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Developer Tools</p>
                    {wcagGuidelines.tools.map((tool) => (
                      <a
                        key={tool.name}
                        href={tool.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-outline-variant/20 bg-white px-3 py-2 text-xs text-primary hover:border-primary/40"
                      >
                        <p className="font-semibold">{tool.name}</p>
                        <p className="text-on-surface-variant">{tool.type}</p>
                      </a>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-outline-variant/20 bg-white p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Check Reference</p>
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {wcagGuidelines.accessibility_checks.map((check) => (
                      <div key={check.id} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-2">
                        <p className="text-xs font-semibold text-primary">{check.name} (WCAG {check.criterion}, Level {check.level})</p>
                        <p className="text-xs text-on-surface-variant">{check.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
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
