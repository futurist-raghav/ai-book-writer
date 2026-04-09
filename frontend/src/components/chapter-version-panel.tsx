/**
 * Chapter Version Management Panel
 * Main UI for viewing, comparing, and reverting chapter versions
 * Combines history sidebar, diff viewer, and revert modal
 */

'use client';

import { useState } from 'react';
import { ChapterVersionHistorySidebar } from '@/components/chapter-version-history';
import { ChapterVersionDiffViewer } from '@/components/chapter-version-diff-viewer';
import { RevertChapterConfirmationModal } from '@/components/revert-chapter-modal';

interface ChapterVersionManagementPanelProps {
  chapterId: string;
  chapterTitle?: string;
  currentWordCount?: number;
}

export function ChapterVersionManagementPanel({
  chapterId,
  chapterTitle,
  currentWordCount,
}: ChapterVersionManagementPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [comparisonVersionId, setComparisonVersionId] = useState<string | null>(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertVersionId, setRevertVersionId] = useState<string | null>(null);

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersionId(versionId);
    // Auto-select for comparison if not already set
    if (!comparisonVersionId) {
      setComparisonVersionId(versionId);
    }
  };

  const handleRevert = (versionId: string) => {
    setRevertVersionId(versionId);
    setShowRevertModal(true);
  };

  const handleRevertSuccess = () => {
    setSelectedVersionId(null);
    setComparisonVersionId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary font-body">Version History</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          {chapterTitle && <>for "<span className="font-semibold">{chapterTitle}</span>"</>}
        </p>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Version Sidebar */}
        <div className="lg:col-span-1">
          <ChapterVersionHistorySidebar
            chapterId={chapterId}
            onVersionSelect={handleVersionSelect}
            onRevert={handleRevert}
          />
        </div>

        {/* Right: Diff Viewer */}
        <div className="lg:col-span-2">
          {selectedVersionId && comparisonVersionId ? (
            <>
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <span className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">
                    Compare with current version
                  </span>
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setComparisonVersionId(null);
                      } else {
                        setComparisonVersionId(selectedVersionId);
                      }
                    }}
                    className="w-4 h-4 rounded border-input bg-background cursor-pointer"
                  />
                </label>
              </div>

              <ChapterVersionDiffViewer
                chapterId={chapterId}
                fromVersionId={selectedVersionId}
                toVersionId={comparisonVersionId}
              />

              {/* Quick Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => handleRevert(selectedVersionId)}
                  className="px-4 py-2.5 rounded-lg bg-secondary text-white font-label font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">history</span>
                  Revert to This Version
                </button>

                <button
                  onClick={() => {
                    setSelectedVersionId(null);
                    setComparisonVersionId(null);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label font-bold text-sm hover:bg-surface-container transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </>
          ) : (
            <div className="bg-surface-container-low rounded-xl p-12 text-center border border-outline-variant/10">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/20 block mb-4">
                history
              </span>
              <p className="text-sm text-on-surface-variant font-label mb-2">
                Select a version to view changes
              </p>
              <p className="text-xs text-on-surface-variant/60">
                Click on a version in the sidebar to compare it with the current version.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Revert Confirmation Modal */}
      {selectedVersionId && (
        <RevertChapterConfirmationModal
          isOpen={showRevertModal}
          chapterId={chapterId}
          versionId={revertVersionId || selectedVersionId}
          versionName={`Version from ${new Date().toLocaleDateString()}`}
          currentWordCount={currentWordCount}
          onClose={() => setShowRevertModal(false)}
          onRevertSuccess={handleRevertSuccess}
        />
      )}
    </div>
  );
}
