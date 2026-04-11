'use client';

import React, { useState } from 'react';
import { useMarketplaceBrowse, useTemplateCategories, useFavoriteTemplate, useUnfavoriteTemplate } from '@/hooks/useMarketplace';
import { TemplateCard } from '@/components/marketplace/TemplateCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function MarketplacePage() {
  const [category, setCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [search, setSearch] = useState<string>('');
  const [skip, setSkip] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const limit = 12;

  const { data: browseData, isLoading: isBrowseLoading } = useMarketplaceBrowse(
    category || undefined,
    undefined,
    undefined,
    sortBy,
    false,
    skip,
    limit
  );

  const { data: categoriesData } = useTemplateCategories();

  const favoriteMutation = useFavoriteTemplate();
  const unfavoriteMutation = useUnfavoriteTemplate();

  const handleFavorite = async (templateId: string) => {
    if (favorites.has(templateId)) {
      setFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
      unfavoriteMutation.mutate(templateId);
    } else {
      setFavorites(prev => new Set(prev).add(templateId));
      favoriteMutation.mutate(templateId);
    }
  };

  const templates = browseData?.templates || [];
  const featured = browseData?.featured_templates || [];
  const totalCount = browseData?.total_count || 0;

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Template Marketplace</h1>
              <p className="mt-1 text-gray-600">
                Discover templates and workflows shared by our community
              </p>
            </div>
            <Link href="/dashboard/marketplace/my-templates">
              <Button variant="outline">My Templates</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Featured Section */}
        {featured && featured.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Featured Templates</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onFavorite={handleFavorite}
                  isFavorited={favorites.has(template.id)}
                  isLoading={favoriteMutation.isPending || unfavoriteMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSkip(0);
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <option value="">All Categories</option>
                {categoriesData?.categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setSkip(0);
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <option value="popularity">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="recent">Most Recent</option>
                <option value="trending">Trending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        {isBrowseLoading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading templates...</div>
          </div>
        ) : templates.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onFavorite={handleFavorite}
                  isFavorited={favorites.has(template.id)}
                  isLoading={favoriteMutation.isPending || unfavoriteMutation.isPending}
                />
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
            <Filter className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No templates found</h3>
            <p className="mt-1 text-gray-600">
              Try adjusting your search filters or browse featured templates
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
