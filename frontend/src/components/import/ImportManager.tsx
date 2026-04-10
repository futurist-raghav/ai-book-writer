/**
 * ImportManager - Handle file uploads, preview, and apply imports (P2.7)
 */

'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader,
  Trash2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type {
  ImportSourceResponse,
  ImportPreviewResponse,
  ImportApplyRequest,
} from '@/lib/api-client';

type UploadStep = 'upload' | 'preview' | 'apply' | 'complete';

interface ImportState {
  step: UploadStep;
  source?: ImportSourceResponse;
  preview?: ImportPreviewResponse;
  selectedSections: Set<number>;
  startChapterNumber: number;
}

export function ImportManager({ onImportComplete }: { onImportComplete?: () => void }) {
  const params = useParams();
  const router = useRouter();
  const bookId = parseInt(params.bookId as string);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({
    step: 'upload',
    selectedSections: new Set(),
    startChapterNumber: 1,
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.import.uploadFile(bookId, formData);
      return response.data;
    },
    onSuccess: (source) => {
      setState((prev) => ({
        ...prev,
        step: 'preview',
        source,
      }));
      toast.success('File uploaded successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to upload file';
      toast.error(message);
    },
  });

  // Get preview query
  const previewQuery = useQuery({
    queryKey: ['import-preview', state.source?.id],
    queryFn: async () => {
      const response = await apiClient.import.getPreview(bookId, state.source!.id);
      return response.data;
    },
    enabled: state.step === 'preview' && !!state.source,
    onSuccess: (preview) => {
      setState((prev) => ({
        ...prev,
        preview,
        selectedSections: new Set(preview.sections.map((_, i) => i)),
      }));
    },
  });

  // Apply import mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!state.source || !state.preview) throw new Error('Missing preview data');
      
      const selectedIndices = Array.from(state.selectedSections);
      const request: ImportApplyRequest = {
        source_id: state.source.id,
        section_indices: selectedIndices.length < state.preview.sections.length 
          ? selectedIndices 
          : undefined,
        create_as_chapters: true,
        split_by: 'auto',
        start_at_chapter_number: state.startChapterNumber,
      };
      
      const response = await apiClient.import.applyImport(bookId, state.source.id, request);
      return response.data;
    },
    onSuccess: (result) => {
      setState((prev) => ({
        ...prev,
        step: 'complete',
      }));
      toast.success(`Imported ${result.chapters_created} chapters successfully`);
      setTimeout(() => {
        onImportComplete?.();
        router.refresh();
      }, 1500);
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to apply import';
      toast.error(message);
    },
  });

  // Delete import source
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.import.deleteSource(bookId, state.source!.id),
    onSuccess: () => {
      setState({
        step: 'upload',
        selectedSections: new Set(),
        startChapterNumber: 1,
      });
      toast.success('Import deleted');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 52428800) { // 50MB
      toast.error('File is too large (max 50MB)');
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleToggleSection = (index: number) => {
    setState((prev) => {
      const sections = new Set(prev.selectedSections);
      if (sections.has(index)) {
        sections.delete(index);
      } else {
        sections.add(index);
      }
      return { ...prev, selectedSections: sections };
    });
  };

  const handleSelectAll = () => {
    if (!state.preview) return;
    setState((prev) => ({
      ...prev,
      selectedSections: new Set(state.preview!.sections.map((_, i) => i)),
    }));
  };

  const handleDeselectAll = () => {
    setState((prev) => ({
      ...prev,
      selectedSections: new Set(),
    }));
  };

  // Render upload step
  if (state.step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Import Manuscript</h2>
            <p className="text-gray-600 mb-6">
              Upload a DOCX, Markdown, Fountain, or text file to import chapters
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.md,.markdown,.fountain,.txt"
              onChange={handleFileSelect}
              disabled={uploadMutation.isPending}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {uploadMutation.isPending && <Loader className="w-4 h-4 animate-spin" />}
              {uploadMutation.isPending ? 'Uploading...' : 'Select File'}
            </button>

            <p className="text-xs text-gray-500 mt-4">
              Supported formats: DOCX, Markdown, Fountain, Text (max 50MB)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render preview step
  if (state.step === 'preview' && state.source && state.preview) {
    const selectedCount = state.selectedSections.size;
    const allSelected = selectedCount === state.preview.sections.length;

    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">{state.source.filename}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Format: {state.source.format.toUpperCase()}</span>
                <span>•</span>
                <span>{state.preview.total_word_count.toLocaleString()} words</span>
                <span>•</span>
                <span>{state.preview.total_sections} sections</span>
              </div>
            </div>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-red-600 hover:text-red-700 p-2"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Structure info */}
          <div className="bg-gray-50 rounded p-4 mb-6">
            <h3 className="font-medium text-sm mb-3">Detected Structure</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {Object.entries(state.source.detected_structure).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-600">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium ml-2">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section controls */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">
              Sections ({selectedCount}/{state.preview.sections.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Sections list */}
          <div className="border border-gray-200 rounded max-h-96 overflow-y-auto space-y-2 p-4">
            {state.preview.sections.map((section, idx) => (
              <label
                key={idx}
                className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={state.selectedSections.has(idx)}
                  onChange={() => handleToggleSection(idx)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{section.title}</div>
                  <div className="text-xs text-gray-500">
                    {section.estimated_word_count.toLocaleString()} words
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Chapter options */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="font-medium mb-4">Import Options</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Start Chapter Number
              </label>
              <input
                type="number"
                min="1"
                value={state.startChapterNumber}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    startChapterNumber: parseInt(e.target.value) || 1,
                  }))
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setState({
                step: 'upload',
                selectedSections: new Set(),
                startChapterNumber: 1,
              });
            }}
            className="px-6 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => setState((prev) => ({ ...prev, step: 'apply' }))}
            disabled={selectedCount === 0}
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            Review & Import <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Render apply step (confirmation)
  if (state.step === 'apply' && state.source && state.preview) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-2xl font-bold mb-4">Confirm Import</h2>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">Ready to import</p>
                <p className="text-blue-800 mt-1">
                  {state.selectedSections.size} sections will be created as chapters starting
                  from chapter {state.startChapterNumber}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Source</span>
              <span className="font-medium">{state.source.filename}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sections</span>
              <span className="font-medium">{state.selectedSections.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Words</span>
              <span className="font-medium">
                {Array.from(state.selectedSections)
                  .reduce((sum, idx) => sum + state.preview!.sections[idx].estimated_word_count, 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setState((prev) => ({ ...prev, step: 'preview' }))}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {applyMutation.isPending && <Loader className="w-4 h-4 animate-spin" />}
              {applyMutation.isPending ? 'Importing...' : 'Import Chapters'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render complete step
  if (state.step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
          <p className="text-gray-600 mb-6">
            Your manuscript has been successfully imported as chapters. They're ready for
            review and editing.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            View Chapters
          </button>
        </div>
      </div>
    );
  }

  return null;
}
