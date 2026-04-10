/**
 * ExportManager - Download book in multiple formats (P2.7)
 */

'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Download,
  FileText,
  Book,
  File,
  Loader,
} from 'lucide-react';
import { apiClient, api } from '@/lib/api-client';

type ExportFormat = 'markdown' | 'text' | 'docx';

interface ExportOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  mimeType: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'markdown',
    label: 'Markdown (.md)',
    description: 'Universal format for editing and publishing',
    icon: <FileText className="w-5 h-5" />,
    mimeType: 'text/markdown',
  },
  {
    id: 'text',
    label: 'Plain Text (.txt)',
    description: 'Simple text format for reading',
    icon: <File className="w-5 h-5" />,
    mimeType: 'text/plain',
  },
  {
    id: 'docx',
    label: 'Word Document (.docx)',
    description: 'Microsoft Word format with formatting',
    icon: <Book className="w-5 h-5" />,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
];

export function ExportManager() {
  const params = useParams();
  const bookId = parseInt(params.bookId as string);
  const [includeMetadata, setIncludeMetadata] = useState(true);

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (format: ExportFormat) => {
      let endpoint = '';
      switch (format) {
        case 'markdown':
          endpoint = `/books/${bookId}/export/markdown`;
          break;
        case 'text':
          endpoint = `/books/${bookId}/export/text`;
          break;
        case 'docx':
          endpoint = `/books/${bookId}/export/docx`;
          break;
      }

      const response = await api.post(endpoint, {
        include_metadata: includeMetadata,
      }, {
        responseType: 'blob',
      });

      return response.data;
    },
    onSuccess: (blob: Blob, format: ExportFormat) => {
      // Get filename from response header or generate default
      const option = EXPORT_OPTIONS.find(o => o.id === format);
      const ext = format === 'docx' ? '.docx' : format === 'markdown' ? '.md' : '.txt';
      const filename = `exported-book${ext}`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported to ${option?.label}`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || `Export failed`;
      if (error.response?.status === 501) {
        toast.error('DOCX export not available. Contact administrator.');
      } else {
        toast.error(message);
      }
    },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Export Book</h2>
            <p className="text-gray-600">
              Download your book in different formats for sharing, publishing, or editing
            </p>
          </div>
          <Download className="w-8 h-8 text-gray-400" />
        </div>

        {/* Export options */}
        <div className="space-y-3 mb-8">
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => exportMutation.mutate(option.id)}
              disabled={exportMutation.isPending}
              className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-4"
            >
              <div className="text-gray-400 mt-1 flex-shrink-0">
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{option.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{option.description}</p>
              </div>
              {exportMutation.isPending && (
                <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-1" />
              )}
            </button>
          ))}
        </div>

        {/* Options */}
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              disabled={exportMutation.isPending}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              Include metadata (title, author, description)
            </span>
          </label>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            ℹ️ Exports include all chapters, proper formatting, and chapter numbers. 
            Custom fields and collaboration data are not included in the export.
          </p>
        </div>
      </div>
    </div>
  );
}
