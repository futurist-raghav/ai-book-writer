/**
 * Writing goals and metrics types and utilities
 */

export interface WritingGoal {
  daily_target_words: number; // Target words per day
  enabled: boolean;
  start_date?: string;
}

export interface WritingMetrics {
  total_words: number;
  total_chapters: number;
  average_words_per_chapter: number;
  reading_time_minutes: number;
  reading_level: 'elementary' | 'middle_school' | 'high_school' | 'college' | 'professional';
}

type ReadingLevel =
  | 'elementary'
  | 'middle_school'
  | 'high_school'
  | 'college'
  | 'professional';

/**
 * Calculate Flesch-Kincaid reading level
 * Based on: (0.39 × average_sentence_length) + (11.8 × syllables_per_word) - 15.59
 */
export function calculateReadingLevel(
  input: string | number
): ReadingLevel {
  // Some widgets only provide word count and not full text content.
  if (typeof input === 'number') {
    const wordCount = Math.max(0, Math.floor(input));
    if (wordCount < 1500) return 'elementary';
    if (wordCount < 6000) return 'middle_school';
    if (wordCount < 20000) return 'high_school';
    if (wordCount < 60000) return 'college';
    return 'professional';
  }

  const text = input;
  if (!text || text.length === 0) return 'elementary';

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length || 1;

  // Simplified syllable count (count vowel groups)
  const syllableCount = words
    .reduce((sum, word) => {
      const vowels = (word.match(/[aeiouy]/gi) || []).length;
      return sum + Math.max(1, vowels);
    }, 0) || 1;

  const flesch = (0.39 * (wordCount / sentences)) + (11.8 * (syllableCount / wordCount)) - 15.59;

  if (flesch < 6) return 'elementary';
  if (flesch < 9) return 'middle_school';
  if (flesch < 13) return 'high_school';
  if (flesch < 16) return 'college';
  return 'professional';
}

/**
 * Calculate reading time in minutes (average 200 words per minute)
 */
export function calculateReadingTime(wordCount: number): number {
  const WORDS_PER_MINUTE = 200;
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

/**
 * Calculate writing streak days
 */
export function calculateWritingStreak(
  lastEditDates: string[]
): { streak: number; longestStreak: number; currentDate: string; lastEditedDate: string } {
  if (lastEditDates.length === 0) {
    return {
      streak: 0,
      longestStreak: 0,
      currentDate: new Date().toDateString(),
      lastEditedDate: '',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneDayMs = 1000 * 60 * 60 * 24;

  const uniqueDatesDescending = Array.from(
    new Set(
      lastEditDates
        .map((d) => {
          const date = new Date(d);
          date.setHours(0, 0, 0, 0);
          return Number.isNaN(date.getTime()) ? null : date.getTime();
        })
        .filter((value): value is number => value !== null)
    )
  )
    .sort((a, b) => b - a)
    .map((timestamp) => new Date(timestamp));

  if (uniqueDatesDescending.length === 0) {
    return {
      streak: 0,
      longestStreak: 0,
      currentDate: today.toDateString(),
      lastEditedDate: '',
    };
  }

  const dateSet = new Set(uniqueDatesDescending.map((date) => date.getTime()));

  let streak = 0;
  let cursor = new Date(today);

  if (!dateSet.has(cursor.getTime())) {
    const yesterday = new Date(today.getTime() - oneDayMs);
    if (dateSet.has(yesterday.getTime())) {
      cursor = yesterday;
    } else {
      cursor = new Date(NaN);
    }
  }

  while (!Number.isNaN(cursor.getTime()) && dateSet.has(cursor.getTime())) {
    streak += 1;
    cursor = new Date(cursor.getTime() - oneDayMs);
  }

  const uniqueDatesAscending = [...uniqueDatesDescending].reverse();
  let longestStreak = 0;
  let runningStreak = 0;
  let previousTimestamp: number | null = null;

  uniqueDatesAscending.forEach((date) => {
    const timestamp = date.getTime();
    if (previousTimestamp === null) {
      runningStreak = 1;
    } else if (timestamp - previousTimestamp === oneDayMs) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }
    previousTimestamp = timestamp;
    longestStreak = Math.max(longestStreak, runningStreak);
  });

  return {
    streak,
    longestStreak,
    currentDate: today.toDateString(),
    lastEditedDate: uniqueDatesDescending[0]?.toDateString() || '',
  };
}

/**
 * Check if goal was met today
 */
export function wasGoalMetToday(wordCountToday: number, dailyTarget: number): boolean {
  return wordCountToday >= dailyTarget;
}

/**
 * Get progress percentage for today
 */
export function getTodayProgress(wordCountToday: number, dailyTarget: number): number {
  if (dailyTarget === 0) return 0;
  return Math.min(100, Math.round((wordCountToday / dailyTarget) * 100));
}
