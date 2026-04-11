/**
 * Editor Dashboard Component
 * 
 * Complete overview: chapters, pending reviews, suggestions, approvals.
 * Batch operations for reviewer workflow.
 */

'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import api from '@/lib/api'

interface ChapterStatus {
  id: string
  title: string
  status: string
  word_count: number
  char_count: number
  comments_count: number
  suggestions_count: number
  approved_sections: number
  total_sections: number
  last_edited: string
  last_editor: { name: string; email: string } | null
  approval_percentage: number
}

interface EditorDashboardProps {
  bookId: string
  isOwner: boolean
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  in_progress: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900',
  in_review: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900',
  approved: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900',
}

const SORT_OPTIONS = [
  { label: 'Last Edited', value: 'last_edited' },
  { label: 'Approval %', value: 'approval_percentage' },
  { label: 'Pending Items', value: 'pending_items' },
  { label: 'Title', value: 'title' },
]

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Has Comments', value: 'has_comments' },
  { label: 'Has Suggestions', value: 'has_suggestions' },
  { label: 'Needs Approval', value: 'needs_approval' },
]

export function EditorDashboard({ bookId, isOwner }: EditorDashboardProps) {
  const [sortBy, setSortBy] = useState('last_edited')
  const [filterBy, setFilterBy] = useState('all')
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  // Fetch all chapters with their status
  const { data: chapters, isLoading } = useQuery<ChapterStatus[]>({
    queryKey: ['editorDashboard', bookId],
    queryFn: async () => {
      // This would fetch from a comprehensive endpoint that returns all status info
      const response = await api.get(`/books/${bookId}/chapters?include=status,comments,suggestions,approvals`)
      return response.data.chapters || []
    },
  })

  // Batch approve mutation
  const { mutate: batchApprove } = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/books/${bookId}/batch-approve-chapters`, {
        chapter_ids: Array.from(selectedChapters),
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editorDashboard', bookId] })
      setSelectedChapters(new Set())
    },
  })

  // Filter chapters
  const filteredChapters = useMemo(() => {
    if (!chapters) return []

    return chapters.filter((ch) => {
      switch (filterBy) {
        case 'has_comments':
          return ch.comments_count > 0
        case 'has_suggestions':
          return ch.suggestions_count > 0
        case 'needs_approval':
          return ch.approval_percentage < 100
        case 'draft':
        case 'in_progress':
        case 'in_review':
        case 'approved':
          return ch.status === filterBy
        default:
          return true
      }
    })
  }, [chapters, filterBy])

  // Sort chapters
  const sortedChapters = useMemo(() => {
    const sorted = [...filteredChapters]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'last_edited':
          return new Date(b.last_edited).getTime() - new Date(a.last_edited).getTime()
        case 'approval_percentage':
          return b.approval_percentage - a.approval_percentage
        case 'pending_items':
          const pendingA = a.comments_count + a.suggestions_count
          const pendingB = b.comments_count + b.suggestions_count
          return pendingB - pendingA
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })
    return sorted
  }, [filteredChapters, sortBy])

  // Calculate stats
  const stats = useMemo(() => {
    if (!chapters) return { total: 0, approved: 0, pending_items: 0, avg_approval: 0 }
    return {
      total: chapters.length,
      approved: chapters.filter((c) => c.approval_percentage === 100).length,
      pending_items: chapters.reduce((sum, c) => sum + c.comments_count + c.suggestions_count, 0),
      avg_approval:
        chapters.length > 0
          ? Math.round(
              chapters.reduce((sum, c) => sum + c.approval_percentage, 0) /
                chapters.length
            )
          : 0,
    }
  }, [chapters])

  if (isLoading) {
    return <div className="text-gray-500">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Chapters</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Fully Approved</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.approved}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Items</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.pending_items}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Approval</div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.avg_approval}%</div>
        </div>
      </div>

      {/* Batch operations */}
      {isOwner && selectedChapters.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-blue-900 dark:text-blue-100">
              {selectedChapters.size} chapters selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => batchApprove()}
                className="px-4 py-2 rounded bg-green-500 text-white font-medium hover:bg-green-600 transition"
              >
                ✅ Approve All
              </button>
              <button
                onClick={() => setSelectedChapters(new Set())}
                className="px-4 py-2 rounded bg-gray-400 text-white font-medium hover:bg-gray-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chapters table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {isOwner && (
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChapters(new Set(sortedChapters.map((ch) => ch.id)))
                        } else {
                          setSelectedChapters(new Set())
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Chapter
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Words
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Comments
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Suggestions
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Approval
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Last Edited
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedChapters.map((chapter) => (
                <tr
                  key={chapter.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  {isOwner && (
                    <td className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedChapters.has(chapter.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedChapters)
                          if (e.target.checked) {
                            newSelected.add(chapter.id)
                          } else {
                            newSelected.delete(chapter.id)
                          }
                          setSelectedChapters(newSelected)
                        }}
                        className="rounded"
                      />
                    </td>
                  )}
                  <td className="px-6 py-3">
                    <Link
                      href={`/workspace/${bookId}/chapter/${chapter.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {chapter.title}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[chapter.status] ||
                        'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      {chapter.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    {chapter.word_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-center text-sm">
                    {chapter.comments_count > 0 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                        {chapter.comments_count}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center text-sm">
                    {chapter.suggestions_count > 0 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs font-bold">
                        {chapter.suggestions_count}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            chapter.approval_percentage === 100
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${chapter.approval_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8">
                        {chapter.approval_percentage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      {formatDistanceToNow(new Date(chapter.last_edited), { addSuffix: true })}
                    </div>
                    {chapter.last_editor && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        by {chapter.last_editor.name}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedChapters.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No chapters found
          </div>
        )}
      </div>
    </div>
  )
}

export default EditorDashboard
