/**
 * Section Approval Workflow Component
 * 
 * Mark sections ready for review, approve/request changes.
 * Shows approval status with reviewer controls.
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

interface SectionApproval {
  id: string
  section_number: number
  status: string
  locked: boolean
  marked_ready_by: string | null
  marked_by_user: { name: string; email: string } | null
  reviewed_by: string | null
  reviewed_by_user: { name: string; email: string } | null
  review_notes: string | null
  marked_ready_at: string | null
  reviewed_at: string | null
}

interface ApprovalStatus {
  chapter_id: string
  total_sections: number
  approved_count: number
  ready_for_review_count: number
  changes_requested_count: number
  draft_count: number
  sections: SectionApproval[]
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  ready_for_review: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  changes_requested: 'bg-red-100 text-red-800 border-red-300',
}

const STATUS_ICONS: Record<string, string> = {
  draft: '📝',
  ready_for_review: '👀',
  approved: '✅',
  changes_requested: '⚠️',
}

interface ApprovalWorkflowProps {
  bookId: string
  chapterId: string
  isReviewer?: boolean
}

export function ApprovalWorkflow({ bookId, chapterId, isReviewer = false }: ApprovalWorkflowProps) {
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set())
  const [reviewNotes, setReviewNotes] = useState('')
  const queryClient = useQueryClient()

  // Fetch approval status
  const { data: status, isLoading } = useQuery<ApprovalStatus>({
    queryKey: ['approvalStatus', chapterId],
    queryFn: async () => {
      const response = await api.get(
        `/books/${bookId}/chapters/${chapterId}/approval-status`
      )
      return response.data
    },
  })

  // Mark section ready
  const { mutate: markReady } = useMutation({
    mutationFn: async (sectionNumber: number) => {
      const response = await api.post(
        `/books/${bookId}/chapters/${chapterId}/sections/${sectionNumber}/mark-ready`,
        { section_number: sectionNumber }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStatus', chapterId] })
    },
  })

  // Review section
  const { mutate: reviewSection } = useMutation({
    mutationFn: async ({
      sectionNumber,
      reviewStatus,
    }: {
      sectionNumber: number
      reviewStatus: string
    }) => {
      const response = await api.post(
        `/books/${bookId}/chapters/${chapterId}/sections/${sectionNumber}/review`,
        { status: reviewStatus, review_notes: reviewNotes }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStatus', chapterId] })
      setReviewNotes('')
    },
  })

  // Batch review
  const { mutate: batchReview } = useMutation({
    mutationFn: async (action: string) => {
      const response = await api.post(
        `/books/${bookId}/chapters/${chapterId}/sections/batch-review`,
        {
          section_numbers: Array.from(selectedSections),
          action,
          review_notes: reviewNotes,
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalStatus', chapterId] })
      setSelectedSections(new Set())
      setReviewNotes('')
    },
  })

  if (isLoading || !status) {
    return <div className="text-gray-500">Loading approval status...</div>
  }

  const completionPercentage =
    status.total_sections > 0
      ? Math.round((status.approved_count / status.total_sections) * 100)
      : 0

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header with progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Section Approval Status
          </h3>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            completionPercentage === 100
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }`}>
            {completionPercentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
          <div className="text-gray-600 dark:text-gray-400">Approved</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {status.approved_count}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
          <div className="text-gray-600 dark:text-gray-400">Ready for Review</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {status.ready_for_review_count}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
          <div className="text-gray-600 dark:text-gray-400">Changes Requested</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {status.changes_requested_count}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
          <div className="text-gray-600 dark:text-gray-400">Draft</div>
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {status.draft_count}
          </div>
        </div>
      </div>

      {/* Reviewer controls */}
      {isReviewer && selectedSections.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">
            Batch Review ({selectedSections.size} sections)
          </h4>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Add review notes..."
            className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-blue-300 dark:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => batchReview('approve')}
              className="px-4 py-2 rounded bg-green-500 text-white font-medium hover:bg-green-600 transition"
            >
              ✅ Approve All
            </button>
            <button
              onClick={() => batchReview('request_changes')}
              className="px-4 py-2 rounded bg-red-500 text-white font-medium hover:bg-red-600 transition"
            >
              ⚠️ Request Changes
            </button>
            <button
              onClick={() => setSelectedSections(new Set())}
              className="px-4 py-2 rounded bg-gray-400 text-white font-medium hover:bg-gray-500 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sections list */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 dark:text-white">Sections</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {status.sections.map((section) => (
            <div
              key={section.id}
              className={`p-3 rounded border flex items-center justify-between ${
                STATUS_COLORS[section.status] || 'bg-gray-100 border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selectedSections.has(section.section_number)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedSections)
                    if (e.target.checked) {
                      newSelected.add(section.section_number)
                    } else {
                      newSelected.delete(section.section_number)
                    }
                    setSelectedSections(newSelected)
                  }}
                  disabled={!isReviewer}
                  className="rounded cursor-pointer"
                />
                <span className="text-lg">
                  {STATUS_ICONS[section.status]}
                </span>
                <div className="flex-1">
                  <div className="font-medium">Section {section.section_number + 1}</div>
                  <div className="text-xs opacity-75">
                    {section.marked_by_user && (
                      <>Marked by {section.marked_by_user.name}</>
                    )}
                    {section.reviewed_by_user && (
                      <> • Reviewed by {section.reviewed_by_user.name}</>
                    )}
                  </div>
                  {section.review_notes && (
                    <div className="text-xs mt-1 italic opacity-75">
                      "{section.review_notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Lock indicator */}
              {section.locked && (
                <span className="text-lg">🔒</span>
              )}

              {/* Quick actions */}
              {isReviewer && section.status === 'ready_for_review' && (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      reviewSection({
                        sectionNumber: section.section_number,
                        reviewStatus: 'approved',
                      })
                    }
                    className="px-2 py-1 rounded text-xs bg-green-500 text-white hover:bg-green-600"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() =>
                      reviewSection({
                        sectionNumber: section.section_number,
                        reviewStatus: 'changes_requested',
                      })
                    }
                    className="px-2 py-1 rounded text-xs bg-red-500 text-white hover:bg-red-600"
                  >
                    ✗
                  </button>
                </div>
              )}

              {/* Mark ready button for writer */}
              {!isReviewer && section.status === 'draft' && (
                <button
                  onClick={() => markReady(section.section_number)}
                  className="px-3 py-1 rounded text-xs bg-blue-500 text-white hover:bg-blue-600"
                >
                  Mark Ready
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info box */}
      {status.approved_count === status.total_sections && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-green-900 dark:text-green-100 font-medium">
            ✅ All sections approved! This chapter is ready to publish.
          </div>
        </div>
      )}
    </div>
  )
}

export default ApprovalWorkflow
