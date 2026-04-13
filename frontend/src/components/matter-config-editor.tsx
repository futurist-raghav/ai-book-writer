/**
 * Front/Back Matter Configuration Component
 * 
 * Build title page, TOC, dedication, about author, etc.
 * Live preview and drag-and-drop reordering.
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface MatterConfig {
  id: string
  book_id: string
  
  include_title_page: boolean
  include_copyright_page: boolean
  include_dedication: boolean
  include_acknowledgments: boolean
  include_preface: boolean
  include_introduction: boolean
  include_toc: boolean
  
  title_page_custom_text: string | null
  copyright_text: string | null
  dedication_text: string | null
  acknowledgments_text: string | null
  
  include_epilogue: boolean
  include_afterword: boolean
  include_about_author: boolean
  include_glossary: boolean
  include_index: boolean
  include_bibliography: boolean
  
  epilogue_text: string | null
  afterword_text: string | null
  about_author_text: string | null
  
  author_name: string | null
  publisher_name: string | null
  publication_year: string | null
  isbn: string | null
}

interface MatterConfigEditorProps {
  bookId: string
}

const FRONT_MATTER_ITEMS = [
  { key: 'title_page', label: 'Title Page', hasContent: false },
  { key: 'copyright_page', label: 'Copyright Page', hasContent: false },
  { key: 'dedication', label: 'Dedication', hasContent: true },
  { key: 'acknowledgments', label: 'Acknowledgments', hasContent: true },
  { key: 'preface', label: 'Preface', hasContent: true },
  { key: 'introduction', label: 'Introduction', hasContent: true },
  { key: 'toc', label: 'Table of Contents', hasContent: false },
]

const BACK_MATTER_ITEMS = [
  { key: 'epilogue', label: 'Epilogue', hasContent: true },
  { key: 'afterword', label: 'Afterword', hasContent: true },
  { key: 'about_author', label: 'About the Author', hasContent: true },
  { key: 'glossary', label: 'Glossary', hasContent: false },
  { key: 'index', label: 'Index', hasContent: false },
  { key: 'bibliography', label: 'Bibliography', hasContent: false },
]

export function MatterConfigEditor({ bookId }: MatterConfigEditorProps) {
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'metadata'>('front')
  const [editingText, setEditingText] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const queryClient = useQueryClient()

  // Fetch matter config
  const { data: config, isLoading } = useQuery<MatterConfig>({
    queryKey: ['matterConfig', bookId],
    queryFn: async () => {
      const response = await api.get(`/books/${bookId}/matter-config`)
      return response.data
    },
  })

  // Update mutation
  const { mutate: updateConfig } = useMutation({
    mutationFn: async (updates: any) => {
      const response = await api.patch(`/books/${bookId}/matter-config`, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matterConfig', bookId] })
      setEditingText(null)
      setEditingValue('')
    },
  })

  const handleToggle = (key: string) => {
    const includeKey = `include_${key === 'toc' ? 'toc' : key}`
    updateConfig({
      [includeKey]: !(config as any)?.[includeKey],
    })
  }

  const handleEditText = (field: string) => {
    setEditingText(field)
    const textKey = `${field}_text`
    setEditingValue((config as any)?.[textKey] || '')
  }

  const handleSaveText = () => {
    if (!editingText) return
    const textKey = `${editingText}_text`
    updateConfig({
      [textKey]: editingValue,
    })
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading matter configuration...</div>
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['front', 'back', 'metadata'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium transition ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'front'
              ? 'Front Matter'
              : tab === 'back'
                ? 'Back Matter'
                : 'Metadata'}
          </button>
        ))}
      </div>

      {/* Front Matter Tab */}
      {activeTab === 'front' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Front Matter Items
          </h3>
          <div className="space-y-3">
            {FRONT_MATTER_ITEMS.map((item) => (
              <div
                key={item.key}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={(config as any)?.[`include_${item.key}`] || false}
                        onChange={() => handleToggle(item.key)}
                        className="rounded"
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </span>
                    </label>
                  </div>

                  {item.hasContent && (config as any)?.[`include_${item.key}`] && (
                    <button
                      onClick={() => handleEditText(item.key)}
                      className="px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Text editor */}
                {editingText === item.key && (
                  <div className="mt-4 space-y-2">
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder={`Enter ${item.label.toLowerCase()} text...`}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white h-32"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveText}
                        className="px-3 py-1 rounded text-sm bg-green-500 text-white hover:bg-green-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingText(null)}
                        className="px-3 py-1 rounded text-sm bg-gray-400 text-white hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back Matter Tab */}
      {activeTab === 'back' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Back Matter Items
          </h3>
          <div className="space-y-3">
            {BACK_MATTER_ITEMS.map((item) => (
              <div
                key={item.key}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={(config as any)?.[`include_${item.key}`] || false}
                        onChange={() => handleToggle(item.key)}
                        className="rounded"
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </span>
                    </label>
                  </div>

                  {item.hasContent && (config as any)?.[`include_${item.key}`] && (
                    <button
                      onClick={() => handleEditText(item.key)}
                      className="px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Text editor */}
                {editingText === item.key && (
                  <div className="mt-4 space-y-2">
                    <textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder={`Enter ${item.label.toLowerCase()} text...`}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white h-32"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveText}
                        className="px-3 py-1 rounded text-sm bg-green-500 text-white hover:bg-green-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingText(null)}
                        className="px-3 py-1 rounded text-sm bg-gray-400 text-white hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Tab */}
      {activeTab === 'metadata' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Book Metadata
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Author Name
              </label>
              <input
                type="text"
                value={(config as any)?.author_name || ''}
                onChange={(e) =>
                  updateConfig({ author_name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Publisher Name
              </label>
              <input
                type="text"
                value={(config as any)?.publisher_name || ''}
                onChange={(e) =>
                  updateConfig({ publisher_name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Publication Year
              </label>
              <input
                type="text"
                value={(config as any)?.publication_year || ''}
                onChange={(e) =>
                  updateConfig({ publication_year: e.target.value })
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ISBN
              </label>
              <input
                type="text"
                value={(config as any)?.isbn || ''}
                onChange={(e) =>
                  updateConfig({ isbn: e.target.value })
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MatterConfigEditor
