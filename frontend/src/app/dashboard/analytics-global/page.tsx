'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Users, Eye, MessageSquare, Star, Download } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface GlobalAnalyticsData {
  overview: {
    total_books: number;
    total_shares: number;
    total_views: number;
    total_comments: number;
    average_rating: number;
  };
  trends: Array<{
    date: string;
    views: number;
    comments: number;
    ratings: number;
  }>;
  top_books: Array<{
    id: string;
    title: string;
    views: number;
    comments: number;
    rating: number;
  }>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export default function GlobalAnalyticsPage() {
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['global-analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics/global');
      return response.data as GlobalAnalyticsData;
    },
  });

  const data = analyticsData || {
    overview: {
      total_books: 0,
      total_shares: 0,
      total_views: 0,
      total_comments: 0,
      average_rating: 0,
    },
    trends: [],
    top_books: [],
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  };

  const handleExport = async () => {
    try {
      await toast.promise(
        api.get('/analytics/global/export', { responseType: 'blob' }),
        {
          loading: 'Exporting analytics...',
          success: (response) => {
            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `global-analytics-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            return 'Analytics exported successfully!';
          },
          error: 'Failed to export analytics',
        }
      );
    } catch (err) {
      toast.error('Export failed');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Analytics Unavailable</h1>
          <p className="text-gray-600 mt-2">Unable to load analytics data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Global Analytics</h1>
            <p className="text-gray-600 mt-1">Track all your books and public share performance</p>
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Total Books</p>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.overview.total_books}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Public Shares</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.overview.total_shares}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Total Views</p>
              <Eye className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.overview.total_views}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Comments</p>
              <MessageSquare className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.overview.total_comments}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Avg Rating</p>
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.overview.average_rating.toFixed(1)}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Trends */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Trends</h2>
            {data.trends && data.trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="comments" stroke="#f97316" strokeWidth={2} />
                  <Line type="monotone" dataKey="ratings" stroke="#eab308" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </div>

          {/* Sentiment */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Comment Sentiment</h2>
            {data.sentiment && (data.sentiment.positive > 0 || data.sentiment.neutral > 0 || data.sentiment.negative > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Positive', value: data.sentiment.positive },
                      { name: 'Neutral', value: data.sentiment.neutral },
                      { name: 'Negative', value: data.sentiment.negative },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#6b7280" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </div>
        </div>

        {/* Top Books */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Books</h2>
          {data.top_books && data.top_books.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Views</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Comments</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Rating</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.top_books.map((book) => (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{book.title}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-600">{book.views}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-600">{book.comments}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-600">{book.rating.toFixed(1)} ⭐</td>
                      <td className="py-3 px-4 text-center">
                        <Link href={`/dashboard?book=${book.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No book data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
