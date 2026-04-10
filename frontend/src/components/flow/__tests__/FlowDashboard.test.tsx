/**
 * FlowDashboard Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlowDashboard } from '../FlowDashboard';
import { FlowEvent, FlowDependency } from '@/lib/api-client';

const mockEvents: FlowEvent[] = [
  {
    id: '1',
    title: 'Opening',
    description: 'Start',
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
    title: 'Midpoint',
    description: 'Middle',
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
];

const mockDependencies: FlowDependency[] = [
  {
    id: 'dep1',
    from_event_id: '1',
    to_event_id: '2',
    dependency_type: 'blocks',
    created_at: new Date(),
  },
];

describe('FlowDashboard Component', () => {
  const mockOnEventCreate = jest.fn();
  const mockOnEventUpdate = jest.fn();
  const mockOnDependencyCreate = jest.fn();
  const mockOnDependencyDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard header', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    expect(screen.getByText('Flow Management')).toBeInTheDocument();
    expect(
      screen.getByText('Organize and track events, dependencies, and timeline')
    ).toBeInTheDocument();
  });

  test('renders view mode toggle buttons', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    expect(screen.getByText('📅 Timeline')).toBeInTheDocument();
    expect(screen.getByText('🔗 Graph')).toBeInTheDocument();
    expect(screen.getByText('✏️ Editor')).toBeInTheDocument();
  });

  test('displays statistics', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
    expect(screen.getByText('Completion')).toBeInTheDocument();
  });

  test('calculates completion percentage correctly', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    // 1 completed out of 2 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  test('toggles view modes', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    // Start in timeline mode (default)
    expect(screen.getByText('📅 Timeline')).toBeInTheDocument();

    // Click Graph button
    const graphButton = screen.getByText('🔗 Graph');
    fireEvent.click(graphButton);

    // Should show graph view
    expect(screen.getByText('Dependency Graph')).toBeInTheDocument();

    // Click Editor button
    const editorButton = screen.getByText('✏️ Editor');
    fireEvent.click(editorButton);

    // Should show editor view
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  test('displays error message', () => {
    const error = 'Failed to load flow data';
    render(
      <FlowDashboard
        bookId="book1"
        events={[]}
        dependencies={[]}
        error={error}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    expect(screen.getByText(`Error loading flow data`)).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={[]}
        dependencies={[]}
        isLoading={true}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    expect(screen.getByText('Flow Management')).toBeInTheDocument();
  });

  test('displays all statistics correctly', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    // Check all stat cards are present
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
    expect(screen.getByText('Completion')).toBeInTheDocument();
  });

  test('can toggle statistics visibility', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    // Click Hide Statistics
    const hideButton = screen.getByText('Hide Statistics');
    fireEvent.click(hideButton);

    // Statistics should still render but can be toggled
    expect(screen.getByText('Show Statistics')).toBeInTheDocument();
  });

  test('displays event list in editor mode', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    // Click editor to switch view
    const editorButton = screen.getByText('✏️ Editor');
    fireEvent.click(editorButton);

    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Opening')).toBeInTheDocument();
    expect(screen.getByText('Midpoint')).toBeInTheDocument();
  });

  test('handles new event creation', () => {
    render(
      <FlowDashboard
        bookId="book1"
        events={mockEvents}
        dependencies={mockDependencies}
        onEventCreate={mockOnEventCreate}
        onEventUpdate={mockOnEventUpdate}
        onDependencyCreate={mockOnDependencyCreate}
        onDependencyDelete={mockOnDependencyDelete}
      />
    );

    // Click editor to switch view
    const editorButton = screen.getByText('✏️ Editor');
    fireEvent.click(editorButton);

    // Click New Event button
    const newEventButton = screen.getByText('+ New Event');
    fireEvent.click(newEventButton);

    // Form should display
    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument();
  });
});
