/**
 * Formatting Theme Selector Component
 * 
 * Browse preset themes, create custom themes, and apply to book.
 * Shows real-time preview of font/color selections.
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

interface ThemePreset {
  id: string
  slug: string
  display_name: string
  description: string | null
  category: string
  preview_image_url: string | null
  config: Record<string, any>
}

interface FormattingTheme {
  id: string
  name: string
  theme_type: string
  body_font_family: string
  text_color: string
  heading_color: string
  margin_top: string
}

interface BookThemesResponse {
  book_id: string
  custom_themes: FormattingTheme[]
  presets: ThemePreset[]
}

const THEME_COLORS: Record<string, string> = {
  novel: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
  academic: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20',
  screenplay: 'border-purple-300 bg-purple-50 dark:bg-purple-900/20',
  textbook: 'border-green-300 bg-green-50 dark:bg-green-900/20',
  poetry: 'border-pink-300 bg-pink-50 dark:bg-pink-900/20',
}

interface FormattingThemeSelectorProps {
  bookId: string
  currentThemeId?: string | null
}

export function FormattingThemeSelector({
  bookId,
  currentThemeId,
}: FormattingThemeSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [bodyFontFamily, setBodyFontFamily] = useState('Garamond')
  const [textColor, setTextColor] = useState('#000000')
  const queryClient = useQueryClient()

  // Fetch available themes
  const { data: themes, isLoading } = useQuery<BookThemesResponse>({
    queryKey: ['themes', bookId],
    queryFn: async () => {
      const response = await api.get(`/books/${bookId}/themes`)
      return response.data
    },
  })

  // Apply preset theme
  const { mutate: applyTheme } = useMutation({
    mutationFn: async (themeId: string) => {
      const response = await api.post(
        `/books/${bookId}/themes/${themeId}/apply`
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes', bookId] })
      setSelectedPreset(null)
    },
  })

  // Create custom theme
  const { mutate: createTheme } = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/books/${bookId}/themes`, {
        name: customName,
        theme_type: 'custom',
        body_font_family: bodyFontFamily,
        text_color: textColor,
        heading_color: textColor,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes', bookId] })
      setShowCreateForm(false)
      setCustomName('')
      setBodyFontFamily('Garamond')
      setTextColor('#000000')
    },
  })

  if (isLoading) {
    return <div className="text-gray-500">Loading themes...</div>
  }

  return (
    <div className="space-y-6">
      {/* Preset themes */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Preset Themes
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {themes?.presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                applyTheme(preset.id)
                setSelectedPreset(preset.id)
              }}
              className={`p-4 rounded-lg border-2 transition ${
                selectedPreset === preset.id
                  ? 'border-blue-500 ring-2 ring-blue-300'
                  : THEME_COLORS[preset.category] ||
                    'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">
                {preset.display_name}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {preset.category}
              </div>
              {selectedPreset === preset.id && (
                <div className="text-xs mt-2 text-green-600 dark:text-green-400 font-medium">
                  ✓ Selected
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom themes */}
      {themes?.custom_themes && themes.custom_themes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Custom Themes
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {themes.custom_themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className="p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-500 transition"
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">
                  {theme.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {theme.body_font_family}
                </div>
                <div
                  className="w-full h-4 rounded mt-2"
                  style={{
                    backgroundColor: theme.text_color,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create custom theme */}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 rounded bg-blue-500 text-white font-medium hover:bg-blue-600 transition"
        >
          + Create Custom Theme
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Create Custom Theme
          </h4>

          {/* Theme name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g., My Novel Style"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>

          {/* Font family */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Font Family
            </label>
            <select
              value={bodyFontFamily}
              onChange={(e) => setBodyFontFamily(e.target.value)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
            >
              <option value="Garamond">Garamond</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Arial">Arial</option>
            </select>
          </div>

          {/* Text color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Text Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="flex-1 px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white font-mono text-sm"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
            <p
              style={{
                fontFamily: bodyFontFamily,
                color: textColor,
              }}
              className="text-sm"
            >
              The quick brown fox jumps over the lazy dog
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => createTheme()}
              disabled={!customName}
              className="flex-1 px-4 py-2 rounded bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 transition"
            >
              Create Theme
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white font-medium hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FormattingThemeSelector
