export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string | null;
  tags: string[];
  creator_id: string;
  is_public: boolean;
  is_featured: boolean;
  is_verified: boolean;
  usage_count: number;
  rating_sum: number;
  rating_count: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceTemplateDetail extends MarketplaceTemplate {
  chapter_structure?: Record<string, any> | null;
  initial_metadata?: Record<string, any> | null;
  formatting_preset?: string | null;
  matter_config?: Record<string, any> | null;
  sample_content?: string | null;
  reviews: TemplateReview[];
  is_favorited: boolean;
  creator: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TemplateReview {
  id: string;
  template_id: string;
  reviewer_id: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  reviewer: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  order: number;
  template_count: number;
}

export interface MarketplaceTemplateListResponse {
  total_count: number;
  templates: MarketplaceTemplate[];
  featured_templates?: MarketplaceTemplate[] | null;
}

export interface TemplateReviewListResponse {
  total_count: number;
  reviews: TemplateReview[];
  average_rating: number;
}

export interface TemplateCategoryListResponse {
  categories: TemplateCategory[];
}

export interface TemplateSearchQuery {
  q?: string;
  category?: string;
  tags?: string[];
  min_rating?: number;
  sort_by?: "popularity" | "rating" | "recent" | "trending";
  featured_only?: boolean;
  skip?: number;
  limit?: number;
}
