/**
 * Analytics types for writing metrics and insights
 */

export interface DailyWritingData {
  date: string | null;
  words_written: number;
  edits: number;
}

export interface VelocityData {
  period_days: number;
  total_words: number;
  avg_words_per_day: number;
  daily_breakdown: DailyWritingData[];
}

export interface ProductivityData {
  period_days: number;
  days_written: number;
  sessions_per_week: number;
  consistency_score: number;
}

export interface PacingData {
  current_word_count: number;
  word_count_goal: number;
  progress_percent: number;
  words_remaining: number;
  estimated_days_to_completion: number | null;
  estimated_completion_date: string | null;
}

export interface ChapterBreakdownItem {
  chapter_id: string;
  chapter_number: number;
  title: string;
  word_count: number;
  type: string;
  status: string;
}

export interface FullAnalyticsResponse {
  book_id: string;
  period_days: number;
  generated_at: string;
  velocity: VelocityData;
  productivity: ProductivityData;
  pacing: PacingData;
  chapter_breakdown: ChapterBreakdownItem[];
}
