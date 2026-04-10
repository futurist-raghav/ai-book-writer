/**
 * Flow Component Types
 */

export interface FlowViewProps {
  bookId: string;
  isLoading?: boolean;
  error?: string;
}

export interface FlowEventEditorState {
  title: string;
  description: string;
  event_type: string;
  status: string;
  timeline_position: number;
  duration?: number;
  content?: string;
  metadata?: Record<string, any>;
}

export interface FlowTimelineCoordinates {
  x: number;
  y: number;
}

export interface FlowGraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface FlowGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}
