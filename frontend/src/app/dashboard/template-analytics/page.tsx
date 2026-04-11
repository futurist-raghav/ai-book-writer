'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

interface TemplateAnalytics {
  template_id: string;
  template_name: string;
  views: number;
  ratings: number;
  average_rating: number;
  downloads: number;
  uses: number;
  created_at: string;
  last_used: string;
}

interface AnalyticsSummary {
  total_views: number;
  total_downloads: number;
  total_uses: number;
  templates: TemplateAnalytics[];
  trends: Array<{
    date: string;
    views: number;
    downloads: number;
  }>;
}

export default function TemplateAnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsSummary>({
    queryKey: ['template-analytics', period],
    queryFn: async () => {
      const response = await api.get(`/marketplace/analytics`, {
        params: { period }
      });
      return response.data;
    }
  });

  if (isLoading) {
    return <div className="p-8">Loading analytics...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error loading analytics</div>;
  }

  if (!analyticsData) {
    return <div className="p-8">No analytics data</div>;
  }

  // Prepare data for sentiment pie chart
  const topTemplates = analyticsData.templates
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 5);

  const ratingDistribution = [
    { name: '5★', value: analyticsData.templates.filter(t => t.average_rating >= 4.5).length },
    { name: '4★', value: analyticsData.templates.filter(t => t.average_rating >= 3.5 && t.average_rating < 4.5).length },
    { name: '3★', value: analyticsData.templates.filter(t => t.average_rating >= 2.5 && t.average_rating < 3.5).length },
    { name: '<3★', value: analyticsData.templates.filter(t => t.average_rating < 2.5).length }
  ];

  const COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Template Analytics</h1>
        <p className="text-gray-500 mt-2">Track performance of your published templates</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.total_views.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">All published templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.total_downloads.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Books created from templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.templates.length}</div>
            <p className="text-xs text-gray-500 mt-1">Published templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analyticsData.templates.reduce((sum, t) => sum + t.average_rating, 0) / analyticsData.templates.length || 0).toFixed(1)}★
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all templates</p>
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart */}
      {analyticsData.trends && analyticsData.trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Trends</CardTitle>
            <CardDescription>Views and downloads over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#3b82f6"
                  name="Views"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="downloads"
                  stroke="#10b981"
                  name="Downloads"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Templates & Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Templates Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Templates</CardTitle>
            <CardDescription>By downloads</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topTemplates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="template_name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="downloads" fill="#3b82f6" name="Downloads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rating Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Templates by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ratingDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {ratingDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Templates Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>Performance metrics for each published template</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Template</th>
                  <th className="text-right py-2 px-2">Views</th>
                  <th className="text-right py-2 px-2">Downloads</th>
                  <th className="text-right py-2 px-2">Rating</th>
                  <th className="text-right py-2 px-2">Ratings Count</th>
                  <th className="text-left py-2 px-2">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.templates.map(template => (
                  <tr key={template.template_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{template.template_name}</td>
                    <td className="text-right py-2 px-2">{template.views.toLocaleString()}</td>
                    <td className="text-right py-2 px-2">{template.downloads.toLocaleString()}</td>
                    <td className="text-right py-2 px-2">
                      {template.average_rating > 0 ? `${template.average_rating.toFixed(1)}★` : 'N/A'}
                    </td>
                    <td className="text-right py-2 px-2">{template.ratings}</td>
                    <td className="py-2 px-2">
                      {template.last_used
                        ? format(new Date(template.last_used), 'MMM d, yyyy')
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
