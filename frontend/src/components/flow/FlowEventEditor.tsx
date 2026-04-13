/**
 * Flow Event Editor Form
 * 
 * Form component for creating and editing flow events
 * Includes validation and multi-step creation workflow
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FlowEvent } from '@/lib/api-client';

interface FlowEventEditorProps {
  event?: FlowEvent;
  bookId: string;
  onSave?: (data: Partial<FlowEvent>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string;
}

interface FormData {
  title: string;
  description: string;
  event_type: string;
  status: FlowEvent['status'];
  timeline_position: number;
  duration?: number;
  content?: string;
  metadata?: Record<string, any>;
}

/**
 * Flow Event Editor Form
 * Create or edit flow events with validation
 */
export function FlowEventEditor({
  event,
  bookId,
  onSave,
  onCancel,
  isLoading,
  error,
}: FlowEventEditorProps) {
  const [formData, setFormData] = useState<FormData>({
    title: event?.title || '',
    description: event?.description || '',
    event_type: event?.event_type || 'beat',
    status: event?.status || 'planned',
    timeline_position: event?.timeline_position || 0,
    duration: event?.duration,
    content: event?.content || '',
    metadata: event?.metadata || {},
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(1);

  const eventTypes = ['act', 'scene', 'beat', 'milestone', 'subplot', 'chapter'];
  const statuses: FlowEvent['status'][] = ['planned', 'in_progress', 'completed', 'archived'];

  // Validation
  const errors: Record<string, string> = {};

  if (!formData.title.trim()) {
    errors.title = 'Title is required';
  } else if (formData.title.length > 200) {
    errors.title = 'Title must be 200 characters or less';
  }

  if (formData.description && formData.description.length > 1000) {
    errors.description = 'Description must be 1000 characters or less';
  }

  if (formData.timeline_position < 0 || formData.timeline_position > 10000) {
    errors.timeline_position = 'Timeline position must be between 0 and 10000';
  }

  if (formData.duration && (formData.duration < 1 || formData.duration > 1000)) {
    errors.duration = 'Duration must be between 1 and 1000 days';
  }

  const isStepValid = {
    1: !errors.title && !errors.event_type,
    2: !errors.timeline_position && !errors.duration,
    3: !errors.description && !errors.content,
  };

  const handleInputChange = (
    field: keyof FormData,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleMetadataChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value,
      },
    }));
  };

  const handleNext = () => {
    if (isStepValid[step as keyof typeof isStepValid]) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    // Only submit if valid
    if (Object.keys(errors).length === 0) {
      onSave?.({
        ...formData,
        book_id: bookId,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold
                ${s <= step ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}
              `}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`
                  h-1 w-12 mx-2
                  ${s < step ? 'bg-blue-500' : 'bg-gray-200'}
                `}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
              maxLength={200}
              className={`
                w-full px-4 py-2 rounded-lg border-2
                ${
                  touched.title && errors.title
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }
                focus:outline-none focus:border-blue-500
              `}
              placeholder="Event title"
            />
            {touched.title && errors.title && (
              <p className="text-sm text-red-600 mt-1">{errors.title}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formData.title.length}/200
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Event Type *
            </label>
            <select
              value={formData.event_type}
              onChange={(e) => handleInputChange('event_type', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 bg-white focus:outline-none focus:border-blue-500"
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value as FlowEvent['status'])}
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 bg-white focus:outline-none focus:border-blue-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Timeline & Duration */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Timeline Position *
            </label>
            <input
              type="number"
              value={formData.timeline_position}
              onChange={(e) =>
                handleInputChange('timeline_position', parseInt(e.target.value))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, timeline_position: true }))}
              min={0}
              max={10000}
              className={`
                w-full px-4 py-2 rounded-lg border-2
                ${
                  touched.timeline_position && errors.timeline_position
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }
                focus:outline-none focus:border-blue-500
              `}
              placeholder="0"
            />
            {touched.timeline_position && errors.timeline_position && (
              <p className="text-sm text-red-600 mt-1">
                {errors.timeline_position}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Lower values happen earlier. Range: 0-10000
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Duration (days)
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) =>
                handleInputChange('duration', e.target.value ? parseInt(e.target.value) : undefined)
              }
              onBlur={() => setTouched((prev) => ({ ...prev, duration: true }))}
              min={1}
              max={1000}
              className={`
                w-full px-4 py-2 rounded-lg border-2
                ${
                  touched.duration && errors.duration
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }
                focus:outline-none focus:border-blue-500
              `}
              placeholder="Optional"
            />
            {touched.duration && errors.duration && (
              <p className="text-sm text-red-600 mt-1">{errors.duration}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Content & Metadata */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
              maxLength={1000}
              rows={3}
              className={`
                w-full px-4 py-2 rounded-lg border-2
                ${
                  touched.description && errors.description
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white'
                }
                focus:outline-none focus:border-blue-500 resize-none
              `}
              placeholder="Event description"
            />
            {touched.description && errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/1000
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
              rows={3}
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 bg-white focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Detailed event content (optional)"
            />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStepValid[step as keyof typeof isStepValid]}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || Object.keys(errors).length > 0}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

export default FlowEventEditor;
