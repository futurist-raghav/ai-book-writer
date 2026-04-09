/**
 * Writing Goal Settings Form
 * Allows users to configure daily writing targets per project
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WritingGoalSettingsProps {
  projectId: string;
  currentDailyTarget: number;
  onSave: (dailyTarget: number) => Promise<void>;
  onCancel?: () => void;
}

export function WritingGoalSettings({
  projectId,
  currentDailyTarget,
  onSave,
  onCancel,
}: WritingGoalSettingsProps) {
  const [dailyTarget, setDailyTarget] = useState(currentDailyTarget);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Common daily targets for quick selection
  const COMMON_TARGETS = [500, 1000, 1500, 2000, 2500, 3000];

  const handleSave = async () => {
    if (dailyTarget < 0) {
      setMessage({ type: 'error', text: 'Daily target must be at least 0' });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(dailyTarget);
      setMessage({ type: 'success', text: 'Daily writing goal updated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save goal',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Goal Display */}
      <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10">
        <label className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant block mb-3">
          Daily Writing Target
        </label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="0"
            max="99999"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="0"
            className="flex-1 font-body text-lg font-semibold"
          />
          <span className="font-label text-sm text-on-surface-variant">words/day</span>
        </div>
      </div>

      {/* Quick Selection */}
      <div>
        <label className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant block mb-2">
          Quick Select
        </label>
        <div className="grid grid-cols-3 gap-2">
          {COMMON_TARGETS.map((target) => (
            <button
              key={target}
              onClick={() => setDailyTarget(target)}
              className={`px-3 py-2 rounded-lg font-label text-sm font-semibold transition-all ${
                dailyTarget === target
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              {target}
            </button>
          ))}
          <button
            onClick={() => setDailyTarget(0)}
            className={`px-3 py-2 rounded-lg font-label text-sm font-semibold transition-all col-span-3 ${
              dailyTarget === 0
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            Disable Goal
          </button>
        </div>
      </div>

      {/* Goal Impact Info */}
      <div className="bg-tertiary-container/20 rounded-lg p-4 border border-tertiary/20">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-tertiary flex-shrink-0">info</span>
          <div className="font-body text-sm text-on-surface-variant">
            {dailyTarget === 0 ? (
              <p>Writing goals help maintain consistent writing motivation through streaks and progress tracking.</p>
            ) : (
              <p>
                Your goal is set to <span className="font-semibold text-on-surface">{dailyTarget} words per day</span>.
                Reach this target to maintain your writing streak and unlock achievements! 🎯
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          message.type === 'success'
            ? 'bg-secondary/10 border-secondary text-secondary'
            : 'bg-error/10 border-error text-error'
        }`}>
          <span className="material-symbols-outlined text-base flex-shrink-0">
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className="font-body text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          disabled={isSaving || dailyTarget === currentDailyTarget}
          className="flex-1"
        >
          {isSaving ? 'Saving...' : 'Save Goal'}
        </Button>
        {onCancel && (
          <Button
            variant="outlined"
            size="lg"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Tips */}
      <div className="bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10">
        <h4 className="font-label text-xs font-bold uppercase tracking-tight text-on-surface-variant mb-2">
          💡 Tips for Success
        </h4>
        <ul className="space-y-2 font-body text-xs text-on-surface-variant">
          <li className="flex gap-2">
            <span>•</span>
            <span>Start with a realistic goal you can consistently reach</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>Build your streak gradually—even 500 words a day adds up!</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>Your streak resets if you miss a day, but you can start fresh anytime</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
