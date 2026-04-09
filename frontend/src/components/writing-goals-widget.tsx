/**
 * Daily Writing Goal Widget
 * Shows today's writing progress and writing streak
 */

'use client';

import { useEffect, useState } from 'react';
import { getTodayProgress, wasGoalMetToday, calculateWritingStreak } from '@/lib/writing-metrics';

interface WritingGoalsWidgetProps {
  dailyTarget: number; // Target words per day
  wordCountToday: number; // Words written today
  lastEditDates: string[]; // Array of edit dates for streak calculation
}

export function WritingGoalsWidget({
  dailyTarget,
  wordCountToday,
  lastEditDates,
}: WritingGoalsWidgetProps) {
  const [streak, setStreak] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const { streak: calculatedStreak } = calculateWritingStreak(lastEditDates);
    setStreak(calculatedStreak);
  }, [lastEditDates]);

  if (!isMounted) return null;

  if (dailyTarget === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
        <p className="text-sm text-on-surface-variant">
          Set a daily writing goal in project settings to get started!
        </p>
      </div>
    );
  }

  const progress = getTodayProgress(wordCountToday, dailyTarget);
  const goalMet = wasGoalMetToday(wordCountToday, dailyTarget);
  const remaining = Math.max(0, dailyTarget - wordCountToday);

  return (
    <div className="bg-gradient-to-br from-tertiary-container/40 to-secondary-container/20 rounded-xl p-6 border border-outline-variant/10">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-1">
            Today's Writing Goal
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-body font-bold text-primary">{wordCountToday}</span>
            <span className="text-sm text-on-surface-variant">/ {dailyTarget} words</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-body font-bold text-secondary">{streak}</div>
          <div className="font-label text-xs text-on-surface-variant uppercase tracking-tight">Day Streak</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              goalMet
                ? 'bg-gradient-to-r from-secondary to-tertiary'
                : 'bg-gradient-to-r from-tertiary-container to-tertiary'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-label text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
            Progress
          </span>
          <span className={`font-label text-[10px] font-bold uppercase tracking-tight ${
            goalMet ? 'text-secondary' : 'text-tertiary-container'
          }`}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Goal status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
        goalMet
          ? 'bg-secondary/10'
          : 'bg-tertiary-container/20'
      }`}>
        <span className={`material-symbols-outlined text-sm ${
          goalMet ? 'text-secondary' : 'text-tertiary-container'
        }`}>
          {goalMet ? 'check_circle' : 'schedule'}
        </span>
        <span className={`font-label text-sm font-semibold ${
          goalMet
            ? 'text-secondary'
            : 'text-tertiary-container'
        }`}>
          {goalMet ? '✨ Goal achieved!' : `${remaining} words to go`}
        </span>
      </div>

      {/* Motivation message */}
      <div className="mt-3 pt-3 border-t border-outline-variant/10">
        <p className="font-body text-xs text-on-surface-variant">
          {streak >= 7
            ? `🔥 Amazing! You're on a ${streak}-day writing streak!`
            : streak >= 3
              ? `💪 Keep it up! ${streak}-day streak active!`
              : streak > 0
                ? `👏 You've written ${streak} day${streak > 1 ? 's' : ''} in a row!`
                : '📝 Start your writing streak today!'}
        </p>
      </div>
    </div>
  );
}
