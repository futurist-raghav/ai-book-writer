'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Rubric {
  [key: string]: {
    max_points: number;
    description: string;
  };
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  submitted_at: string;
  status: 'submitted' | 'graded' | 'returned';
  content_type: 'project' | 'text' | 'file';
  word_count?: number;
}

interface Props {
  assignmentId: string;
  rubric?: Rubric;
}

export function StudentGradingPanel({ assignmentId, rubric }: Props) {
  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ['submissions', assignmentId],
    queryFn: async () => {
      const response = await apiClient.classroom.listSubmissions(assignmentId);
      return response.data as Submission[];
    },
  });

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [maxScore, setMaxScore] = useState(
    rubric ? Object.values(rubric).reduce((sum, item) => sum + item.max_points, 0) : 100
  );

  const gradeMutation = useMutation({
    mutationFn: (submissionId: string) =>
      apiClient.classroom.submitGrade(submissionId, {
        score,
        feedback,
        rubric_scores: Object.keys(rubricScores).length > 0 ? rubricScores : undefined,
      }),
    onSuccess: () => {
      toast.success('Grade submitted successfully');
      resetForm();
    },
    onError: () => {
      toast.error('Failed to submit grade');
    },
  });

  const selectedSubmission = submissions.find((s: Submission) => s.id === selectedSubmissionId);

  const resetForm = () => {
    setFeedback('');
    setScore(0);
    setRubricScores({});
  };

  const handleRubricScoreChange = (key: string, value: number) => {
    setRubricScores((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const gradingProgress = submissions.length > 0
    ? `${submissions.filter((s: Submission) => s.status === 'graded').length}/${submissions.length}`
    : '0/0';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Grading Interface</CardTitle>
          <CardDescription>
            Progress: {gradingProgress} submissions graded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs className="w-full" defaultValue="submissions">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="grader">Grading</TabsTrigger>
            </TabsList>

            {/* Submissions Tab */}
            <TabsContent value="submissions" className="space-y-4 py-4">
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-sm text-gray-600">Loading submissions...</p>
                ) : submissions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">No submissions yet</p>
                  </div>
                ) : (
                  submissions.map((submission: Submission) => (
                    <button
                      key={submission.id}
                      onClick={() => {
                        setSelectedSubmissionId(submission.id);
                        resetForm();
                      }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedSubmissionId === submission.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-950'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {submission.student_name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                            {submission.word_count && ` • ${submission.word_count} words`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {submission.status === 'graded' && (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          )}
                          {submission.status === 'submitted' && (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            submission.status === 'graded'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Grading Tab */}
            <TabsContent value="grader" className="py-4">
              {selectedSubmission ? (
                <div className="space-y-6">
                  {/* Submission Info */}
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Grading: {selectedSubmission.student_name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {selectedSubmission.content_type.charAt(0).toUpperCase() + selectedSubmission.content_type.slice(1)} submission
                      {selectedSubmission.word_count && ` • ${selectedSubmission.word_count} words`}
                    </p>
                  </div>

                  {/* Rubric Scoring */}
                  {rubric && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Rubric Scoring</h4>
                      {Object.entries(rubric).map(([key, criterion]) => (
                        <div key={key} className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {key}
                            <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                              (Max: {criterion.max_points} points)
                            </span>
                          </label>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {criterion.description}
                          </p>
                          <Input
                            type="number"
                            min="0"
                            max={criterion.max_points}
                            value={rubricScores[key] || 0}
                            onChange={(e) =>
                              handleRubricScoreChange(key, parseInt(e.target.value) || 0)
                            }
                            className="w-32"
                          />
                        </div>
                      ))}
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Subtotal:{' '}
                          <span className="text-lg font-bold text-purple-600">
                            {Object.values(rubricScores).reduce((sum, val) => sum + val, 0)}/
                            {maxScore}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Overall Score */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Overall Score
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max={maxScore}
                        value={score}
                        onChange={(e) => setScore(parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        / {maxScore}
                      </span>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Feedback
                    </label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Provide detailed feedback for the student..."
                      rows={6}
                      className="resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedSubmissionId(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() =>
                        gradeMutation.mutate(selectedSubmission.id)
                      }
                      disabled={gradeMutation.isPending || score < 0}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {gradeMutation.isPending ? 'Submitting...' : 'Submit Grade'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Select a submission to grade
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
