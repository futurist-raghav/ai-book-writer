'use client';

import React from 'react';
import Link from 'next/link';
import { MarketplaceTemplate } from '@/types/marketplace';
import { Heart, Star, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TemplateCardProps {
  template: MarketplaceTemplate;
  onFavorite?: (id: string) => void;
  isFavorited?: boolean;
  isLoading?: boolean;
}

export function TemplateCard({
  template,
  onFavorite,
  isFavorited = false,
  isLoading = false,
}: TemplateCardProps) {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onFavorite?.(template.id);
  };

  const averageRating = template.rating_count > 0
    ? (template.rating_sum / template.rating_count).toFixed(1)
    : '0.0';

  return (
    <Link href={`/dashboard/marketplace/${template.id}`}>
      <div className="group relative flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-md">
        {/* Header with favorite button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600">
              {template.name}
            </h3>
            {template.is_verified && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                ✓ Verified
              </div>
            )}
          </div>
          <button
            onClick={handleFavoriteClick}
            disabled={isLoading}
            className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Heart
              className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
            />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2">
          {template.description}
        </p>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                +{template.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="font-medium text-gray-700">{averageRating}</span>
            <span className="text-gray-400">({template.rating_count})</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            <span>{template.usage_count}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
