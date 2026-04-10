/**
 * Draggable Gantt Chart Component
 * Allows drag-and-drop reordering of events on timeline
 * Fully typed with TypeScript
 */

import React, { useState, useRef, useEffect } from 'react';
import { FlowEvent, FlowDependency } from '@/types/flow';

interface DraggableGanttChartProps {
  events: FlowEvent[];
  dependencies?: FlowDependency[];
  onEventReorder?: (eventId: string, newPosition: number) => void;
  onEventClick?: (eventId: string) => void;
  isLoading?: boolean;
  error?: string;
}

interface DragState {
  isDragging: boolean;
  draggedEventId: string | null;
  startX: number;
  dragOffsetX: number;
}

const STATUS_COLORS = {
  planned: '#9CA3AF',
  in_progress: '#3B82F6',
  completed: '#10B981',
  blocked: '#EF4444',
};

const EVENT_TYPE_COLORS = {
  act: '#8B5CF6',
  scene: '#6366F1',
  beat: '#EC4899',
  major_event: '#F59E0B',
  climax: '#EF4444',
  resolution: '#10B981',
};

/**
 * DraggableGanttChart: Canvas-based Gantt chart with drag-and-drop support
 */
export const DraggableGanttChart: React.FC<DraggableGanttChartProps> = ({
  events,
  dependencies = [],
  onEventReorder,
  onEventClick,
  isLoading,
  error,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedEventId: null,
    startX: 0,
    dragOffsetX: 0,
  });
  const [hoverEventId, setHoverEventId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(20); // pixels per unit
  const [scrollX, setScrollX] = useState(0);

  const rowHeight = 60;
  const padding = 40;
  const barHeight = 30;

  // Calculate timeline dimensions
  const maxPosition = Math.max(...events.map((e) => e.timeline_position + (e.duration || 1)), 100);
  const canvasWidth = 1200;
  const canvasHeight = Math.max(400, events.length * rowHeight + padding * 2);

  // Find event at canvas coordinates
  const getEventAtPoint = (canvasX: number, canvasY: number): FlowEvent | null => {
    const x = canvasX - padding + scrollX;
    const y = canvasY - padding;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventY = i * rowHeight;
      const eventX = event.timeline_position * zoom;
      const eventWidth = (event.duration || 1) * zoom;

      if (
        x >= eventX &&
        x <= eventX + eventWidth &&
        y >= eventY &&
        y <= eventY + barHeight
      ) {
        return event;
      }
    }
    return null;
  };

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const event = getEventAtPoint(e.clientX, e.clientY);
    if (event) {
      setDragState({
        isDragging: true,
        draggedEventId: event.id,
        startX: e.clientX,
        dragOffsetX: 0,
      });
    }
  };

  // Handle drag
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const event = getEventAtPoint(e.clientX, e.clientY);
    setHoverEventId(event?.id || null);

    if (dragState.isDragging && dragState.draggedEventId) {
      const offsetX = e.clientX - dragState.startX;
      setDragState((prev) => ({
        ...prev,
        dragOffsetX: offsetX,
      }));
    }
  };

  // Handle drag end
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragState.isDragging && dragState.draggedEventId) {
      const draggedEvent = events.find((ev) => ev.id === dragState.draggedEventId);
      if (draggedEvent) {
        // Calculate new position based on drag offset
        const newPosition =
          draggedEvent.timeline_position + dragState.dragOffsetX / zoom;

        // Constrain to valid range
        const constrainedPosition = Math.max(0, Math.min(newPosition, maxPosition - 10));

        onEventReorder?.(dragState.draggedEventId, constrainedPosition);
      }
    }

    setDragState({
      isDragging: false,
      draggedEventId: null,
      startX: 0,
      dragOffsetX: 0,
    });
  };

  // Handle zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.max(5, Math.min(200, prev * delta)));
    } else {
      setScrollX((prev) => Math.max(0, prev + e.deltaX));
    }
  };

  // Draw canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw background grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    for (let i = 0; i <= maxPosition; i += 10) {
      const x = padding + i * zoom - scrollX;
      if (x > padding && x < canvasWidth) {
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, canvasHeight - padding);
        ctx.stroke();

        // Draw time label
        ctx.fillStyle = '#6B7280';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${i}`, x, padding - 10);
      }
    }

    // Draw events
    events.forEach((event, index) => {
      const y = padding + index * rowHeight;
      const x = padding + event.timeline_position * zoom - scrollX;
      const width = Math.max(20, (event.duration || 1) * zoom);

      // Highlight if dragging or hovering
      const isDraggingThis = dragState.isDragging && dragState.draggedEventId === event.id;
      const isHoveringThis = hoverEventId === event.id;

      // Draw event bar
      ctx.fillStyle = EVENT_TYPE_COLORS[event.event_type as keyof typeof EVENT_TYPE_COLORS] || '#808080';
      if (isDraggingThis) {
        ctx.globalAlpha = 0.8;
        // Apply drag offset
        ctx.fillRect(x + dragState.dragOffsetX, y + (rowHeight - barHeight) / 2, width, barHeight);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillRect(x, y + (rowHeight - barHeight) / 2, width, barHeight);
      }

      // Draw border
      ctx.strokeStyle = isHoveringThis ? '#000000' : STATUS_COLORS[event.status as keyof typeof STATUS_COLORS] || '#9CA3AF';
      ctx.lineWidth = isHoveringThis ? 3 : 2;
      ctx.strokeRect(
        isDraggingThis ? x + dragState.dragOffsetX : x,
        y + (rowHeight - barHeight) / 2,
        width,
        barHeight
      );

      // Draw event title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        event.title.substring(0, 15),
        (isDraggingThis ? x + dragState.dragOffsetX : x) + 8,
        y + (rowHeight - barHeight) / 2 + barHeight / 2 + 5
      );

      // Draw event label (type + status)
      ctx.fillStyle = '#4B5563';
      ctx.font = '10px sans-serif';
      ctx.fillText(
        `${event.event_type} (${event.status})`,
        (isDraggingThis ? x + dragState.dragOffsetX : x) + 8,
        y + (rowHeight - barHeight) / 2 + 15
      );
    });

    // Draw dependency arrows
    dependencies.forEach((dep) => {
      const fromEvent = events.find((e) => e.id === dep.from_event_id);
      const toEvent = events.find((e) => e.id === dep.to_event_id);

      if (fromEvent && toEvent) {
        const fromIndex = events.indexOf(fromEvent);
        const toIndex = events.indexOf(toEvent);

        const x1 = padding + (fromEvent.timeline_position + (fromEvent.duration || 1)) * zoom - scrollX;
        const y1 = padding + fromIndex * rowHeight + (rowHeight - barHeight) / 2 + barHeight / 2;

        const x2 = padding + toEvent.timeline_position * zoom - scrollX;
        const y2 = padding + toIndex * rowHeight + (rowHeight - barHeight) / 2 + barHeight / 2;

        // Draw arrow
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + 50, y1, x2 - 50, y2, x2 - 10, y2);
        ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.fillStyle = '#9CA3AF';
        ctx.beginPath();
        ctx.moveTo(x2 - 10, y2);
        ctx.lineTo(x2 - 10 - 8 * Math.cos(angle - Math.PI / 6), y2 - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - 10 - 8 * Math.cos(angle + Math.PI / 6), y2 - 8 * Math.sin(angle + Math.PI / 6));
        ctx.fill();
      }
    });
  }, [events, dependencies, dragState, hoverEventId, scrollX, zoom, maxPosition]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading timeline...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="w-full border border-gray-300 rounded-lg bg-white overflow-auto">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoverEventId(null)}
        onWheel={handleWheel}
        onClick={(e) => {
          const event = getEventAtPoint(e.clientX, e.clientY);
          if (event && !dragState.isDragging) {
            onEventClick?.(event.id);
          }
        }}
        className="cursor-grab active:cursor-grabbing w-full"
      />
      <div className="p-3 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
        <p>Drag events to reorder • Scroll wheel to zoom • Click to select</p>
      </div>
    </div>
  );
};
