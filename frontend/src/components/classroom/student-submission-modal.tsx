'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBooks } from '@/hooks/useBooks';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { FileText, BookOpen, Upload } from 'lucide-react';

interface StudentSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  classroomId: string;
  assignmentTitle?: string;
}

interface SubmissionPayload {
  assignment_id: string;
  book_id?: string;
  submitted_text?: string;
  submitted_file?: File;
}

export function StudentSubmissionModal({
  isOpen,
  onClose,
  assignmentId,
  classroomId,
  assignmentTitle = 'Assignment',
}: StudentSubmissionModalProps) {
  const { data: books = [] } = useBooks();
  const [submissionMode, setSubmissionMode] = useState<'project' | 'text' | 'file'>('project');
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [submittedText, setSubmittedText] = useState('');
  const [submittedFile, setSubmittedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');

  const submitMutation = useMutation({
    mutationFn: async (payload: SubmissionPayload) => {
      if (submissionMode === 'file' && submittedFile) {
        const formData = new FormData();
        formData.append('assignment_id', assignmentId);
        formData.append('file', submittedFile);
        return apiClient.classroom.submitAssignmentFile(classroomId, formData);
      }
      return apiClient.classroom.submitAssignment(classroomId, payload);
    },
    onSuccess: () => {
      toast.success('Assignment submitted successfully!');
      handleReset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to submit assignment');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSubmittedFile(file);
      setFileName(file.name);
    }
  };

  const handleSubmit = () => {
    if (submissionMode === 'project' && !selectedBookId) {
      toast.error('Please select a project to submit');
      return;
    }

    if (submissionMode === 'text' && !submittedText.trim()) {
      toast.error('Please enter submission text');
      return;
    }

    if (submissionMode === 'file' && !submittedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    const payload: SubmissionPayload = {
      assignment_id: assignmentId,
      book_id: submissionMode === 'project' ? selectedBookId : undefined,
      submitted_text: submissionMode === 'text' ? submittedText : undefined,
    };

    submitMutation.mutate(payload);
  };

  const handleReset = () => {
    setSubmissionMode('project');
    setSelectedBookId('');
    setSubmittedText('');
    setSubmittedFile(null);
    setFileName('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
          <DialogDescription>
            {assignmentTitle && <p>Assignment: <span className="font-semibold">{assignmentTitle}</span></p>}
            <p className="mt-1">Choose how you'd like to submit your work</p>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={submissionMode} onValueChange={(value) => setSubmissionMode(value as 'project' | 'text' | 'file')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="project" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Project
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File
            </TabsTrigger>
          </TabsList>

          {/* Project Mode */}
          <TabsContent value="project" className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select a Project</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {books.length === 0 ? (
                  <p className="text-sm text-gray-500">No projects found. Create a project first.</p>
                ) : (
                  books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => setSelectedBookId(book.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedBookId === book.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">{book.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {book.status} • {book.word_count || 0} words
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              You can select any of your projects to submit. The project content will be evaluated for the assignment.
            </p>
          </TabsContent>

          {/* Text Mode */}
          <TabsContent value="text" className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Submission</label>
              <Textarea
                value={submittedText}
                onChange={(e) => setSubmittedText(e.target.value)}
                placeholder="Paste or type your submission here..."
                className="min-h-64 resize-none"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Word count: {submittedText.split(/\s+/).filter(Boolean).length}
              </p>
            </div>
          </TabsContent>

          {/* File Mode */}
          <TabsContent value="file" className="space-y-4 py-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
              <input
                type="file"
                id="file-input"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,.doc,.txt,.md"
              />
              <label htmlFor="file-input" className="cursor-pointer block">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {fileName || 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  PDF, DOCX, TXT, or MD files
                </p>
              </label>
            </div>
            {submittedFile && (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm text-green-800 dark:text-green-200">📎 {fileName}</span>
                <button
                  onClick={() => {
                    setSubmittedFile(null);
                    setFileName('');
                  }}
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Assignment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
