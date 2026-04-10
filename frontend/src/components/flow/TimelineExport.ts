/**
 * Flow Timeline Export Utilities
 * Export flow events as CSV, JSON, or generate HTML
 */

import { FlowEvent, FlowDependency } from '@/types/flow';

export interface ExportOptions {
  includeMetadata?: boolean;
  includeDependencies?: boolean;
  dateFormat?: 'ISO' | 'US' | 'EU';
}

/**
 * Export events to CSV format
 */
export function exportToCSV(
  events: FlowEvent[],
  dependencies: FlowDependency[] = [],
  options: ExportOptions = {}
): string {
  const { dateFormat = 'ISO' } = options;

  // CSV Headers
  const headers = [
    'ID',
    'Title',
    'Event Type',
    'Status',
    'Timeline Position',
    'Duration',
    'Description',
    'Priority',
  ];

  if (options.includeDependencies) {
    headers.push('Dependencies');
  }

  // Create dependency map
  const depMap = new Map<string, string[]>();
  dependencies.forEach((dep) => {
    if (!depMap.has(dep.from_event_id)) {
      depMap.set(dep.from_event_id, []);
    }
    depMap.get(dep.from_event_id)!.push(dep.to_event_id);
  });

  // CSV Rows
  const rows = events.map((event) => {
    const cells = [
      event.id,
      `"${event.title.replace(/"/g, '""')}"`, // Escape quotes in title
      event.event_type,
      event.status,
      event.timeline_position,
      event.duration || 1,
      `"${(event.description || '').replace(/"/g, '""')}"`, // Escape quotes
      event.priority || 'Medium',
    ];

    if (options.includeDependencies) {
      const deps = depMap.get(event.id) || [];
      cells.push(`"${deps.join(', ')}"`);
    }

    return cells.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export events to JSON format
 */
export function exportToJSON(
  events: FlowEvent[],
  dependencies: FlowDependency[] = [],
  options: ExportOptions = {}
): string {
  const data: Record<string, any> = {
    events,
  };

  if (options.includeDependencies) {
    data.dependencies = dependencies;
  }

  if (options.includeMetadata) {
    data.metadata = {
      exportDate: new Date().toISOString(),
      eventCount: events.length,
      dependencyCount: dependencies.length,
    };
  }

  return JSON.stringify(data, null, 2);
}

/**
 * Export events to HTML with interactive timeline
 */
export function exportToHTML(
  events: FlowEvent[],
  dependencies: FlowDependency[] = [],
  options: ExportOptions = {}
): string {
  const statusColorMap = {
    planned: '#9CA3AF',
    in_progress: '#3B82F6',
    completed: '#10B981',
    blocked: '#EF4444',
  };

  const eventTypeColorMap = {
    act: '#8B5CF6',
    scene: '#6366F1',
    beat: '#EC4899',
    major_event: '#F59E0B',
    climax: '#EF4444',
    resolution: '#10B981',
  };

  const timelineHTML = events
    .map((event, idx) => {
      const statusColor =
        statusColorMap[event.status as keyof typeof statusColorMap] || '#9CA3AF';
      const eventTypeColor =
        eventTypeColorMap[event.event_type as keyof typeof eventTypeColorMap] ||
        '#808080';

      return `
    <div class="timeline-item" style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: ${eventTypeColor};
          margin-right: 10px;
        "></span>
        <h3 style="margin: 0; font-size: 16px; font-weight: bold;">${event.title}</h3>
        <span style="
          margin-left: 10px;
          padding: 2px 8px;
          border-radius: 4px;
          background-color: ${statusColor};
          color: white;
          font-size: 12px;
          font-weight: bold;
        ">${event.status.toUpperCase()}</span>
      </div>
      <div style="margin-left: 22px; font-size: 13px; color: #666;">
        <p><strong>Type:</strong> ${event.event_type}</p>
        <p><strong>Position:</strong> ${event.timeline_position}</p>
        <p><strong>Duration:</strong> ${event.duration || 1}</p>
        ${event.description ? `<p><strong>Description:</strong> ${event.description}</p>` : ''}
      </div>
    </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Timeline Export</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #000;
            margin-top: 0;
        }
        .metadata {
            background-color: #f0f0f0;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 12px;
        }
        .timeline {
            position: relative;
            padding-left: 20px;
        }
        .timeline-item {
            position: relative;
        }
        .statistics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }
        .stat-card {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
            text-align: center;
        }
        .stat-card-value {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
        }
        .stat-card-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Flow Timeline Export</h1>
        
        <div class="metadata">
            <strong>Exported:</strong> ${new Date().toLocaleString()}<br/>
            <strong>Total Events:</strong> ${events.length}<br/>
            <strong>Total Dependencies:</strong> ${dependencies.length}
        </div>

        <div class="statistics">
            <div class="stat-card">
                <div class="stat-card-value">${events.length}</div>
                <div class="stat-card-label">Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${events.filter((e) => e.status === 'completed').length}</div>
                <div class="stat-card-label">Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${events.filter((e) => e.status === 'in_progress').length}</div>
                <div class="stat-card-label">In Progress</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${events.filter((e) => e.status === 'planned').length}</div>
                <div class="stat-card-label">Planned</div>
            </div>
        </div>

        <h2>Timeline</h2>
        <div class="timeline">
            ${timelineHTML}
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download as CSV
 */
export function downloadCSV(
  events: FlowEvent[],
  dependencies: FlowDependency[] = [],
  filename = 'timeline.csv'
): void {
  const csv = exportToCSV(events, dependencies);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export and download as JSON
 */
export function downloadJSON(
  events: FlowEvent[],
  dependencies: FlowDependency[] = [],
  filename = 'timeline.json'
): void {
  const json = exportToJSON(events, dependencies, { includeMetadata: true });
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export and download as HTML
 */
export function downloadHTML(
  events: FlowEvent[],
  dependencies: FlowDependency[] = [],
  filename = 'timeline.html'
): void {
  const html = exportToHTML(events, dependencies);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  downloadBlob(blob, filename);
}
