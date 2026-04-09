/**
 * Writing Statistics & Analytics Dashboard
 * Comprehensive view of writing metrics, streaks, and achievements
 */

'use client';

import { useEffect, useState } from 'react';
import { calculateReadingTime, calculateReadingLevel, calculateWritingStreak } from '@/lib/writing-metrics';

interface WritingAnalyticsDashboardProps {
  projects: Array<{
    id: string;
    title: string;
    wordCount: number;
    status: string;
    editDates: string[];
  }>;
  totalWordCount: number;
  editHistory: Array<{
    date: string;
    wordCount: number;
  }>;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: any) => boolean;
  color: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-draft',
    name: 'First Words',
    description: 'Write your first 100 words',
    icon: '✏️',
    condition: (stats) => stats.totalWords >= 100,
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 'one-k-club',
    name: '1K Club',
    description: 'Reach 1,000 words',
    icon: '🎯',
    condition: (stats) => stats.totalWords >= 1000,
    color: 'from-purple-400 to-purple-600',
  },
  {
    id: 'ten-k-milestone',
    name: '10K Milestone',
    description: 'Reach 10,000 words',
    icon: '🚀',
    condition: (stats) => stats.totalWords >= 10000,
    color: 'from-pink-400 to-pink-600',
  },
  {
    id: 'century',
    name: 'Century Writer',
    description: 'Write 100,000 words',
    icon: '🏆',
    condition: (stats) => stats.totalWords >= 100000,
    color: 'from-yellow-400 to-yellow-600',
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day writing streak',
    icon: '🔥',
    condition: (stats) => stats.longestStreak >= 7,
    color: 'from-orange-400 to-orange-600',
  },
  {
    id: 'month-master',
    name: 'Month Master',
    description: 'Maintain a 30-day writing streak',
    icon: '⭐',
    condition: (stats) => stats.longestStreak >= 30,
    color: 'from-red-400 to-red-600',
  },
  {
    id: 'consistency-king',
    name: 'Consistency King',
    description: 'Write 100+ days total',
    icon: '👑',
    condition: (stats) => stats.totalDaysWritten >= 100,
    color: 'from-indigo-400 to-indigo-600',
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Write 5,000+ words in a day',
    icon: '⚡',
    condition: (stats) => stats.maxWordsPerDay >= 5000,
    color: 'from-cyan-400 to-cyan-600',
  },
];

