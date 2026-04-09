'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useProjectContext } from '@/stores/project-context';
import { Spinner } from '@/components/ui/spinner';

interface ExportFormat {
  format: 'pdf' | 'epub' | 'docx' | 'markdown' | 'latex' | 'fountain' | 'html' | 'json';
  label: string;
  description: string;
}

interface PublishingSettings {
  title: string;
  subtitle?: string;
  author: string;
  isbn?: string;
  publisher?: string;
  imprint?: string;
  publication_date?: string;
  language?: string;
  copyright_holder?: string;
  license?: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { format: 'pdf', label: 'PDF', description: 'Professional print-ready PDF with formatting' },
  { format: 'epub', label: 'EPUB', description: 'Digital eBook format for readers and platforms' },
  { format: 'docx', label: 'Word (DOCX)', description: 'Microsoft Word format for editing' },
  { format: 'markdown', label: 'Markdown', description: 'Plain text markdown for version control' },
  { format: 'latex', label: 'LaTeX', description: 'Academic typesetting format' },
  { format: 'fountain', label: 'Fountain', description: 'Screenplay industry standard format' },
  { format: 'html', label: 'HTML', description: 'Web format for online publishing' },
  { format: 'json', label: 'JSON', description: 'Structured data export' },
];

export default function PublishingPage() {
  const queryClient = useQueryClient();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat['format']>('pdf');
  const [exportSettings, setExportSettings] = useState({
    includeFrontMatter: true,
    includeBackMatter: true,
    includeToc: true,
    pageSize: 'letter',
    fontSize: 12,
  });

  const [publishingMode, setPublishingMode] = useState(false);
  const [isbnInput, setIsbnInput] = useState('');
  const [publisherInput, setPublisherInput] = useState('');
  const [imprintInput, setImprintInput] = useState('');
  const [publicationDateInput, setPublicationDateInput] = useState('');

  // Get the current active book from context
  const projectContext = useProjectContext();
  const activeBookId = projectContext?.activeBook?.id;

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project-publishing', activeBookId],
    queryFn: () => (activeBookId ? apiClient.books.get(activeBookId) : Promise.reject('No book selected')),
    enabled: !!activeBookId,
  });

  const exportMutation = useMutation({
    mutationFn: (data: { format: string; options?: Record<string, unknown> }) =>
      apiClient.books.export(activeBookId!, data.format, data.options),
    onSuccess: (response: any, variables: any) => {
      // The response should contain export data
      if (response?.data) {
        const blob = new Blob([response.data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectData?.data?.title || 'export'}.${variables.format}`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        toast.success(`Exported to ${variables.format.toUpperCase()}`);
      }
    },
    onError: () => toast.error('Export failed'),
  });

  const publishMutation = useMutation({
    mutationFn: (data: { isbn?: string; publisher?: string; imprint?: string; publication_date?: string }) =>
      apiClient.publishing.updateExport('latest', { metadata: data }),
    onSuccess: () => {
      toast.success('Publishing data saved');
      queryClient.invalidateQueries({ queryKey: ['project-publishing'] });
      setPublishingMode(false);
    },
    onError: () => toast.error('Failed to save publishing data'),
  });

  const handleExport = (format: ExportFormat['format']) => {
    const project = projectData?.data;
    if (!project) {
      toast.error('No project loaded');
      return;
    }

    exportMutation.mutate({
      format,
      options: exportSettings,
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

  const project = projectData?.data;

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

          {/* Export Formats */}
          <div className="mb-12">
            <h3 className="font-label text-lg font-bold text-primary uppercase tracking-widest mb-6">Export Formats</h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.format}
                  onClick={() => handleExport(fmt.format)}
                  disabled={exportMutation.isPending}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedFormat === fmt.format
                      ? 'border-secondary bg-secondary/5'
                      : 'border-outline-variant/20 bg-surface-container-lowest hover:border-secondary/50'
                  }`}
                >
                  <p className="font-bold text-sm text-primary mb-1">{fmt.label}</p>
                  <p className="text-xs text-on-surface-variant line-clamp-2">{fmt.description}</p>
                </button>
              ))}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
