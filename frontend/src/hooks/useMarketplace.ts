import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiClient } from "@/lib/api-client";
import {
  MarketplaceTemplate,
  MarketplaceTemplateDetail,
  MarketplaceTemplateListResponse,
  TemplateReviewListResponse,
  TemplateCategoryListResponse,
  TemplateSearchQuery,
} from "@/types/marketplace";

export function useMarketplaceBrowse(
  category?: string,
  tags?: string[],
  minRating?: number,
  sortBy?: string,
  featuredOnly?: boolean,
  skip?: number,
  limit?: number
) {
  return useQuery({
    queryKey: ["marketplace", "browse", { category, tags, minRating, sortBy, featuredOnly, skip, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (tags?.length) tags.forEach(tag => params.append("tags", tag));
      if (minRating) params.append("min_rating", minRating.toString());
      if (sortBy) params.append("sort_by", sortBy);
      if (featuredOnly) params.append("featured_only", "true");
      if (skip !== undefined) params.append("skip", skip.toString());
      if (limit !== undefined) params.append("limit", limit.toString());

      const response = await api.get<MarketplaceTemplateListResponse>(
        `/templates/marketplace?${params.toString()}`
      );
      return response.data;
    },
  });
}

export function useMarketplaceSearch(query: string, category?: string, skip?: number, limit?: number) {
  return useQuery({
    queryKey: ["marketplace", "search", { query, category, skip, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      if (category) params.append("category", category);
      if (skip !== undefined) params.append("skip", skip.toString());
      if (limit !== undefined) params.append("limit", limit.toString());

      const response = await api.get<MarketplaceTemplateListResponse>(
        `/templates/marketplace/search?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!query,
  });
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ["marketplace", "categories"],
    queryFn: async () => {
      const response = await api.get<TemplateCategoryListResponse>(
        `/templates/marketplace/categories`
      );
      return response.data;
    },
  });
}

export function useTemplateDetail(templateId: string) {
  return useQuery({
    queryKey: ["marketplace", "template", templateId],
    queryFn: async () => {
      const response = await api.get<MarketplaceTemplateDetail>(
        `/templates/marketplace/${templateId}`
      );
      return response.data;
    },
    enabled: !!templateId,
  });
}

export function useTemplateReviews(templateId: string, skip?: number, limit?: number) {
  return useQuery({
    queryKey: ["marketplace", "reviews", templateId, { skip, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (skip !== undefined) params.append("skip", skip.toString());
      if (limit !== undefined) params.append("limit", limit.toString());

      const response = await api.get<TemplateReviewListResponse>(
        `/templates/marketplace/${templateId}/reviews?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!templateId,
  });
}

export function useMyTemplates(skip?: number, limit?: number) {
  return useQuery({
    queryKey: ["marketplace", "my-templates", { skip, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (skip !== undefined) params.append("skip", skip.toString());
      if (limit !== undefined) params.append("limit", limit.toString());

      const response = await api.get<MarketplaceTemplateListResponse>(
        `/templates/marketplace/user/my-templates?${params.toString()}`
      );
      return response.data;
    },
  });
}

export function useFavoriteTemplates(skip?: number, limit?: number) {
  return useQuery({
    queryKey: ["marketplace", "favorites", { skip, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (skip !== undefined) params.append("skip", skip.toString());
      if (limit !== undefined) params.append("limit", limit.toString());

      const response = await api.get<MarketplaceTemplateListResponse>(
        `/templates/marketplace/user/favorites?${params.toString()}`
      );
      return response.data;
    },
  });
}

export function useFavoriteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await api.post(`/templates/marketplace/${templateId}/favorite`);
    },
    onSuccess: (_data, templateId) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "template", templateId] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "favorites"] });
    },
  });
}

export function useUnfavoriteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`/templates/marketplace/${templateId}/favorite`);
    },
    onSuccess: (_data, templateId) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "template", templateId] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "favorites"] });
    },
  });
}

export function useCreateTemplateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      rating,
      title,
      content,
    }: {
      templateId: string;
      rating: number;
      title?: string;
      content?: string;
    }) => {
      const response = await api.post(
        `/templates/marketplace/${templateId}/reviews`,
        { rating, title, content }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "reviews", variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "template", variables.templateId] });
    },
  });
}

export function useCreateBookFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // This endpoint doesn't exist yet in backend, but we can create it
      // For now, we'll create a book with template data
      const response = await apiClient.books.create({
        title: `Book from Template`,
        description: 'Created from marketplace template',
        project_type: 'novel',
        project_settings: { template_id: templateId },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}
