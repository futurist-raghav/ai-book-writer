/**
 * Gantt Chart Timeline Component
 * 
 * Displays flow events in a Gantt chart format with timeline bars,
 * dependencies, and visual progress tracking
 */

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FlowEvent, FlowDependency } from '@/lib/api-client';

interface GanttChartProps {
  events: FlowEvent[];
  dependencies?: FlowDependency[];
  onEventClick?: (eventId: string) => void;
  isLoading?: boolean;
  error?: string;
}

interface GanttRow {
  event: FlowEvent;
  startX: number;
  width: number;
  y: number;
}

/**
 * Gantt Chart Timeline Component
 * Visual timeline representation with duration-based bars
 */
export function GanttChart({ events, dependencies = [], onEventClick, isLoading, error }: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [scale, setScale] = useState(50); // pixels per unit
  const [scrollX, setScrollX] = useState(0);

  // Calculate timeline range and layout
  const timelineData = useMemo(() => {
    if (events.length === 0) {
      return { minPos: 0, maxPos: 1000, rows: [], duration: 1000 };
    }

    const positions = events.map((e) => ({
      start: e.timeline_position,
      end: e.timeline_position + (e.duration || 1),
    }));

    const minPos = Math.min(...positions.map((p) => p.start));
    const maxPos = Math.max(...positions.map((p) => p.end));
    const duration = maxPos - minPos || 1;

    const rows: GanttRow[] = events.map((event, index) => ({
      event,
      startX: (event.timeline_position - minPos) * scale,
      width: Math.max((event.duration || 1) * scale, 40),
      y: index * 60 + 40,
    }));

    return { minPos, maxPos, rows, duration };
  }, [events, scale]);

  // Draw canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = containerRef.current?.clientWidth || 1000;
    canvas.height = timelineData.rows.length * 60 + 80;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridStep = scale * 10;
    for (let x = -scrollX % gridStep; x < canvas.width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let i = 0; i <= timelineData.rows.length; i++) {
      const y = i * 60 + 40;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw timeline header
    ctx.fillStyle = '#111827';
    ctx.font = '12px sans-serif';
    for (let i = 0; i <= timelineData.duration / 10; i++) {
      const x = i * scale * 10 - scrollX;
      if (x > 0 && x < canvas.width) {
        ctx.fillText(`${timelineData.minPos + i * 10}`, x + 5, 25);
      }
    }

    // Draw rows
    timelineData.rows.forEach((row) => {
      const isHovered = row.event.id === hoveredEventId;

      // Row label
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(row.event.title.substring(0, 20), 180, row.y + 25);

      // Bar
      const barX = row.startX - scrollX;
      const barY = row.y + 5;
      const barHeight = 30;

      // Bar background
      ctx.fillStyle = getEventColor(row.event.status);
      if (isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(barX, barY, row.width, barHeight);
      ctx.shadowColor = 'transparent';

      // Bar border
      ctx.strokeStyle = isHovered ? '#1f2937' : '#d1d5db';
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.strokeRect(barX, barY, row.width, barHeight);

      // Progress indicator in bar
      if (row.event.status === 'in_progress') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.fillRect(barX, barY, (row.width * 70) / 100, barHeight);
      }

      // Label in bar
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.event.event_type, barX + 5, row.y + 20);
    });

    // Draw dependency arrows
    ctx.strokeStyle = '#9ca3af';
    ctx.fillStyle = '#9ca3af';
    ctx.lineWidth = 1;

    dependencies.forEach((dep) => {
      const fromRow = timelineData.rows.find((r) => r.event.id === dep.from_event_id);
      const toRow = timelineData.rows.find((r) => r.event.id === dep.to_event_id);

      if (fromRow && toRow) {
        const from = {
          x: fromRow.startX + fromRow.width - scrollX,
          y: fromRow.y + 15,
        };
        const to = {
          x: toRow.startX - scrollX,
          y: toRow.y + 15,
        };

        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - 8 * Math.cos(angle - Math.PI / 6), to.y - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(to.x - 8 * Math.cos(angle + Math.PI / 6), to.y - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    });
  }, [timelineData, hoveredEventId, scrollX, dependencies]);

  const getEventColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#d1fae5';
      case 'in_progress':
        return '#fef3c7';
      case 'planned':
        return '#dbeafe';
      case 'blocked':
        return '#fee2e2';
      default:
        return '#f3f4f6';
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollX;
    const clickY = e.clientY - rect.top;

    for (const row of timelineData.rows) {
      if (
        clickY >= row.y + 5 &&
        clickY <= row.y + 35 &&
        clickX >= row.startX &&
        clickX <= row.startX + row.width
      ) {
        onEventClick?.(row.event.id);
        break;
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      setScale((prev) => Math.max(10, prev - 5));
    } else {
      setScale((prev) => Math.min(200, prev + 5));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-gray-500">Loading Gantt chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Error loading chart: {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full space-y-4">
      <div className="flex items-center justify-between px-4">
        <h3 className="font-semibold text-gray-900">Gantt Timeline</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((p) => Math.max(10, p - 10))}
            className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            −
          </button>
          <span className="text-sm text-gray-600 w-12 text-center">{scale}px</span>
          <button
            onClick={() => setScale((p) => Math.min(200, p + 10))}
            className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            +
          </button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          onMouseMove={(e) => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const row = timelineData.rows.find(
              (r) => y >= r.y + 5 && y <= r.y + 35
            );
            setHoveredEventId(row?.event.id || null);
          }}
          onMouseLeave={() => setHoveredEventId(null)}
          className="w-full cursor-pointer"
          style={{ display: 'block' }}
        />
      </div>

      <div className="px-4 py-2 bg-gray-50 rounded text-sm text-gray-600">
        <div className="flex gap-4">
          <div>🔵 Planned: {events.filter((e) => e.status === 'planned').length}</div>
          <div>🟡 In Progress: {events.filter((e) => e.status === 'in_progress').length}</div>
          <div>🟢 Completed: {events.filter((e) => e.status === 'completed').length}</div>
          <div>⚫ Archived: {events.filter((e) => e.status === 'archived').length}</div>
        </div>
      </div>
    </div>
  );
}

export default GanttChart;
