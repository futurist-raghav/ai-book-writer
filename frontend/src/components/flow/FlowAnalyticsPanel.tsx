'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FlowEvent {
  id: string;
  title: string;
  timeline_position: number;
  duration?: number;
  status: 'planned' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
}

interface FlowDependency {
  id: string;
  source_event_id: string;
  target_event_id: string;
  dependency_type: string;
}

interface FlowAnalyticsPanelProps {
  events: FlowEvent[];
  dependencies: FlowDependency[];
}

const STATUS_COLORS = {
  planned: '#b3b3b3',
  in_progress: '#2196f3',
  completed: '#4caf50',
  archived: '#9e9e9e',
};

export function FlowAnalyticsPanel({ events, dependencies }: FlowAnalyticsPanelProps) {
  const metrics = useMemo(() => {
    // Event count by status
    const statusDistribution = {
      planned: events.filter((e) => e.status === 'planned').length,
      in_progress: events.filter((e) => e.status === 'in_progress').length,
      completed: events.filter((e) => e.status === 'completed').length,
      archived: events.filter((e) => e.status === 'archived').length,
    };

    // Timeline span
    const positions = events.map((e) => e.timeline_position).filter((p) => p !== undefined);
    const minPosition = Math.min(...positions);
    const maxPosition = Math.max(...positions);
    const timelineSpan = maxPosition - minPosition;

    // Average duration
    const durations = events
      .map((e) => e.duration)
      .filter((d) => d !== undefined && d > 0) as number[];
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    // Pacing: events per week (assuming timeline_position is in days)
    const eventsPerWeek: Record<number, number> = {};
    events.forEach((e) => {
      const week = Math.floor(e.timeline_position / 7);
      eventsPerWeek[week] = (eventsPerWeek[week] || 0) + 1;
    });

    const pacingData = Object.entries(eventsPerWeek)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .slice(0, 12) // Limit to 12 weeks
      .map(([week, count]) => ({
        week: `W${parseInt(week) + 1}`,
        events: count,
      }));

    // Dependency density
    const eventsWithDeps = new Set(
      dependencies.flatMap((d) => [d.source_event_id, d.target_event_id])
    ).size;
    const dependencyDensity = events.length > 0 ? Math.round((eventsWithDeps / events.length) * 100) : 0;

    // Busiest period
    let busiestWeek = 0;
    let maxEvents = 0;
    Object.entries(eventsPerWeek).forEach(([week, count]) => {
      if (count > maxEvents) {
        maxEvents = count;
        busiestWeek = parseInt(week);
      }
    });

    return {
      totalEvents: events.length,
      statusDistribution,
      timelineSpan,
      avgDuration,
      pacingData,
      dependencyDensity,
      busiestPeriod: `Week ${busiestWeek + 1}`,
      maxEventsPerWeek: maxEvents,
    };
  }, [events, dependencies]);

  const statusData = Object.entries(metrics.statusDistribution).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
  }));

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-lg p-6 space-y-6">
      <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">
        Timeline Analytics
      </h3>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-low rounded p-4 border border-outline-variant/10">
          <div className="text-xs font-label uppercase tracking-wider text-on-surface-variant mb-1">
            Total Events
          </div>
          <div className="text-2xl font-bold text-primary">{metrics.totalEvents}</div>
        </div>

        <div className="bg-surface-container-low rounded p-4 border border-outline-variant/10">
          <div className="text-xs font-label uppercase tracking-wider text-on-surface-variant mb-1">
            Timeline Span
          </div>
          <div className="text-2xl font-bold text-primary">
            {metrics.timelineSpan} <span className="text-sm">days</span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded p-4 border border-outline-variant/10">
          <div className="text-xs font-label uppercase tracking-wider text-on-surface-variant mb-1">
            Avg Duration
          </div>
          <div className="text-2xl font-bold text-primary">
            {metrics.avgDuration} <span className="text-sm">days</span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded p-4 border border-outline-variant/10">
          <div className="text-xs font-label uppercase tracking-wider text-on-surface-variant mb-1">
            Dependency Density
          </div>
          <div className="text-2xl font-bold text-primary">{metrics.dependencyDensity}%</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10">
          <h4 className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
            Status Distribution
          </h4>
          {metrics.totalEvents > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
              No events to visualize
            </div>
          )}
        </div>

        {/* Pacing Chart */}
        <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10">
          <h4 className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
            Events Per Week
          </h4>
          {metrics.pacingData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.pacingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="events" fill="#2196f3" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
              No pacing data available
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 space-y-2">
        <h4 className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
          Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="font-semibold capitalize">Planned:</span>
            <span className="ml-2 text-primary">{metrics.statusDistribution.planned} events</span>
          </div>
          <div>
            <span className="font-semibold capitalize">In Progress:</span>
            <span className="ml-2 text-primary">{metrics.statusDistribution.in_progress} events</span>
          </div>
          <div>
            <span className="font-semibold capitalize">Completed:</span>
            <span className="ml-2 text-primary">{metrics.statusDistribution.completed} events</span>
          </div>
          <div>
            <span className="font-semibold">Busiest Period:</span>
            <span className="ml-2 text-primary">{metrics.busiestPeriod}</span>
          </div>
          <div>
            <span className="font-semibold">Max Events/Week:</span>
            <span className="ml-2 text-primary">{metrics.maxEventsPerWeek}</span>
          </div>
          <div>
            <span className="font-semibold">Total Dependencies:</span>
            <span className="ml-2 text-primary">{dependencies.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
