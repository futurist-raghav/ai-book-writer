/**
 * Flow Dependency Graph Editor
 * 
 * Interactive component for visual dependency management
 * Uses D3/graph visualization with click-to-add edges
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FlowEvent, FlowDependency } from '@/lib/api-client';

interface DependencyGraphEditorProps {
  events: FlowEvent[];
  dependencies: FlowDependency[];
  onAddDependency?: (fromId: string, toId: string, depType: string) => void;
  onRemoveDependency?: (dependencyId: string) => void;
  isLoading?: boolean;
  error?: string;
}

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

/**
 * Flow Dependency Graph Editor
 * Visualizes event dependencies and allows interactive management
 */
export function DependencyGraphEditor({
  events,
  dependencies,
  onAddDependency,
  onRemoveDependency,
  isLoading,
  error,
}: DependencyGraphEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{
    from: string;
    to: string | null;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Generate graph layout (simple force-directed or circular)
  const graphData = useMemo(() => {
    const nodeRadius = 30;
    const nodes: GraphNode[] = events.map((event, index) => {
      // Circular layout with timeline_position influence
      const angle = (index / Math.max(events.length, 1)) * 2 * Math.PI;
      const radius = 200 + event.timeline_position / 10;

      return {
        id: event.id,
        label: event.title.substring(0, 10),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        r: nodeRadius,
        color: getNodeColor(event.status),
      };
    });

    const edges: GraphEdge[] = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.from_event_id,
      target: dep.to_event_id,
      type: dep.dependency_type || 'blocks',
    }));

    return { nodes, edges };
  }, [events, dependencies]);

  const getNodeColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#f59e0b';
      case 'blocked':
        return '#ef4444';
      case 'planned':
        return '#3b82f6';
      default:
        return '#9ca3af';
    }
  };

  // Mouse handling
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / scale,
      y: (e.clientY - rect.top - pan.y) / scale,
    };
  };

  const getNearestNode = (x: number, y: number, threshold: number = 40): string | null => {
    for (const node of graphData.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      if (dist < threshold) {
        return node.id;
      }
    }
    return null;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const nearest = getNearestNode(coords.x, coords.y);
    setHoveredNode(nearest);

    if (connecting) {
      setConnecting({ ...connecting, to: nearest });
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const node = getNearestNode(coords.x, coords.y);
    if (node) {
      if (e.shiftKey && !connecting) {
        // Start connection mode
        setConnecting({ from: node, to: null });
      } else {
        setSelectedNode(node);
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (connecting && connecting.to && connecting.from !== connecting.to) {
      onAddDependency?.(connecting.from, connecting.to, 'blocks');
      setConnecting(null);
    } else {
      setConnecting(null);
    }
  };

  // Canvas drawing
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Draw edges
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;

    for (const edge of graphData.edges) {
      const fromNode = graphData.nodes.find((n) => n.id === edge.source);
      const toNode = graphData.nodes.find((n) => n.id === edge.target);

      if (!fromNode || !toNode) continue;

      // Arrow
      const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
      const startX = fromNode.x + fromNode.r * Math.cos(angle);
      const startY = fromNode.y + fromNode.r * Math.sin(angle);
      const endX = toNode.x - toNode.r * Math.cos(angle);
      const endY = toNode.y - toNode.r * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    // Draw connecting line during creation
    if (connecting) {
      const fromNode = graphData.nodes.find((n) => n.id === connecting.from);
      if (fromNode && connecting.to) {
        const toCoords = getCanvasCoords(
          new MouseEvent('') as any // This is a hack; in real code, store cursor
        ) || { x: fromNode.x, y: fromNode.y };

        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toCoords.x, toCoords.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw nodes
    for (const node of graphData.nodes) {
      const isSelected = node.id === selectedNode;
      const isHovered = node.id === hoveredNode;
      const isConnecting = connecting?.from === node.id || connecting?.to === node.id;

      // Node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, 2 * Math.PI);
      ctx.fill();

      // Highlight
      if (isSelected || isHovered || isConnecting) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    }

    ctx.restore();

    // Draw instructions
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('Click to select • Shift+click to connect', 10, canvas.height - 10);
  }, [graphData, selectedNode, hoveredNode, connecting, scale, pan]);

  // Zoom and pan
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.1, Math.min(3, prev * delta)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-gray-500">Loading graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full space-y-4">
      <div className="flex items-center justify-between px-4">
        <h3 className="font-semibold text-gray-900">Dependency Graph</h3>
        <div className="text-sm text-gray-500">
          {graphData.nodes.length} events • {graphData.edges.length} dependencies
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onWheel={handleWheel}
        className="w-full border border-gray-300 rounded-lg cursor-crosshair bg-white"
        style={{ aspectRatio: '2/1' }}
      />

      {selectedNode && (
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="font-semibold text-blue-900">Selected:</div>
          <div className="text-blue-700">
            {events.find((e) => e.id === selectedNode)?.title}
          </div>
        </div>
      )}

      {connecting && (
        <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <div className="font-semibold text-yellow-900">Connecting mode:</div>
          <div className="text-yellow-700">
            From: {events.find((e) => e.id === connecting.from)?.title} →{' '}
            {connecting.to ? events.find((e) => e.id === connecting.to)?.title : 'Click target'}
          </div>
        </div>
      )}
    </div>
  );
}

export default DependencyGraphEditor;
