/**
 * Public comments and ratings types
 */

export interface PublicComment {
  id: string;
  public_share_id: string;
  reader_name?: string;
  content: string;
  comment_type?: string;
  likes: number;
  is_approved: boolean;
  created_at: string;
}

export interface PublicRating {
  id: string;
  public_share_id: string;
  rating: number;
  reader_name?: string;
  title?: string;
  review_text?: string;
  created_at: string;
}

export interface RatingsStats {
  average_rating: number;
  total_ratings: number;
  rating_distribution: {
    [key: number]: number;
  };
}

// Request schemas

export interface CreateCommentRequest {
  content: string;
  reader_name?: string;
  reader_email?: string;
  comment_type?: string;
}

export interface CreateRatingRequest {
  rating: number;
  reader_name?: string;
  reader_email?: string;
  title?: string;
  review_text?: string;
}
