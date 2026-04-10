/**
 * Flow Timeline Analytics Component
 * 
 * Displays analytics, burn-down charts, and progress tracking
 */

'use client';

import React, { useMemo } from 'react';
import { FlowEvent } from '@/lib/api-client';

interface FlowAnalyticsProps {
  events: FlowEvent[];
  isLoading?: boolean;
}

interface AnalyticsData {
  totalEvents: number;
  completedEvents: number;
  inProgressEvents: number;
  plannedEvents: number;
  blockedEvents: number;
  completionRate: number;
  averageDuration: number;
  totalSpan: number;
  eventsByType: Record<string, number>;
}

/**
 * Flow Timeline Analytics Component
 * Shows metrics, charts, and progress visualization
 */
export function FlowAnalytics({ events, isLoading }: FlowAnalyticsProps) {
  const analytics = useMemo((): AnalyticsData => {
    const completed = events.filter((e) => e.status === 'completed').length;
    const inProgress = events.filter((e) => e.status === 'in_progress').length;
    const planned = events.filter((e) => e.status === 'planned').length;
    const blocked = events.filter((e) => e.status === 'blocked').length;

    const durations = events.filter((e) => e.duration).map((e) => e.duration || 0);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0;

    const positions = events.map((e) => e.timeline_position);
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const totalSpan = maxPos - minPos;

    const typeCount: Record<string, number> = {};
    events.forEach((e) => {
      typeCount[e.event_type] = (typeCount[e.event_type] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      completedEvents: completed,
      inProgressEvents: inProgress,
      plannedEvents: planned,
      blockedEvents: blocked,
      completionRate: events.length > 0 ? Math.round((completed / events.length) * 100) : 0,
      averageDuration: avgDuration,
      totalSpan,
      eventsByType: typeCount,
    };
  }, [events]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white p-6 rounded-lg">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Timeline Analytics</h2>
        <p className="text-gray-600 mt-1">Flow event metrics and progress tracking</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Events */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">Total Events</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{analytics.totalEvents}</div>
          <div className="text-xs text-blue-700 mt-2">across {analytics.totalSpan} timeline units</div>
        </div>

        {/* Completion Progress */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">Completion</div>
          <div className="text-3xl font-bold text-green-900 mt-1">{analytics.completionRate}%</div>
          <div className="w-full bg-green-200 rounded-full h-2 mt-3">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${analytics.completionRate}%` }}
            />
          </div>
          <div className="text-xs text-green-700 mt-2">
            {analytics.completedEvents} of {analytics.totalEvents} complete
          </div>
        </div>

        {/* Average Duration */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
          <div className="text-sm text-purple-600 font-medium">Avg Duration</div>
          <div className="text-3xl font-bold text-purple-900 mt-1">{analytics.averageDuration}d</div>
          <div className="text-xs text-purple-700 mt-2">average event duration</div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <div className="space-y-3">
            {[
              { status: 'completed', count: analytics.completedEvents, color: 'bg-green-200', label: '✅ Completed' },
              { status: 'in_progress', count: analytics.inProgressEvents, color: 'bg-yellow-200', label: '⏳ In Progress' },
              { status: 'planned', count: analytics.plannedEvents, color: 'bg-blue-200', label: '📋 Planned' },
              { status: 'blocked', count: analytics.blockedEvents, color: 'bg-red-200', label: '🚫 Blocked' },
            ].map((item) => {
              const percent = analytics.totalEvents > 0 ? (item.count / analytics.totalEvents) * 100 : 0;
              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full transition-all`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Types */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-4">Event Types</h3>
          <div className="space-y-3">
            {Object.entries(analytics.eventsByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const percent = analytics.totalEvents > 0 ? (count / analytics.totalEvents) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Burn-Down Chart Simulation */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-4">Projected Burn-Down</h3>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Based on current completion rate of {analytics.completionRate}% with {analytics.inProgressEvents} events in progress.
          </p>

          {/* Simple ASCII Chart */}
          <div className="bg-white border border-gray-200 rounded p-3 font-mono text-xs overflow-x-auto">
            <div className="space-y-1 text-gray-700">
              <div>Remaining Events Over Time</div>
              <div className="mt-2 text-gray-400">
                {Array.from({ length: 5 }).map((_, i) => {
                  const remaining = Math.max(
                    0,
                    analytics.totalEvents - Math.floor((i / 4) * analytics.totalEvents * 1.2)
                  );
                  const bar = '█'.repeat(remaining);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-8 text-right">{100 - i * 20}%</span>
                      <span className="text-green-600">{bar}</span>
                      <span className="text-gray-500">{remaining}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
              <div className="font-semibold">Ideal Rate</div>
              <div className="text-blue-700 mt-1">{(100 / Math.max(analytics.totalEvents, 1)).toFixed(1)}%/event</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
              <div className="font-semibold">Current Rate</div>
              <div className="text-green-700 mt-1">
                {analytics.totalEvents > 0 ? ((analytics.completionRate / Math.max(1, Date.now())).toFixed(3)) : 'N/A'}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-center">
              <div className="font-semibold">Est. Complete</div>
              <div className="text-yellow-700 mt-1">
                {analytics.completionRate < 100
                  ? Math.ceil((100 / Math.max(analytics.completionRate, 1)) * 10) + 'd'
                  : 'Done!'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="border-t pt-4 text-sm text-gray-600 flex items-center justify-between">
        <span>Timeline Statistics</span>
        <span className="font-semibold text-gray-900">
          {analytics.totalEvents} total • {analytics.completedEvents} done • {analytics.inProgressEvents} active
        </span>
      </div>
    </div>
  );
}

export default FlowAnalytics;
