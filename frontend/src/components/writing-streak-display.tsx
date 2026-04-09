/**
 * Writing Streak Display Component
 * Shows the user's current writing streak and milestone achievements
 */

'use client';

import { useEffect, useState } from 'react';
import { calculateWritingStreak } from '@/lib/writing-metrics';

interface WritingStreakDisplayProps {
  lastEditDates: string[]; // Array of dates in YYYY-MM-DD format
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export function WritingStreakDisplay({
  lastEditDates,
  size = 'md',
  showDetails = true,
}: WritingStreakDisplayProps) {
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const { streak: currentStreak, longestStreak: longest } = calculateWritingStreak(
      lastEditDates
    );
    setStreak(currentStreak);
    setLongestStreak(longest);
  }, [lastEditDates]);

  if (!isMounted) return null;

  const getStreakMessage = (current: number) => {
    if (current === 0) return '📝 Start your streak today!';
    if (current === 1) return '🎉 Day 1! Off to a great start!';
    if (current < 7) return `💪 ${current} days in! Keep going!`;
    if (current < 14) return `🔥 ${current} days! You\'re on fire!`;
    if (current < 30) return `⭐ ${current} days! Incredible dedication!`;
    if (current < 100) return `🚀 ${current} days! You\'re unstoppable!`;
    return `🏆 ${current} days! Absolute legend!`;
  };

  const getMilestoneEmoji = (milestone: number) => {
    if (milestone < 7) return '🌱'; // Seedling
    if (milestone < 14) return '🔥'; // Fire
    if (milestone < 30) return '⭐'; // Star
    if (milestone < 100) return '🚀'; // Rocket
    return '🏆'; // Trophy
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'p-3',
          number: 'text-2xl',
          label: 'text-xs',
        };
      case 'lg':
        return {
          container: 'p-6',
          number: 'text-5xl',
          label: 'text-sm',
        };
      case 'md':
      default:
        return {
          container: 'p-4',
          number: 'text-3xl',
          label: 'text-sm',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div
      className={`rounded-xl border border-outline-variant/10 bg-gradient-to-br from-tertiary-container/30 to-secondary-container/10 ${sizeClasses.container}`}
    >
      {/* Main Streak Display */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className={`font-body font-bold text-tertiary ${sizeClasses.number}`}>
            {streak}
          </span>
          <span className={`font-label font-semibold text-on-surface-variant uppercase tracking-tight ${sizeClasses.label}`}>
            Day Streak
          </span>
        </div>
        <span className="text-3xl">{getMilestoneEmoji(streak)}</span>
      </div>

      {/* Motivational Message */}
      {showDetails && (
        <>
          <p className="font-body text-sm text-on-surface-variant mb-3">
            {getStreakMessage(streak)}
          </p>

          {/* Longest Streak Info */}
          {longestStreak > 0 && longestStreak !== streak && (
            <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/10">
              <span className="material-symbols-outlined text-sm text-secondary">trophy</span>
              <span className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-tight">
                Personal Best: {longestStreak} days
              </span>
            </div>
          )}

          {/* Milestones */}
          <div className="mt-3 space-y-2">
            {/* 7-day milestone */}
            {streak >= 7 ? (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-tertiary-container/30">
                <span className="text-sm">🔥</span>
                <span className="font-label text-xs font-semibold text-on-surface">7-Day Hero Unlocked!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface-container-high/30">
                <span className="text-sm">🔥</span>
                <span className="font-label text-xs font-semibold text-on-surface-variant">
                  {7 - streak} days to 7-Day Hero
                </span>
              </div>
            )}

            {/* 30-day milestone */}
            {streak >= 30 ? (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-secondary-container/30">
                <span className="text-sm">🚀</span>
                <span className="font-label text-xs font-semibold text-on-surface">
                  Writing Warrior (30 Days) Unlocked!
                </span>
              </div>
            ) : (
              streak > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface-container-high/30">
                  <span className="text-sm">🚀</span>
                  <span className="font-label text-xs font-semibold text-on-surface-variant">
                    {30 - streak} days to Writing Warrior
                  </span>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact streak badge for headers and cards
 */
export function WritingStreakBadge({ lastEditDates }: { lastEditDates: string[] }) {
  const [streak, setStreak] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const { streak: currentStreak } = calculateWritingStreak(lastEditDates);
    setStreak(currentStreak);
  }, [lastEditDates]);

  if (!isMounted || streak === 0) return null;

  const getStreakColor = (current: number) => {
    if (current < 7) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-100';
    if (current < 30) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100';
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-100';
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-label text-xs font-semibold ${getStreakColor(
        streak
      )}`}
    >
      <span className="material-symbols-outlined text-sm">local_fire_department</span>
      <span>{streak} day streak</span>
    </div>
  );
}

/**
 * Streak progress ring for dashboard
 */
export function StreakProgressRing({ lastEditDates }: { lastEditDates: string[] }) {
  const [streak, setStreak] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const { streak: currentStreak } = calculateWritingStreak(lastEditDates);
    setStreak(currentStreak);
  }, [lastEditDates]);

  if (!isMounted) return null;

  // Use 30 days as the target for the progress ring
  const targetDays = 30;
  const progress = Math.min((streak / targetDays) * 100, 100);
  const circumference = 2 * Math.PI * 45; // r = 45
  const offset = circumference - (progress / 100) * circumference;

  const getColor = (current: number) => {
    if (current === 0) return '#6e40aa';
    if (current < 7) return '#ffa500';
    if (current < 14) return '#ff4500';
    if (current < 30) return '#dc2626';
    return '#7c3aed';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle cx="60" cy="60" r="45" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.1" />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={getColor(streak)}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Center text */}
        <text x="60" y="65" textAnchor="middle" fontSize="24" fontWeight="bold" fill={getColor(streak)}>
          {streak}
        </text>
        <text x="60" y="80" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">
          days
        </text>
      </svg>
      <p className="font-label text-xs font-semibold text-on-surface-variant text-center">
        {Math.ceil(targetDays - streak)} days to Legend
      </p>
    </div>
  );
}
