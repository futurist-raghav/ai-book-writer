'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface PublishTemplateFormData {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  chapter_structure?: any;
  initial_metadata?: any;
  formatting_preset?: string;
  matter_config?: any;
  sample_content?: string;
  is_public: boolean;
}

export default function PublishTemplatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PublishTemplateFormData>({
    name: '',
    description: '',
    category: 'novel',
    tags: [],
    is_public: true,
  });
  const [tagInput, setTagInput] = useState('');
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');

  // Fetch user's books
  const { data: booksData } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const response = await apiClient.books.list({ limit: 100 });
      return response;
    },
  });

  React.useEffect(() => {
    if (booksData) {
      setBooks(booksData);
    }
  }, [booksData]);

  const publishMutation = useMutation({
    mutationFn: async (data: PublishTemplateFormData) => {
      const response = await axios.post('/api/v1/templates/marketplace', data);
      return response.data;
    },
    onSuccess: (data) => {
      router.push(`/dashboard/marketplace/${data.id}`);
    },
  });

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!formData.tags.includes(newTag)) {
        setFormData({
          ...formData,
          tags: [...formData.tags, newTag],
        });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handlePublish = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      alert('Please fill in name and description');
      return;
    }

    publishMutation.mutate(formData);
  };

  const categories = [
    'novel',
    'screenplay',
    'memoir',
    'academic',
    'textbook',
    'poetry',
    'songwriting',
    'newsletter',
    'blog',
    'research_paper',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/dashboard/marketplace">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Publish a Template</h1>
          <p className="mt-1 text-gray-600">
            Share your writing workflow with the community
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Step Indicator */}
        <div className="mb-8 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-colors ${
                  s <= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`h-1 flex-1 transition-colors ${
                    s < step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Template Details */}
        {step === 1 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Template Details
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Hero's Journey Novel Structure"
                  maxLength={255}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe what this template includes, who it's for, and what makes it unique..."
                  rows={4}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcategory (optional)
                </label>
                <Input
                  type="text"
                  value={formData.subcategory || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, subcategory: e.target.value })
                  }
                  placeholder="e.g., Fantasy, Mystery, Psychological Thriller"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (press Enter to add)
                </label>
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tags like 'beginner-friendly', '3-act', etc."
                />
                {formData.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-blue-500 hover:text-blue-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Visibility */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="public"
                  checked={formData.is_public}
                  onChange={(e) =>
                    setFormData({ ...formData, is_public: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="public" className="text-sm font-medium text-gray-700">
                  Make template public (visible to all users)
                </label>
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="outline" disabled>
                Previous
              </Button>
              <Button onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 2: Optional Content */}
        {step === 2 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Optional: Template Content
            </h2>

            <div className="space-y-4">
              {/* Sample Content Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sample Content / Preview
                </label>
                <Textarea
                  value={formData.sample_content || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, sample_content: e.target.value })
                  }
                  placeholder="Add a sample section or excerpt to help users understand this template"
                  rows={4}
                />
              </div>

              {/* Formatting Preset */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formatting Preset (optional)
                </label>
                <Input
                  type="text"
                  value={formData.formatting_preset || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, formatting_preset: e.target.value })
                  }
                  placeholder="Reference to a formatting theme preset"
                />
              </div>

              <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                💡 Tip: Chapter structure and metadata will be extracted from your
                selected book automatically in the next step.
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Previous
              </Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Publish */}
        {step === 3 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Review & Publish
            </h2>

            {/* Summary */}
            <div className="space-y-4 rounded-lg bg-gray-50 p-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Template Name
                </p>
                <p className="mt-1 text-gray-900">{formData.name || '(Not provided)'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Description
                </p>
                <p className="mt-1 text-gray-900">
                  {formData.description || '(Not provided)'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Category
                  </p>
                  <p className="mt-1 text-gray-900">{formData.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Visibility
                  </p>
                  <p className="mt-1 text-gray-900">
                    {formData.is_public ? 'Public' : 'Private'}
                  </p>
                </div>
              </div>
              {formData.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                ⚠️ By publishing, you agree that this template will be publicly
                available and other users can use it. You can update or delete it
                anytime from your published templates.
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Previous
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {publishMutation.isPending ? 'Publishing...' : 'Publish Template'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
