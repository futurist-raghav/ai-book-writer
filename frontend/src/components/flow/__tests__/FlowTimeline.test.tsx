/**
 * FlowTimeline Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlowTimeline } from '../FlowTimeline';
import { FlowEvent, FlowDependency } from '@/lib/api-client';

// Mock data
const mockEvents: FlowEvent[] = [
  {
    id: '1',
    title: 'Opening Scene',
    description: 'The beginning',
    event_type: 'scene',
    status: 'completed',
    timeline_position: 0,
    duration: 5,
    content: '',
    book_id: 'book1',
    chapter_ids: [],
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '2',
    title: 'Midpoint Crisis',
    description: 'The turning point',
    event_type: 'beat',
    status: 'in_progress',
    timeline_position: 500,
    duration: 10,
    content: '',
    book_id: 'book1',
    chapter_ids: [],
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '3',
    title: 'Climax',
    description: 'The final battle',
    event_type: 'scene',
    status: 'planned',
    timeline_position: 900,
    duration: 8,
    content: '',
    book_id: 'book1',
    chapter_ids: [],
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  },
];

const mockDependencies: FlowDependency[] = [
  {
    id: 'dep1',
    from_event_id: '1',
    to_event_id: '2',
    dependency_type: 'blocks',
    created_at: new Date(),
  },
  {
    id: 'dep2',
    from_event_id: '2',
    to_event_id: '3',
    dependency_type: 'blocks',
    created_at: new Date(),
  },
];

describe('FlowTimeline Component', () => {
  test('renders timeline with events', () => {
    render(<FlowTimeline events={mockEvents} dependencies={mockDependencies} />);

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Opening Scene')).toBeInTheDocument();
    expect(screen.getByText('Midpoint Crisis')).toBeInTheDocument();
    expect(screen.getByText('Climax')).toBeInTheDocument();
  });

  test('shows event count', () => {
    render(<FlowTimeline events={mockEvents} dependencies={mockDependencies} />);

    expect(screen.getByText(/3 events/)).toBeInTheDocument();
  });

  test('displays event details', () => {
    render(<FlowTimeline events={mockEvents} dependencies={mockDependencies} />);

    expect(screen.getByText('Opening Scene')).toBeInTheDocument();
    expect(screen.getByText('The beginning')).toBeInTheDocument();
    expect(screen.getByText('scene')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(<FlowTimeline events={[]} dependencies={[]} isLoading={true} />);

    expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
  });

  test('shows error state', () => {
    const error = 'Failed to load timeline';
    render(<FlowTimeline events={[]} dependencies={[]} error={error} />);

    expect(screen.getByText(`Error loading timeline: ${error}`)).toBeInTheDocument();
  });

  test('shows empty state', () => {
    render(<FlowTimeline events={[]} dependencies={[]} />);

    expect(screen.getByText('No timeline events yet')).toBeInTheDocument();
  });

  test('calls onEventClick when event is clicked', () => {
    const mockClick = jest.fn();
    render(
      <FlowTimeline events={mockEvents} dependencies={mockDependencies} onEventClick={mockClick} />
    );

    const eventButton = screen.getByText('Opening Scene').closest('button');
    if (eventButton) {
      fireEvent.click(eventButton);
      expect(mockClick).toHaveBeenCalledWith('1');
    }
  });

  test('calls onEventHover when event is hovered', () => {
    const mockHover = jest.fn();
    render(
      <FlowTimeline events={mockEvents} dependencies={mockDependencies} onEventHover={mockHover} />
    );

    const eventCard = screen.getByText('Opening Scene').closest('.group');
    if (eventCard) {
      fireEvent.mouseEnter(eventCard);
      expect(mockHover).toHaveBeenCalledWith('1');
    }
  });

  test('sorts events by timeline position', () => {
    render(<FlowTimeline events={mockEvents} dependencies={mockDependencies} />);

    const events = screen.getAllByRole('button').slice(0, 3);
    expect(events[0]).toHaveTextContent('Opening Scene');
    expect(events[1]).toHaveTextContent('Midpoint Crisis');
    expect(events[2]).toHaveTextContent('Climax');
  });

  test('displays status badges', () => {
    render(<FlowTimeline events={mockEvents} dependencies={mockDependencies} />);

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('in_progress')).toBeInTheDocument();
    expect(screen.getByText('planned')).toBeInTheDocument();
  });

  test('shows dependency indicators', () => {
    render(<FlowTimeline events={mockEvents} dependencies={mockDependencies} />);

    // Events should have dependency indicators after implementation
    expect(screen.queryByText(/⬅️|➡️/)).toBeInTheDocument();
  });
});
