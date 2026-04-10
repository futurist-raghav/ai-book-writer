/**
 * FlowEventEditor Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FlowEventEditor } from '../FlowEventEditor';
import { FlowEvent } from '@/lib/api-client';

// Mock event data
const mockEvent: FlowEvent = {
  id: 'event1',
  title: 'Opening Scene',
  description: 'The beginning of the story',
  event_type: 'scene',
  status: 'in_progress',
  timeline_position: 0,
  duration: 5,
  content: 'Scene content here',
  book_id: 'book1',
  chapter_ids: ['ch1'],
  metadata: {},
  created_at: new Date(),
  updated_at: new Date(),
};

describe('FlowEventEditor Component', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form with step indicator', () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Title *')).toBeInTheDocument();
    expect(screen.getByText('Event Type *')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  test('loads existing event data', () => {
    render(
      <FlowEventEditor
        event={mockEvent}
        bookId="book1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const titleInput = screen.getByPlaceholderText('Event title') as HTMLInputElement;
    expect(titleInput.value).toBe('Opening Scene');
  });

  test('validates required title field', async () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const titleInput = screen.getByPlaceholderText('Event title');
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  test('validates timeline position', async () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Click next to get to step 2
    const titleInput = screen.getByPlaceholderText('Event title');
    await userEvent.type(titleInput, 'Test Event');

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Timeline Position *')).toBeInTheDocument();
    });

    const positionInput = screen.getByPlaceholderText('0') as HTMLInputElement;
    await userEvent.clear(positionInput);
    await userEvent.type(positionInput, '10001');
    fireEvent.blur(positionInput);

    await waitFor(() => {
      expect(
        screen.getByText('Timeline position must be between 0 and 10000')
      ).toBeInTheDocument();
    });
  });

  test('progresses through form steps', async () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Step 1: Fill title
    const titleInput = screen.getByPlaceholderText('Event title');
    await userEvent.type(titleInput, 'Test Event');

    // Click Next
    let nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    // Step 2: Timeline and duration
    await waitFor(() => {
      expect(screen.getByText('Timeline Position *')).toBeInTheDocument();
    });

    const positionInput = screen.getByPlaceholderText('0');
    await userEvent.type(positionInput, '100');

    // Click Next again
    nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    // Step 3: Description and content
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Event description')).toBeInTheDocument();
    });
  });

  test('calls onCancel when cancel button clicked', () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('disables save button when form has errors', async () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Complete form through all steps
    const titleInput = screen.getByPlaceholderText('Event title');
    await userEvent.type(titleInput, 'Test Event');

    let nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Timeline Position *')).toBeInTheDocument();
    });

    const positionInput = screen.getByPlaceholderText('0');
    await userEvent.type(positionInput, '100');

    nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Event description')).toBeInTheDocument();
    });

    // Now submit should be enabled
    const submitButton = screen.getByText('Create Event');
    expect(submitButton).not.toBeDisabled();
  });

  test('character count visible for title', async () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    const titleInput = screen.getByPlaceholderText('Event title');
    await userEvent.type(titleInput, 'Test');

    expect(screen.getByText('4/200')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(
      <FlowEventEditor
        bookId="book1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('displays error message', () => {
    const error = 'Failed to save event';
    render(
      <FlowEventEditor
        bookId="book1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        error={error}
      />
    );

    expect(screen.getByText(error)).toBeInTheDocument();
  });

  test('calls onSave with correct data', async () => {
    render(
      <FlowEventEditor bookId="book1" onSave={mockOnSave} onCancel={mockOnCancel} />
    );

    // Fill in all fields
    const titleInput = screen.getByPlaceholderText('Event title');
    await userEvent.type(titleInput, 'Test Event');

    let nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Timeline Position *')).toBeInTheDocument();
    });

    const positionInput = screen.getByPlaceholderText('0');
    await userEvent.type(positionInput, '100');

    nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Event description')).toBeInTheDocument();
    });

    // Submit form
    const submitButton = screen.getByText('Create Event');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Event',
          timeline_position: 100,
          book_id: 'book1',
        })
      );
    });
  });

  test('edit mode shows Update Event button', () => {
    render(
      <FlowEventEditor
        event={mockEvent}
        bookId="book1"
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // Navigate to step 3
    const titleInput = screen.getByPlaceholderText('Event title');
    expect(titleInput).toBeInTheDocument();

    // In edit mode, after going through steps, button should say "Update Event"
    let nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(screen.getByText('Update Event')).toBeInTheDocument();
  });
});
