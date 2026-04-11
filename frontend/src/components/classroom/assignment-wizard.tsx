'use client';

import React, { useState } from 'react';
import { useCreateAssignment } from '@/hooks/useClassroom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateAssignmentRequest } from '@/types/classroom';

interface AssignmentWizardProps {
  classroomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentWizard({ classroomId, open, onOpenChange }: AssignmentWizardProps) {
  const { mutate: createAssignment, isPending } = useCreateAssignment();
  const [step, setStep] = useState<'basic' | 'instructions' | 'requirements'>('basic');
  const [formData, setFormData] = useState<CreateAssignmentRequest>({
    title: '',
    description: '',
    instructions: '',
    allow_peer_review: true,
    allow_student_upload: true,
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter an assignment title');
      return;
    }

    createAssignment(
      { classroomId, data: formData },
      {
        onSuccess: () => {
          toast.success('Assignment created!');
          setFormData({ title: '', description: '', instructions: '' });
          setStep('basic');
          onOpenChange(false);
        },
        onError: () => {
          toast.error('Failed to create assignment');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assignment Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Short Story: Character Development"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Brief Description
                </label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="What is this assignment about?"
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Due Date (optional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={formData.due_date || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 pl-10 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('instructions')}>
                  Next: Instructions
                </Button>
              </div>
            </div>
          )}

          {step === 'instructions' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Detailed Instructions
                </label>
                <Textarea
                  value={formData.instructions || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  placeholder="Provide detailed instructions for the assignment. Include any guidelines, examples, or requirements."
                  rows={6}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStep('basic')}>
                  Back
                </Button>
                <Button onClick={() => setStep('requirements')}>
                  Next: Requirements
                </Button>
              </div>
            </div>
          )}

          {step === 'requirements' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Minimum Word Count
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.word_count_min || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        word_count_min: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    placeholder="e.g., 500"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Maximum Word Count
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.word_count_max || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        word_count_max: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    placeholder="e.g., 2000"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allow_student_upload}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allow_student_upload: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Allow student uploads
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allow_peer_review}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allow_peer_review: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Allow peer review
                  </span>
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStep('instructions')}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isPending}
                >
                  {isPending ? 'Creating...' : 'Create Assignment'}
                </Button>
              </div>
            </div>
          )}

          {/* Step indicator */}
          <div className="flex gap-2 justify-center text-xs">
            <span
              className={`px-2 py-1 rounded ${
                step === 'basic' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              1. Basic Info
            </span>
            <span
              className={`px-2 py-1 rounded ${
                step === 'instructions' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              2. Instructions
            </span>
            <span
              className={`px-2 py-1 rounded ${
                step === 'requirements' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              3. Requirements
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
