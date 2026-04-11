'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Download,
  Settings,
  Package,
  Check,
  AlertCircle,
  Loader,
  Copy,
} from 'lucide-react';

interface ExportBundle {
  id: string;
  name: string;
  icon: string;
  description: string;
  formats: string[];
  default_config: Record<string, any>;
}

interface BundleConfig {
  id: string;
  bundle_type: string;
  primary_format: string;
  include_secondary_formats: boolean;
  secondary_formats: string | null;
  include_front_matter: boolean;
  include_back_matter: boolean;
  include_toc: boolean;
  include_bookmarks: boolean;
  include_metadata: boolean;
  include_keywords: boolean;
  include_author_bio: boolean;
  preserve_formatting: boolean;
  use_embedded_fonts: boolean;
  compress_images: boolean;
  image_dpi: number;
  last_exported_at: string | null;
  export_count: number;
  [key: string]: any;
}

interface ExportBundleSelectorProps {
  bookId: string;
  onExportStart?: (bundleType: string) => void;
  onExportComplete?: (bundleType: string, fileUrl: string) => void;
}

const BUNDLE_ICONS: Record<string, string> = {
  kdp: '📘',
  agent: '📄',
  beta: '👥',
  print: '🖨️',
  ebook: '📱',
};

const BUNDLE_COLORS: Record<string, string> = {
  kdp: 'bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800',
  agent: 'bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-800',
  beta: 'bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800',
  print: 'bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/20 dark:border-orange-800',
  ebook: 'bg-pink-50 border-pink-200 hover:bg-pink-100 dark:bg-pink-900/20 dark:border-pink-800',
};

