import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface WritingStats {
  total_sessions: number;
  total_words: number;
  average_session_length: number;
  current_streak: number;
  longest_streak: number;
  active_challenges: number;
  unlocked_milestones: number;
  last_session_at?: string;
}

interface WritingSession {
  id: string;
  started_at: string;
  ended_at?: string;
  words_written: number;
  net_words: number;
  session_type: string;
}

export function WritingPerformanceDashboard() {
  const [stats, setStats] = useState<WritingStats | null>(null);
  const [activeSession, setActiveSession] = useState<WritingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [wordsDelta, setWordsDelta] = useState(0);
  const { user } = useAuthStore();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get(`/writing/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const startSession = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.post(`/writing/sessions`, {
        user_id: user.id,
        session_type: 'focused',
        notes: '',
      });
      setActiveSession(response.data);
      setWordsDelta(0);
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await api.patch(`/writing/sessions/${activeSession.id}`, {
        words_written: Math.max(0, wordsDelta),
        words_deleted: Math.max(0, -wordsDelta),
        net_words: wordsDelta,
      });
      setActiveSession(null);
      setWordsDelta(0);
      await loadStats();
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Control */}
      <Card>
        <CardHeader>
          <CardTitle>Writing Session</CardTitle>
          <CardDescription>
            {activeSession ? 'Session in progress' : 'Start a new writing session'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSession ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Words in this session</div>
                <div className="text-3xl font-bold text-blue-600">{wordsDelta}</div>
                <input
                  type="range"
                  min="-1000"
                  max="5000"
                  value={wordsDelta}
                  onChange={(e) => setWordsDelta(parseInt(e.target.value))}
                  className="w-full mt-4"
                />
              </div>
              <Button
                onClick={endSession}
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                End Session
              </Button>
            </div>
          ) : (
            <Button
              onClick={startSession}
              disabled={loading}
              className="w-full"
            >
              Start Writing Session
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Words</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.total_words.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-2">{stats.total_sessions} sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.current_streak}</div>
              <p className="text-sm text-gray-500 mt-2">Best: {stats.longest_streak} days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Avg. Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.average_session_length}</div>
              <p className="text-sm text-gray-500 mt-2">words/session</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Milestones Unlocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.unlocked_milestones}</div>
              <p className="text-sm text-gray-500 mt-2">achievements</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Challenges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.active_challenges}</div>
              <p className="text-sm text-gray-500 mt-2">in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Last Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {stats.last_session_at
                  ? new Date(stats.last_session_at).toLocaleDateString()
                  : 'No sessions yet'}
              </div>
              <p className="text-sm text-gray-500 mt-2">—</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
