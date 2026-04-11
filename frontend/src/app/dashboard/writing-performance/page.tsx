'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { format } from 'date-fns';

interface HeatmapPoint {
  day: number;
  hour: number;
  sessions: number;
  total_words: number;
}

interface PerformanceData {
  period_days: number;
  start_date: string;
  end_date: string;
  total_sessions: number;
  total_words: number;
  total_hours: number;
  avg_words_per_session: number;
  avg_session_duration: number;
  busiest_day: { day: string; sessions: number };
  busiest_hour: { hour: number; sessions: number };
  session_types: Record<string, number>;
  daily_breakdown: Array<{ day: string; sessions: number; words: number }>;
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function WritingPerformancePage() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['writing-heatmap', period],
    queryFn: async () => {
      const response = await api.get(`/writing/heatmap`, {
        params: { days: period }
      });
      return response.data;
    }
  });

  const { data: performanceData, isLoading: perfLoading } = useQuery<PerformanceData>({
    queryKey: ['writing-performance', period],
    queryFn: async () => {
      const response = await api.get(`/writing/performance`, {
        params: { days: period }
      });
      return response.data;
    }
  });

  const isLoading = heatmapLoading || perfLoading;

  if (isLoading) {
    return <div className="p-8">Loading writing performance data...</div>;
  }

  if (!performanceData) {
    return <div className="p-8">No performance data available</div>;
  }

  // Prepare heatmap for visualization
  const heatmapPoints = (heatmapData?.heatmap || []) as HeatmapPoint[];
  const maxSessions = Math.max(...heatmapPoints.map(p => p.sessions), 1);

  // Prepare session type distribution
  const sessionTypeData = Object.entries(performanceData.session_types || {}).map(([type, count]) => ({
    name: type,
    value: count as number
  }));

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Writing Performance Analytics</h1>
        <p className="text-gray-500 mt-2">Track your writing habits, patterns, and productivity</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p as 7 | 30 | 90)}
            className={`px-4 py-2 rounded ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {p === 7 ? 'Last 7 Days' : p === 30 ? 'Last 30 Days' : 'Last 90 Days'}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.total_sessions}</div>
            <p className="text-xs text-gray-500 mt-1">Writing sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Words</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.total_words.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Words written</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.avg_words_per_session.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Words/session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.total_hours.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Hours spent writing</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Peak Writing Times</CardTitle>
            <CardDescription>Your most productive hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Busiest Day: {performanceData.busiest_day?.day}</p>
              <p className="text-gray-500 text-xs">{performanceData.busiest_day?.sessions} sessions</p>
            </div>
            <div>
              <p className="text-sm font-medium">Busiest Hour: {performanceData.busiest_hour?.hour}:00</p>
              <p className="text-gray-500 text-xs">{performanceData.busiest_hour?.sessions} sessions</p>
            </div>
            <div>
              <p className="text-sm font-medium">Avg Session Duration: {performanceData.avg_session_duration} min</p>
              <p className="text-gray-500 text-xs">Per writing session</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Types</CardTitle>
            <CardDescription>Breakdown of writing modes</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sessionTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sessionTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">No session data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Writing Activity</CardTitle>
          <CardDescription>Sessions and words written by day of week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData.daily_breakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="sessions" fill="#3b82f6" name="Sessions" />
              <Bar yAxisId="right" dataKey="words" fill="#10b981" name="Words Written" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Writing Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Writing Heatmap</CardTitle>
          <CardDescription>Activity intensity by day and time</CardDescription>
        </CardHeader>
        <CardContent>
          {heatmapPoints.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Heatmap Grid */}
                <div className="grid gap-1 p-4" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                  {/* Hour headers */}
                  <div className="col-start-1 col-span-24 grid gap-1" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={`h${h}`} className="text-xs text-gray-500 text-center">{h}</div>
                    ))}
                  </div>

                  {/* Day rows */}
                  {DAY_LABELS.map((day, dayIdx) => (
                    <div key={day} className="grid gap-1" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                      {Array.from({ length: 24 }).map((_, hour) => {
                        const point = heatmapPoints.find(p => p.day === dayIdx && p.hour === hour);
                        const intensity = point ? (point.sessions / maxSessions) * 100 : 0;
                        const bgColor = intensity === 0
                          ? 'bg-gray-100'
                          : intensity < 20
                          ? 'bg-blue-100'
                          : intensity < 40
                          ? 'bg-blue-300'
                          : intensity < 60
                          ? 'bg-blue-500'
                          : intensity < 80
                          ? 'bg-blue-700'
                          : 'bg-blue-900';

                        return (
                          <div
                            key={`${dayIdx}-${hour}`}
                            className={`w-8 h-8 rounded text-xs flex items-center justify-center cursor-pointer hover:ring-2 ring-blue-400 ${bgColor}`}
                            title={`${day} ${hour}:00 - ${point?.sessions || 0} sessions`}
                          >
                            {point && point.sessions > 0 ? point.sessions : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-6 flex gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Intensity:</span>
                  <div className="flex gap-1">
                    {[
                      { bg: 'bg-gray-100', label: 'None' },
                      { bg: 'bg-blue-100', label: 'Low' },
                      { bg: 'bg-blue-300', label: 'Medium' },
                      { bg: 'bg-blue-500', label: 'High' },
                      { bg: 'bg-blue-700', label: 'Very High' },
                      { bg: 'bg-blue-900', label: 'Peak' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1">
                        <div className={`w-4 h-4 rounded ${item.bg}`} />
                        <span className="text-xs text-gray-500">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No heatmap data available yet</div>
          )}
        </CardContent>
      </Card>

      {/* Insights Text */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {performanceData.total_sessions > 0 && (
            <>
              <p>✨ You've completed <strong>{performanceData.total_sessions}</strong> writing sessions in the last {period} days</p>
              <p>🎯 Your average session produces <strong>{performanceData.avg_words_per_session.toLocaleString()} words</strong> at <strong>{performanceData.avg_session_duration} minutes</strong> per session</p>
              <p>📊 Your most productive time is <strong>{performanceData.busiest_day?.day} at {performanceData.busiest_hour?.hour}:00</strong></p>
              <p>💡 Keep writing at these peak times to maximize your output</p>
            </>
          )}
          {performanceData.total_sessions === 0 && (
            <p className="text-gray-500">Start a writing session to see your performance insights here</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