export function ExportBundleSelector({
  bookId,
  onExportStart,
  onExportComplete,
}: ExportBundleSelectorProps) {
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedSettings, setExpandedSettings] = useState<Record<string, boolean>>({});

  // Fetch export bundle presets
  const { data: presetsData, isLoading: presetsLoading } = useQuery({
    queryKey: ['export-bundle-presets'],
    queryFn: async () => {
      const response = await fetch('/api/v1/books/presets/export-bundles');
      if (!response.ok) throw new Error('Failed to fetch bundle presets');
      return response.json();
    },
  });

  // Fetch current bundle configurations
  const { data: bundlesData, isLoading: bundlesLoading } = useQuery({
    queryKey: ['export-bundles', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/export-bundles`);
      if (!response.ok) throw new Error('Failed to fetch export bundles');
      return response.json();
    },
  });

  // Update bundle configuration
  const updateBundleMutation = useMutation({
    mutationFn: async (data: { bundleType: string; config: Record<string, any> }) => {
      const response = await fetch(
        `/api/v1/books/${bookId}/export-bundles/${data.bundleType}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.config),
        }
      );
      if (!response.ok) throw new Error('Failed to update bundle');
      return response.json();
    },
  });

  // Execute export bundle
  const executeBundleMutation = useMutation({
    mutationFn: async (bundleType: string) => {
      const response = await fetch(
        `/api/v1/books/${bookId}/export-bundles/${bundleType}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bundle_id: bundleType, format: 'pdf' }),
        }
      );
      if (!response.ok) throw new Error('Failed to execute export');
      return response.json();
    },
    onSuccess: (data, bundleType) => {
      onExportComplete?.(bundleType, data.file_url);
    },
  });

  const bundles = presetsData?.bundles || [];
  const bundleConfigs = bundlesData?.bundles || [];

  const getConfigForBundle = (bundleType: string): BundleConfig | undefined => {
    return bundleConfigs.find((b: BundleConfig) => b.bundle_type === bundleType);
  };

  const handleExport = (bundleType: string) => {
    onExportStart?.(bundleType);
    executeBundleMutation.mutate(bundleType);
  };

  const toggleSetting = (bundleType: string, field: string, value: any) => {
    const config = getConfigForBundle(bundleType);
    if (config) {
      updateBundleMutation.mutate({
        bundleType,
        config: { [field]: value },
      });
    }
  };

  if (presetsLoading || bundlesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b pb-6 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-2 dark:text-white">Export Bundles</h2>
        <p className="text-gray-600 dark:text-gray-400">
          One-click exports optimized for different submission and distribution channels
        </p>
      </div>

      {/* Bundle Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundles.map((bundle: ExportBundle) => {
          const config = getConfigForBundle(bundle.id);
          const isSelected = selectedBundle === bundle.id;
          const isExporting = executeBundleMutation.isPending && selectedBundle === bundle.id;

          return (
            <div
              key={bundle.id}
              className={`border-2 rounded-lg p-6 transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                  : `border-gray-200 dark:border-gray-700 ${BUNDLE_COLORS[bundle.id]}`
              }`}
              onClick={() => setSelectedBundle(isSelected ? null : bundle.id)}
            >
              {/* Bundle Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{bundle.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {bundle.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {bundle.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Supported Formats */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Formats
                </p>
                <div className="flex flex-wrap gap-2">
                  {bundle.formats.map((format: string) => (
                    <span
                      key={format}
                      className="px-2 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {format.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Export Info */}
              {config && (
                <div className="mb-4 text-xs text-gray-600 dark:text-gray-400">
                  {config.export_count > 0 && (
                    <p>
                      Exported {config.export_count} time{config.export_count !== 1 ? 's' : ''}
                      {config.last_exported_at && (
                        <>
                          {' on '}
                          {new Date(config.last_exported_at).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(bundle.id);
                  }}
                  disabled={isExporting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isExporting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedSettings((prev) => ({
                      ...prev,
                      [bundle.id]: !prev[bundle.id],
                    }));
                  }}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Settings */}
      {selectedBundle && getConfigForBundle(selectedBundle) && (
        <div className="border-t pt-8 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-6 dark:text-white">
            Settings: {bundles.find((b: ExportBundle) => b.id === selectedBundle)?.name}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Content Settings */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Content Options</h4>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.include_front_matter ?? true}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'include_front_matter', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include front matter (title page, TOC, etc.)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.include_back_matter ?? true}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'include_back_matter', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include back matter (appendix, author bio, etc.)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.include_toc ?? true}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'include_toc', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include table of contents
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.include_bookmarks ?? true}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'include_bookmarks', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include PDF bookmarks
                </span>
              </label>
            </div>

            {/* Formatting Settings */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Formatting</h4>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.preserve_formatting ?? true}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'preserve_formatting', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Preserve original formatting
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.use_embedded_fonts ?? true}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'use_embedded_fonts', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Embed fonts in PDF
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getConfigForBundle(selectedBundle)?.compress_images ?? false}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'compress_images', e.target.checked)
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Compress images (smaller file size)
                </span>
              </label>
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-2">
                  Image DPI
                </label>
                <select
                  value={getConfigForBundle(selectedBundle)?.image_dpi ?? 300}
                  onChange={(e) =>
                    toggleSetting(selectedBundle, 'image_dpi', parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={72}>72 DPI (Web)</option>
                  <option value={150}>150 DPI (E-reader)</option>
                  <option value={300}>300 DPI (Print)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bundle-Specific Settings */}
          {selectedBundle === 'agent' && (
            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">
                Agent Submission Settings
              </h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConfigForBundle(selectedBundle)?.agent_double_spaced ?? true}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'agent_double_spaced', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-purple-800 dark:text-purple-200">
                    Double-spaced (standard for agents)
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConfigForBundle(selectedBundle)?.agent_include_page_numbers ?? true}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'agent_include_page_numbers', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-purple-800 dark:text-purple-200">
                    Include page numbers
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConfigForBundle(selectedBundle)?.agent_include_word_count ?? true}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'agent_include_word_count', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-purple-800 dark:text-purple-200">
                    Include word count in header
                  </span>
                </label>
              </div>
            </div>
          )}

          {selectedBundle === 'beta' && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                Beta Reader Settings
              </h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConfigForBundle(selectedBundle)?.beta_include_line_numbers ?? true}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'beta_include_line_numbers', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    Include line numbers for feedback references
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConfigForBundle(selectedBundle)?.beta_wide_margins ?? true}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'beta_wide_margins', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    Wide margins for handwritten notes
                  </span>
                </label>
              </div>
            </div>
          )}

          {selectedBundle === 'print' && (
            <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">
                Print-Ready Settings
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-orange-800 dark:text-orange-200 block mb-2">
                    Trim Size
                  </label>
                  <select
                    value={getConfigForBundle(selectedBundle)?.print_trim_size || '6x9'}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'print_trim_size', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="6x9">6\" × 9\" Paperback</option>
                    <option value="8x10">8\" × 10\" Hardcover</option>
                    <option value="a4">A4</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getConfigForBundle(selectedBundle)?.print_include_bleed ?? true}
                    onChange={(e) =>
                      toggleSetting(selectedBundle, 'print_include_bleed', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-orange-800 dark:text-orange-200">
                    Include 0.125\" bleed for full-bleed images
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          💡 Export Tips
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>
            • <strong>KDP:</strong> Follow Amazon's guidelines for trim size and formatting
          </li>
          <li>
            • <strong>Agent:</strong> Double-space and use standard fonts per submission guidelines
          </li>
          <li>
            • <strong>Beta:</strong> Wide margins and line numbers help readers provide feedback
          </li>
          <li>
            • <strong>Print:</strong> Use 300 DPI and include bleeds for professional printing
          </li>
        </ul>
      </div>
    </div>
  );
}
