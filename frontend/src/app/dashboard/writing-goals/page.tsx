'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useBookStore } from '@/stores/book-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Flame, Target, TrendingUp, Award } from 'lucide-react';
import { toast } from 'sonner';

interface WritingGoal {
  daily_target: number;
  weekly_target: number;
  monthly_target: number;
  genre_benchmark: number;
}

interface WritingStreak {
  current_streak: number;
  longest_streak: number;
  last_write_date: string;
}

export default function WritingGoalsPage() {
  const { selectedBook } = useBookStore();
  const [goals, setGoals] = useState<WritingGoal>({
    daily_target: 1000,
    weekly_target: 7000,
    monthly_target: 30000,
    genre_benchmark: 0,
  });

  // Fetch streak data
  const { data: streakData } = useQuery({
    queryKey: ['writing-streak', selectedBook?.id],
    queryFn: async () => {
      if (!selectedBook) return null;
      const response = await api.get(`/books/${selectedBook.id}/writing-streak`);
      return response.data as WritingStreak;
    },
    enabled: !!selectedBook,
  });

  // Fetch today's progress
  const { data: todayProgress } = useQuery({
    queryKey: ['today-progress', selectedBook?.id],
    queryFn: async () => {
      if (!selectedBook) return null;
      const response = await api.get(`/books/${selectedBook.id}/analytics/today`);
      return response.data;
    },
    enabled: !!selectedBook,
  });

  const handleSaveGoals = async () => {
    try {
      if (!selectedBook) return;
      await api.put(`/books/${selectedBook.id}/writing-goals`, goals);
      toast.success('Goals saved!');
    } catch {
      toast.error('Failed to save goals');
    }
  };

  if (!selectedBook) {
    return <div className="flex items-center justify-center h-screen">Select a project first</div>;
  }

  const todayWords = todayProgress?.words_written || 0;
  const todayProgress_percent = Math.min(100, (todayWords / goals.daily_target) * 100);
  const streakBg = (streakData?.current_streak || 0) >= 7 ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Writing Goals</h1>
          <p className="text-gray-600 mt-2">Track your progress toward daily, weekly, and monthly targets</p>
        </div>

        {/* Streak Card */}
        <div className={`${streakBg} rounded-lg border border-yellow-200 p-6 mb-8`}>
          <div className="flex items-center gap-4">
            <Flame className="h-10 w-10 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">Current Writing Streak</p>
              <p className="text-4xl font-bold text-gray-900">{streakData?.current_streak || 0} days</p>
              <p className="text-xs text-gray-500 mt-1">Longest: {streakData?.longest_streak || 0} days</p>
            </div>
            <div className="text-right">
              {(streakData?.current_streak || 0) >= 7 && (
                <div className="inline-flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
                  <Award className="h-4 w-4" />
                  <span className="text-sm font-medium">Week Streak!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's Progress */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Today's Progress</h2>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-3xl font-bold text-primary">{todayWords}</p>
                <p className="text-gray-600">/ {goals.daily_target} words</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${todayProgress_percent}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{Math.round(todayProgress_percent)}%</p>
              <p className="text-sm text-gray-600">complete</p>
            </div>
          </div>
        </div>

        {/* Goals Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-6">Set Your Targets</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Target className="inline h-4 w-4 mr-2" />
                Daily Target (words)
              </label>
              <Input
                type="number"
                value={goals.daily_target}
                onChange={(e) => setGoals({ ...goals, daily_target: parseInt(e.target.value) })}
                min="100"
                step="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TrendingUp className="inline h-4 w-4 mr-2" />
                Weekly Target (words)
              </label>
              <Input
                type="number"
                value={goals.weekly_target}
                onChange={(e) => setGoals({ ...goals, weekly_target: parseInt(e.target.value) })}
                min="500"
                step="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Award className="inline h-4 w-4 mr-2" />
                Monthly Target (words)
              </label>
              <Input
                type="number"
                value={goals.monthly_target}
                onChange={(e) => setGoals({ ...goals, monthly_target: parseInt(e.target.value) })}
                min="1000"
                step="1000"
              />
            </div>
          </div>

          <Button onClick={handleSaveGoals} className="w-full">
            Save Goals
          </Button>
        </div>

        {/* Genre Benchmarks */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <h3 className="font-semibold text-blue-900 mb-3">Genre Writing Benchmarks</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>📚 <strong>Novel:</strong> 1,000-3,000 words/day (professional), 500-1,500 (hobbyist)</p>
            <p>📰 <strong>Non-fiction:</strong> 500-1,500 words/day average</p>
            <p>🎬 <strong>Screenplay:</strong> 5-10 pages/day (1,500-3,000 words)</p>
            <p>🎓 <strong>Academic:</strong> 500-1,000 words/day</p>
          </div>
        </div>
      </div>
    </div>
  );
}
