'use client';

import React, { useState } from 'react';
import { useMyTemplates } from '@/hooks/useMarketplace';
import { TemplateCard } from '@/components/marketplace/TemplateCard';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function MyTemplatesPage() {
  const [skip, setSkip] = useState(0);
  const limit = 12;

  const { data, isLoading } = useMyTemplates(skip, limit);

  const templates = data?.templates || [];
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard/marketplace" className="mb-4 inline-block">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Marketplace
                </Button>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">My Templates</h1>
              <p className="mt-1 text-gray-600">
                Manage your published templates and view community feedback
              </p>
            </div>
            <Link href="/dashboard/marketplace/publish">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Publish Template
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading templates...</div>
          </div>
        ) : templates.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSkip(Math.max(0, skip - limit))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSkip(skip + limit)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Plus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No published templates yet</h3>
            <p className="mt-1 text-gray-600">
              Share your writing workflow with the community by publishing a template
            </p>
            <Link href="/dashboard/marketplace/publish">
              <Button className="mt-4">Publish Your First Template</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
