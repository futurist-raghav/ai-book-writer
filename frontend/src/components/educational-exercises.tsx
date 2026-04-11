'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: string;
  type: string;
}

interface DiscussionPrompt {
  prompt: string;
  guide_questions: string[];
  suggested_format: string;
  learning_goals: string[];
}

interface HomeworkExercise {
  exercise_title: string;
  instructions: string;
  materials_needed: string[];
  expected_output: string;
  time_estimate_minutes: number;
  difficulty: string;
  rubric_points?: number;
}

interface EducationalExercisesResponse {
  quiz_questions: QuizQuestion[];
  discussion_prompts: DiscussionPrompt[];
  homework_exercises: HomeworkExercise[];
  total_exercises: number;
  chapter_summary: string;
  message: string;
}

interface EducationalExercisesProps {
  chapterId: string;
  onClose: () => void;
}

export function EducationalExercises({
  chapterId,
  onClose,
}: EducationalExercisesProps) {
  const [activeTab, setActiveTab] = useState<'quiz' | 'discussion' | 'homework'>('quiz');
  const [numQuestions, setNumQuestions] = useState(3);
  const [numPrompts, setNumPrompts] = useState(2);
  const [numExercises, setNumExercises] = useState(2);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/chapters/${chapterId}/generate-exercises`, null, {
        params: {
          num_questions: numQuestions,
          num_prompts: numPrompts,
          num_exercises: numExercises,
        },
      });
      return response.data as EducationalExercisesResponse;
    },
    onError: () => {
      alert('Failed to generate exercises. Try again.');
    },
  });

  const data = generateMutation.data;

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] overflow-y-auto p-6">
          <h2 className="text-2xl font-bold mb-4 text-primary">Generate Educational Exercises</h2>

          <div className="space-y-4">
            {/* Number of Questions */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Number of Quiz Questions: {numQuestions}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Number of Discussion Prompts */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Number of Discussion Prompts: {numPrompts}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={numPrompts}
                onChange={(e) => setNumPrompts(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Number of Homework Exercises */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Number of Homework Exercises: {numExercises}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={numExercises}
                onChange={(e) => setNumExercises(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate Exercises'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-medium text-on-surface hover:bg-surface-container"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-primary">Educational Exercises</h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <div className="bg-primary/5 rounded-lg p-4 mb-4 border border-primary/20">
          <h3 className="font-semibold text-on-surface mb-2">Key Learning Points</h3>
          <p className="text-sm text-on-surface-variant">{data.chapter_summary}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-outline-variant/30 mb-4">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'quiz'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Quiz ({data.quiz_questions.length})
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'discussion'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Discussion ({data.discussion_prompts.length})
          </button>
          <button
            onClick={() => setActiveTab('homework')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'homework'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Homework ({data.homework_exercises.length})
          </button>
        </div>

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div className="space-y-4">
            {data.quiz_questions.length === 0 ? (
              <p className="text-on-surface-variant">No quiz questions generated.</p>
            ) : (
              data.quiz_questions.map((q, idx) => (
                <div key={idx} className="border border-outline-variant/30 rounded-lg p-4 bg-surface-container-lowest">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-on-surface">Question {idx + 1}</h4>
                    <span className={`text-xs px-2 py-1 rounded ${
                      q.difficulty === 'easy' ? 'bg-green-100 text-green-900' :
                      q.difficulty === 'hard' ? 'bg-red-100 text-red-900' :
                      'bg-yellow-100 text-yellow-900'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <p className="text-on-surface mb-3">{q.question}</p>
                  <div className="space-y-2 mb-3">
                    {q.options.map((opt, i) => (
                      <div key={i} className={`p-2 rounded border ${
                        i === q.correct_answer
                          ? 'bg-green-50 border-green-200 text-green-900 font-semibold'
                          : 'border-outline-variant/20 text-on-surface'
                      }`}>
                        {String.fromCharCode(65 + i)}) {opt}
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-900">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Discussion Tab */}
        {activeTab === 'discussion' && (
          <div className="space-y-4">
            {data.discussion_prompts.length === 0 ? (
              <p className="text-on-surface-variant">No discussion prompts generated.</p>
            ) : (
              data.discussion_prompts.map((d, idx) => (
                <div key={idx} className="border border-outline-variant/30 rounded-lg p-4 bg-surface-container-lowest">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-on-surface">Prompt {idx + 1}</h4>
                    <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-900">
                      {d.suggested_format}
                    </span>
                  </div>
                  <p className="text-on-surface font-medium mb-3">{d.prompt}</p>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-on-surface-variant mb-1">Guide Questions:</p>
                    <ul className="list-disc list-inside text-sm text-on-surface space-y-1">
                      {d.guide_questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface-variant mb-1">Learning Goals:</p>
                    <ul className="list-disc list-inside text-sm text-on-surface space-y-1">
                      {d.learning_goals.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Homework Tab */}
        {activeTab === 'homework' && (
          <div className="space-y-4">
            {data.homework_exercises.length === 0 ? (
              <p className="text-on-surface-variant">No homework exercises generated.</p>
            ) : (
              data.homework_exercises.map((h, idx) => (
                <div key={idx} className="border border-outline-variant/30 rounded-lg p-4 bg-surface-container-lowest">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-on-surface">{h.exercise_title}</h4>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        h.difficulty === 'easy' ? 'bg-green-100 text-green-900' :
                        h.difficulty === 'hard' ? 'bg-red-100 text-red-900' :
                        'bg-yellow-100 text-yellow-900'
                      }`}>
                        {h.difficulty}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-900">
                        {h.time_estimate_minutes}min
                      </span>
                      {h.rubric_points && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-900">
                          {h.rubric_points}pts
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-on-surface mb-2 text-sm">{h.instructions}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <p className="font-semibold text-on-surface-variant">Materials:</p>
                      <p className="text-on-surface">{h.materials_needed.length > 0 ? h.materials_needed.join(', ') : 'None'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-on-surface-variant">Expected Output:</p>
                      <p className="text-on-surface">{h.expected_output}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Download/Export Options */}
        <div className="mt-6 pt-4 border-t border-outline-variant/30 flex gap-2">
          <button
            onClick={() => {
              const text = `$Educational Exercises
${data.chapter_summary}

Quiz Questions:
${data.quiz_questions.map((q, i) => `${i+1}. ${q.question}\n${q.options.map((o, j) => `   ${j}) ${o}`).join('\n')}`).join('\n\n')}

Discussion Prompts:
${data.discussion_prompts.map((d, i) => `${i+1}. ${d.prompt}`).join('\n\n')}

Homework Exercises:
${data.homework_exercises.map((h, i) => `${i+1}. ${h.exercise_title}\n${h.instructions}`).join('\n\n')}`;
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'exercises.txt';
              a.click();
            }}
            className="flex-1 rounded-lg border border-outline bg-surface-container-lowest px-4 py-2 font-medium text-on-surface hover:bg-surface-container"
          >
            Download as Text
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
