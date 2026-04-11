'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  User,
  BookOpen,
  Globe,
  Award,
  DollarSign,
  Settings,
  Plus,
  Trash2,
  Save,
  X,
  Loader,
} from 'lucide-react';

interface BookMetadata {
  id: string;
  book_id: string;
  author_name: string | null;
  author_bio: string | null;
  author_website: string | null;
  author_email: string | null;
  author_social_links: string | null;
  publisher_name: string | null;
  publication_year: number | null;
  publication_date: string | null;
  isbn_13: string | null;
  copyright_year: number | null;
  copyright_holder: string | null;
  series_name: string | null;
  series_volume: number | null;
  genre: string | null;
  keywords: string | null;
  description_short: string | null;
  description_long: string | null;
  primary_language: string | null;
  page_count: number | null;
  word_count: number | null;
  reading_level: string | null;
  editor_name: string | null;
  illustrator_name: string | null;
  translator_name: string | null;
  [key: string]: any;
}

interface MetadataManagerProps {
  bookId: string;
  onSave?: (metadata: BookMetadata) => void;
}

type TabType = 'author' | 'publishing' | 'discovery' | 'distribution';

export function MetadataManager({ bookId, onSave }: MetadataManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('author');
  const [editMode, setEditMode] = useState(false);

  // Fetch metadata
  const { data: metadata, isLoading, refetch } = useQuery({
    queryKey: ['book-metadata', bookId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/books/${bookId}/metadata`);
      if (!response.ok) throw new Error('Failed to fetch metadata');
      return response.json();
    },
  });

  // Fetch classifications
  const { data: classifications } = useQuery({
    queryKey: ['metadata-classifications'],
    queryFn: async () => {
      const response = await fetch('/api/v1/metadata/classifications');
      if (!response.ok) throw new Error('Failed to fetch classifications');
      return response.json();
    },
  });

  // Update metadata
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const response = await fetch(`/api/v1/books/${bookId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update metadata');
      return response.json();
    },
    onSuccess: (data) => {
      onSave?.(data);
      refetch();
      setEditMode(false);
    },
  });

  const handleSave = () => {
    if (metadata) {
      updateMutation.mutate(metadata);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    if (metadata) {
      // Only update in local state, not sync to DB yet
      // This would typically be done with a form state library
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No metadata available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-6 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold dark:text-white">Book Metadata</h2>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              editMode
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {editMode ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive metadata for publishing and discovery
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-gray-700">
        {[
          { id: 'author', label: '👤 Author', icon: User },
          { id: 'publishing', label: '📖 Publishing', icon: BookOpen },
          { id: 'discovery', label: '🌐 Discovery', icon: Globe },
          { id: 'distribution', label: '🏆 Distribution', icon: Award },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Author Tab */}
        {activeTab === 'author' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetadataField
              label="Author Name"
              value={metadata.author_name}
              disabled={!editMode}
              onChange={(value) => (metadata.author_name = value)}
              placeholder="Enter author name"
            />
            <MetadataField
              label="Author Email"
              type="email"
              value={metadata.author_email}
              disabled={!editMode}
              onChange={(value) => (metadata.author_email = value)}
              placeholder="author@example.com"
            />
            <div className="md:col-span-2">
              <MetadataTextarea
                label="Author Bio"
                value={metadata.author_bio}
                disabled={!editMode}
                onChange={(value) => (metadata.author_bio = value)}
                placeholder="Write a short biography (up to 500 words)"
                rows={4}
              />
            </div>
            <MetadataField
              label="Author Website"
              type="url"
              value={metadata.author_website}
              disabled={!editMode}
              onChange={(value) => (metadata.author_website = value)}
              placeholder="https://authorwebsite.com"
            />
            <MetadataField
              label="Social Media Links"
              value={metadata.author_social_links}
              disabled={!editMode}
              onChange={(value) => (metadata.author_social_links = value)}
              placeholder='{"twitter": "...", "instagram": "..."}'
            />
          </div>
        )}

        {/* Publishing Tab */}
        {activeTab === 'publishing' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetadataField
              label="Publisher Name"
              value={metadata.publisher_name}
              disabled={!editMode}
              onChange={(value) => (metadata.publisher_name = value)}
              placeholder="Independent" />
            <MetadataField
              label="Publication Year"
              type="number"
              value={metadata.publication_year}
              disabled={!editMode}
              onChange={(value) => (metadata.publication_year = value)}
              placeholder={new Date().getFullYear().toString()}
            />
            <MetadataField
              label="ISBN-13"
              value={metadata.isbn_13}
              disabled={!editMode}
              onChange={(value) => (metadata.isbn_13 = value)}
              placeholder="978-0-123456-78-9"
            />
            <MetadataField
              label="Copyright Year"
              type="number"
              value={metadata.copyright_year}
              disabled={!editMode}
              onChange={(value) => (metadata.copyright_year = value)}
              placeholder={new Date().getFullYear().toString()}
            />
            <MetadataField
              label="Series Name"
              value={metadata.series_name}
              disabled={!editMode}
              onChange={(value) => (metadata.series_name = value)}
              placeholder="Book Series Name"
            />
            <MetadataField
              label="Series Volume"
              type="number"
              value={metadata.series_volume}
              disabled={!editMode}
              onChange={(value) => (metadata.series_volume = value)}
              placeholder="1"
            />
          </div>
        )}

        {/* Discovery Tab */}
        {activeTab === 'discovery' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetadataSelect
              label="Genre"
              value={metadata.genre}
              disabled={!editMode}
              onChange={(value) => (metadata.genre = value)}
              options={classifications?.genres || []}
            />
            <MetadataField
              label="Keywords"
              value={metadata.keywords}
              disabled={!editMode}
              onChange={(value) => (metadata.keywords = value)}
              placeholder="keyword1, keyword2, keyword3"
            />
            <MetadataSelect
              label="Reading Level"
              value={metadata.reading_level}
              disabled={!editMode}
              onChange={(value) => (metadata.reading_level = value)}
              options={classifications?.reading_levels || []}
            />
            <MetadataField
              label="Page Count"
              type="number"
              value={metadata.page_count}
              disabled={!editMode}
              onChange={(value) => (metadata.page_count = value)}
              placeholder="250"
            />
            <div className="md:col-span-2">
              <MetadataField
                label="Short Description (160 chars)"
                value={metadata.description_short}
                disabled={!editMode}
                onChange={(value) => (metadata.description_short = value)}
                placeholder="Brief book description for search results"
              />
            </div>
            <div className="md:col-span-2">
              <MetadataTextarea
                label="Full Description"
                value={metadata.description_long}
                disabled={!editMode}
                onChange={(value) => (metadata.description_long = value)}
                placeholder="Complete book description for retailers"
                rows={4}
              />
            </div>
          </div>
        )}

        {/* Distribution Tab */}
        {activeTab === 'distribution' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetadataField
              label="Editor Name"
              value={metadata.editor_name}
              disabled={!editMode}
              onChange={(value) => (metadata.editor_name = value)}
              placeholder="Editor name"
            />
            <MetadataField
              label="Illustrator Name"
              value={metadata.illustrator_name}
              disabled={!editMode}
              onChange={(value) => (metadata.illustrator_name = value)}
              placeholder="Illustrator name"
            />
            <MetadataField
              label="Translator Name"
              value={metadata.translator_name}
              disabled={!editMode}
              onChange={(value) => (metadata.translator_name = value)}
              placeholder="Translator name"
            />
            <MetadataSelect
              label="Primary Language"
              value={metadata.primary_language}
              disabled={!editMode}
              onChange={(value) => (metadata.primary_language = value)}
              options={
                classifications?.languages.map((l: any) => ({ code: l.code, name: l.name })) || []
              }
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      {editMode && (
        <div className="flex gap-3 pt-6 border-t dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {updateMutation.isPending ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
          <button
            onClick={() => setEditMode(false)}
            className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg border border-gray-300 dark:border-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          📋 Metadata Tips
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Complete author information improves book discovery and credibility</li>
          <li>• Use relevant keywords to help readers find your book in search results</li>
          <li>• ISBN is required for print distribution; leave blank for e-book only</li>
          <li>• Series information helps readers find related works</li>
        </ul>
      </div>
    </div>
  );
}

// Helper Components
interface MetadataFieldProps {
  label: string;
  value: any;
  disabled: boolean;
  onChange: (value: any) => void;
  type?: string;
  placeholder?: string;
}

function MetadataField({
  label,
  value,
  disabled,
  onChange,
  type = 'text',
  placeholder,
}: MetadataFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
      />
    </div>
  );
}

interface MetadataTextareaProps {
  label: string;
  value: any;
  disabled: boolean;
  onChange: (value: any) => void;
  placeholder?: string;
  rows?: number;
}

function MetadataTextarea({
  label,
  value,
  disabled,
  onChange,
  placeholder,
  rows = 3,
}: MetadataTextareaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 resize-none"
      />
    </div>
  );
}

interface MetadataSelectProps {
  label: string;
  value: any;
  disabled: boolean;
  onChange: (value: any) => void;
  options: any[];
}

function MetadataSelect({
  label,
  value,
  disabled,
  onChange,
  options,
}: MetadataSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
      >
        <option value="">Select an option</option>
        {options.map((option: any) => (
          <option key={option.code || option} value={option.code || option}>
            {option.name || option}
          </option>
        ))}
      </select>
    </div>
  );
}
