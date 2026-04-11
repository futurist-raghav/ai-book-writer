'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

interface Exercise {
  question: string;
  exercise_type: string;
  difficulty: string;
  suggested_answer?: string;
  answer_key_notes?: string;
}

interface ExerciseGenerationData {
  exercises: Exercise[];
  total_exercises: number;
  exercise_distribution: Record<string, number>;
  chapter_summary: string;
  processing_time_ms: number;
}

interface ExerciseGeneratorModalProps {
  isOpen: boolean;
  chapterId: string;
  onClose: () => void;
}

const EXERCISE_TYPE_ICONS: Record<string, string> = {
  quiz: '❓',
  discussion: '💬',
  homework: '📝',
};

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'mixed'] as const;

export function ExerciseGeneratorModal({ isOpen, chapterId, onClose }: ExerciseGeneratorModalProps) {
  const [data, setData] = useState<ExerciseGenerationData | null>(null);
  const [difficulty, setDifficulty] = useState<string>('mixed');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['quiz', 'discussion', 'homework']));
  const [exerciseCount, setExerciseCount] = useState<number>(8);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const exerciseTypes = Array.from(selectedTypes).join(',');
      const response = await apiClient.chapters.generateExercises(chapterId, {
        difficulty,
        exercise_types: exerciseTypes || 'all',
        count: exerciseCount,
      });
      return (response as any).data as ExerciseGenerationData;
    },
    onSuccess: (result) => {
      setData(result);
      toast.success(`Generated ${result.total_exercises} exercises`);
    },
    onError: (error) => {
      toast.error('Failed to generate exercises');
      console.error(error);
    },
  });

  const handleGenerate = useCallback(() => {
    if (selectedTypes.size === 0) {
      toast.error('Please select at least one exercise type');
      return;
    }
    generateMutation.mutate();
  }, [selectedTypes, generateMutation]);

  const toggleExerciseType = (type: string) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedTypes(newSet);
  };

  const handleClose = () => {
    setData(null);
    setDifficulty('mixed');
    setSelectedTypes(new Set(['quiz', 'discussion', 'homework']));
    setExerciseCount(8);
    setExpandedIndex(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 px-6 py-4 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Educational Exercise Generator
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Generate quiz questions, discussion prompts, and homework exercises
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {!data && (
            <>
              {/* Exercise Type Selection */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Exercise Types
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {['quiz', 'discussion', 'homework'].map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleExerciseType(type)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        selectedTypes.has(type)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <span className="text-xl">{EXERCISE_TYPE_ICONS[type]}</span>
                      <span className="font-medium capitalize text-gray-900 dark:text-white">
                        {type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Difficulty Level
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {DIFFICULTY_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`px-3 py-2 rounded-lg border-2 font-medium capitalize transition-all ${
                        difficulty === level
                          ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Count Selection */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Number of Exercises
                </h3>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={exerciseCount}
                    onChange={(e) => setExerciseCount(Number.parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400 w-12">
                    {exerciseCount}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Generate 1-25 exercises (optimal: 6-12)
                </p>
              </div>
            </>
          )}

          {generateMutation.isPending && (
            <div className="flex flex-col items-center justify-center space-y-4 py-12">
              <Spinner />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generating exercises...
              </p>
            </div>
          )}

          {data && (
            <>
              {/* Distribution Summary */}
              <div className="flex gap-4 bg-gray-100 dark:bg-slate-800 rounded-lg p-4">
                {Object.entries(data.exercise_distribution).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-lg">{EXERCISE_TYPE_ICONS[type]}</span>
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                        {type}
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white">{count}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Exercises List */}
              <div className="space-y-3">
                {data.exercises.map((exercise, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-start justify-between gap-3 text-left transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {EXERCISE_TYPE_ICONS[exercise.exercise_type]}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100 font-medium capitalize">
                            {exercise.difficulty}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                          {exercise.question}
                        </p>
                      </div>
                      <span className="mt-1 text-gray-500 dark:text-gray-400">
                        {expandedIndex === idx ? '▼' : '▶'}
                      </span>
                    </button>

                    {expandedIndex === idx && (
                      <div className="px-4 py-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 space-y-3">
                        {exercise.suggested_answer && (
                          <div>
                            <h4 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-2">
                              Answer / Key Points
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 p-3 rounded">
                              {exercise.suggested_answer}
                            </p>
                          </div>
                        )}
                        {exercise.answer_key_notes && (
                          <div>
                            <h4 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-2">
                              Teacher Notes
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-950 p-3 rounded border-l-4 border-yellow-400">
                              💡 {exercise.answer_key_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {data.chapter_summary} • Generated in {data.processing_time_ms}ms
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 px-6 py-4 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
            >
              Close
            </button>
            {!data && (
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || selectedTypes.size === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate Exercises'}
              </button>
            )}
            {data && (
              <button
                onClick={() => {
                  setData(null);
                  setSelectedTypes(new Set(['quiz', 'discussion', 'homework']));
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                Generate More
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
