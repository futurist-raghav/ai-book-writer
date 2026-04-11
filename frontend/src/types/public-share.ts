/**
 * Types for public sharing and feedback
 */

export interface BookFeedback {
  id: string;
  reader_name?: string;
  reader_email?: string;
  rating?: number;
  title?: string;
  content: string;
  feedback_type?: string;
  created_at: string;
  author_response?: string;
  author_responded_at?: string;
}

export interface PublicShare {
  id: string;
  share_token: string;
  is_active: boolean;
  allow_comments: boolean;
  allow_ratings: boolean;
  created_at: string;
  view_count: number;
  unique_viewers: number;
  expires_at?: string;
}

export interface BookRating {
  book_id: string;
  total_ratings: number;
  average_rating: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  updated_at: string;
}

export interface PublicShareDetail {
  share: PublicShare;
  feedback: BookFeedback[];
  rating?: BookRating;
}
