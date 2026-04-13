/**
 * Advanced analytics chart components
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { VelocityData, ChapterBreakdownItem } from '@/types/analytics';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

interface VelocityChartProps {
  data: VelocityData;
}

export function VelocityLineChart({ data }: VelocityChartProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Writing Velocity Trend
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.daily_breakdown}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="5 5" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            interval={Math.floor(data.daily_breakdown.length / 5)}
          />
          <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
            }}
            formatter={(value) => `${value} words`}
          />
          <Line
            type="monotone"
            dataKey="words_written"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ChapterBreakdownChartProps {
  data: ChapterBreakdownItem[];
}

export function ChapterDistributionPie({ data }: ChapterBreakdownChartProps) {
  const chartData = data.map((chapter) => ({
    name: `Ch ${chapter.chapter_number}: ${chapter.title.substring(0, 15)}...`,
    value: chapter.word_count,
  }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Chapter Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#3b82f6"
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} words`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChapterComparisonBar({ data }: ChapterBreakdownChartProps) {
  const chartData = data.map((chapter) => ({
    name: `Ch ${chapter.chapter_number}`,
    words: chapter.word_count,
  }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Word Counts by Chapter
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="5 5" />
          <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
            }}
            formatter={(value) => `${value} words`}
          />
          <Bar dataKey="words" fill="#3b82f6" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