export function WritingAnalyticsDashboard({
  projects,
  totalWordCount,
  editHistory,
}: WritingAnalyticsDashboardProps) {
  const [stats, setStats] = useState({
    totalWords: totalWordCount,
    projectCount: projects.length,
    longestStreak: 0,
    currentStreak: 0,
    totalDaysWritten: 0,
    maxWordsPerDay: 0,
    avgWordsPerDay: 0,
    readingTime: 0,
    readingLevel: '',
  });

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    calculateStats();
  }, [projects, totalWordCount, editHistory]);

  const calculateStats = () => {
    // Combine all edit dates from all projects
    const allEditDates = new Set<string>();
    projects.forEach((project) => {
      project.editDates.forEach((date) => allEditDates.add(date));
    });

    const { streak: currentStreak, longestStreak } = calculateWritingStreak(
      Array.from(allEditDates)
    );

    // Calculate max words per day
    const maxWordsPerDay = editHistory.length > 0
      ? Math.max(...editHistory.map((e) => e.wordCount))
      : 0;

    // Calculate total days written
    const totalDaysWritten = editHistory.length;

    // Calculate average words per day
    const avgWordsPerDay = totalDaysWritten > 0
      ? Math.round(totalWordCount / totalDaysWritten)
      : 0;

    // Calculate reading time and level
    const readingTime = calculateReadingTime(totalWordCount);
    const readingLevel = calculateReadingLevel(totalWordCount);

    const newStats = {
      totalWords: totalWordCount,
      projectCount: projects.length,
      longestStreak,
      currentStreak,
      totalDaysWritten,
      maxWordsPerDay,
      avgWordsPerDay,
      readingTime,
      readingLevel,
    };

    setStats(newStats);

    // Check which achievements are unlocked
    const unlockedAchievements = ACHIEVEMENTS.filter((achievement) =>
      achievement.condition(newStats)
    );
    setAchievements(unlockedAchievements);
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-container to-secondary-container rounded-xl p-6">
        <h1 className="font-display text-2xl font-bold text-on-primary-container mb-2">
          Writing Statistics
        </h1>
        <p className="font-body text-sm text-on-primary-container/80">
          Track your progress and celebrate your achievements
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Words */}
        <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10">
          <div className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-2">
            Total Words
          </div>
          <div className="font-display text-2xl font-bold text-primary">
            {stats.totalWords.toLocaleString()}
          </div>
        </div>

        {/* Projects */}
        <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10">
          <div className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-2">
            Projects
          </div>
          <div className="font-display text-2xl font-bold text-secondary">
            {stats.projectCount}
          </div>
        </div>

        {/* Current Streak */}
        <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10">
          <div className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-2">
            Current Streak
          </div>
          <div className="font-display text-2xl font-bold text-tertiary">
            {stats.currentStreak}
          </div>
          <div className="font-body text-xs text-on-surface-variant mt-1">days 🔥</div>
        </div>

        {/* Reading Time */}
        <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10">
          <div className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-2">
            Reading Time
          </div>
          <div className="font-display text-2xl font-bold text-tertiary-container">
            {stats.readingTime}
          </div>
          <div className="font-body text-xs text-on-surface-variant mt-1">minutes</div>
        </div>

        {/* Avg Per Day */}
        <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10">
          <div className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-2">
            Avg/Day
          </div>
          <div className="font-display text-2xl font-bold text-secondary-container">
            {stats.avgWordsPerDay.toLocaleString()}
          </div>
          <div className="font-body text-xs text-on-surface-variant mt-1">words</div>
        </div>
      </div>

      {/* Achievements Section */}
      <div>
        <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
          🏅 Achievements ({achievements.length} of {ACHIEVEMENTS.length})
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((achievement) => {
            const isUnlocked = achievements.some((a) => a.id === achievement.id);

            return (
              <div
                key={achievement.id}
                className={`rounded-lg p-4 border transition-all ${
                  isUnlocked
                    ? `border-outline bg-gradient-to-br ${achievement.color} text-white shadow-lg`
                    : 'border-outline-variant/10 bg-surface-container-lowest text-on-surface-variant opacity-50'
                }`}
              >
                <div className="text-3xl mb-2">{achievement.icon}</div>
                <h3 className={`font-label text-sm font-bold mb-1 ${
                  isUnlocked ? 'text-white' : 'text-on-surface-variant'
                }`}>
                  {achievement.name}
                </h3>
                <p className={`font-body text-xs ${
                  isUnlocked ? 'text-white/90' : 'text-on-surface-variant'
                }`}>
                  {achievement.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* All-Time Stats */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
          <h3 className="font-headline text-base font-bold text-on-surface mb-4">
            All-Time Stats
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Total Words Written</span>
              <span className="font-body font-bold text-on-surface">
                {stats.totalWords.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Days Written</span>
              <span className="font-body font-bold text-on-surface">
                {stats.totalDaysWritten}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Average Per Day</span>
              <span className="font-body font-bold text-on-surface">
                {stats.avgWordsPerDay.toLocaleString()} words
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Max Per Day</span>
              <span className="font-body font-bold text-on-surface">
                {stats.maxWordsPerDay.toLocaleString()} words
              </span>
            </div>
          </div>
        </div>

        {/* Reading Metrics */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
          <h3 className="font-headline text-base font-bold text-on-surface mb-4">
            Reading Metrics
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Total Word Count</span>
              <span className="font-body font-bold text-on-surface">
                {stats.totalWords.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Reading Time</span>
              <span className="font-body font-bold text-on-surface">
                {stats.readingTime} minutes
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-on-surface-variant">Reading Level</span>
              <span className="font-body font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">school</span>
                {formatReadingLevel(stats.readingLevel)}
              </span>
            </div>
            <div className="pt-3 border-t border-outline-variant/10">
              <p className="font-body text-xs text-on-surface-variant">
                💡 Tip: More complex writing engages readers at deeper levels!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatReadingLevel(level: string): string {
  const levelMap: Record<string, string> = {
    elementary: 'Elementary',
    middle_school: 'Middle School',
    high_school: 'High School',
    college: 'College',
    professional: 'Professional',
  };
  return levelMap[level] || 'Unknown';
}
