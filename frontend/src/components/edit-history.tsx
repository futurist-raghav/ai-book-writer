/**
 * Chapter Edit History Timeline Component
 * 
 * Visual timeline of all edits with author attribution and filtering.
 * Shows who changed what, when, with ability to rollback to any version.
 */

'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import api from '@/lib/api'

interface HistoryEdit {
  id: string
  author: { name: string; email: string; id: string } | null
  author_id: string
  created_at: string
  edit_type: string
  change_description: string | null
  char_delta: number
  word_delta: number
  char_count_before: number
  char_count_after: number
  word_count_before: number
  word_count_after: number
  content_before: string | null
  content_after: string
}

interface HistoryTimeline {
  chapter_id: string
  total_edits: number
  editors: string[]
  edits: HistoryEdit[]
}

interface EditsByUserResponse {
  author_id: string
  author: { name: string; email: string; id: string } | null
  edit_count: number
  total_char_delta: number
  total_word_delta: number
  edits: HistoryEdit[]
}

const EDIT_TYPE_COLORS: Record<string, string> = {
  full_rewrite: 'bg-red-100 text-red-800 border-red-300',
  partial_edit: 'bg-blue-100 text-blue-800 border-blue-300',
  grammar_fix: 'bg-green-100 text-green-800 border-green-300',
  rollback: 'bg-orange-100 text-orange-800 border-orange-300',
  suggestion_accepted: 'bg-purple-100 text-purple-800 border-purple-300',
}

const EDIT_TYPE_ICONS: Record<string, string> = {
  full_rewrite: '📝',
  partial_edit: '✏️',
  grammar_fix: '🔤',
  rollback: '⏮️',
  suggestion_accepted: '✅',
}

interface EditHistoryProps {
  bookId: string
  chapterId: string
}

export function EditHistory({ bookId, chapterId }: EditHistoryProps) {
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Fetch edit history
  const { data: history, isLoading } = useQuery<HistoryTimeline>({
    queryKey: ['editHistory', chapterId],
    queryFn: async () => {
      const response = await api.get(
        `/books/${bookId}/chapters/${chapterId}/edit-history?limit=50`
      )
      return response.data
    },
  })

  // Fetch edits by specific user
  const { data: userEdits } = useQuery<EditsByUserResponse | null>({
    queryKey: ['editsByUser', chapterId, selectedAuthor],
    queryFn: async () => {
      if (!selectedAuthor) return null
      const response = await api.get(
        `/books/${bookId}/chapters/${chapterId}/edit-history/by-user/${selectedAuthor}`
      )
      return response.data
    },
    enabled: !!selectedAuthor,
  })

  // Rollback mutation
  const { mutate: rollback, isPending: isRollingBack } = useMutation({
    mutationFn: async (editId: string) => {
      const response = await api.post(
        `/books/${bookId}/chapters/${chapterId}/edits/${editId}/rollback`
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editHistory', chapterId] })
      queryClient.invalidateQueries({ queryKey: ['chapter', chapterId] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading edit history...</div>
      </div>
    )
  }

  if (!history || history.total_edits === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">No edit history yet</div>
      </div>
    )
  }

  const displayEdits = selectedAuthor && userEdits ? userEdits.edits : history.edits
  const uniqueAuthors = selectedAuthor && userEdits ? [userEdits] : history.editors

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Edit History ({history.total_edits} edits)
        </h3>
        <button
          onClick={() => setSelectedAuthor(null)}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            selectedAuthor
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          All Edits
        </button>
      </div>

      {/* Author filter */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">
          Authors:
        </span>
        {history.editors.map((authorId) => (
          <button
            key={authorId}
            onClick={() => setSelectedAuthor(authorId)}
            className={`px-3 py-2 rounded text-sm font-medium transition ${
              selectedAuthor === authorId
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {history.edits.find((e) => e.author_id === authorId)?.author?.email ||
              'Unknown'}
          </button>
        ))}
      </div>

      {/* User summary */}
      {selectedAuthor && userEdits && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Edits</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {userEdits.edit_count}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Characters</div>
              <div className={`text-2xl font-bold ${userEdits.total_char_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {userEdits.total_char_delta >= 0 ? '+' : ''}{userEdits.total_char_delta}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Words</div>
              <div className={`text-2xl font-bold ${userEdits.total_word_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {userEdits.total_word_delta >= 0 ? '+' : ''}{userEdits.total_word_delta}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {displayEdits.map((edit, index) => (
          <div key={edit.id} className="flex gap-4">
            {/* Timeline dot */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 dark:bg-blue-400 border-2 border-white dark:border-gray-900" />
              {index < displayEdits.length - 1 && (
                <div className="w-0.5 h-12 bg-gray-300 dark:bg-gray-600" />
              )}
            </div>

            {/* Edit details */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Author and timestamp */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {edit.author?.name || 'Unknown'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(edit.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Edit type badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${
                        EDIT_TYPE_COLORS[edit.edit_type] ||
                        'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {EDIT_TYPE_ICONS[edit.edit_type] || '📄'} {edit.edit_type}
                    </span>
                  </div>

                  {/* Change description */}
                  {edit.change_description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {edit.change_description}
                    </p>
                  )}

                  {/* Statistics */}
                  <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <span>
                      Chars:{' '}
                      <span
                        className={
                          edit.char_delta >= 0
                            ? 'text-green-600 dark:text-green-400 font-medium'
                            : 'text-red-600 dark:text-red-400 font-medium'
                        }
                      >
                        {edit.char_delta >= 0 ? '+' : ''}{edit.char_delta}
                      </span>{' '}
                      ({edit.char_count_before} → {edit.char_count_after})
                    </span>
                    <span>
                      Words:{' '}
                      <span
                        className={
                          edit.word_delta >= 0
                            ? 'text-green-600 dark:text-green-400 font-medium'
                            : 'text-red-600 dark:text-red-400 font-medium'
                        }
                      >
                        {edit.word_delta >= 0 ? '+' : ''}{edit.word_delta}
                      </span>{' '}
                      ({edit.word_count_before} → {edit.word_count_after})
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setShowDiff(showDiff === edit.id ? null : edit.id)
                    }
                    className="px-3 py-2 rounded text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    {showDiff === edit.id ? 'Hide' : 'Show'} Diff
                  </button>
                  {edit.edit_type !== 'rollback' && (
                    <button
                      onClick={() => rollback(edit.id)}
                      disabled={isRollingBack}
                      className="px-3 py-2 rounded text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition"
                    >
                      {isRollingBack ? 'Rolling back...' : 'Rollback'}
                    </button>
                  )}
                </div>
              </div>

              {/* Diff viewer */}
              {showDiff === edit.id && (
                <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 space-y-2">
                  {edit.content_before && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        Before:
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto font-mono text-xs">
                        {edit.content_before}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                      After:
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto font-mono text-xs">
                      {edit.content_after}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default EditHistory
