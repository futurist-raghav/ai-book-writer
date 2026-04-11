/**
 * Glossary TypeScript types for frontend
 */

export interface GlossaryExtractionInput {
  confidence_threshold?: number;
  max_terms?: number;
  include_chapters?: string[];
}

export interface GlossaryExtractionCandidate {
  term: string;
  frequency: number;
  confidence: number;
  part_of_speech?: string;
  sample_context?: string;
  chapter_mentions?: Record<string, number>;
  from_chapters?: string[];
  suggested_definition?: string;
}

export interface GlossaryExtractionResponse {
  candidates: GlossaryExtractionCandidate[];
  analyzed_chapters: number;
  total_terms_found: number;
  extraction_time_ms: number;
  note: string;
}

export interface GlossaryEntryCreate {
  term: string;
  definition?: string;
  definition_source?: string;
  part_of_speech?: string;
  context?: string;
  user_defined?: boolean;
}

export interface GlossaryEntryUpdate {
  definition?: string;
  definition_source?: string;
  part_of_speech?: string;
  context?: string;
  confirmed?: boolean;
}

export interface GlossaryEntryResponse {
  id: string;
  book_id: string;
  term: string;
  definition?: string;
  definition_source?: string;
  confirmed: boolean;
  part_of_speech?: string;
  context?: string;
  frequency: number;
  chapter_mentions?: Record<string, number>;
  user_defined: boolean;
  created_at: string;
  updated_at: string;
}

export interface GlossaryListResponse {
  entries: GlossaryEntryResponse[];
  total: number;
  confirmed: number;
  suggested: number;
}
