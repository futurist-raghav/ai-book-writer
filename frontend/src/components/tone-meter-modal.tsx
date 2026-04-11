'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

interface ToneEmotionScore {
  emotion: string;
  confidence: number;
  intensity: number;
}

interface ToneAnalysisData {
  primary_emotions: ToneEmotionScore[];
  overall_tone: string;
  tone_summary: string;
  tone_shift_suggestions: string[];
  chapter_context: string;
  processing_time_ms: number;
}

interface ToneMeterModalProps {
  isOpen: boolean;
  chapterId: string;
  onClose: () => void;
}

const EMOTION_COLORS: Record<string, string> = {
  joyful: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  tense: 'bg-red-100 text-red-900 border-red-300',
  somber: 'bg-slate-100 text-slate-900 border-slate-300',
  inspiring: 'bg-blue-100 text-blue-900 border-blue-300',
  neutral: 'bg-gray-100 text-gray-900 border-gray-300',
};

const EMOTION_LABELS: Record<string, string> = {
  joyful: '😊 Joyful',
  tense: '😰 Tense',
  somber: '😔 Somber',
  inspiring: '🚀 Inspiring',
  neutral: '😐 Neutral',
};

export function ToneMeterModal({ isOpen, chapterId, onClose }: ToneMeterModalProps) {
  const [data, setData] = useState<ToneAnalysisData | null>(null);
  const [toneShiftValue, setToneShiftValue] = useState(0);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.chapters.analyzeTone(chapterId);
      return (response as any).data as ToneAnalysisData;
    },
    onSuccess: (result) => {
      setData(result);
      toast.success('Tone analysis complete');
    },
    onError: (error) => {
      toast.error('Failed to analyze tone');
      console.error(error);
    },
  });

  const handleAnalyze = useCallback(() => {
    analyzeMutation.mutate();
  }, [analyzeMutation]);

  if (!isOpen) return null;

  const handleClose = () => {
    setData(null);
    setToneShiftValue(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Tone Meter & Analysis
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Analyze the emotional tone of your chapter
          </p>
        </div>

        {/* Content */}
        <div className="max-h-[600px] overflow-y-auto px-6 py-4">
          {!data && !analyzeMutation.isPending && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="text-gray-400">📊 No analysis yet</div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Click "Analyze Tone" to detect the emotional tone of this chapter
              </p>
            </div>
          )}

          {analyzeMutation.isPending && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Spinner />
              <p className="text-sm text-gray-600 dark:text-gray-400">Analyzing tone...</p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Primary Emotions */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Detected Emotions
                </h3>
                <div className="mt-3 space-y-3">
                  {data.primary_emotions.map((emotion, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {EMOTION_LABELS[emotion.emotion] || emotion.emotion}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {Math.round(emotion.confidence * 100)}% confidence
                        </span>
                      </div>
                      {/* Confidence bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-full transition-all ${
                            emotion.emotion === 'joyful'
                              ? 'bg-yellow-400'
                              : emotion.emotion === 'tense'
                                ? 'bg-red-400'
                                : emotion.emotion === 'somber'
                                  ? 'bg-slate-400'
                                  : emotion.emotion === 'inspiring'
                                    ? 'bg-blue-400'
                                    : 'bg-gray-400'
                          }`}
                          style={{ width: `${emotion.confidence * 100}%` }}
                        />
                      </div>
                      {/* Intensity indicator */}
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>Intensity:</span>
                        <div className="flex space-x-1">
                          {[0, 1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={`h-2 w-2 rounded-full ${
                                level < Math.ceil(emotion.intensity * 5)
                                  ? emotion.emotion === 'joyful'
                                    ? 'bg-yellow-400'
                                    : emotion.emotion === 'tense'
                                      ? 'bg-red-400'
                                      : emotion.emotion === 'somber'
                                        ? 'bg-slate-400'
                                        : emotion.emotion === 'inspiring'
                                          ? 'bg-blue-400'
                                          : 'bg-gray-400'
                                  : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Tone Summary</h3>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  {data.tone_summary}
                </p>
              </div>

              {/* Tone Shift Slider */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Shift Tone</h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Adjust the emotional balance of this chapter
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">More Somber</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {toneShiftValue > 0 ? '+' : ''}{toneShiftValue}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">More Uplifting</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={toneShiftValue}
                    onChange={(e) => setToneShiftValue(Number.parseInt(e.target.value))}
                    className="range range-sm w-full"
                  />
                </div>
              </div>

              {/* Tone Shift Suggestions */}
              {data.tone_shift_suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Suggestions for Tone Adjustment
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {data.tone_shift_suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mt-1 flex-shrink-0 text-blue-500">💡</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chapter Context */}
              <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-slate-800">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.chapter_context}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {data.processing_time_ms}ms
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
            >
              Close
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Tone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
