/**
 * Revert Chapter Confirmation Modal
 * Shows warning and confirmation before reverting to a previous version
 */

'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

interface RevertChapterConfirmationModalProps {
  isOpen: boolean;
  chapterId: string;
  versionId: string;
  versionName?: string;
  currentWordCount?: number;
  targetWordCount?: number;
  onClose: () => void;
  onRevertSuccess?: () => void;
}

export function RevertChapterConfirmationModal({
  isOpen,
  chapterId,
  versionId,
  versionName,
  currentWordCount,
  targetWordCount,
  onClose,
  onRevertSuccess,
}: RevertChapterConfirmationModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();

  const revertMutation = useMutation({
    mutationFn: () => apiClient.chapters.versions.revertTo(chapterId, versionId),
    onSuccess: () => {
      toast.success('Chapter reverted successfully. A backup has been created.');
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-versions', chapterId] });
      setConfirmed(false);
      onRevertSuccess?.();
      onClose();
    },
    onError: () => {
      toast.error('Failed to revert chapter');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-highest rounded-xl shadow-lg max-w-md w-full space-y-6 p-6 border border-outline-variant/10">
        {/* Header */}
        <div>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error/20 mx-auto mb-4">
            <span className="material-symbols-outlined text-error text-xl">warning</span>
          </div>
          <h2 className="text-lg font-bold text-primary text-center">
            Revert Chapter
          </h2>
          <p className="text-xs text-on-surface-variant text-center mt-2">
            This action cannot be undone. A backup will be created automatically.
          </p>
        </div>

        {/* Details */}
        <div className="space-y-3 bg-surface-container-low rounded-lg p-4">
          <div>
            <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              Reverting to
            </p>
            <p className="text-sm font-semibold text-on-surface">
              {versionName || 'Previous version'}
            </p>
          </div>

          {targetWordCount && currentWordCount && (
            <div>
              <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                Word Count Impact
              </p>
              <p className="text-xs text-on-surface-variant">
                Current: <span className="font-semibold text-on-surface">{currentWordCount}</span> words
                <br />
                Will become: <span className="font-semibold text-on-surface">{targetWordCount}</span> words
                <br />
                <span className={targetWordCount > currentWordCount ? 'text-secondary' : 'text-error'}>
                  {targetWordCount > currentWordCount
                    ? `+${targetWordCount - currentWordCount}`
                    : `${targetWordCount - currentWordCount}`}{' '}
                  words
                </span>
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              What Happens
            </p>
            <ul className="text-xs text-on-surface-variant space-y-1">
              <li>• Current version saved as backup</li>
              <li>• Chapter content restored to selected version</li>
              <li>• All versions remain accessible</li>
              <li>• You can undo by reverting to backup</li>
            </ul>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 mt-1 rounded border-input bg-background cursor-pointer"
          />
          <span className="text-xs text-on-surface-variant">
            I understand that this will revert my chapter to a previous version, and I have reviewed 
            the word count impact.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label font-bold text-sm hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => revertMutation.mutate()}
            disabled={!confirmed || revertMutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-error text-white font-label font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {revertMutation.isPending && <Spinner className="w-3 h-3" />}
            Revert Chapter
          </button>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-on-surface-variant/60 text-center italic">
          Need help? All versions can be accessed from the Version History panel.
        </p>
      </div>
    </div>
  );
}
