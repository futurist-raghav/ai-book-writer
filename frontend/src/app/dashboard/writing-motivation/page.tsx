'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Zap, 
  Target, 
  Star, 
  Award,
  TrendingUp,
  Flame,
  BookOpen,
  Rocket
} from 'lucide-react';

interface Achievement {
  milestone: number;
  name: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
}

interface Challenge {
  challenge_id: string;
  name: string;
  description: string;
  target_words: number;
  duration_days: number;
  icon: string;
  difficulty: string;
  reward: string;
  progress: number;
  in_progress: boolean;
  completed: boolean;
}

interface AchievementsData {
  total_words: number;
  longest_streak: number;
  word_milestones: Achievement[];
  streak_achievements: Achievement[];
  total_unlocked: number;
}

interface ChallengesData {
  available_challenges: Challenge[];
  active_count: number;
  completed_count: number;
}

const AchievementIcon = ({ icon }: { icon: string }) => {
  switch (icon) {
    case 'milestone':
      return <Target className="h-6 w-6 text-blue-600" />;
    case 'trophy':
      return <Trophy className="h-6 w-6 text-purple-600" />;
    case 'crown':
      return <Award className="h-6 w-6 text-yellow-600" />;
    case 'fire':
      return <Flame className="h-6 w-6 text-orange-600" />;
    case 'flame':
      return <Flame className="h-6 w-6 text-red-600" />;
    case 'inferno':
      return <Zap className="h-6 w-6 text-red-800" />;
    default:
      return <Star className="h-6 w-6 text-gray-600" />;
  }
};

const ChallengeIcon = ({ icon }: { icon: string }) => {
  switch (icon) {
    case 'book':
      return <BookOpen className="h-6 w-6 text-blue-600" />;
    case 'target':
      return <Target className="h-6 w-6 text-green-600" />;
    case 'zap':
      return <Zap className="h-6 w-6 text-yellow-600" />;
    case 'rocket':
      return <Rocket className="h-6 w-6 text-purple-600" />;
    default:
      return <Star className="h-6 w-6 text-gray-600" />;
  }
};

const DifficultyColor = ({ difficulty }: { difficulty: string }) => {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'hard':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function MotivationDashboardPage() {
  const { data: achievements, isLoading: achievementsLoading } = useQuery({
    queryKey: ['user-achievements'],
    queryFn: async () => {
      const response = await api.get('/writing/achievements');
      return response.data as AchievementsData;
    },
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ['writing-challenges'],
    queryFn: async () => {
      const response = await api.get('/writing/challenges');
      return response.data as ChallengesData;
    },
  });

  const isLoading = achievementsLoading || challengesLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <Trophy className="h-10 w-10" />
            Writing Motivation Hub
          </h1>
          <p className="text-purple-100 text-lg">
            Track achievements, complete challenges, and unlock rewards for your writing journey
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Words Written</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    {achievements?.total_words.toLocaleString() || 0}
                  </p>
                </div>
                <TrendingUp className="h-12 w-12 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">Current Streak</p>
                  <p className="text-3xl font-bold text-orange-900 mt-2">
                    {achievements?.longest_streak || 0} days
                  </p>
                </div>
                <Flame className="h-12 w-12 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Achievements Unlocked</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">
                    {achievements?.total_unlocked || 0}
                  </p>
                </div>
                <Award className="h-12 w-12 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements & Challenges Tabs */}
        <Tabs defaultValue="achievements" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
          </TabsList>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Word Milestones
                </CardTitle>
                <CardDescription>
                  Unlock achievements by reaching word count milestones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />
                  ))
                ) : (
                  achievements?.word_milestones.map((achievement, idx) => (
                    <div
                      key={idx}
                      className={`p-4 border rounded-lg transition ${
                        achievement.unlocked
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          <AchievementIcon icon={achievement.icon} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`font-semibold ${
                              achievement.unlocked ? 'text-blue-900' : 'text-gray-700'
                            }`}>
                              {achievement.name}
                            </h4>
                            {achievement.unlocked && (
                              <Badge className="bg-blue-600">Unlocked!</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Progress
                              value={achievement.progress || 0}
                              className="flex-1"
                            />
                            <span className="text-sm font-semibold text-gray-600 w-12 text-right">
                              {achievement.progress || 0}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {achievement.milestone.toLocaleString()} words
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-600" />
                  Streak Achievements
                </CardTitle>
                <CardDescription>
                  Keep writing to build your streak and unlock special badges
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {achievements?.streak_achievements.map((achievement, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border rounded-lg transition ${
                      achievement.unlocked
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <AchievementIcon icon={achievement.icon} />
                      <div className="flex-1">
                        <h4 className={`font-semibold ${
                          achievement.unlocked ? 'text-orange-900' : 'text-gray-700'
                        }`}>
                          {achievement.name}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {achievement.milestone} consecutive days of writing
                        </p>
                      </div>
                      {achievement.unlocked && (
                        <Badge className="bg-orange-600">Unlocked!</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Challenges Tab */}
          <TabsContent value="challenges" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Active Challenges</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {challenges?.active_count || 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">Completed Challenges</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {challenges?.completed_count || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
                ))
              ) : (
                challenges?.available_challenges.map((challenge) => (
                  <Card key={challenge.challenge_id} className={`overflow-hidden ${
                    challenge.completed
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                      : challenge.in_progress
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                      : ''
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <ChallengeIcon icon={challenge.icon} />
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">
                              {challenge.name}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {challenge.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={DifficultyColor({ difficulty: challenge.difficulty })}>
                            {challenge.difficulty}
                          </Badge>
                          {challenge.completed && (
                            <Badge className="bg-green-600">Completed</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {challenge.target_words.toLocaleString()} words in {challenge.duration_days} days
                          </span>
                          <span className="font-semibold text-purple-600">{challenge.progress}%</span>
                        </div>
                        <Progress value={challenge.progress} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Reward: {challenge.reward}</span>
                        {!challenge.in_progress && !challenge.completed && (
                          <Button size="sm" variant="outline">
                            Join Challenge
                          </Button>
                        )}
                        {challenge.completed && (
                          <Badge className="bg-green-600">✓ Completed</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Motivational Quote */}
        <Card className="mt-12 bg-gradient-to-r from-indigo-100 to-purple-100 border-indigo-200">
          <CardContent className="py-8 text-center">
            <blockquote className="text-lg font-semibold text-indigo-900 mb-2">
              "The secret to getting ahead is getting started. Every word you write is a step toward your story."
            </blockquote>
            <p className="text-sm text-indigo-700">— Keep writing, stay inspired!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
