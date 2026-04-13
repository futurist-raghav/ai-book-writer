/**
 * Glossary API client methods
 * 
 * Provides type-safe access to glossary extraction and management endpoints.
 */

import { GlossaryEntryCreate, GlossaryEntryUpdate, GlossaryExtractionInput } from '@/types/glossary';
import { api as baseApiClient } from './api-client';

export const glossaryApiMethods = {
  /**
   * Extract glossary candidates from a book
   */
  extract: async (bookId: string, input: GlossaryExtractionInput) => {
    const response = await baseApiClient.post(`/books/${bookId}/glossary/extract`, input);
    return response.data;
  },

  /**
   * Confirm extracted terms and save to glossary
   */
  confirmExtraction: async (bookId: string, terms: string[]) => {
    const response = await baseApiClient.post(`/books/${bookId}/glossary/confirm-extraction`, {
      terms,
    });
    return response.data;
  },

  /**
   * List glossary entries
   */
  list: async (bookId: string, confirmedOnly?: boolean) => {
    const response = await baseApiClient.get(`/books/${bookId}/glossary`, {
      params: { confirmed_only: confirmedOnly },
    });
    return response.data;
  },

  /**
   * Get a specific glossary entry
   */
  get: async (bookId: string, entryId: string) => {
    const response = await baseApiClient.get(`/books/${bookId}/glossary/${entryId}`);
    return response.data;
  },

  /**
   * Create a new glossary entry
   */
  create: async (bookId: string, entry: GlossaryEntryCreate) => {
    const response = await baseApiClient.post(`/books/${bookId}/glossary`, entry);
    return response.data;
  },

  /**
   * Update a glossary entry
   */
  update: async (bookId: string, entryId: string, updates: GlossaryEntryUpdate) => {
    const response = await baseApiClient.patch(`/books/${bookId}/glossary/${entryId}`, updates);
    return response.data;
  },

  /**
   * Delete a glossary entry
   */
  delete: async (bookId: string, entryId: string) => {
    await baseApiClient.delete(`/books/${bookId}/glossary/${entryId}`);
  },
};
